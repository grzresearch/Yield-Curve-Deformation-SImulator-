import numpy as np
import pytest

from yield_curve import CurveDeformer
from yield_curve.deformations import DeformationType


def test_parallel_shift_moves_every_tenor(readme_curve):
    result = CurveDeformer(readme_curve).parallel_shift(25)
    np.testing.assert_allclose(result.rate_changes, 0.25)


def test_custom_and_pca_report_their_own_type(readme_curve):
    deformer = CurveDeformer(readme_curve)
    assert deformer.custom_deformation({1: 10, 10: -10}).deformation_type is DeformationType.CUSTOM
    assert deformer.pca_deformation(10, 5, 1).deformation_type is DeformationType.PCA


def test_custom_deformation_accepts_string_tenors_from_json(readme_curve):
    deformer = CurveDeformer(readme_curve)
    a = deformer.custom_deformation({"1": 10, "10": -10}).rate_changes
    b = deformer.custom_deformation({1.0: 10, 10.0: -10}).rate_changes
    np.testing.assert_allclose(a, b)


def test_scenario_analysis_dispatches_every_deformation(readme_curve):
    deformer = CurveDeformer(readme_curve)
    scenarios = [
        {"type": "parallel_shift", "shift_bps": 10},
        {"type": "positive_butterfly", "magnitude_bps": 20},
        {"type": "negative_butterfly", "magnitude_bps": 20},
        {"type": "custom", "tenor_shifts": {2: 5, 10: 15}},
        {"type": "pca", "level_shift": 10},
    ]
    names = [r.deformation_type.value for r in deformer.scenario_analysis(scenarios)]
    assert names == ["parallel_shift", "butterfly", "butterfly", "custom", "pca"]


def test_unknown_scenario_type_is_rejected(readme_curve):
    with pytest.raises(ValueError, match="Unknown deformation type"):
        CurveDeformer(readme_curve).scenario_analysis([{"type": "wobble"}])


def test_deformed_curve_keeps_curve_date(readme_curve):
    readme_curve.curve_date = "2026-10-16"
    assert CurveDeformer(readme_curve).steepening(50).deformed_curve.curve_date == "2026-10-16"
