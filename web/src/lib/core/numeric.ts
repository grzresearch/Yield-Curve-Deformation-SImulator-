/**
 * Numerical building blocks, ported to reproduce numpy/scipy bit-for-bit
 * where it matters: `np.interp`, `np.arange`, scipy's `CubicSpline`
 * (not-a-knot), `PchipInterpolator` and `norm.ppf`.
 */

export type Interpolation = 'cubic_spline' | 'pchip' | 'linear';
export type Interpolator = (t: number) => number;

/** Index i of the interval [x[i], x[i+1]) holding t, clamped to the end intervals. */
function intervalIndex(x: readonly number[], t: number): number {
  let lo = 0;
  let hi = x.length - 2;
  if (t < x[0]) return 0;
  if (t >= x[hi]) return hi;
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1;
    if (x[mid] <= t) lo = mid;
    else hi = mid - 1;
  }
  return lo;
}

/** numpy.interp: linear interpolation with flat extrapolation. */
export function interp(t: number, xp: readonly number[], fp: readonly number[]): number {
  const n = xp.length;
  if (t < xp[0]) return fp[0];
  if (t >= xp[n - 1]) return fp[n - 1];
  const j = intervalIndex(xp, t);
  if (xp[j] === t) return fp[j];
  const slope = (fp[j + 1] - fp[j]) / (xp[j + 1] - xp[j]);
  return slope * (t - xp[j]) + fp[j];
}

/** numpy.arange for floats: start + i * (start + step - start). */
export function arange(start: number, stop: number, step: number): number[] {
  const length = Math.ceil((stop - start) / step);
  const delta = start + step - start;
  const out: number[] = [];
  for (let i = 0; i < length; i++) out.push(start + i * delta);
  return out;
}

/** Piecewise cubic Hermite polynomial in scipy's PPoly form (extrapolating). */
function hermite(x: readonly number[], y: readonly number[], dydx: readonly number[]): Interpolator {
  const n = x.length;
  const c0 = new Float64Array(n - 1);
  const c1 = new Float64Array(n - 1);
  for (let i = 0; i < n - 1; i++) {
    const dx = x[i + 1] - x[i];
    const slope = (y[i + 1] - y[i]) / dx;
    const t = (dydx[i] + dydx[i + 1] - 2 * slope) / dx;
    c0[i] = t / dx;
    c1[i] = (slope - dydx[i]) / dx - t;
  }
  return (t: number) => {
    const i = intervalIndex(x, t);
    const d = t - x[i];
    return ((c0[i] * d + c1[i]) * d + dydx[i]) * d + y[i];
  };
}

/** Dense Gaussian elimination with partial pivoting (systems here are tiny). */
export function solveLinear(matrix: number[][], rhs: number[]): number[] {
  const n = rhs.length;
  const a = matrix.map((row, i) => [...row, rhs[i]]);
  for (let col = 0; col < n; col++) {
    let pivot = col;
    for (let r = col + 1; r < n; r++) {
      if (Math.abs(a[r][col]) > Math.abs(a[pivot][col])) pivot = r;
    }
    [a[col], a[pivot]] = [a[pivot], a[col]];
    for (let r = col + 1; r < n; r++) {
      const factor = a[r][col] / a[col][col];
      if (factor === 0) continue;
      for (let c = col; c <= n; c++) a[r][c] -= factor * a[col][c];
    }
  }
  const out = new Array<number>(n);
  for (let r = n - 1; r >= 0; r--) {
    let sum = a[r][n];
    for (let c = r + 1; c < n; c++) sum -= a[r][c] * out[c];
    out[r] = sum / a[r][r];
  }
  return out;
}

/** scipy.interpolate.CubicSpline with the default not-a-knot boundary. */
export function cubicSpline(x: readonly number[], y: readonly number[]): Interpolator {
  const n = x.length;
  const dx = x.slice(1).map((v, i) => v - x[i]);
  const slope = dx.map((h, i) => (y[i + 1] - y[i]) / h);

  if (n === 2) return hermite(x, y, [slope[0], slope[0]]);

  const A = Array.from({ length: n }, () => new Array<number>(n).fill(0));
  const b = new Array<number>(n).fill(0);

  if (n === 3) {
    // Both not-a-knot conditions coincide: scipy fits the parabola through the points.
    A[0][0] = 1; A[0][1] = 1;
    A[1][0] = dx[1]; A[1][1] = 2 * (dx[0] + dx[1]); A[1][2] = dx[0];
    A[2][1] = 1; A[2][2] = 1;
    b[0] = 2 * slope[0];
    b[1] = 3 * (dx[0] * slope[1] + dx[1] * slope[0]);
    b[2] = 2 * slope[1];
    return hermite(x, y, solveLinear(A, b));
  }

  for (let i = 1; i < n - 1; i++) {
    A[i][i - 1] = dx[i];
    A[i][i] = 2 * (dx[i - 1] + dx[i]);
    A[i][i + 1] = dx[i - 1];
    b[i] = 3 * (dx[i] * slope[i - 1] + dx[i - 1] * slope[i]);
  }
  let d = x[2] - x[0];
  A[0][0] = dx[1];
  A[0][1] = d;
  b[0] = ((dx[0] + 2 * d) * dx[1] * slope[0] + dx[0] ** 2 * slope[1]) / d;

  d = x[n - 1] - x[n - 3];
  A[n - 1][n - 1] = dx[n - 3];
  A[n - 1][n - 2] = d;
  b[n - 1] = (dx[n - 2] ** 2 * slope[n - 3] + (2 * d + dx[n - 2]) * dx[n - 3] * slope[n - 2]) / d;

  return hermite(x, y, solveLinear(A, b));
}

