/**
 * The TypeScript port must reproduce the Python toolkit. Fixtures come from
 * scripts/generate_parity_fixtures.py and are regenerated in CI.
 */
import { describe, expect, it } from 'vitest';
import fixtures from './fixtures/parity.json';
import {
  Bond,
  BondPortfolio,
  CurveDeformer,
  FedWatch,
  PortfolioRiskCalculator,
  RiskCalculator,
  YieldCurve,
  pathFromMoves,
  policyCurveShift,
  priceChangeEstimate,
  termPremiumLoading,
  type Interpolation,
  type RiskMetrics,
  type Scenario
} from '../src/lib/core';

const { inputs } = fixtures;
const TOLERANCE = 1e-9;

function close(actual: number[], expected: number[], tolerance = TOLERANCE) {
  expect(actual.length).toBe(expected.length);
  actual.forEach((a, i) => {
    const scale = Math.max(1, Math.abs(expected[i]));
    expect(Math.abs(a - expected[i]) / scale, `index ${i}: ${a} vs ${expected[i]}`).toBeLessThan(tolerance);
  });
}

const metricVector = (m: RiskMetrics) => [
  m.macaulayDuration,
  m.modifiedDuration,
  m.effectiveDuration,
  m.dv01,
  m.convexity,
  m.effectiveConvexity
];

function buildCurves(interpolation: Interpolation): Record<string, YieldCurve> {
  return {
    readme: new YieldCurve(inputs.readme.tenors, inputs.readme.rates, interpolation),
    treasury: YieldCurve.fromParYields(inputs.treasury.tenors, inputs.treasury.par, 2, interpolation),
    ecb: new YieldCurve(inputs.ecb.tenors, inputs.ecb.rates, interpolation)
  };
}

for (const interpolation of ['cubic_spline', 'pchip', 'linear'] as const) {
  describe(`${interpolation} curves`, () => {
    const curves = buildCurves(interpolation);
    for (const [name, curve] of Object.entries(curves)) {
      const expected = (fixtures.curves as any)[interpolation][name];

      describe(name, () => {
        it('nodes, interpolation, discounting and forwards', () => {
          close(curve.rates, expected.rates);
          close(inputs.sampleTenors.map((t) => curve.rateAt(t)), expected.rateAt);
          close(inputs.sampleTenors.map((t) => curve.discountFactor(t)), expected.discountFactor);
          close(inputs.sampleTenors.map((t) => curve.forwardRate(t, t + 1.5)), expected.forward);
          close(inputs.sampleTenors.map((t) => curve.instantaneousForward(t)), expected.instantaneousForward, 1e-6);
          close(inputs.parMaturities.map((m) => curve.parRate(m)), expected.parRate);
          close([curve.slope(), curve.curvature()], [expected.slope, expected.curvature]);
        });

        it('every deformation', () => {
          const results = new CurveDeformer(curve).scenarioAnalysis(inputs.scenarios as Scenario[]);
          results.forEach((r, i) => {
            const e = expected.deformations[i];
            expect(r.deformationType).toBe(e.type);
            close(r.rateChanges, e.rateChanges);
            close([r.slopeChange, r.curvatureChange], [e.slopeChange, e.curvatureChange]);
          });
        });

        it('bond pricing and risk metrics', () => {
          const calc = new RiskCalculator(curve);
          const results = calc.deformer.scenarioAnalysis(inputs.scenarios as Scenario[]);
          inputs.bonds.forEach((spec, i) => {
            const e = expected.bonds[i];
            const bond = new Bond(spec.face, spec.coupon, spec.maturity, spec.frequency);
            const price = bond.price(curve);
            const metrics = calc.calculateMetrics(bond);
            close([price, bond.yieldToMaturity(price), bond.currentYield(price)], [e.price, e.ytm, e.currentYield]);
            close(metricVector(metrics), e.metrics, 1e-8);
            close([-100, -25, 50].map((b) => priceChangeEstimate(metrics, b)), e.priceChangeEstimate, 1e-8);
            const krd = calc.keyRateDurations(bond);
            close(krd.tenors, e.krdTenors);
            close(krd.durations, e.krd, 1e-7);
            close(calc.partialDurations(bond).map((p) => p.duration), e.partial, 1e-7);
            close(
              [
                [0.95, 1],
                [0.99, 10],
                [0.975, 5]
              ].map(([c, d]) => calc.valueAtRisk(bond, 80, c, d)),
              e.var,
              1e-8
            );
            close(
              [
                [0.95, 1],
                [0.99, 10]
              ].map(([c, d]) => calc.expectedShortfall(bond, 80, c, d)),
              e.es,
              1e-8
            );
            calc.scenarioAnalysis(bond, results).forEach((r, j) => {
              close(
                [r.priceChange, r.priceChangePct, r.durationContribution, r.convexityContribution],
                e.scenarios[j],
                1e-8
              );
            });
          });
        });

        it('portfolio analytics', () => {
          const portfolio = new BondPortfolio();
          inputs.bonds.slice(0, 4).forEach((spec, i) => {
            portfolio.addPosition(new Bond(spec.face, spec.coupon, spec.maturity, spec.frequency), [100, 200, 150, 50][i]);
          });
          const port = new PortfolioRiskCalculator(curve, portfolio);
          const e = expected.portfolio;
          close([portfolio.totalValue(curve), portfolio.weightedAverageMaturity()], [e.value, e.wam]);
          close(metricVector(port.portfolioMetrics()), e.metrics, 1e-8);
          close(port.portfolioKeyRateDurations().durations, e.krd, 1e-7);
          close(
            port.contributionToDuration().flatMap((c) => [c.contribution, c.contributionPct]),
            e.contribution.flat(),
            1e-8
          );
          const pnl = port.scenarioPnl(new CurveDeformer(curve).steepening(50));
          close([pnl.totalPnl, pnl.totalPnlPct, ...pnl.positions.map((p) => p.pnl)], e.steepeningPnl, 1e-8);
        });
      });
    }
  });
}

