import type { Bond, BondPortfolio } from './bond';
import { YieldCurve } from './curve';
import { CurveDeformer, type DeformationResult } from './deformations';
import { normPdf, normPpf } from './numeric';

export const DEFAULT_SHOCK_BPS = 1;
export const DEFAULT_KEY_TENORS = [0.5, 1, 2, 3, 5, 7, 10, 20, 30];

export interface RiskMetrics {
  macaulayDuration: number;
  modifiedDuration: number;
  effectiveDuration: number;
  dv01: number;
  convexity: number;
  effectiveConvexity: number;
}

/** Duration + convexity estimate of the % price change for a parallel yield move. */
export function priceChangeEstimate(m: RiskMetrics, yieldChangeBps: number): number {
  const dy = yieldChangeBps / 10000;
  return (-m.modifiedDuration * dy + 0.5 * m.convexity * dy ** 2) * 100;
}

export interface KeyRateDurations {
  tenors: number[];
  durations: number[];
}

export interface ScenarioRisk {
  scenarioName: string;
  priceChange: number;
  priceChangePct: number;
  durationContribution: number;
  convexityContribution: number;
}

/** Port of `yield_curve.risk_metrics.RiskCalculator`. */
export class RiskCalculator {
  readonly deformer: CurveDeformer;

  constructor(readonly curve: YieldCurve) {
    this.deformer = new CurveDeformer(curve);
  }

  calculateMetrics(bond: Bond): RiskMetrics {
    const base = bond.price(this.curve);
    const macaulay = this.macaulayDuration(bond, base);
    const ytm = bond.yieldToMaturity(base);
    return {
      macaulayDuration: macaulay,
      modifiedDuration: macaulay / (1 + ytm / 100 / bond.frequency),
      effectiveDuration: this.effectiveDuration(bond, base),
      dv01: this.dv01(bond, base),
      convexity: this.convexity(bond, base, ytm),
      effectiveConvexity: this.effectiveConvexity(bond, base)
    };
  }

  private macaulayDuration(bond: Bond, base: number): number {
    if (base === 0) return 0;
    let weighted = 0;
    for (const cf of bond.cashFlows) weighted += cf.time * cf.amount * this.curve.discountFactor(cf.time);
    return weighted / base;
  }

  private effectiveDuration(bond: Bond, base: number, shock = DEFAULT_SHOCK_BPS): number {
    const up = bond.price(this.curve.shift(shock));
    const down = bond.price(this.curve.shift(-shock));
    return (down - up) / (base * ((2 * shock) / 10000));
  }

  private dv01(bond: Bond, base: number, shock = DEFAULT_SHOCK_BPS): number {
    return (base - bond.price(this.curve.shift(shock))) / shock;
  }

  private convexity(bond: Bond, base: number, ytm: number): number {
    if (base === 0) return 0;
    let weighted = 0;
    for (const cf of bond.cashFlows) {
      weighted += cf.time * (cf.time + 1 / bond.frequency) * cf.amount * this.curve.discountFactor(cf.time);
    }
    return weighted / (base * (1 + ytm / 100 / bond.frequency) ** 2);
  }

  private effectiveConvexity(bond: Bond, base: number, shock = DEFAULT_SHOCK_BPS): number {
    const up = bond.price(this.curve.shift(shock));
    const down = bond.price(this.curve.shift(-shock));
    const dy = shock / 10000;
    return (up + down - 2 * base) / (base * dy * dy);
  }

  keyRateDurations(bond: Bond, keyTenors: readonly number[] = DEFAULT_KEY_TENORS, shock = DEFAULT_SHOCK_BPS): KeyRateDurations {
    const tenors = keyTenors.filter((t) => t <= bond.maturity * 1.5);
    const base = bond.price(this.curve);
    const durations = tenors.map((key) => {
      const up = bond.price(this.shockKeyRate(key, shock));
      const down = bond.price(this.shockKeyRate(key, -shock));
      return (down - up) / (base * ((2 * shock) / 10000));
    });
    return { tenors, durations };
  }

  shockKeyRate(keyTenor: number, shockBps: number, width = 2.0): YieldCurve {
    return this.curve.withRates(
      this.curve.rates.map((r, i) => {
        const distance = Math.abs(this.curve.tenors[i] - keyTenor);
        return distance <= width ? r + (shockBps / 100) * (1 - distance / width) : r;
      })
    );
  }

  partialDurations(bond: Bond, shock = DEFAULT_SHOCK_BPS): { tenor: number; duration: number }[] {
    const base = bond.price(this.curve);
    return this.curve.tenors.map((tenor, i) => {
      const bump = (bps: number) => this.curve.withRates(this.curve.rates.map((r, j) => (j === i ? r + bps / 100 : r)));
      const up = bond.price(bump(shock));
      const down = bond.price(bump(-shock));
      return { tenor, duration: (down - up) / (base * ((2 * shock) / 10000)) };
    });
  }

