#!/usr/bin/env python3

import numpy as np
import sys
sys.path.insert(0, '..')

from yield_curve import YieldCurve, CurveDeformer, RiskCalculator, Bond
from yield_curve.bond import BondPortfolio
from yield_curve.risk_metrics import PortfolioRiskCalculator


def print_separator(title):
    print(f"\n{'='*60}")
    print(f" {title}")
    print('='*60)


def main():
    print_separator("YIELD CURVE DEFORMATION SIMULATOR")

    tenors = np.array([0.25, 0.5, 1, 2, 3, 5, 7, 10, 20, 30])
    rates = np.array([5.25, 5.20, 5.00, 4.50, 4.25, 4.00, 4.10, 4.25, 4.50, 4.60])

    curve = YieldCurve(tenors, rates, interpolation="cubic_spline")

    print("\nBase Yield Curve:")
    print("-" * 40)
    for t, r in zip(curve.tenors, curve.rates):
        print(f"  {t:5.2f}Y: {r:.3f}%")

    print(f"\n  2s10s Slope: {curve.slope() * 100:.1f} bps")
    print(f"  2s5s10s Curvature: {curve.curvature() * 100:.1f} bps")

    print_separator("CURVE DEFORMATIONS")

    deformer = CurveDeformer(curve)

    print("\n1. PARALLEL SHIFT (+25 bps)")
    print("-" * 40)
    result = deformer.parallel_shift(25)
    for t, orig, new in zip(curve.tenors, curve.rates, result.deformed_curve.rates):
        print(f"  {t:5.2f}Y: {orig:.3f}% -> {new:.3f}% ({(new-orig)*100:+.1f} bps)")

    print("\n2. STEEPENING (50 bps magnitude)")
    print("-" * 40)
    result = deformer.steepening(50)
    print(f"  Original 2s10s: {curve.slope() * 100:.1f} bps")
    print(f"  New 2s10s: {result.deformed_curve.slope() * 100:.1f} bps")
    print(f"  Slope change: {result.slope_change * 100:.1f} bps")

    print("\n3. FLATTENING (50 bps magnitude)")
    print("-" * 40)
    result = deformer.flattening(50)
    print(f"  Original 2s10s: {curve.slope() * 100:.1f} bps")
    print(f"  New 2s10s: {result.deformed_curve.slope() * 100:.1f} bps")
    print(f"  Slope change: {result.slope_change * 100:.1f} bps")

    print("\n4. TWIST (short -20 bps, long +30 bps)")
    print("-" * 40)
    result = deformer.twist(short_shift_bps=-20, long_shift_bps=30)
    print("  Rate changes by tenor:")
    for t, change in zip(curve.tenors, result.rate_changes * 100):
        print(f"    {t:5.2f}Y: {change:+.1f} bps")

    print("\n5. BUTTERFLY (wings +25 bps, body -25 bps)")
    print("-" * 40)
    result = deformer.positive_butterfly(25)
    print(f"  Original curvature: {curve.curvature() * 100:.1f} bps")
    print(f"  New curvature: {result.deformed_curve.curvature() * 100:.1f} bps")
    print(f"  Curvature change: {result.curvature_change * 100:.1f} bps")

    print("\n6. BEAR STEEPENER (+40 bps long end)")
    print("-" * 40)
    result = deformer.bear_steepener(40)
    print(f"  Slope change: {result.slope_change * 100:.1f} bps")
    print("  Rate changes:")
    for t, change in zip(curve.tenors, result.rate_changes * 100):
        if change != 0:
            print(f"    {t:5.2f}Y: {change:+.1f} bps")

    print("\n7. BULL FLATTENER (-30 bps long end)")
    print("-" * 40)
    result = deformer.bull_flattener(30)
    print(f"  Slope change: {result.slope_change * 100:.1f} bps")

    print_separator("BOND RISK METRICS")

    bond = Bond(
        face_value=1000,
        coupon_rate=4.0,
        maturity=10,
        frequency=2
    )

    print(f"\nBond: {bond}")
    print("-" * 40)

    risk_calc = RiskCalculator(curve)
    metrics = risk_calc.calculate_metrics(bond)

    print(f"\n  Bond Price: ${bond.price(curve):.4f}")
    print(f"\n  Duration Metrics:")
    print(f"    Macaulay Duration: {metrics.macaulay_duration:.4f} years")
    print(f"    Modified Duration: {metrics.modified_duration:.4f}")
    print(f"    Effective Duration: {metrics.effective_duration:.4f}")
    print(f"\n  DV01: ${metrics.dv01:.4f}")
    print(f"\n  Convexity Metrics:")
    print(f"    Convexity: {metrics.convexity:.4f}")
    print(f"    Effective Convexity: {metrics.effective_convexity:.4f}")

    print("\n  Price Change Estimates:")
    for bp_change in [-50, -25, 25, 50, 100]:
        pct_change = metrics.price_change_estimate(bp_change)
        print(f"    {bp_change:+4d} bps: {pct_change:+.4f}%")

    print_separator("KEY RATE DURATIONS")

    krds = risk_calc.key_rate_durations(bond)
    print(f"\nKey Rate Durations for {bond.maturity}Y bond:")
    print("-" * 40)
    for tenor, krd in krds.to_dict().items():
        bar = "=" * int(abs(krd) * 10)
        print(f"  {tenor:5.1f}Y: {krd:7.4f} |{bar}")
    print(f"\n  Total Duration: {krds.total_duration():.4f}")

    print_separator("SCENARIO ANALYSIS")

    scenarios = [
        {"type": "parallel_shift", "shift_bps": 25},
        {"type": "parallel_shift", "shift_bps": -25},
        {"type": "steepening", "magnitude_bps": 50},
        {"type": "flattening", "magnitude_bps": 50},
        {"type": "butterfly", "wings_shift_bps": 25, "body_shift_bps": -25},
    ]

    results = deformer.scenario_analysis(scenarios)
    scenario_risks = risk_calc.scenario_analysis(bond, results)

    print("\nScenario P&L Analysis:")
    print("-" * 60)
    print(f"{'Scenario':<20} {'Price Chg':>12} {'% Change':>10}")
    print("-" * 60)

    for risk in scenario_risks:
        print(f"{risk.scenario_name:<20} ${risk.price_change:>10.4f} {risk.price_change_pct:>9.4f}%")

    print_separator("PORTFOLIO ANALYSIS")

    portfolio = BondPortfolio()
    portfolio.add_position(Bond(1000, 3.5, 2, 2), 100)
    portfolio.add_position(Bond(1000, 4.0, 5, 2), 200)
    portfolio.add_position(Bond(1000, 4.5, 10, 2), 150)
    portfolio.add_position(Bond(1000, 5.0, 30, 2), 50)

    print("\nPortfolio Positions:")
    print("-" * 50)
    for bond, qty in portfolio.positions:
        print(f"  {qty:>4} x {bond}")

    port_risk = PortfolioRiskCalculator(curve, portfolio)
    port_metrics = port_risk.portfolio_metrics()

    print(f"\nPortfolio Value: ${portfolio.total_value(curve):,.2f}")
    print(f"Portfolio Modified Duration: {port_metrics.modified_duration:.4f}")
    print(f"Portfolio DV01: ${port_metrics.dv01:,.4f}")
    print(f"Portfolio Convexity: {port_metrics.convexity:.4f}")

    print("\nDuration Contribution by Position:")
    print("-" * 50)
    contributions = port_risk.contribution_to_duration()
    for bond, contrib, contrib_pct in contributions:
        print(f"  {bond.maturity:>2}Y Bond: {contrib:.4f} ({contrib_pct:.1f}%)")

    steep_scenario = deformer.steepening(50)
    total_pnl, pnl_pct, position_pnls = port_risk.scenario_pnl(steep_scenario)

    print(f"\nSteepening Scenario P&L:")
    print("-" * 50)
    print(f"  Total P&L: ${total_pnl:,.2f} ({pnl_pct:.4f}%)")
    print("\n  By Position:")
    for bond, pnl in position_pnls:
        print(f"    {bond.maturity:>2}Y Bond: ${pnl:,.2f}")

    print_separator("VALUE AT RISK")

    vol_bps = 10
    var_95 = risk_calc.value_at_risk(bond, vol_bps, 0.95, 1)
    var_99 = risk_calc.value_at_risk(bond, vol_bps, 0.99, 1)
    es_95 = risk_calc.expected_shortfall(bond, vol_bps, 0.95, 1)

    print(f"\nRisk Metrics (daily, {vol_bps} bps yield vol):")
    print("-" * 40)
    print(f"  95% VaR: ${var_95:.4f}")
    print(f"  99% VaR: ${var_99:.4f}")
    print(f"  95% Expected Shortfall: ${es_95:.4f}")

    print("\n" + "="*60)
    print(" Simulation Complete")
    print("="*60 + "\n")


if __name__ == "__main__":
    main()
