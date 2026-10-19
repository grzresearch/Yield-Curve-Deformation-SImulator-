import { arange, buildInterpolator, interp, type Interpolation, type Interpolator } from './numeric';

/** Port of `yield_curve.curve.YieldCurve`. Rates are continuously compounded zero rates in %. */
export class YieldCurve {
  static readonly STANDARD_TENORS = [0.25, 0.5, 1, 2, 3, 5, 7, 10, 20, 30];

  readonly tenors: number[];
  readonly rates: number[];
  readonly interpolation: Interpolation;
  curveDate: string | null;
  private readonly interpolator: Interpolator;

  constructor(
    tenors: readonly number[],
    rates: readonly number[],
    interpolation: Interpolation = 'cubic_spline',
    curveDate: string | null = null
  ) {
    if (tenors.length !== rates.length) throw new Error('Tenors and rates must have same length');
    if (tenors.length < 2) throw new Error('At least 2 points required for interpolation');
    const order = tenors.map((_, i) => i).sort((a, b) => tenors[a] - tenors[b]);
    this.tenors = order.map((i) => tenors[i]);
    this.rates = order.map((i) => rates[i]);
    this.interpolation = interpolation;
    this.curveDate = curveDate;
    this.interpolator = buildInterpolator(interpolation, this.tenors, this.rates);
  }

  rateAt(tenor: number): number {
    return this.interpolator(tenor);
  }

  forwardRate(t1: number, t2: number): number {
    if (t2 <= t1) throw new Error('t2 must be greater than t1');
    const r1 = this.rateAt(t1);
    const r2 = this.rateAt(t2);
    return (r2 * t2 - r1 * t1) / (t2 - t1);
  }

  instantaneousForward(t: number, delta = 0.001): number {
    return this.forwardRate(t, t + delta);
  }

  discountFactor(t: number): number {
    return Math.exp((-this.rateAt(t) * t) / 100);
  }

  discountFactors(times: readonly number[]): number[] {
    return times.map((t) => this.discountFactor(t));
  }

  private coupons(maturity: number, frequency: number) {
    const dt = 1 / frequency;
    const times = arange(dt, maturity + dt / 2, dt);
    if (times.length === 0) times.push(maturity);
    times[times.length - 1] = maturity;
    const accruals = times.map((t, i) => t - (i === 0 ? 0 : times[i - 1]));
    const dfs = this.discountFactors(times);
    let annuity = 0;
    for (let i = 0; i < dfs.length; i++) annuity += dfs[i] * accruals[i];
    return { accruals, dfs, annuity };
  }

  parRate(maturity: number, frequency = 2): number {
    const { dfs, annuity } = this.coupons(maturity, frequency);
    return ((1 - dfs[dfs.length - 1]) / annuity) * 100;
  }

  /** d parRate(t) / d zero(t), holding the rest of the curve fixed. */
  parRateSensitivity(maturity: number, frequency = 2): number {
    const { accruals, dfs, annuity } = this.coupons(maturity, frequency);
    const last = dfs[dfs.length - 1];
    const par = (1 - last) / annuity;
    return (maturity * last * (1 + par * accruals[accruals.length - 1])) / annuity;
  }

  zeroToPar(): YieldCurve {
    return new YieldCurve(
      this.tenors,
      this.tenors.map((t) => this.parRate(t)),
      this.interpolation,
      this.curveDate
    );
  }

  shift(basisPoints: number): YieldCurve {
    return this.withRates(this.rates.map((r) => r + basisPoints / 100));
  }

  withRates(rates: readonly number[]): YieldCurve {
    return new YieldCurve(this.tenors, rates, this.interpolation, this.curveDate);
  }

  /** Long minus short rate, in percentage points (x100 for bps). */
  slope(shortTenor = 2, longTenor = 10): number {
    return this.rateAt(longTenor) - this.rateAt(shortTenor);
  }

  curvature(short = 2, mid = 5, long = 10): number {
    return 2 * this.rateAt(mid) - this.rateAt(short) - this.rateAt(long);
  }

  copy(): YieldCurve {
    return new YieldCurve(this.tenors, this.rates, this.interpolation, this.curveDate);
  }

  static flatCurve(rate: number, tenors: readonly number[] = YieldCurve.STANDARD_TENORS): YieldCurve {
    return new YieldCurve(tenors, tenors.map(() => rate));
  }

  static normalCurve(
    shortRate = 2.0,
    longRate = 4.0,
    tenors: readonly number[] = YieldCurve.STANDARD_TENORS
  ): YieldCurve {
    const logs = tenors.map((t) => Math.log(t + 1));
    const max = Math.max(...logs);
    return new YieldCurve(tenors, logs.map((l) => shortRate + (longRate - shortRate) * (l / max)));
  }

  static invertedCurve(
    shortRate = 5.0,
    longRate = 3.0,
    tenors: readonly number[] = YieldCurve.STANDARD_TENORS
  ): YieldCurve {
    return YieldCurve.normalCurve(shortRate, longRate, tenors);
  }

  /**
   * Bootstrap continuously compounded zero rates from par yields. The result
   * reprices its inputs: under the curve's own interpolation, `parRate(t)`
   * equals the quoted par yield at every tenor (see the Python docstring).
   */
  static fromParYields(
    tenors: readonly number[],
    parYields: readonly number[],
    frequency = 2,
    interpolation: Interpolation = 'cubic_spline',
    curveDate: string | null = null,
    tolerance = 1e-10,
    maxIterations = 100
  ): YieldCurve {
    const order = tenors.map((_, i) => i).sort((a, b) => tenors[a] - tenors[b]);
    const t = order.map((i) => tenors[i]);
    const par = order.map((i) => parYields[i]);
    const period = 1 / frequency;
    const moneyMarket = t.map((x) => x <= period + 1e-12);

    let zero = t.map((x, i) => (moneyMarket[i] ? (Math.log1p((par[i] / 100) * x) / x) * 100 : 0));

    if (moneyMarket.some((m) => !m)) {
      const periods = Math.ceil(t[t.length - 1] * frequency - 1e-9);
      const grid = Array.from({ length: periods }, (_, i) => (i + 1) * period);
      const parFractions = par.map((p) => p / 100);
      const logDfs: number[] = [];
      let annuity = 0;
      for (const g of grid) {
        const c = interp(g, t, parFractions) / frequency;
        const df = (1 - c * annuity) / (1 + c);
        annuity += df;
        logDfs.push(Math.log(df));
      }
      zero = zero.map((z, i) => (moneyMarket[i] ? z : (-interp(t[i], grid, logDfs) / t[i]) * 100));
    }

    let curve = new YieldCurve(t, zero, interpolation, curveDate);
    for (let iteration = 0; iteration < maxIterations; iteration++) {
      const errors = t.map((x, i) => curve.parRate(x, frequency) - par[i]);
      if (Math.max(...errors.map(Math.abs)) < tolerance) break;
      zero = zero.map((z, i) => z - errors[i] / curve.parRateSensitivity(t[i], frequency));
      curve = new YieldCurve(t, zero, interpolation, curveDate);
    }
    return curve;
  }
}
