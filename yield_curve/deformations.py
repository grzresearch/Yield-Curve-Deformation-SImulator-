import numpy as np
from typing import Optional, Tuple, Dict, List
from dataclasses import dataclass
from enum import Enum

from .curve import YieldCurve


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

    def parallel_shift(self, shift_bps: float) -> DeformationResult:
        new_rates = self.base_curve.rates + shift_bps / 100
        deformed = YieldCurve(
            self.base_curve.tenors.copy(),
            new_rates,
            interpolation=self.base_curve.interpolation
        )

        return DeformationResult(
            original_curve=self.base_curve,
            deformed_curve=deformed,
            deformation_type=DeformationType.PARALLEL_SHIFT,
            parameters={"shift_bps": shift_bps},
            rate_changes=new_rates - self.base_curve.rates
        )

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
        new_rates = self.base_curve.rates + shifts

        deformed = YieldCurve(
            self.base_curve.tenors.copy(),
            new_rates,
            interpolation=self.base_curve.interpolation
        )

        return DeformationResult(
            original_curve=self.base_curve,
            deformed_curve=deformed,
            deformation_type=DeformationType.STEEPENING,
            parameters={
                "magnitude_bps": magnitude_bps,
                "pivot_tenor": pivot_tenor,
                "short_tenor": short_tenor,
                "long_tenor": long_tenor
            },
            rate_changes=shifts
        )

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
        new_rates = self.base_curve.rates + shifts

        deformed = YieldCurve(
            self.base_curve.tenors.copy(),
            new_rates,
            interpolation=self.base_curve.interpolation
        )

        return DeformationResult(
            original_curve=self.base_curve,
            deformed_curve=deformed,
            deformation_type=DeformationType.FLATTENING,
            parameters={
                "magnitude_bps": magnitude_bps,
                "pivot_tenor": pivot_tenor,
                "short_tenor": short_tenor,
                "long_tenor": long_tenor
            },
            rate_changes=shifts
        )

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

        new_rates = self.base_curve.rates + shifts

        deformed = YieldCurve(
            self.base_curve.tenors.copy(),
            new_rates,
            interpolation=self.base_curve.interpolation
        )

        return DeformationResult(
            original_curve=self.base_curve,
            deformed_curve=deformed,
            deformation_type=DeformationType.TWIST,
            parameters={
                "short_shift_bps": short_shift_bps,
                "long_shift_bps": long_shift_bps,
                "pivot_tenor": pivot_tenor
            },
            rate_changes=shifts
        )

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

        new_rates = self.base_curve.rates + shifts

        deformed = YieldCurve(
            self.base_curve.tenors.copy(),
            new_rates,
            interpolation=self.base_curve.interpolation
        )

        return DeformationResult(
            original_curve=self.base_curve,
            deformed_curve=deformed,
            deformation_type=DeformationType.BUTTERFLY,
            parameters={
                "wings_shift_bps": wings_shift_bps,
                "body_shift_bps": body_shift_bps,
                "short_tenor": short_tenor,
                "mid_tenor": mid_tenor,
                "long_tenor": long_tenor
            },
            rate_changes=shifts
        )

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

        new_rates = self.base_curve.rates + shifts

        deformed = YieldCurve(
            self.base_curve.tenors.copy(),
            new_rates,
            interpolation=self.base_curve.interpolation
        )

        return DeformationResult(
            original_curve=self.base_curve,
            deformed_curve=deformed,
            deformation_type=DeformationType.BEAR_STEEPENER,
            parameters={
                "long_end_shift_bps": long_end_shift_bps,
                "pivot_tenor": pivot_tenor
            },
            rate_changes=shifts
        )

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

        new_rates = self.base_curve.rates + shifts

        deformed = YieldCurve(
            self.base_curve.tenors.copy(),
            new_rates,
            interpolation=self.base_curve.interpolation
        )

        return DeformationResult(
            original_curve=self.base_curve,
            deformed_curve=deformed,
            deformation_type=DeformationType.BULL_STEEPENER,
            parameters={
                "short_end_shift_bps": short_end_shift_bps,
                "pivot_tenor": pivot_tenor
            },
            rate_changes=shifts
        )

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

        new_rates = self.base_curve.rates + shifts

        deformed = YieldCurve(
            self.base_curve.tenors.copy(),
            new_rates,
            interpolation=self.base_curve.interpolation
        )

        return DeformationResult(
            original_curve=self.base_curve,
            deformed_curve=deformed,
            deformation_type=DeformationType.BEAR_FLATTENER,
            parameters={
                "short_end_shift_bps": short_end_shift_bps,
                "pivot_tenor": pivot_tenor
            },
            rate_changes=shifts
        )

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

        new_rates = self.base_curve.rates + shifts

        deformed = YieldCurve(
            self.base_curve.tenors.copy(),
            new_rates,
            interpolation=self.base_curve.interpolation
        )

        return DeformationResult(
            original_curve=self.base_curve,
            deformed_curve=deformed,
            deformation_type=DeformationType.BULL_FLATTENER,
            parameters={
                "long_end_shift_bps": long_end_shift_bps,
                "pivot_tenor": pivot_tenor
            },
            rate_changes=shifts
        )

    def custom_deformation(
        self,
        tenor_shifts: Dict[float, float]
    ) -> DeformationResult:
        shift_tenors = np.array(sorted(tenor_shifts.keys()))
        shift_values = np.array([tenor_shifts[t] for t in shift_tenors]) / 100

        shifts = np.interp(self.base_curve.tenors, shift_tenors, shift_values)
        new_rates = self.base_curve.rates + shifts

        deformed = YieldCurve(
            self.base_curve.tenors.copy(),
            new_rates,
            interpolation=self.base_curve.interpolation
        )

        return DeformationResult(
            original_curve=self.base_curve,
            deformed_curve=deformed,
            deformation_type=DeformationType.PARALLEL_SHIFT,
            parameters={"tenor_shifts": tenor_shifts},
            rate_changes=shifts
        )

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

        new_rates = self.base_curve.rates + shifts

        deformed = YieldCurve(
            self.base_curve.tenors.copy(),
            new_rates,
            interpolation=self.base_curve.interpolation
        )

        return DeformationResult(
            original_curve=self.base_curve,
            deformed_curve=deformed,
            deformation_type=DeformationType.PARALLEL_SHIFT,
            parameters={
                "level_shift": level_shift,
                "slope_shift": slope_shift,
                "curvature_shift": curvature_shift
            },
            rate_changes=shifts
        )

    def scenario_analysis(
        self,
        scenarios: List[Dict]
    ) -> List[DeformationResult]:
        results = []

        for scenario in scenarios:
            deform_type = scenario.get("type", "parallel_shift")
            params = {k: v for k, v in scenario.items() if k != "type"}

            if deform_type == "parallel_shift":
                result = self.parallel_shift(**params)
            elif deform_type == "steepening":
                result = self.steepening(**params)
            elif deform_type == "flattening":
                result = self.flattening(**params)
            elif deform_type == "twist":
                result = self.twist(**params)
            elif deform_type == "butterfly":
                result = self.butterfly(**params)
            elif deform_type == "bear_steepener":
                result = self.bear_steepener(**params)
            elif deform_type == "bull_steepener":
                result = self.bull_steepener(**params)
            elif deform_type == "bear_flattener":
                result = self.bear_flattener(**params)
            elif deform_type == "bull_flattener":
                result = self.bull_flattener(**params)
            else:
                raise ValueError(f"Unknown deformation type: {deform_type}")

            results.append(result)

        return results