describe('FedWatch and policy transmission', () => {
  const f = inputs.fedwatch;
  const fw = new FedWatch(
    f.calendar,
    f.futures.map(([year, month, price]) => ({ year, month, price })),
    f.targetLower,
    f.targetUpper,
    f.asOf,
    f.effr
  );
  const expected = fixtures.fedwatch;

  it('expected rate path and probability tree', () => {
    expect(fw.meetings).toEqual(expected.meetings);
    close(fw.rates, expected.rates, 1e-12);
    fw.outlooks.forEach((o, i) => {
      const e = expected.outlooks[i];
      const asObject = (m: Map<number, number>) => Object.fromEntries([...m].map(([k, v]) => [String(k), v]));
      expect(Object.keys(asObject(o.moveProbabilities))).toEqual(Object.keys(e.move));
      close(Object.values(asObject(o.moveProbabilities)), Object.values(e.move), 1e-10);
      expect(Object.keys(asObject(o.probabilities))).toEqual(Object.keys(e.probabilities));
      close(Object.values(asObject(o.probabilities)), Object.values(e.probabilities), 1e-10);
      expect(o.mostLikelyChangeBps).toBe(e.mostLikely);
    });
  });

  it('policy surprise shifts', () => {
    const market = fw.impliedPolicyPath();
    const zeros = market.meetings.map(() => 0);
    const hold = pathFromMoves(market.asOf, market.startRate, market.meetings, zeros);
    const cuts = pathFromMoves(
      market.asOf,
      market.startRate,
      market.meetings,
      market.meetings.map((_, i) => (i % 2 === 0 ? -25 : 0))
    );
    const tenors = inputs.treasury.tenors;
    const e = expected.policy;
    close(termPremiumLoading(tenors), e.termPremiumLoading, 1e-12);
    close(policyCurveShift(tenors, hold, market), e.hold, 1e-9);
    close(policyCurveShift(tenors, hold, market, null), e.holdPermanent, 1e-9);
    close(policyCurveShift(tenors, cuts, market, 0.75, 15), e.cutsWithTermPremium, 1e-9);
  });
});
