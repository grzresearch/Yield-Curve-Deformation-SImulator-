/**
 * Application state. Inputs are runes; everything computed from them is
 * `$derived`, so a slider change flows through curve → deformation → risk
 * without any manual wiring.
 */
import { MediaQuery } from 'svelte/reactivity';
import {
  Bond,
  BondPortfolio,
  CurveDeformer,
  FedWatch,
  pathFromMoves,
  type DeformationResult,
  type Interpolation,
  type PolicyPath
} from './core';
import {
  SAMPLE_CURVE,
  buildCurve,
  indexOnOrBefore,
  pointsOn,
  realisedVolatility,
  type BuiltCurve,
  type CurvePoint,
  type CurveSeries,
  type CurveSourceId,
  type Market
} from './data/market';
import { readPalette, type Palette } from './charts/build';
import { formatter } from './format';
import { translate, type Lang, type MessageKey } from './i18n';
import { DEFAULT_STRESS, SHOCK_TYPES, defaultParams, toScenario, type ShockSpec, type StressScenario } from './scenarios';

export const VIEWS = ['overview', 'curve', 'fedwatch', 'policy', 'shocks', 'bond', 'portfolio', 'stress', 'data'] as const;
export type View = (typeof VIEWS)[number];

export interface BondSpec {
  face: number;
  coupon: number;
  maturity: number;
  frequency: number;
}

export interface PositionSpec extends BondSpec {
  label: string;
  quantity: number;
}

export type PolicyPreset = 'market' | 'hold' | 'mode' | 'cut' | 'hike' | 'emergency' | 'custom';

export const PRESET_LABELS: Record<PolicyPreset, MessageKey> = {
  market: 'presetMarket',
  hold: 'presetHold',
  mode: 'presetMode',
  cut: 'presetCut',
  hike: 'presetHike',
  emergency: 'presetEmergency',
  custom: 'presetCustom'
};

export interface PolicySpec {
  preset: PolicyPreset;
  custom: number[];
  halfLife: number | null;
  termPremium: number;
}

export const EXAMPLE_PORTFOLIO: PositionSpec[] = [
  { label: '2Y 3.50%', face: 1000, coupon: 3.5, maturity: 2, frequency: 2, quantity: 100 },
  { label: '5Y 4.00%', face: 1000, coupon: 4.0, maturity: 5, frequency: 2, quantity: 200 },
  { label: '10Y 4.50%', face: 1000, coupon: 4.5, maturity: 10, frequency: 2, quantity: 150 },
  { label: '30Y 5.00%', face: 1000, coupon: 5.0, maturity: 30, frequency: 2, quantity: 50 }
];

const DEFAULT_BOND: BondSpec = { face: 1000, coupon: 4.0, maturity: 10, frequency: 2 };
const STORAGE_KEY = 'yield-curve-simulator:v1';

type ThemePreference = 'system' | 'light' | 'dark';

interface Persisted {
  lang: Lang;
  themePreference: ThemePreference;
  source: CurveSourceId;
  bootstrap: boolean;
  interpolation: Interpolation;
  customCurve: CurvePoint[];
  bond: BondSpec;
  portfolio: PositionSpec[];
  shock: ShockSpec;
  policy: PolicySpec;
  stress: StressScenario[];
}

const prefersDark = new MediaQuery('(prefers-color-scheme: dark)');

const PRESETS = Object.keys(PRESET_LABELS) as PolicyPreset[];

