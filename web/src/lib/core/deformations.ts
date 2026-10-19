import { YieldCurve } from './curve';
import { interp } from './numeric';
import { policyCurveShift, type PolicyPath } from './policy';

export type DeformationType =
  | 'parallel_shift'
  | 'steepening'
  | 'flattening'
  | 'twist'
  | 'butterfly'
  | 'bear_steepener'
  | 'bull_steepener'
  | 'bear_flattener'
  | 'bull_flattener'
  | 'custom'
  | 'pca'
  | 'policy';

export interface DeformationResult {
  originalCurve: YieldCurve;
  deformedCurve: YieldCurve;
  deformationType: DeformationType;
  parameters: Record<string, unknown>;
  /** Change per curve node in percentage points (x100 for bps). */
  rateChanges: number[];
  slopeChange: number;
  curvatureChange: number;
}

const clip01 = (x: number) => Math.min(1, Math.max(0, x));

/** Port of `yield_curve.deformations.CurveDeformer`. All shifts are in bps. */
export class CurveDeformer {
  constructor(readonly baseCurve: YieldCurve) {}

  private apply(
    shifts: readonly number[],
    deformationType: DeformationType,
    parameters: Record<string, unknown>
  ): DeformationResult {
    const base = this.baseCurve;
    const newRates = base.rates.map((r, i) => r + shifts[i]);
    const deformed = base.withRates(newRates);
    return {
      originalCurve: base,
      deformedCurve: deformed,
      deformationType,
      parameters,
      rateChanges: newRates.map((r, i) => r - base.rates[i]),
      slopeChange: deformed.slope() - base.slope(),
      curvatureChange: deformed.curvature() - base.curvature()
    };
  }

  private get tenors() {
    return this.baseCurve.tenors;
  }

  parallelShift(shiftBps: number): DeformationResult {
    return this.apply(this.tenors.map(() => shiftBps / 100), 'parallel_shift', { shift_bps: shiftBps });
  }

  private tiltShifts(magnitudeBps: number, pivot: number, short: number, long: number, steepen: boolean) {
    const sign = steepen ? 1 : -1;
    return this.tenors.map((t) =>
      t <= pivot
        ? ((-sign * magnitudeBps) / 100) * clip01((pivot - t) / (pivot - short))
        : ((sign * magnitudeBps) / 100) * clip01((t - pivot) / (long - pivot))
    );
  }

  steepening(magnitudeBps: number, pivotTenor = 5.0, shortTenor = 2.0, longTenor = 10.0): DeformationResult {
    return this.apply(this.tiltShifts(magnitudeBps, pivotTenor, shortTenor, longTenor, true), 'steepening', {
      magnitude_bps: magnitudeBps,
      pivot_tenor: pivotTenor,
      short_tenor: shortTenor,
      long_tenor: longTenor
    });
  }

  flattening(magnitudeBps: number, pivotTenor = 5.0, shortTenor = 2.0, longTenor = 10.0): DeformationResult {
    return this.apply(this.tiltShifts(magnitudeBps, pivotTenor, shortTenor, longTenor, false), 'flattening', {
      magnitude_bps: magnitudeBps,
      pivot_tenor: pivotTenor,
      short_tenor: shortTenor,
      long_tenor: longTenor
    });
  }

  twist(shortShiftBps: number, longShiftBps: number, pivotTenor = 5.0): DeformationResult {
    const last = this.tenors[this.tenors.length - 1];
    const shifts = this.tenors.map((t) =>
      t <= pivotTenor
        ? (shortShiftBps * (1 - t / pivotTenor)) / 100
        : (longShiftBps * ((t - pivotTenor) / (last - pivotTenor))) / 100
    );
    return this.apply(shifts, 'twist', {
      short_shift_bps: shortShiftBps,
      long_shift_bps: longShiftBps,
      pivot_tenor: pivotTenor
    });
  }

  butterfly(
    wingsShiftBps: number,
    bodyShiftBps: number,
    shortTenor = 2.0,
    midTenor = 5.0,
    longTenor = 10.0
  ): DeformationResult {
    const shifts = this.tenors.map((t) => {
      if (t <= shortTenor) {
        const weight = shortTenor > 0 ? 1 - (shortTenor - t) / shortTenor : 1;
        return (wingsShiftBps / 100) * weight;
      }
      if (t <= midTenor) {
        const progress = (t - shortTenor) / (midTenor - shortTenor);
        return (wingsShiftBps + (bodyShiftBps - wingsShiftBps) * progress) / 100;
      }
      if (t <= longTenor) {
        const progress = (t - midTenor) / (longTenor - midTenor);
        return (bodyShiftBps + (wingsShiftBps - bodyShiftBps) * progress) / 100;
      }
      return (wingsShiftBps / 100) * Math.exp(-(t - longTenor) / 5);
    });
    return this.apply(shifts, 'butterfly', {
      wings_shift_bps: wingsShiftBps,
      body_shift_bps: bodyShiftBps,
      short_tenor: shortTenor,
      mid_tenor: midTenor,
      long_tenor: longTenor
    });
  }

  positiveButterfly(magnitudeBps = 25): DeformationResult {
    return this.butterfly(magnitudeBps, -magnitudeBps);
  }

  negativeButterfly(magnitudeBps = 25): DeformationResult {
    return this.butterfly(-magnitudeBps, magnitudeBps);
  }

  private longEnd(shiftBps: number, pivot: number) {
    const last = this.tenors[this.tenors.length - 1];
    return this.tenors.map((t) => (t >= pivot ? (shiftBps / 100) * ((t - pivot) / (last - pivot)) : 0));
  }

