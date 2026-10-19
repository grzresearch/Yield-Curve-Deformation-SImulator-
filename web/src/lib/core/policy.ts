/**
 * Monetary-policy transmission (port of `yield_curve.policy`).
 *
 * Expectations hypothesis: a zero rate is the average expected overnight rate
 * over its life plus a term premium. Only the surprise versus the market path
 * moves the curve; beyond the last modelled meeting it decays with a half-life.
 */
import { addDays, daysBetween } from './dates';

export const DAYS_PER_YEAR = 365.0;
export const NELSON_SIEGEL_DECAY = 0.0609 * 12;
export const TERM_PREMIUM_ANCHOR_TENOR = 10.0;

export interface PolicyPath {
  asOf: string;
  startRate: number;
  meetings: string[];
  /** Policy rate (%) after each meeting. */
  levels: number[];
}

export function pathFromMoves(asOf: string, startRate: number, meetings: string[], movesBps: number[]): PolicyPath {
  let level = startRate;
  const levels = movesBps.map((move) => (level += move / 100));
  return { asOf, startRate, meetings: [...meetings], levels };
}

export const changeTimes = (path: PolicyPath): number[] =>
  path.meetings.map((m) => daysBetween(path.asOf, addDays(m, 1)) / DAYS_PER_YEAR);

export function rateAt(path: PolicyPath, t: number): number {
  const times = changeTimes(path);
  let level = path.startRate;
  times.forEach((change, i) => {
    if (t >= change) level = path.levels[i];
  });
  return level;
}

function surpriseSegments(scenario: PolicyPath, baseline: PolicyPath) {
  if (scenario.asOf !== baseline.asOf) throw new Error('Scenario and baseline must share the same as-of date');
  const breaks = [...new Set([0, ...changeTimes(scenario), ...changeTimes(baseline)])]
    .filter((t) => t >= 0)
    .sort((a, b) => a - b);
  const values = breaks.map((t) => rateAt(scenario, t) - rateAt(baseline, t));
  return { breaks, values };
}

function integratedSurprise(tau: number, breaks: number[], values: number[], halfLife: number | null): number {
  let total = 0;
  for (let i = 0; i < breaks.length - 1; i++) {
    total += values[i] * Math.max(0, Math.min(tau, breaks[i + 1]) - breaks[i]);
  }
  const tail = Math.max(0, tau - breaks[breaks.length - 1]);
  if (tail > 0) {
    const last = values[values.length - 1];
    if (halfLife === null || !Number.isFinite(halfLife)) total += last * tail;
    else if (halfLife > 0) {
      const rate = Math.LN2 / halfLife;
      total += (last * (1 - Math.exp(-rate * tail))) / rate;
    }
  }
  return total;
}

/** Zero-rate change in bps at each tenor caused by the policy surprise. */
export function policyRateShift(
  tenors: readonly number[],
  scenario: PolicyPath,
  baseline: PolicyPath,
  halfLifeYears: number | null = 2.0
): number[] {
  const { breaks, values } = surpriseSegments(scenario, baseline);
  return tenors.map((t) => (t > 0 ? (integratedSurprise(t, breaks, values, halfLifeYears) / t) * 100 : values[0] * 100));
}

export function termPremiumLoading(
  tenors: readonly number[],
  decay = NELSON_SIEGEL_DECAY,
  anchorTenor = TERM_PREMIUM_ANCHOR_TENOR
): number[] {
  const longEnd = (t: number) => {
    const x = decay * t;
    return 1 - (x > 0 ? (1 - Math.exp(-x)) / x : 1);
  };
  const anchor = longEnd(anchorTenor);
  return tenors.map((t) => longEnd(t) / anchor);
}

/** Total zero-rate change in bps: policy surprise plus term-premium shock. */
export function policyCurveShift(
  tenors: readonly number[],
  scenario: PolicyPath,
  baseline: PolicyPath,
  halfLifeYears: number | null = 2.0,
  termPremiumBps = 0
): number[] {
  const policy = policyRateShift(tenors, scenario, baseline, halfLifeYears);
  const loading = termPremiumLoading(tenors);
  return policy.map((p, i) => p + termPremiumBps * loading[i]);
}
