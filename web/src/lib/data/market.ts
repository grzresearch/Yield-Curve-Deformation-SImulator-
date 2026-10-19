/** The market snapshot written by scripts/fetch_market_data.py, and curves built from it. */
import { YieldCurve, type Interpolation } from '../core';

export type SourceStatus = 'ok' | 'stale' | 'error';

export interface SourceInfo {
  provider: string;
  url: string;
  status: SourceStatus;
  fetchedAt?: string | null;
  error?: string;
}

export interface CurveSeries {
  name: string;
  basis: 'par' | 'zero';
  frequency: number;
  labels: string[];
  tenors: number[];
  asOf: string;
  history: { date: string; rates: (number | null)[] }[];
}

export interface FedFundsData {
  asOf: string;
  effr: number;
  targetLower: number;
  targetUpper: number;
  history: { date: string; effr: number; lower: number; upper: number }[];
}

export interface FuturesData {
  instrument: string;
  asOf: string;
  contracts: { symbol: string; year: number; month: number; price: number; date: string }[];
}

export interface Market {
  schema: number;
  generatedAt: string;
  sources: Record<string, SourceInfo>;
  treasury: CurveSeries;
  ecb?: CurveSeries;
  fedFunds?: FedFundsData;
  fomc?: { meetings: { start: string; decision: string; projections: boolean }[] };
  futures?: FuturesData;
}

export async function loadMarket(): Promise<Market> {
  const response = await fetch('./data/market.json', { cache: 'no-cache' });
  if (!response.ok) throw new Error(`market.json: HTTP ${response.status}`);
  return response.json();
}

export type CurveSourceId = 'ust' | 'ecb' | 'sample' | 'custom';

export interface CurvePoint {
  tenor: number;
  label: string;
  rate: number;
}

/** The yield curve from the original README, kept as a reproducible reference. */
export const SAMPLE_CURVE: CurvePoint[] = [
  [0.25, 5.25], [0.5, 5.2], [1, 5.0], [2, 4.5], [3, 4.25], [5, 4.0], [7, 4.1], [10, 4.25], [20, 4.5], [30, 4.6]
].map(([tenor, rate]) => ({ tenor, label: tenorLabel(tenor), rate }));

export function tenorLabel(tenor: number): string {
  if (tenor < 1) return `${Math.round(tenor * 12 * 10) / 10}M`;
  return `${Math.round(tenor * 100) / 100}Y`;
}

/** Quoted points of a series on one date (missing tenors dropped). */
export function pointsOn(series: CurveSeries, index: number): CurvePoint[] {
  const row = series.history[index];
  return series.tenors
    .map((tenor, i) => ({ tenor, label: series.labels[i], rate: row.rates[i] }))
    .filter((p): p is CurvePoint => p.rate !== null && Number.isFinite(p.rate));
}

/** Index of the last observation on or before `iso`. */
export function indexOnOrBefore(series: CurveSeries, iso: string): number {
  let lo = 0;
  let hi = series.history.length - 1;
  if (iso < series.history[0].date) return 0;
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1;
    if (series.history[mid].date <= iso) lo = mid;
    else hi = mid - 1;
  }
  return lo;
}

export interface BuiltCurve {
  curve: YieldCurve;
  /** The quoted inputs (par yields for Treasury, spot rates otherwise). */
  quotes: CurvePoint[];
  date: string | null;
  quoteBasis: 'par' | 'zero';
}

export function buildCurve(
  points: CurvePoint[],
  quoteBasis: 'par' | 'zero',
  interpolation: Interpolation,
  bootstrap: boolean,
  frequency: number,
  date: string | null
): BuiltCurve {
  const tenors = points.map((p) => p.tenor);
  const rates = points.map((p) => p.rate);
  const curve =
    quoteBasis === 'par' && bootstrap
      ? YieldCurve.fromParYields(tenors, rates, frequency, interpolation, date)
      : new YieldCurve(tenors, rates, interpolation, date);
  return { curve, quotes: points, date, quoteBasis };
}

/**
 * Annualised realised volatility of daily changes, in bps, per tenor of a
 * series, over its last `window` observations.
 */
export function realisedVolatility(series: CurveSeries, window = 250): { tenor: number; vol: number }[] {
  const rows = series.history.slice(-window - 1);
  return series.tenors.map((tenor, i) => {
    const changes: number[] = [];
    for (let k = 1; k < rows.length; k++) {
      const a = rows[k - 1].rates[i];
      const b = rows[k].rates[i];
      if (a !== null && b !== null) changes.push((b - a) * 100);
    }
    const mean = changes.reduce((s, x) => s + x, 0) / Math.max(1, changes.length);
    const variance = changes.reduce((s, x) => s + (x - mean) ** 2, 0) / Math.max(1, changes.length - 1);
    return { tenor, vol: Math.sqrt(variance) * Math.sqrt(252) };
  }).filter((v) => Number.isFinite(v.vol) && v.vol > 0);
}
