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
        times[-1] = maturity

        dfs = self.discount_factors(times)
        annuity = np.sum(dfs) * dt
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
        return f"YieldCurve(points={len(self.tenors)}, slope_2_10={self.slope():.2f}bps)"
