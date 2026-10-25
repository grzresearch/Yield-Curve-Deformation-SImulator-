import numpy as np
from scipy.interpolate import CubicSpline, PchipInterpolator
from typing import Optional, Dict, List, Union
from dataclasses import dataclass


@dataclass
class CurvePoint:
    tenor: float
    rate: float


class YieldCurve:

    STANDARD_TENORS = [0.25, 0.5, 1, 2, 3, 5, 7, 10, 20, 30]

    def __init__(
        self,
        tenors: np.ndarray,
        rates: np.ndarray,
        interpolation: str = "cubic_spline",
        curve_date: Optional[str] = None
    ):
        if len(tenors) != len(rates):
            raise ValueError("Tenors and rates must have same length")
        if len(tenors) < 2:
            raise ValueError("At least 2 points required for interpolation")

        sort_idx = np.argsort(tenors)
        self.tenors = np.array(tenors)[sort_idx]
        self.rates = np.array(rates)[sort_idx]
        self.interpolation = interpolation
        self.curve_date = curve_date
        self._build_interpolator()

    def _build_interpolator(self):
        if self.interpolation == "cubic_spline":
            self._interpolator = CubicSpline(self.tenors, self.rates)
        elif self.interpolation == "pchip":
            self._interpolator = PchipInterpolator(self.tenors, self.rates)
        elif self.interpolation == "linear":
            self._interpolator = lambda x: np.interp(x, self.tenors, self.rates)
        else:
            raise ValueError(f"Unknown interpolation method: {self.interpolation}")

    def rate_at(self, tenor: Union[float, np.ndarray]) -> Union[float, np.ndarray]:
        tenor = np.atleast_1d(tenor)
        result = self._interpolator(tenor)
        return float(result[0]) if len(result) == 1 else result

    def forward_rate(self, t1: float, t2: float) -> float:
        if t2 <= t1:
            raise ValueError("t2 must be greater than t1")
        r1 = self.rate_at(t1)
        r2 = self.rate_at(t2)
        return (r2 * t2 - r1 * t1) / (t2 - t1)

    def instantaneous_forward(self, t: float, delta: float = 0.001) -> float:
        return self.forward_rate(t, t + delta)

    def discount_factor(self, t: float) -> float:
        r = self.rate_at(t)
        return np.exp(-r * t / 100)

    def discount_factors(self, tenors: np.ndarray) -> np.ndarray:
        return np.array([self.discount_factor(t) for t in tenors])

    def par_rate(self, maturity: float, frequency: int = 2) -> float:
        dt = 1 / frequency
        times = np.arange(dt, maturity + dt/2, dt)
        if len(times) == 0:
            times = np.array([maturity])
        times[-1] = maturity
        accruals = np.diff(times, prepend=0.0)

        dfs = self.discount_factors(times)
        annuity = np.sum(dfs * accruals)
        df_mat = dfs[-1]

        return (1 - df_mat) / annuity * 100

    def zero_to_par(self) -> "YieldCurve":
        par_rates = np.array([self.par_rate(t) for t in self.tenors])
        return YieldCurve(
            self.tenors.copy(),
            par_rates,
            interpolation=self.interpolation,
            curve_date=self.curve_date
        )

    def shift(self, basis_points: float) -> "YieldCurve":
        new_rates = self.rates + basis_points / 100
        return YieldCurve(
            self.tenors.copy(),
            new_rates,
            interpolation=self.interpolation,
            curve_date=self.curve_date
        )

    def slope(self, short_tenor: float = 2, long_tenor: float = 10) -> float:
        return self.rate_at(long_tenor) - self.rate_at(short_tenor)

    def curvature(self, short: float = 2, mid: float = 5, long: float = 10) -> float:
        return 2 * self.rate_at(mid) - self.rate_at(short) - self.rate_at(long)

    def copy(self) -> "YieldCurve":
        return YieldCurve(
            self.tenors.copy(),
            self.rates.copy(),
            interpolation=self.interpolation,
            curve_date=self.curve_date
        )

    def to_dict(self) -> Dict:
        return {
            "tenors": self.tenors.tolist(),
            "rates": self.rates.tolist(),
            "interpolation": self.interpolation,
            "curve_date": self.curve_date
        }

    @classmethod
    def from_dict(cls, data: Dict) -> "YieldCurve":
        return cls(
            tenors=np.array(data["tenors"]),
            rates=np.array(data["rates"]),
            interpolation=data.get("interpolation", "cubic_spline"),
            curve_date=data.get("curve_date")
        )

    @classmethod
    def from_par_yields(
        cls,
        tenors: np.ndarray,
        par_yields: np.ndarray,
        frequency: int = 2,
        interpolation: str = "cubic_spline",
        curve_date: Optional[str] = None,
        tolerance: float = 1e-10,
        max_iterations: int = 100
    ) -> "YieldCurve":
        """Bootstrap continuously compounded zero rates from par yields.

        The result reprices its inputs: under the curve's own interpolation,
        ``par_rate(t)`` equals the quoted par yield at every tenor. Tenors up
        to one coupon period are single-payment money-market instruments,
        1 / (1 + y * t), which fixes their zero rate in closed form. Longer
        tenors start from a classic coupon-grid bootstrap (par yields
        interpolated linearly) and are refined by Newton steps until every
        quoted par bond prices exactly at par.
        """
        order = np.argsort(tenors)
        tenors = np.asarray(tenors, dtype=float)[order]
        par = np.asarray(par_yields, dtype=float)[order]
        period = 1 / frequency

        zero = np.empty_like(tenors)
        money_market = tenors <= period + 1e-12
        zero[money_market] = (
            np.log1p(par[money_market] / 100 * tenors[money_market]) / tenors[money_market] * 100
        )

        if np.any(~money_market):
            n_periods = int(np.ceil(tenors[-1] * frequency - 1e-9))
            grid = np.arange(1, n_periods + 1) * period
            coupons = np.interp(grid, tenors, par / 100) / frequency

            dfs = np.empty(n_periods)
            annuity = 0.0
            for i, c in enumerate(coupons):
                dfs[i] = (1 - c * annuity) / (1 + c)
                annuity += dfs[i]

            long_tenors = tenors[~money_market]
            log_dfs = np.interp(long_tenors, grid, np.log(dfs))
            zero[~money_market] = -log_dfs / long_tenors * 100

        curve = cls(tenors, zero, interpolation=interpolation, curve_date=curve_date)
        for _ in range(max_iterations):
            errors = np.array([curve.par_rate(t, frequency) for t in tenors]) - par
            if np.max(np.abs(errors)) < tolerance:
                break
            zero = zero - errors / curve._par_rate_sensitivity(tenors, frequency)
            curve = cls(tenors, zero, interpolation=interpolation, curve_date=curve_date)

        return curve

    def _par_rate_sensitivity(self, tenors: np.ndarray, frequency: int) -> np.ndarray:
        """d par_rate(t) / d zero(t), holding the rest of the curve fixed."""
        dt = 1 / frequency
        sensitivity = np.empty(len(tenors))
        for i, maturity in enumerate(tenors):
            times = np.arange(dt, maturity + dt/2, dt)
            if len(times) == 0:
                times = np.array([maturity])
            times[-1] = maturity
            accruals = np.diff(times, prepend=0.0)
            dfs = self.discount_factors(times)
            annuity = np.sum(dfs * accruals)
            par = (1 - dfs[-1]) / annuity
            sensitivity[i] = maturity * dfs[-1] * (1 + par * accruals[-1]) / annuity
        return sensitivity

    @classmethod
    def flat_curve(cls, rate: float, tenors: Optional[np.ndarray] = None) -> "YieldCurve":
        if tenors is None:
            tenors = np.array(cls.STANDARD_TENORS)
        rates = np.full_like(tenors, rate, dtype=float)
        return cls(tenors, rates)

    @classmethod
    def normal_curve(
        cls,
        short_rate: float = 2.0,
        long_rate: float = 4.0,
        tenors: Optional[np.ndarray] = None
    ) -> "YieldCurve":
        if tenors is None:
            tenors = np.array(cls.STANDARD_TENORS)

        log_tenors = np.log(tenors + 1)
        normalized = log_tenors / np.max(log_tenors)
        rates = short_rate + (long_rate - short_rate) * normalized
        return cls(tenors, rates)

    @classmethod
    def inverted_curve(
        cls,
        short_rate: float = 5.0,
        long_rate: float = 3.0,
        tenors: Optional[np.ndarray] = None
    ) -> "YieldCurve":
        return cls.normal_curve(short_rate, long_rate, tenors)

    def __repr__(self) -> str:
        return f"YieldCurve(points={len(self.tenors)}, slope_2_10={self.slope() * 100:.1f}bps)"
