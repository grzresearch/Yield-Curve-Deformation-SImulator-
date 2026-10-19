import numpy as np
import pytest

from yield_curve import Bond, YieldCurve

TREASURY_TENORS = np.array([1/12, 1.5/12, 2/12, 0.25, 4/12, 0.5, 1, 2, 3, 5, 7, 10, 20, 30])
TREASURY_PAR = np.array([4.12, 4.14, 4.17, 4.26, 4.32, 4.34, 4.46, 4.74, 4.82, 4.89, 4.98, 5.09, 5.47, 5.43])


def test_par_rate_handles_maturities_shorter_than_a_coupon_period(readme_curve):
    df = readme_curve.discount_factor(0.25)
    assert readme_curve.par_rate(0.25) == pytest.approx((1 / df - 1) / 0.25 * 100)


def test_par_rate_on_regular_grid_matches_annuity_formula(readme_curve):
    times = np.arange(0.5, 10.25, 0.5)
    dfs = readme_curve.discount_factors(times)
    expected = (1 - dfs[-1]) / (dfs.sum() * 0.5) * 100
    assert readme_curve.par_rate(10) == pytest.approx(expected, rel=1e-12)


def test_flat_par_curve_bootstraps_to_flat_zero_curve():
    tenors = np.array([0.5, 1, 2, 5, 10, 30])
    curve = YieldCurve.from_par_yields(tenors, np.full(6, 4.0))
    continuous = 2 * np.log1p(0.04 / 2) * 100
    np.testing.assert_allclose(curve.rates, continuous, rtol=1e-12)


@pytest.mark.parametrize("interpolation", ["cubic_spline", "pchip", "linear"])
def test_bootstrapped_curve_reprices_its_par_bonds_exactly(interpolation):
    curve = YieldCurve.from_par_yields(TREASURY_TENORS, TREASURY_PAR, interpolation=interpolation)
    for maturity, coupon in zip(TREASURY_TENORS[5:], TREASURY_PAR[5:]):
        assert Bond(100, coupon, maturity, frequency=2).price(curve) == pytest.approx(100, abs=1e-8)
    np.testing.assert_allclose(
        [curve.par_rate(t) for t in TREASURY_TENORS], TREASURY_PAR, atol=1e-9
    )


def test_bootstrap_money_market_tenors_use_simple_yield():
    curve = YieldCurve.from_par_yields(TREASURY_TENORS, TREASURY_PAR)
    t = 0.25
    expected = np.log1p(0.0426 * t) / t * 100
    assert curve.rates[3] == pytest.approx(expected, rel=1e-12)


def test_repr_reports_slope_in_basis_points(readme_curve):
    assert "slope_2_10=-25.0bps" in repr(readme_curve)