function toBase64Url(text: string): string {
  let binary = '';
  for (const byte of new TextEncoder().encode(text)) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function fromBase64Url(encoded: string): string {
  const binary = atob(encoded.replace(/-/g, '+').replace(/_/g, '/'));
  return new TextDecoder().decode(Uint8Array.from(binary, (c) => c.charCodeAt(0)));
}

/** Drop restored fields that don't fit the current shape instead of crashing on them. */
function sanitize(data: Partial<Persisted>): Partial<Persisted> {
  const out = { ...data };
  if (out.lang && !['de', 'en'].includes(out.lang)) delete out.lang;
  if (out.source && !['ust', 'ecb', 'sample', 'custom'].includes(out.source)) delete out.source;
  if (out.interpolation && !['cubic_spline', 'pchip', 'linear'].includes(out.interpolation)) delete out.interpolation;
  if (out.shock && !(SHOCK_TYPES as readonly string[]).includes(out.shock.type)) delete out.shock;
  if (out.policy && !PRESETS.includes(out.policy.preset)) delete out.policy;
  for (const key of ['customCurve', 'portfolio', 'stress'] as const) {
    if (out[key] !== undefined && !Array.isArray(out[key])) delete out[key];
  }
  return out;
}

function detectLang(): Lang {
  return typeof navigator !== 'undefined' && navigator.language?.toLowerCase().startsWith('de') ? 'de' : 'en';
}

class AppState {
  view = $state<View>('overview');
  market = $state.raw<Market | null>(null);
  loadError = $state<string | null>(null);

  lang = $state<Lang>(detectLang());
  themePreference = $state<ThemePreference>('system');
  source = $state<CurveSourceId>('ust');
  /** null = latest observation. */
  curveDate = $state<string | null>(null);
  bootstrap = $state(true);
  interpolation = $state<Interpolation>('cubic_spline');
  customCurve = $state<CurvePoint[]>(SAMPLE_CURVE.map((p) => ({ ...p })));

  bond = $state<BondSpec>({ ...DEFAULT_BOND });
  portfolio = $state<PositionSpec[]>(EXAMPLE_PORTFOLIO.map((p) => ({ ...p })));
  shock = $state<ShockSpec>({ type: 'parallel_shift', params: defaultParams('parallel_shift'), custom: {} });
  policy = $state<PolicySpec>({ preset: 'hold', custom: [], halfLife: 2, termPremium: 0 });
  stress = $state<StressScenario[]>(DEFAULT_STRESS.map((s) => ({ ...s })));

  theme = $derived<'light' | 'dark'>(
    this.themePreference === 'system' ? (prefersDark.current ? 'dark' : 'light') : this.themePreference
  );
  /** Applying the theme here (not in an effect) guarantees charts read the new tokens. */
  palette = $derived.by((): Palette => {
    document.documentElement.dataset.theme = this.theme;
    return readPalette();
  });
  currency = $derived(this.source === 'ecb' ? 'EUR' : 'USD');
  fmt = $derived(formatter(this.lang, this.currency));

  t = (key: MessageKey, vars?: Record<string, string | number>) => translate(this.lang, key, vars);

  /** The market series behind the selected source, if any. */
  series = $derived.by((): CurveSeries | null => {
    if (!this.market) return null;
    if (this.source === 'ust') return this.market.treasury;
    if (this.source === 'ecb') return this.market.ecb ?? null;
    return null;
  });

  seriesIndex = $derived.by(() => {
    const s = this.series;
    if (!s) return -1;
    return this.curveDate ? indexOnOrBefore(s, this.curveDate) : s.history.length - 1;
  });

  built = $derived.by((): BuiltCurve | null => {
    const s = this.series;
    if (s && this.seriesIndex >= 0) {
      return buildCurve(
        pointsOn(s, this.seriesIndex),
        s.basis,
        this.interpolation,
        this.bootstrap,
        s.frequency,
        s.history[this.seriesIndex].date
      );
    }
    if (this.source === 'sample') return buildCurve(SAMPLE_CURVE, 'zero', this.interpolation, false, 2, null);
    if (this.source === 'custom') {
      const points = [...this.customCurve]
        .filter((p) => Number.isFinite(p.tenor) && Number.isFinite(p.rate) && p.tenor > 0)
        .sort((a, b) => a.tenor - b.tenor);
      if (points.length >= 2) return buildCurve(points, 'zero', this.interpolation, false, 2, null);
    }
    return null;
  });

  curve = $derived(this.built?.curve ?? null);

  volatility = $derived(this.series ? realisedVolatility(this.series) : []);

  bondObject = $derived(new Bond(this.bond.face, this.bond.coupon, this.bond.maturity, this.bond.frequency));

  /** Positions that can be priced; `portfolioObject.positions[i]` belongs to `activePositions[i]`. */
  activePositions = $derived(
    this.portfolio.filter((p) => p.face > 0 && p.maturity > 0 && p.quantity !== 0 && p.frequency > 0)
  );

  portfolioObject = $derived(
    new BondPortfolio(
      this.activePositions.map((p) => ({ bond: new Bond(p.face, p.coupon, p.maturity, p.frequency), quantity: p.quantity }))
    )
  );

  /** Upcoming meetings are judged against the snapshot's own date. */
  asOf = $derived(this.market ? this.market.generatedAt.slice(0, 10) : null);

  fedwatch = $derived.by((): FedWatch | null => {
    const m = this.market;
    if (!m?.futures || !m.fedFunds || !m.fomc || !this.asOf) return null;
    return new FedWatch(
      m.fomc.meetings.map((x) => x.decision),
      m.futures.contracts,
      m.fedFunds.targetLower,
      m.fedFunds.targetUpper,
      this.asOf,
      m.fedFunds.effr
    );
  });

  policyMoves = $derived.by((): number[] => {
    const fw = this.fedwatch;
    if (!fw) return [];
    const n = fw.meetings.length;
    switch (this.policy.preset) {
      case 'market':
        return fw.outlooks.map((o) => o.expectedChangeBps);
      case 'hold':
        return new Array(n).fill(0);
      case 'mode':
        return fw.outlooks.map((o) => [...o.moveProbabilities].reduce((a, b) => (b[1] > a[1] ? b : a))[0]);
      case 'cut':
        return new Array(n).fill(-25);
      case 'hike':
        return new Array(n).fill(25);
      case 'emergency':
        return fw.meetings.map((_, i) => (i === 0 ? -50 : 0));
      case 'custom':
        return fw.meetings.map((_, i) => this.policy.custom[i] ?? 0);
    }
  });

  policyPaths = $derived.by((): { market: PolicyPath; scenario: PolicyPath } | null => {
    const fw = this.fedwatch;
    if (!fw || !fw.meetings.length) return null;
    const market = fw.impliedPolicyPath();
    return { market, scenario: pathFromMoves(market.asOf, market.startRate, market.meetings, this.policyMoves) };
  });

  policyResult = $derived.by((): DeformationResult | null => {
    if (!this.curve || !this.policyPaths) return null;
    return new CurveDeformer(this.curve).policyScenario(
      this.policyPaths.scenario,
      this.policyPaths.market,
      this.policy.halfLife,
      this.policy.termPremium
    );
  });

  shockResult = $derived.by((): DeformationResult | null => {
    if (!this.curve) return null;
    return new CurveDeformer(this.curve).run(toScenario(this.shock));
  });

  /* ---------- persistence & sharing ---------- */

  private snapshot(): Persisted {
    return {
      lang: this.lang,
      themePreference: this.themePreference,
      source: this.source,
      bootstrap: this.bootstrap,
      interpolation: this.interpolation,
      customCurve: $state.snapshot(this.customCurve),
      bond: $state.snapshot(this.bond),
      portfolio: $state.snapshot(this.portfolio),
      shock: $state.snapshot(this.shock),
      policy: $state.snapshot(this.policy),
      stress: $state.snapshot(this.stress)
    };
  }

  private apply(raw: Partial<Persisted>) {
    const data = sanitize(raw);
    const keys: (keyof Persisted)[] = [
      'lang', 'themePreference', 'source', 'bootstrap', 'interpolation', 'customCurve',
      'bond', 'portfolio', 'shock', 'policy', 'stress'
    ];
    for (const key of keys) {
      if (data[key] !== undefined) (this as Record<string, unknown>)[key] = data[key];
    }
  }

  restore() {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) this.apply(JSON.parse(stored));
    } catch {
      /* storage unavailable or corrupt: start fresh */
    }
    const shared = new URLSearchParams(location.hash.split('?')[1] ?? '').get('s');
    if (shared) {
      try {
        const { lang: _lang, themePreference: _theme, ...rest } = JSON.parse(fromBase64Url(shared)) as Persisted;
        this.apply(rest);
      } catch {
        /* malformed share link: ignore */
      }
      history.replaceState(null, '', location.pathname + location.hash.split('?')[0]);
    }
  }

  persist() {
    const data = this.snapshot();
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    } catch {
      /* private mode or quota: settings simply won't survive a reload */
    }
  }

  shareUrl(): string {
    const { lang: _lang, themePreference: _theme, ...rest } = this.snapshot();
    return `${location.origin}${location.pathname}#/${this.view}?s=${toBase64Url(JSON.stringify(rest))}`;
  }

  resetBond() {
    this.bond = { ...DEFAULT_BOND };
  }
}

export const app = new AppState();
