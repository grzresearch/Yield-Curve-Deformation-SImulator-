from datetime import date, timedelta

import numpy as np
import pytest

from yield_curve import CurveDeformer, PolicyPath
from yield_curve.deformations import DeformationType
from yield_curve.policy import policy_curve_shift, policy_rate_shift, term_premium_loading

AS_OF = date(2026, 10, 19)
MEETINGS = (date(2026, 10, 28), date(2026, 12, 9), date(2027, 1, 27))
TENORS = np.array([0.25, 0.5, 1, 2, 5, 10, 30])


def market():
    return PolicyPath(AS_OF, 3.88, MEETINGS, (3.92, 4.13, 4.24))


def test_scenario_equal_to_market_leaves_curve_unchanged():
    np.testing.assert_allclose(policy_rate_shift(TENORS, market(), market()), 0)


def test_permanent_surprise_from_today_shifts_every_tenor_one_for_one():
    base = PolicyPath(AS_OF, 3.88, (), ())
    hike = PolicyPath(AS_OF, 4.13, (), ())
    shift = policy_rate_shift(TENORS, hike, base, half_life_years=None)
    np.testing.assert_allclose(shift, 25)


def test_expectations_hypothesis_average_for_a_single_move():
    base = PolicyPath(AS_OF, 3.88, (), ())
    meeting = AS_OF + timedelta(days=72)
    hike = PolicyPath(AS_OF, 3.88, (meeting,), (4.13,))
    effective = 73 / 365
    shift = policy_rate_shift(np.array([1.0]), hike, base, half_life_years=None)
    assert shift[0] == pytest.approx(25 * (1 - effective))


def test_half_life_controls_reach_into_the_long_end():
    hold = PolicyPath.from_moves(AS_OF, 3.88, MEETINGS, [0, 0, 0])
    persistent = policy_rate_shift(TENORS, hold, market(), half_life_years=10)
    fleeting = policy_rate_shift(TENORS, hold, market(), half_life_years=0.5)
    assert np.all(persistent <= 0) and np.all(fleeting <= 0)
    assert persistent[-1] < fleeting[-1]
    assert persistent[0] == pytest.approx(fleeting[0])


def test_term_premium_loading_is_anchored_at_ten_years():
    loading = term_premium_loading(np.array([0.0, 2.0, 10.0, 30.0]))
    assert loading[0] == 0
    assert loading[2] == pytest.approx(1)
    assert np.all(np.diff(loading) > 0)


def test_policy_scenario_is_a_curve_deformation(readme_curve):
    hold = PolicyPath.from_moves(AS_OF, 3.88, MEETINGS, [0, 0, 0])
    result = CurveDeformer(readme_curve).policy_scenario(hold, market(), term_premium_bps=10)
    expected = policy_curve_shift(readme_curve.tenors, hold, market(), term_premium_bps=10) / 100
    assert result.deformation_type is DeformationType.POLICY
    np.testing.assert_allclose(result.rate_changes, expected, atol=1e-12)


def test_paths_must_share_as_of_date():
    other = PolicyPath(AS_OF + timedelta(days=1), 3.88, (), ())
    with pytest.raises(ValueError):
        policy_rate_shift(TENORS, market(), other)
