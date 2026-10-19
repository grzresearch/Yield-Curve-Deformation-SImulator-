/** Parameter schemas for every curve deformation, and the default stress-test set. */
import type { Scenario, ScenarioType } from './core';
import type { Formatter } from './format';
import type { MessageKey } from './i18n';

export interface ParamDef {
  key: string;
  min: number;
  max: number;
  step: number;
  unit: 'bps' | 'years';
  default: number;
}

const bps = (key: string, def: number, min = -200, max = 200): ParamDef => ({ key, min, max, step: 1, unit: 'bps', default: def });
const tenor = (key: string, def: number, min = 0.5, max = 30): ParamDef => ({ key, min, max, step: 0.25, unit: 'years', default: def });

/** The deformations offered in the UI (positive/negative butterfly are `butterfly` presets). */
export const SHOCK_TYPES = [
  'parallel_shift',
  'steepening',
  'flattening',
  'twist',
  'butterfly',
  'bear_steepener',
  'bull_steepener',
  'bear_flattener',
  'bull_flattener',
  'pca',
  'custom'
] as const satisfies readonly ScenarioType[];

export type ShockType = (typeof SHOCK_TYPES)[number];

export const SHOCK_PARAMS: Record<ShockType, ParamDef[]> = {
  parallel_shift: [bps('shift_bps', 25, -300, 300)],
  steepening: [bps('magnitude_bps', 50, 0, 200), tenor('pivot_tenor', 5, 1, 20), tenor('short_tenor', 2, 0.25, 10), tenor('long_tenor', 10, 2, 30)],
  flattening: [bps('magnitude_bps', 50, 0, 200), tenor('pivot_tenor', 5, 1, 20), tenor('short_tenor', 2, 0.25, 10), tenor('long_tenor', 10, 2, 30)],
  twist: [bps('short_shift_bps', -20), bps('long_shift_bps', 30), tenor('pivot_tenor', 5, 1, 20)],
  butterfly: [bps('wings_shift_bps', 25), bps('body_shift_bps', -25), tenor('short_tenor', 2, 0.5, 5), tenor('mid_tenor', 5, 1, 15), tenor('long_tenor', 10, 3, 30)],
  bear_steepener: [bps('long_end_shift_bps', 40, 0, 200), tenor('pivot_tenor', 5, 1, 20)],
  bull_steepener: [bps('short_end_shift_bps', 50, 0, 200), tenor('pivot_tenor', 5, 1, 20)],
  bear_flattener: [bps('short_end_shift_bps', 30, 0, 200), tenor('pivot_tenor', 5, 1, 20)],
  bull_flattener: [bps('long_end_shift_bps', 30, 0, 200), tenor('pivot_tenor', 5, 1, 20)],
  pca: [bps('level_shift', 25, -300, 300), bps('slope_shift', 0, -300, 300), bps('curvature_shift', 0, -300, 300)],
  custom: []
};

export function defaultParams(type: ShockType): Record<string, number> {
  return Object.fromEntries(SHOCK_PARAMS[type].map((p) => [p.key, p.default]));
}

/** Keep pivot-style tenors ordered so no weight divides by zero. */
export function constrainParams(type: ShockType, params: Record<string, number>): Record<string, number> {
  const p = { ...params };
  const gap = 0.25;
  if (type === 'steepening' || type === 'flattening') {
    p.short_tenor = Math.min(p.short_tenor, p.pivot_tenor - gap);
    p.long_tenor = Math.max(p.long_tenor, p.pivot_tenor + gap);
  }
  if (type === 'butterfly') {
    p.mid_tenor = Math.max(p.mid_tenor, p.short_tenor + gap);
    p.long_tenor = Math.max(p.long_tenor, p.mid_tenor + gap);
  }
  return p;
}

export interface ShockSpec {
  type: ShockType;
  params: Record<string, number>;
  /** bps per tenor, used by the `custom` type. */
  custom: Record<string, number>;
}

export function toScenario(spec: ShockSpec): Scenario {
  if (spec.type === 'custom') return { type: 'custom', tenor_shifts: { ...spec.custom } };
  return { type: spec.type, ...constrainParams(spec.type, spec.params) };
}

export interface StressScenario {
  id: string;
  scenario: Scenario;
}

let counter = 0;
export const newId = () => `s${Date.now().toString(36)}${(counter++).toString(36)}`;

/** The scenario set behind the README's scenario and portfolio charts. */
export const DEFAULT_STRESS: StressScenario[] = (
  [
    { type: 'parallel_shift', shift_bps: 50 },
    { type: 'parallel_shift', shift_bps: -50 },
    { type: 'parallel_shift', shift_bps: 25 },
    { type: 'parallel_shift', shift_bps: -25 },
    { type: 'steepening', magnitude_bps: 50 },
    { type: 'flattening', magnitude_bps: 50 },
    { type: 'positive_butterfly', magnitude_bps: 25 },
    { type: 'bear_steepener', long_end_shift_bps: 40 },
    { type: 'bull_steepener', short_end_shift_bps: 50 },
    { type: 'bear_flattener', short_end_shift_bps: 30 },
    { type: 'bull_flattener', long_end_shift_bps: 30 },
    { type: 'twist', short_shift_bps: -20, long_shift_bps: 30 }
  ] as Scenario[]
).map((scenario, i) => ({ id: `default-${i}`, scenario }));

/** Short human label, e.g. "Parallel shift +50 bp" or "Twist −20 / +30 bp". */
export function scenarioLabel(scenario: Scenario, t: (key: MessageKey) => string, fmt: Formatter): string {
  const name = t(`d_${scenario.type}` as MessageKey);
  const s = scenario as Record<string, number> & Scenario;
  const b = (x: number) => fmt.bps(x, 0);
  switch (scenario.type) {
    case 'parallel_shift':
      return `${name} ${b(s.shift_bps)}`;
    case 'steepening':
    case 'flattening':
    case 'positive_butterfly':
    case 'negative_butterfly':
      return `${name} ${fmt.bps(s.magnitude_bps, 0, false)}`;
    case 'twist':
      return `${name} ${b(s.short_shift_bps)} / ${b(s.long_shift_bps)}`;
    case 'butterfly':
      return `${name} ${b(s.wings_shift_bps)} / ${b(s.body_shift_bps)}`;
    case 'bear_steepener':
    case 'bull_flattener':
      return `${name} ${fmt.bps(s.long_end_shift_bps, 0, false)}`;
    case 'bull_steepener':
    case 'bear_flattener':
      return `${name} ${fmt.bps(s.short_end_shift_bps, 0, false)}`;
    case 'pca':
      return `${name} ${b(s.level_shift)} / ${b(s.slope_shift)} / ${b(s.curvature_shift)}`;
    default:
      return name;
  }
}
