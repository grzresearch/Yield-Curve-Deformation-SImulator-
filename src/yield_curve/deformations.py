import numpy as np
from typing import Optional, Tuple, Dict, List
from dataclasses import dataclass
from enum import Enum

from .curve import YieldCurve
from .policy import PolicyPath, policy_curve_shift


class DeformationType(Enum):
    PARALLEL_SHIFT = "parallel_shift"
    STEEPENING = "steepening"
    FLATTENING = "flattening"
    TWIST = "twist"
    BUTTERFLY = "butterfly"
    BEAR_STEEPENER = "bear_steepener"
    BULL_STEEPENER = "bull_steepener"
    BEAR_FLATTENER = "bear_flattener"
    BULL_FLATTENER = "bull_flattener"
    CUSTOM = "custom"
    PCA = "pca"
    POLICY = "policy"


@dataclass
class DeformationResult:
    original_curve: YieldCurve
    deformed_curve: YieldCurve
    deformation_type: DeformationType
    parameters: Dict
    rate_changes: np.ndarray

    @property
    def slope_change(self) -> float:
        return self.deformed_curve.slope() - self.original_curve.slope()

    @property
    def curvature_change(self) -> float:
        return self.deformed_curve.curvature() - self.original_curve.curvature()


class CurveDeformer:

    def __init__(self, curve: YieldCurve):
        self.base_curve = curve

    def _apply(
        self,
        shifts: np.ndarray,
        deformation_type: DeformationType,
        parameters: Dict
    ) -> DeformationResult:
        new_rates = self.base_curve.rates + shifts
        deformed = YieldCurve(
            self.base_curve.tenors.copy(),
            new_rates,
            interpolation=self.base_curve.interpolation,
            curve_date=self.base_curve.curve_date
        )

        return DeformationResult(
            original_curve=self.base_curve,
            deformed_curve=deformed,
            deformation_type=deformation_type,
            parameters=parameters,
            rate_changes=new_rates - self.base_curve.rates
        )

    def parallel_shift(self, shift_bps: float) -> DeformationResult:
        shifts = np.full_like(self.base_curve.tenors, shift_bps / 100, dtype=float)
        return self._apply(shifts, DeformationType.PARALLEL_SHIFT, {"shift_bps": shift_bps})

    def steepening(
        self,
        magnitude_bps: float,
        pivot_tenor: float = 5.0,
        short_tenor: float = 2.0,
        long_tenor: float = 10.0
    ) -> DeformationResult:
        shifts = self._calculate_tilt_shifts(
            magnitude_bps, pivot_tenor, short_tenor, long_tenor, steepen=True
        )
        return self._apply(shifts, DeformationType.STEEPENING, {
            "magnitude_bps": magnitude_bps,
            "pivot_tenor": pivot_tenor,
            "short_tenor": short_tenor,
            "long_tenor": long_tenor
        })

    def flattening(
        self,
        magnitude_bps: float,
        pivot_tenor: float = 5.0,
        short_tenor: float = 2.0,
        long_tenor: float = 10.0
    ) -> DeformationResult:
        shifts = self._calculate_tilt_shifts(
            magnitude_bps, pivot_tenor, short_tenor, long_tenor, steepen=False
        )
        return self._apply(shifts, DeformationType.FLATTENING, {
            "magnitude_bps": magnitude_bps,
            "pivot_tenor": pivot_tenor,
            "short_tenor": short_tenor,
            "long_tenor": long_tenor
        })

    def _calculate_tilt_shifts(
        self,
        magnitude_bps: float,
        pivot_tenor: float,
        short_tenor: float,
        long_tenor: float,
        steepen: bool
    ) -> np.ndarray:
        tenors = self.base_curve.tenors
        shifts = np.zeros_like(tenors, dtype=float)

        for i, t in enumerate(tenors):
            if t <= pivot_tenor:
                weight = (pivot_tenor - t) / (pivot_tenor - short_tenor)
                weight = np.clip(weight, 0, 1)
                if steepen:
                    shifts[i] = -magnitude_bps / 100 * weight
                else:
                    shifts[i] = magnitude_bps / 100 * weight
            else:
                weight = (t - pivot_tenor) / (long_tenor - pivot_tenor)
                weight = np.clip(weight, 0, 1)
                if steepen:
                    shifts[i] = magnitude_bps / 100 * weight
                else:
                    shifts[i] = -magnitude_bps / 100 * weight

        return shifts

    def twist(
        self,
        short_shift_bps: float,
        long_shift_bps: float,
        pivot_tenor: float = 5.0
    ) -> DeformationResult:
        tenors = self.base_curve.tenors
        shifts = np.zeros_like(tenors, dtype=float)

        for i, t in enumerate(tenors):
            if t <= pivot_tenor:
                weight = t / pivot_tenor
                shifts[i] = (short_shift_bps * (1 - weight)) / 100
            else:
                weight = (t - pivot_tenor) / (tenors[-1] - pivot_tenor)
                shifts[i] = (long_shift_bps * weight) / 100

        return self._apply(shifts, DeformationType.TWIST, {
            "short_shift_bps": short_shift_bps,
            "long_shift_bps": long_shift_bps,
            "pivot_tenor": pivot_tenor
        })

    def butterfly(
        self,
        wings_shift_bps: float,
        body_shift_bps: float,
        short_tenor: float = 2.0,
        mid_tenor: float = 5.0,
        long_tenor: float = 10.0
    ) -> DeformationResult:
        tenors = self.base_curve.tenors
        shifts = np.zeros_like(tenors, dtype=float)

        for i, t in enumerate(tenors):
            if t <= short_tenor:
                weight = 1 - (short_tenor - t) / short_tenor if short_tenor > 0 else 1
                shifts[i] = wings_shift_bps / 100 * weight
            elif t <= mid_tenor:
                progress = (t - short_tenor) / (mid_tenor - short_tenor)
                shifts[i] = (wings_shift_bps + (body_shift_bps - wings_shift_bps) * progress) / 100
            elif t <= long_tenor:
                progress = (t - mid_tenor) / (long_tenor - mid_tenor)
                shifts[i] = (body_shift_bps + (wings_shift_bps - body_shift_bps) * progress) / 100
            else:
                decay = np.exp(-(t - long_tenor) / 5)
                shifts[i] = wings_shift_bps / 100 * decay

        return self._apply(shifts, DeformationType.BUTTERFLY, {
            "wings_shift_bps": wings_shift_bps,
            "body_shift_bps": body_shift_bps,
            "short_tenor": short_tenor,
            "mid_tenor": mid_tenor,
            "long_tenor": long_tenor
        })

    def positive_butterfly(self, magnitude_bps: float = 25) -> DeformationResult:
        return self.butterfly(
            wings_shift_bps=magnitude_bps,
            body_shift_bps=-magnitude_bps
        )

    def negative_butterfly(self, magnitude_bps: float = 25) -> DeformationResult:
        return self.butterfly(
            wings_shift_bps=-magnitude_bps,
            body_shift_bps=magnitude_bps
        )

    def bear_steepener(
        self,
        long_end_shift_bps: float,
        pivot_tenor: float = 5.0
    ) -> DeformationResult:
        tenors = self.base_curve.tenors
        shifts = np.zeros_like(tenors, dtype=float)

        for i, t in enumerate(tenors):
            if t >= pivot_tenor:
                weight = (t - pivot_tenor) / (tenors[-1] - pivot_tenor)
                shifts[i] = long_end_shift_bps / 100 * weight

        return self._apply(shifts, DeformationType.BEAR_STEEPENER, {
            "long_end_shift_bps": long_end_shift_bps,
            "pivot_tenor": pivot_tenor
        })

    def bull_steepener(
        self,
        short_end_shift_bps: float,
        pivot_tenor: float = 5.0
    ) -> DeformationResult:
        tenors = self.base_curve.tenors
        shifts = np.zeros_like(tenors, dtype=float)

        for i, t in enumerate(tenors):
            if t <= pivot_tenor:
                weight = (pivot_tenor - t) / pivot_tenor
                shifts[i] = -abs(short_end_shift_bps) / 100 * weight

        return self._apply(shifts, DeformationType.BULL_STEEPENER, {
            "short_end_shift_bps": short_end_shift_bps,
            "pivot_tenor": pivot_tenor
        })

    def bear_flattener(
        self,
        short_end_shift_bps: float,
        pivot_tenor: float = 5.0
    ) -> DeformationResult:
        tenors = self.base_curve.tenors
        shifts = np.zeros_like(tenors, dtype=float)

        for i, t in enumerate(tenors):
            if t <= pivot_tenor:
                weight = (pivot_tenor - t) / pivot_tenor
                shifts[i] = abs(short_end_shift_bps) / 100 * weight

        return self._apply(shifts, DeformationType.BEAR_FLATTENER, {
            "short_end_shift_bps": short_end_shift_bps,
            "pivot_tenor": pivot_tenor
        })

    def bull_flattener(
        self,
        long_end_shift_bps: float,
        pivot_tenor: float = 5.0
    ) -> DeformationResult:
        tenors = self.base_curve.tenors
        shifts = np.zeros_like(tenors, dtype=float)

        for i, t in enumerate(tenors):
            if t >= pivot_tenor:
                weight = (t - pivot_tenor) / (tenors[-1] - pivot_tenor)
                shifts[i] = -abs(long_end_shift_bps) / 100 * weight

        return self._apply(shifts, DeformationType.BULL_FLATTENER, {
            "long_end_shift_bps": long_end_shift_bps,
            "pivot_tenor": pivot_tenor
        })

    def custom_deformation(
        self,
        tenor_shifts: Dict[float, float]
    ) -> DeformationResult:
        shift_tenors = np.array(sorted(float(t) for t in tenor_shifts.keys()))
        lookup = {float(t): v for t, v in tenor_shifts.items()}
        shift_values = np.array([lookup[t] for t in shift_tenors]) / 100

        shifts = np.interp(self.base_curve.tenors, shift_tenors, shift_values)
        return self._apply(shifts, DeformationType.CUSTOM, {"tenor_shifts": tenor_shifts})

    def pca_deformation(
        self,
        level_shift: float = 0,
        slope_shift: float = 0,
        curvature_shift: float = 0
    ) -> DeformationResult:
        tenors = self.base_curve.tenors
        n = len(tenors)

        normalized_tenors = (tenors - tenors.min()) / (tenors.max() - tenors.min())

        level_component = np.ones(n)
        slope_component = normalized_tenors - 0.5
        curvature_component = (normalized_tenors - 0.5) ** 2 - 1/12

        level_component /= np.linalg.norm(level_component)
        slope_component /= np.linalg.norm(slope_component)
        curvature_component /= np.linalg.norm(curvature_component)

        shifts = (
            level_shift / 100 * level_component +
            slope_shift / 100 * slope_component +
            curvature_shift / 100 * curvature_component
        )

        return self._apply(shifts, DeformationType.PCA, {
            "level_shift": level_shift,
            "slope_shift": slope_shift,
            "curvature_shift": curvature_shift
        })

    def policy_scenario(
        self,
        scenario: PolicyPath,
        baseline: PolicyPath,
        half_life_years: Optional[float] = 2.0,
        term_premium_bps: float = 0.0
    ) -> DeformationResult:
        """Shift the curve by the surprise of a policy-rate path versus the
        path the market already prices (see ``policy.policy_curve_shift``)."""
        shifts = policy_curve_shift(
            self.base_curve.tenors, scenario, baseline,
            half_life_years=half_life_years,
            term_premium_bps=term_premium_bps
        ) / 100

        return self._apply(shifts, DeformationType.POLICY, {
            "scenario_levels": list(scenario.levels),
            "baseline_levels": list(baseline.levels),
            "half_life_years": half_life_years,
            "term_premium_bps": term_premium_bps
        })

    def scenario_analysis(
        self,
        scenarios: List[Dict]
    ) -> List[DeformationResult]:
        dispatch = {
            "parallel_shift": self.parallel_shift,
            "steepening": self.steepening,
            "flattening": self.flattening,
            "twist": self.twist,
            "butterfly": self.butterfly,
            "positive_butterfly": self.positive_butterfly,
            "negative_butterfly": self.negative_butterfly,
            "bear_steepener": self.bear_steepener,
            "bull_steepener": self.bull_steepener,
            "bear_flattener": self.bear_flattener,
            "bull_flattener": self.bull_flattener,
            "custom": self.custom_deformation,
            "pca": self.pca_deformation,
        }
        results = []

        for scenario in scenarios:
            deform_type = scenario.get("type", "parallel_shift")
            params = {k: v for k, v in scenario.items() if k != "type"}

            if deform_type not in dispatch:
                raise ValueError(f"Unknown deformation type: {deform_type}")

            results.append(dispatch[deform_type](**params))

        return results