function pchipEdge(h0: number, h1: number, m0: number, m1: number): number {
  // One-sided three-point estimate, shape-preserving (Moler, pchiptx.m).
  let d = ((2 * h0 + h1) * m0 - h0 * m1) / (h0 + h1);
  if (Math.sign(d) !== Math.sign(m0)) d = 0;
  else if (Math.sign(m0) !== Math.sign(m1) && Math.abs(d) > 3 * Math.abs(m0)) d = 3 * m0;
  return d;
}

/** scipy.interpolate.PchipInterpolator. */
export function pchip(x: readonly number[], y: readonly number[]): Interpolator {
  const n = x.length;
  const h = x.slice(1).map((v, i) => v - x[i]);
  const m = h.map((hk, i) => (y[i + 1] - y[i]) / hk);
  if (n === 2) return hermite(x, y, [m[0], m[0]]);

  const d = new Array<number>(n).fill(0);
  for (let k = 1; k < n - 1; k++) {
    const left = m[k - 1];
    const right = m[k];
    if (Math.sign(left) !== Math.sign(right) || left === 0 || right === 0) continue;
    const w1 = 2 * h[k] + h[k - 1];
    const w2 = h[k] + 2 * h[k - 1];
    d[k] = 1 / ((w1 / left + w2 / right) / (w1 + w2));
  }
  d[0] = pchipEdge(h[0], h[1], m[0], m[1]);
  d[n - 1] = pchipEdge(h[n - 2], h[n - 3], m[n - 2], m[n - 3]);
  return hermite(x, y, d);
}

export function linear(x: readonly number[], y: readonly number[]): Interpolator {
  return (t: number) => interp(t, x, y);
}

export function buildInterpolator(
  method: Interpolation,
  x: readonly number[],
  y: readonly number[]
): Interpolator {
  switch (method) {
    case 'cubic_spline':
      return cubicSpline(x, y);
    case 'pchip':
      return pchip(x, y);
    case 'linear':
      return linear(x, y);
    default:
      throw new Error(`Unknown interpolation method: ${method}`);
  }
}

export const normPdf = (z: number): number => Math.exp(-0.5 * z * z) / Math.sqrt(2 * Math.PI);

/** Inverse standard normal CDF, Wichura's AS 241 (PPND16), ~1e-16 accurate. */
export function normPpf(p: number): number {
  if (p <= 0) return -Infinity;
  if (p >= 1) return Infinity;
  const q = p - 0.5;
  if (Math.abs(q) <= 0.425) {
    const r = 0.180625 - q * q;
    return (
      (q *
        (((((((2509.0809287301226727 * r + 33430.575583588128105) * r + 67265.770927008700853) * r +
          45921.953931549871457) * r + 13731.693765509461125) * r + 1971.5909503065514427) * r +
          133.14166789178437745) * r + 3.387132872796366608)) /
      (((((((5226.495278852545925 * r + 28729.085735721942674) * r + 39307.89580009271061) * r +
        21213.794301586595867) * r + 5394.1960214247511077) * r + 687.1870074920579083) * r +
        42.313330701600911252) * r + 1)
    );
  }
  let r = q < 0 ? p : 1 - p;
  r = Math.sqrt(-Math.log(r));
  let value: number;
  if (r <= 5) {
    r -= 1.6;
    value =
      (((((((7.7454501427834140764e-4 * r + 0.0227238449892691845833) * r + 0.24178072517745061177) * r +
        1.27045825245236838258) * r + 3.64784832476320460504) * r + 5.7694972214606914055) * r +
        4.6303378461565452959) * r + 1.42343711074968357734) /
      (((((((1.05075007164441684324e-9 * r + 5.475938084995344946e-4) * r + 0.0151986665636164571966) * r +
        0.14810397642748007459) * r + 0.68976733498510000455) * r + 1.6763848301838038494) * r +
        2.05319162663775882187) * r + 1);
  } else {
    r -= 5;
    value =
      (((((((2.01033439929228813265e-7 * r + 2.71155556874348757815e-5) * r + 0.0012426609473880784386) * r +
        0.026532189526576123093) * r + 0.29656057182850489123) * r + 1.7848265399172913358) * r +
        5.4637849111641143699) * r + 6.6579046435011037772) /
      (((((((2.04426310338993978564e-15 * r + 1.4215117583164458887e-7) * r + 1.8463183175100546818e-5) * r +
        7.868691311456132591e-4) * r + 0.0148753612908506148525) * r + 0.13692988092273580531) * r +
        0.59983220655588793769) * r + 1);
  }
  return q < 0 ? -value : value;
}
