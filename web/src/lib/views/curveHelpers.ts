import type { YieldCurve } from '../core';

/** Dense tenor grid spanning the curve (and at least 3M–30Y) for smooth lines. */
export function denseTenors(curve: YieldCurve, points = 160): number[] {
  const start = Math.min(curve.tenors[0], 0.25);
  const end = Math.max(curve.tenors[curve.tenors.length - 1], 30);
  return Array.from({ length: points }, (_, i) => start + ((end - start) * i) / (points - 1));
}

export const sample = (grid: number[], fn: (t: number) => number): [number, number][] => grid.map((t) => [t, fn(t)]);