  private shortEnd(shiftBps: number, pivot: number) {
    return this.tenors.map((t) => (t <= pivot ? (shiftBps / 100) * ((pivot - t) / pivot) : 0));
  }

  bearSteepener(longEndShiftBps: number, pivotTenor = 5.0): DeformationResult {
    return this.apply(this.longEnd(longEndShiftBps, pivotTenor), 'bear_steepener', {
      long_end_shift_bps: longEndShiftBps,
      pivot_tenor: pivotTenor
    });
  }

  bullSteepener(shortEndShiftBps: number, pivotTenor = 5.0): DeformationResult {
    return this.apply(this.shortEnd(-Math.abs(shortEndShiftBps), pivotTenor), 'bull_steepener', {
      short_end_shift_bps: shortEndShiftBps,
      pivot_tenor: pivotTenor
    });
  }

  bearFlattener(shortEndShiftBps: number, pivotTenor = 5.0): DeformationResult {
    return this.apply(this.shortEnd(Math.abs(shortEndShiftBps), pivotTenor), 'bear_flattener', {
      short_end_shift_bps: shortEndShiftBps,
      pivot_tenor: pivotTenor
    });
  }

  bullFlattener(longEndShiftBps: number, pivotTenor = 5.0): DeformationResult {
    return this.apply(this.longEnd(-Math.abs(longEndShiftBps), pivotTenor), 'bull_flattener', {
      long_end_shift_bps: longEndShiftBps,
      pivot_tenor: pivotTenor
    });
  }

  customDeformation(tenorShifts: Record<string, number>): DeformationResult {
    const points = Object.entries(tenorShifts)
      .map(([t, v]) => [Number(t), v / 100] as const)
      .sort((a, b) => a[0] - b[0]);
    const xs = points.map((p) => p[0]);
    const ys = points.map((p) => p[1]);
    return this.apply(
      this.tenors.map((t) => interp(t, xs, ys)),
      'custom',
      { tenor_shifts: tenorShifts }
    );
  }

  pcaDeformation(levelShift = 0, slopeShift = 0, curvatureShift = 0): DeformationResult {
    const t = this.tenors;
    const min = Math.min(...t);
    const max = Math.max(...t);
    const u = t.map((x) => (x - min) / (max - min));
    const norm = (v: number[]) => {
      const length = Math.sqrt(v.reduce((s, x) => s + x * x, 0));
      return v.map((x) => x / length);
    };
    const level = norm(t.map(() => 1));
    const slope = norm(u.map((x) => x - 0.5));
    const curvature = norm(u.map((x) => (x - 0.5) ** 2 - 1 / 12));
    const shifts = t.map(
      (_, i) => (levelShift / 100) * level[i] + (slopeShift / 100) * slope[i] + (curvatureShift / 100) * curvature[i]
    );
    return this.apply(shifts, 'pca', {
      level_shift: levelShift,
      slope_shift: slopeShift,
      curvature_shift: curvatureShift
    });
  }

  policyScenario(
    scenario: PolicyPath,
    baseline: PolicyPath,
    halfLifeYears: number | null = 2.0,
    termPremiumBps = 0
  ): DeformationResult {
    const shifts = policyCurveShift(this.tenors, scenario, baseline, halfLifeYears, termPremiumBps).map((s) => s / 100);
    return this.apply(shifts, 'policy', {
      scenario_levels: scenario.levels,
      baseline_levels: baseline.levels,
      half_life_years: halfLifeYears,
      term_premium_bps: termPremiumBps
    });
  }

  /** Mirrors the Python dispatcher; `scenario.type` picks the method, other keys are its arguments. */
  scenarioAnalysis(scenarios: readonly Scenario[]): DeformationResult[] {
    return scenarios.map((s) => this.run(s));
  }

  run(scenario: Scenario): DeformationResult {
    const p = scenario as Record<string, number> & Scenario;
    switch (scenario.type) {
      case 'parallel_shift':
        return this.parallelShift(p.shift_bps);
      case 'steepening':
        return this.steepening(p.magnitude_bps, p.pivot_tenor, p.short_tenor, p.long_tenor);
      case 'flattening':
        return this.flattening(p.magnitude_bps, p.pivot_tenor, p.short_tenor, p.long_tenor);
      case 'twist':
        return this.twist(p.short_shift_bps, p.long_shift_bps, p.pivot_tenor);
      case 'butterfly':
        return this.butterfly(p.wings_shift_bps, p.body_shift_bps, p.short_tenor, p.mid_tenor, p.long_tenor);
      case 'positive_butterfly':
        return this.positiveButterfly(p.magnitude_bps);
      case 'negative_butterfly':
        return this.negativeButterfly(p.magnitude_bps);
      case 'bear_steepener':
        return this.bearSteepener(p.long_end_shift_bps, p.pivot_tenor);
      case 'bull_steepener':
        return this.bullSteepener(p.short_end_shift_bps, p.pivot_tenor);
      case 'bear_flattener':
        return this.bearFlattener(p.short_end_shift_bps, p.pivot_tenor);
      case 'bull_flattener':
        return this.bullFlattener(p.long_end_shift_bps, p.pivot_tenor);
      case 'custom':
        return this.customDeformation(scenario.tenor_shifts as Record<string, number>);
      case 'pca':
        return this.pcaDeformation(p.level_shift, p.slope_shift, p.curvature_shift);
      default:
        throw new Error(`Unknown deformation type: ${(scenario as Scenario).type}`);
    }
  }
}

export type ScenarioType = Exclude<DeformationType, 'policy'> | 'positive_butterfly' | 'negative_butterfly';
/** `type` picks the method; the other keys are its Python keyword arguments (bps / years). */
export type Scenario = { type: ScenarioType; [parameter: string]: unknown };