  scenarioAnalysis(bond: Bond, results: readonly DeformationResult[]): ScenarioRisk[] {
    const base = bond.price(this.curve);
    const metrics = this.calculateMetrics(bond);
    return results.map((result) => {
      const change = bond.price(result.deformedCurve) - base;
      const avgChange = (result.rateChanges.reduce((s, x) => s + x, 0) / result.rateChanges.length) * 100;
      return {
        scenarioName: result.deformationType,
        priceChange: change,
        priceChangePct: (change / base) * 100,
        durationContribution: ((-metrics.modifiedDuration * avgChange) / 100) * 100,
        convexityContribution: 0.5 * metrics.convexity * (avgChange / 100) ** 2 * 100
      };
    });
  }

  valueAtRisk(bond: Bond, yieldVolatilityBps: number, confidence = 0.95, holdingDays = 1): number {
    const base = bond.price(this.curve);
    const scaledVol = yieldVolatilityBps * Math.sqrt(holdingDays / 252);
    return ((base * this.calculateMetrics(bond).modifiedDuration * scaledVol) / 10000) * normPpf(confidence);
  }

  expectedShortfall(bond: Bond, yieldVolatilityBps: number, confidence = 0.95, holdingDays = 1): number {
    const base = bond.price(this.curve);
    const multiplier = normPdf(normPpf(confidence)) / (1 - confidence);
    const scaledVol = yieldVolatilityBps * Math.sqrt(holdingDays / 252);
    return ((base * this.calculateMetrics(bond).modifiedDuration * scaledVol) / 10000) * multiplier;
  }
}

/** Port of `yield_curve.risk_metrics.PortfolioRiskCalculator`. */
export class PortfolioRiskCalculator {
  readonly single: RiskCalculator;

  constructor(readonly curve: YieldCurve, readonly portfolio: BondPortfolio) {
    this.single = new RiskCalculator(curve);
  }

  private weighted<T>(fn: (bond: Bond, quantity: number, weight: number) => T): T[] {
    const total = this.portfolio.totalValue(this.curve);
    return this.portfolio.positions.map(({ bond, quantity }) =>
      fn(bond, quantity, (bond.price(this.curve) * quantity) / total)
    );
  }

  portfolioMetrics(): RiskMetrics {
    const out: RiskMetrics = {
      macaulayDuration: 0,
      modifiedDuration: 0,
      effectiveDuration: 0,
      dv01: 0,
      convexity: 0,
      effectiveConvexity: 0
    };
    if (this.portfolio.totalValue(this.curve) === 0) return out;
    this.weighted((bond, quantity, weight) => {
      const m = this.single.calculateMetrics(bond);
      out.macaulayDuration += weight * m.macaulayDuration;
      out.modifiedDuration += weight * m.modifiedDuration;
      out.effectiveDuration += weight * m.effectiveDuration;
      out.dv01 += m.dv01 * quantity;
      out.convexity += weight * m.convexity;
      out.effectiveConvexity += weight * m.effectiveConvexity;
    });
    return out;
  }

  portfolioKeyRateDurations(keyTenors: readonly number[] = DEFAULT_KEY_TENORS): KeyRateDurations {
    const durations = keyTenors.map(() => 0);
    if (this.portfolio.totalValue(this.curve) === 0) return { tenors: [...keyTenors], durations };
    this.weighted((bond, _quantity, weight) => {
      this.single.keyRateDurations(bond, keyTenors).durations.forEach((krd, i) => (durations[i] += weight * krd));
    });
    return { tenors: [...keyTenors], durations };
  }

  contributionToDuration(): { bond: Bond; contribution: number; contributionPct: number }[] {
    const total = this.portfolioMetrics().modifiedDuration;
    return this.weighted((bond, _quantity, weight) => {
      const contribution = weight * this.single.calculateMetrics(bond).modifiedDuration;
      return { bond, contribution, contributionPct: total !== 0 ? (contribution / total) * 100 : 0 };
    });
  }

  scenarioPnl(result: DeformationResult): { totalPnl: number; totalPnlPct: number; positions: { bond: Bond; pnl: number }[] } {
    const base = this.portfolio.totalValue(this.curve);
    const totalPnl = this.portfolio.totalValue(result.deformedCurve) - base;
    return {
      totalPnl,
      totalPnlPct: base !== 0 ? (totalPnl / base) * 100 : 0,
      positions: this.portfolio.positions.map(({ bond, quantity }) => ({
        bond,
        pnl: (bond.price(result.deformedCurve) - bond.price(this.curve)) * quantity
      }))
    };
  }
}
