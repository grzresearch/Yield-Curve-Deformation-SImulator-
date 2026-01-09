#!/usr/bin/env python3

import numpy as np
import matplotlib.pyplot as plt
import sys
sys.path.insert(0, '..')

from yield_curve import YieldCurve, CurveDeformer, RiskCalculator, Bond
from yield_curve.bond import BondPortfolio
from yield_curve.risk_metrics import PortfolioRiskCalculator

# Set style for better-looking plots
plt.style.use('seaborn-v0_8-darkgrid')
plt.rcParams['figure.figsize'] = (12, 8)
plt.rcParams['font.size'] = 10

def create_base_curve():
    """Create the base yield curve for all examples"""
    tenors = np.array([0.25, 0.5, 1, 2, 3, 5, 7, 10, 20, 30])
    rates = np.array([5.25, 5.20, 5.00, 4.50, 4.25, 4.00, 4.10, 4.25, 4.50, 4.60])
    return YieldCurve(tenors, rates, interpolation="cubic_spline")

def plot_base_curve(curve, filename='01_base_curve.png'):
    """Plot the base yield curve with interpolation"""
    fig, ax = plt.subplots(figsize=(12, 7))

    # Create dense points for smooth curve
    dense_tenors = np.linspace(curve.tenors[0], curve.tenors[-1], 200)
    dense_rates = curve.rate_at(dense_tenors)

    # Plot interpolated curve
    ax.plot(dense_tenors, dense_rates, 'b-', linewidth=2, label='Interpolated Curve (Cubic Spline)')

    # Plot original points
    ax.plot(curve.tenors, curve.rates, 'ro', markersize=8, label='Market Points', zorder=5)

    ax.set_xlabel('Maturity (Years)', fontsize=12, fontweight='bold')
    ax.set_ylabel('Yield (%)', fontsize=12, fontweight='bold')
    ax.set_title('Base Yield Curve', fontsize=14, fontweight='bold', pad=20)
    ax.grid(True, alpha=0.3)
    ax.legend(fontsize=11)

    # Add annotations for key rates
    for tenor, rate in zip(curve.tenors, curve.rates):
        ax.annotate(f'{rate:.2f}%',
                   xy=(tenor, rate),
                   xytext=(0, 10),
                   textcoords='offset points',
                   ha='center',
                   fontsize=9,
                   bbox=dict(boxstyle='round,pad=0.3', facecolor='yellow', alpha=0.7))

    plt.tight_layout()
    plt.savefig(filename, dpi=300, bbox_inches='tight')
    print(f"Saved: {filename}")
    plt.close()

def plot_parallel_shift(curve, filename='02_parallel_shift.png'):
    """Plot parallel shift deformation"""
    deformer = CurveDeformer(curve)

    fig, ax = plt.subplots(figsize=(12, 7))

    # Dense points for smooth curves
    dense_tenors = np.linspace(curve.tenors[0], curve.tenors[-1], 200)
    base_rates = curve.rate_at(dense_tenors)

    # Plot base curve
    ax.plot(dense_tenors, base_rates, 'b-', linewidth=2, label='Base Curve', zorder=3)

    # Plot shifts
    shifts = [-50, -25, 25, 50]
    colors = ['green', 'lightgreen', 'orange', 'red']

    for shift, color in zip(shifts, colors):
        result = deformer.parallel_shift(shift)
        shifted_rates = result.deformed_curve.rate_at(dense_tenors)
        ax.plot(dense_tenors, shifted_rates, color=color, linewidth=2,
               label=f'{shift:+d} bps', alpha=0.8)

    ax.set_xlabel('Maturity (Years)', fontsize=12, fontweight='bold')
    ax.set_ylabel('Yield (%)', fontsize=12, fontweight='bold')
    ax.set_title('Parallel Shift Deformations', fontsize=14, fontweight='bold', pad=20)
    ax.grid(True, alpha=0.3)
    ax.legend(fontsize=11, loc='best')

    plt.tight_layout()
    plt.savefig(filename, dpi=300, bbox_inches='tight')
    print(f"Saved: {filename}")
    plt.close()

def plot_steepening_flattening(curve, filename='03_steepening_flattening.png'):
    """Plot steepening and flattening deformations"""
    deformer = CurveDeformer(curve)

    fig, (ax1, ax2) = plt.subplots(1, 2, figsize=(16, 7))

    dense_tenors = np.linspace(curve.tenors[0], curve.tenors[-1], 200)
    base_rates = curve.rate_at(dense_tenors)

    # Steepening plot
    ax1.plot(dense_tenors, base_rates, 'b-', linewidth=2, label='Base Curve', zorder=3)

    for magnitude, alpha in [(25, 0.6), (50, 0.8), (100, 1.0)]:
        result = deformer.steepening(magnitude)
        steep_rates = result.deformed_curve.rate_at(dense_tenors)
        ax1.plot(dense_tenors, steep_rates, linewidth=2,
                label=f'Steepening {magnitude} bps', alpha=alpha)

    ax1.set_xlabel('Maturity (Years)', fontsize=12, fontweight='bold')
    ax1.set_ylabel('Yield (%)', fontsize=12, fontweight='bold')
    ax1.set_title('Steepening (Short ↓, Long ↑)', fontsize=13, fontweight='bold', pad=15)
    ax1.grid(True, alpha=0.3)
    ax1.legend(fontsize=10)

    # Flattening plot
    ax2.plot(dense_tenors, base_rates, 'b-', linewidth=2, label='Base Curve', zorder=3)

    for magnitude, alpha in [(25, 0.6), (50, 0.8), (100, 1.0)]:
        result = deformer.flattening(magnitude)
        flat_rates = result.deformed_curve.rate_at(dense_tenors)
        ax2.plot(dense_tenors, flat_rates, linewidth=2,
                label=f'Flattening {magnitude} bps', alpha=alpha)

    ax2.set_xlabel('Maturity (Years)', fontsize=12, fontweight='bold')
    ax2.set_ylabel('Yield (%)', fontsize=12, fontweight='bold')
    ax2.set_title('Flattening (Short ↑, Long ↓)', fontsize=13, fontweight='bold', pad=15)
    ax2.grid(True, alpha=0.3)
    ax2.legend(fontsize=10)

    plt.tight_layout()
    plt.savefig(filename, dpi=300, bbox_inches='tight')
    print(f"Saved: {filename}")
    plt.close()

def plot_twist(curve, filename='04_twist.png'):
    """Plot twist deformations"""
    deformer = CurveDeformer(curve)

    fig, ax = plt.subplots(figsize=(12, 7))

    dense_tenors = np.linspace(curve.tenors[0], curve.tenors[-1], 200)
    base_rates = curve.rate_at(dense_tenors)

    ax.plot(dense_tenors, base_rates, 'b-', linewidth=3, label='Base Curve', zorder=5)

    # Different twist scenarios
    twists = [
        (-20, 30, 'red', 'Short -20, Long +30'),
        (20, -30, 'green', 'Short +20, Long -30'),
        (-30, 50, 'purple', 'Short -30, Long +50'),
    ]

    for short, long, color, label in twists:
        result = deformer.twist(short_shift_bps=short, long_shift_bps=long)
        twist_rates = result.deformed_curve.rate_at(dense_tenors)
        ax.plot(dense_tenors, twist_rates, color=color, linewidth=2,
               label=label, alpha=0.7)

    ax.axvline(x=5.0, color='gray', linestyle='--', alpha=0.5, label='Pivot (5Y)')

    ax.set_xlabel('Maturity (Years)', fontsize=12, fontweight='bold')
    ax.set_ylabel('Yield (%)', fontsize=12, fontweight='bold')
    ax.set_title('Twist Deformations', fontsize=14, fontweight='bold', pad=20)
    ax.grid(True, alpha=0.3)
    ax.legend(fontsize=11)

    plt.tight_layout()
    plt.savefig(filename, dpi=300, bbox_inches='tight')
    print(f"Saved: {filename}")
    plt.close()

def plot_butterfly(curve, filename='05_butterfly.png'):
    """Plot butterfly deformations"""
    deformer = CurveDeformer(curve)

    fig, (ax1, ax2) = plt.subplots(1, 2, figsize=(16, 7))

    dense_tenors = np.linspace(curve.tenors[0], curve.tenors[-1], 200)
    base_rates = curve.rate_at(dense_tenors)

    # Positive butterfly (wings up, belly down)
    ax1.plot(dense_tenors, base_rates, 'b-', linewidth=2, label='Base Curve', zorder=3)

    for magnitude, alpha in [(15, 0.6), (25, 0.8), (40, 1.0)]:
        result = deformer.positive_butterfly(magnitude)
        butterfly_rates = result.deformed_curve.rate_at(dense_tenors)
        ax1.plot(dense_tenors, butterfly_rates, linewidth=2,
                label=f'Pos Butterfly {magnitude} bps', alpha=alpha)

    ax1.set_xlabel('Maturity (Years)', fontsize=12, fontweight='bold')
    ax1.set_ylabel('Yield (%)', fontsize=12, fontweight='bold')
    ax1.set_title('Positive Butterfly (Wings ↑, Belly ↓)', fontsize=13, fontweight='bold', pad=15)
    ax1.grid(True, alpha=0.3)
    ax1.legend(fontsize=10)

    # Negative butterfly (wings down, belly up)
    ax2.plot(dense_tenors, base_rates, 'b-', linewidth=2, label='Base Curve', zorder=3)

    for magnitude, alpha in [(15, 0.6), (25, 0.8), (40, 1.0)]:
        result = deformer.negative_butterfly(magnitude)
        butterfly_rates = result.deformed_curve.rate_at(dense_tenors)
        ax2.plot(dense_tenors, butterfly_rates, linewidth=2,
                label=f'Neg Butterfly {magnitude} bps', alpha=alpha)

    ax2.set_xlabel('Maturity (Years)', fontsize=12, fontweight='bold')
    ax2.set_ylabel('Yield (%)', fontsize=12, fontweight='bold')
    ax2.set_title('Negative Butterfly (Wings ↓, Belly ↑)', fontsize=13, fontweight='bold', pad=15)
    ax2.grid(True, alpha=0.3)
    ax2.legend(fontsize=10)

    plt.tight_layout()
    plt.savefig(filename, dpi=300, bbox_inches='tight')
    print(f"Saved: {filename}")
    plt.close()

def plot_bear_bull_scenarios(curve, filename='06_bear_bull_scenarios.png'):
    """Plot bear/bull steepener and flattener scenarios"""
    deformer = CurveDeformer(curve)

    fig, ((ax1, ax2), (ax3, ax4)) = plt.subplots(2, 2, figsize=(16, 14))

    dense_tenors = np.linspace(curve.tenors[0], curve.tenors[-1], 200)
    base_rates = curve.rate_at(dense_tenors)

    # Bear Steepener
    ax1.plot(dense_tenors, base_rates, 'b-', linewidth=2, label='Base Curve')
    result = deformer.bear_steepener(40)
    ax1.plot(dense_tenors, result.deformed_curve.rate_at(dense_tenors),
            'r-', linewidth=2, label='Bear Steepener (+40 bps long end)')
    ax1.set_xlabel('Maturity (Years)', fontsize=11, fontweight='bold')
    ax1.set_ylabel('Yield (%)', fontsize=11, fontweight='bold')
    ax1.set_title('Bear Steepener (Long Rates Rise)', fontsize=12, fontweight='bold')
    ax1.grid(True, alpha=0.3)
    ax1.legend(fontsize=10)

    # Bull Steepener
    ax2.plot(dense_tenors, base_rates, 'b-', linewidth=2, label='Base Curve')
    result = deformer.bull_steepener(50)
    ax2.plot(dense_tenors, result.deformed_curve.rate_at(dense_tenors),
            'g-', linewidth=2, label='Bull Steepener (-50 bps short end)')
    ax2.set_xlabel('Maturity (Years)', fontsize=11, fontweight='bold')
    ax2.set_ylabel('Yield (%)', fontsize=11, fontweight='bold')
    ax2.set_title('Bull Steepener (Short Rates Fall)', fontsize=12, fontweight='bold')
    ax2.grid(True, alpha=0.3)
    ax2.legend(fontsize=10)

    # Bear Flattener
    ax3.plot(dense_tenors, base_rates, 'b-', linewidth=2, label='Base Curve')
    result = deformer.bear_flattener(30)
    ax3.plot(dense_tenors, result.deformed_curve.rate_at(dense_tenors),
            'orange', linewidth=2, label='Bear Flattener (+30 bps short end)')
    ax3.set_xlabel('Maturity (Years)', fontsize=11, fontweight='bold')
    ax3.set_ylabel('Yield (%)', fontsize=11, fontweight='bold')
    ax3.set_title('Bear Flattener (Short Rates Rise)', fontsize=12, fontweight='bold')
    ax3.grid(True, alpha=0.3)
    ax3.legend(fontsize=10)

    # Bull Flattener
    ax4.plot(dense_tenors, base_rates, 'b-', linewidth=2, label='Base Curve')
    result = deformer.bull_flattener(30)
    ax4.plot(dense_tenors, result.deformed_curve.rate_at(dense_tenors),
            'purple', linewidth=2, label='Bull Flattener (-30 bps long end)')
    ax4.set_xlabel('Maturity (Years)', fontsize=11, fontweight='bold')
    ax4.set_ylabel('Yield (%)', fontsize=11, fontweight='bold')
    ax4.set_title('Bull Flattener (Long Rates Fall)', fontsize=12, fontweight='bold')
    ax4.grid(True, alpha=0.3)
    ax4.legend(fontsize=10)

    plt.tight_layout()
    plt.savefig(filename, dpi=300, bbox_inches='tight')
    print(f"Saved: {filename}")
    plt.close()

def plot_key_rate_durations(curve, filename='07_key_rate_durations.png'):
    """Plot key rate durations for different bond maturities"""
    risk_calc = RiskCalculator(curve)

    fig, ax = plt.subplots(figsize=(12, 7))

    bond_maturities = [2, 5, 10, 30]
    colors = ['blue', 'green', 'red', 'purple']

    for maturity, color in zip(bond_maturities, colors):
        bond = Bond(face_value=1000, coupon_rate=4.0, maturity=maturity, frequency=2)
        krds = risk_calc.key_rate_durations(bond)
        krd_dict = krds.to_dict()

        tenors = list(krd_dict.keys())
        values = list(krd_dict.values())

        ax.bar([t + (bond_maturities.index(maturity) - 1.5) * 0.15 for t in tenors],
               values, width=0.15, label=f'{maturity}Y Bond', color=color, alpha=0.7)

    ax.set_xlabel('Key Rate Tenor (Years)', fontsize=12, fontweight='bold')
    ax.set_ylabel('Duration Contribution', fontsize=12, fontweight='bold')
    ax.set_title('Key Rate Durations by Bond Maturity', fontsize=14, fontweight='bold', pad=20)
    ax.grid(True, alpha=0.3, axis='y')
    ax.legend(fontsize=11)
    ax.set_xticks(list(krds.to_dict().keys()))

    plt.tight_layout()
    plt.savefig(filename, dpi=300, bbox_inches='tight')
    print(f"Saved: {filename}")
    plt.close()

def plot_scenario_analysis(curve, filename='08_scenario_analysis.png'):
    """Plot scenario analysis for a bond"""
    bond = Bond(face_value=1000, coupon_rate=4.0, maturity=10, frequency=2)
    deformer = CurveDeformer(curve)
    risk_calc = RiskCalculator(curve)

    scenarios = [
        {"type": "parallel_shift", "shift_bps": -50},
        {"type": "parallel_shift", "shift_bps": -25},
        {"type": "parallel_shift", "shift_bps": 25},
        {"type": "parallel_shift", "shift_bps": 50},
        {"type": "steepening", "magnitude_bps": 50},
        {"type": "flattening", "magnitude_bps": 50},
        {"type": "butterfly", "wings_shift_bps": 25, "body_shift_bps": -25},
    ]

    results = deformer.scenario_analysis(scenarios)
    scenario_risks = risk_calc.scenario_analysis(bond, results)

    fig, (ax1, ax2) = plt.subplots(1, 2, figsize=(16, 7))

    # Price changes
    scenario_names = [r.scenario_name for r in scenario_risks]
    price_changes = [r.price_change for r in scenario_risks]
    colors = ['green' if pc > 0 else 'red' for pc in price_changes]

    ax1.barh(scenario_names, price_changes, color=colors, alpha=0.7)
    ax1.set_xlabel('Price Change ($)', fontsize=12, fontweight='bold')
    ax1.set_title('Bond Price Changes by Scenario\n(10Y Bond, 4% Coupon)',
                  fontsize=13, fontweight='bold', pad=15)
    ax1.axvline(x=0, color='black', linewidth=0.8)
    ax1.grid(True, alpha=0.3, axis='x')

    # Percentage changes
    pct_changes = [r.price_change_pct for r in scenario_risks]

    ax2.barh(scenario_names, pct_changes, color=colors, alpha=0.7)
    ax2.set_xlabel('Price Change (%)', fontsize=12, fontweight='bold')
    ax2.set_title('Bond Price Changes by Scenario (%)\n(10Y Bond, 4% Coupon)',
                  fontsize=13, fontweight='bold', pad=15)
    ax2.axvline(x=0, color='black', linewidth=0.8)
    ax2.grid(True, alpha=0.3, axis='x')

    plt.tight_layout()
    plt.savefig(filename, dpi=300, bbox_inches='tight')
    print(f"Saved: {filename}")
    plt.close()

def plot_duration_convexity(curve, filename='09_duration_convexity.png'):
    """Plot duration and convexity metrics across maturities"""
    risk_calc = RiskCalculator(curve)

    maturities = np.array([1, 2, 3, 5, 7, 10, 15, 20, 30])
    durations = []
    convexities = []
    dv01s = []

    for mat in maturities:
        bond = Bond(face_value=1000, coupon_rate=4.0, maturity=mat, frequency=2)
        metrics = risk_calc.calculate_metrics(bond)
        durations.append(metrics.modified_duration)
        convexities.append(metrics.convexity)
        dv01s.append(metrics.dv01)

    fig, (ax1, ax2, ax3) = plt.subplots(1, 3, figsize=(18, 6))

    # Duration
    ax1.plot(maturities, durations, 'b-o', linewidth=2, markersize=8)
    ax1.set_xlabel('Bond Maturity (Years)', fontsize=12, fontweight='bold')
    ax1.set_ylabel('Modified Duration', fontsize=12, fontweight='bold')
    ax1.set_title('Modified Duration by Maturity', fontsize=13, fontweight='bold', pad=15)
    ax1.grid(True, alpha=0.3)

    # Convexity
    ax2.plot(maturities, convexities, 'g-o', linewidth=2, markersize=8)
    ax2.set_xlabel('Bond Maturity (Years)', fontsize=12, fontweight='bold')
    ax2.set_ylabel('Convexity', fontsize=12, fontweight='bold')
    ax2.set_title('Convexity by Maturity', fontsize=13, fontweight='bold', pad=15)
    ax2.grid(True, alpha=0.3)

    # DV01
    ax3.plot(maturities, dv01s, 'r-o', linewidth=2, markersize=8)
    ax3.set_xlabel('Bond Maturity (Years)', fontsize=12, fontweight='bold')
    ax3.set_ylabel('DV01 ($)', fontsize=12, fontweight='bold')
    ax3.set_title('DV01 by Maturity', fontsize=13, fontweight='bold', pad=15)
    ax3.grid(True, alpha=0.3)

    plt.tight_layout()
    plt.savefig(filename, dpi=300, bbox_inches='tight')
    print(f"Saved: {filename}")
    plt.close()

def plot_portfolio_analysis(curve, filename='10_portfolio_analysis.png'):
    """Plot portfolio risk metrics and scenario P&L"""
    portfolio = BondPortfolio()
    portfolio.add_position(Bond(1000, 3.5, 2, 2), 100)
    portfolio.add_position(Bond(1000, 4.0, 5, 2), 200)
    portfolio.add_position(Bond(1000, 4.5, 10, 2), 150)
    portfolio.add_position(Bond(1000, 5.0, 30, 2), 50)

    port_risk = PortfolioRiskCalculator(curve, portfolio)

    fig, (ax1, ax2) = plt.subplots(1, 2, figsize=(16, 7))

    # Duration contribution
    contributions = port_risk.contribution_to_duration()
    maturities = [bond.maturity for bond, _, _ in contributions]
    contribs = [contrib for _, contrib, _ in contributions]
    contrib_pcts = [pct for _, _, pct in contributions]

    colors_contrib = plt.cm.viridis(np.linspace(0.2, 0.9, len(maturities)))
    bars1 = ax1.bar(range(len(maturities)), contribs, color=colors_contrib, alpha=0.8)
    ax1.set_xlabel('Bond Maturity', fontsize=12, fontweight='bold')
    ax1.set_ylabel('Duration Contribution', fontsize=12, fontweight='bold')
    ax1.set_title('Portfolio Duration Contribution by Position',
                  fontsize=13, fontweight='bold', pad=15)
    ax1.set_xticks(range(len(maturities)))
    ax1.set_xticklabels([f'{m}Y' for m in maturities])
    ax1.grid(True, alpha=0.3, axis='y')

    # Add percentage labels on bars
    for bar, pct in zip(bars1, contrib_pcts):
        height = bar.get_height()
        ax1.text(bar.get_x() + bar.get_width()/2., height,
                f'{pct:.1f}%', ha='center', va='bottom', fontsize=10, fontweight='bold')

    # Scenario P&L
    deformer = CurveDeformer(curve)
    scenarios = [
        ('Parallel +50', deformer.parallel_shift(50)),
        ('Parallel -50', deformer.parallel_shift(-50)),
        ('Steepening', deformer.steepening(50)),
        ('Flattening', deformer.flattening(50)),
        ('Bear Steep', deformer.bear_steepener(40)),
        ('Bull Flat', deformer.bull_flattener(30)),
    ]

    scenario_names = []
    scenario_pnls = []

    for name, scenario in scenarios:
        total_pnl, pnl_pct, _ = port_risk.scenario_pnl(scenario)
        scenario_names.append(name)
        scenario_pnls.append(total_pnl)

    colors_pnl = ['red' if pnl < 0 else 'green' for pnl in scenario_pnls]
    ax2.barh(scenario_names, scenario_pnls, color=colors_pnl, alpha=0.7)
    ax2.set_xlabel('Portfolio P&L ($)', fontsize=12, fontweight='bold')
    ax2.set_title('Portfolio Scenario Analysis\n(Total Value: $504K)',
                  fontsize=13, fontweight='bold', pad=15)
    ax2.axvline(x=0, color='black', linewidth=0.8)
    ax2.grid(True, alpha=0.3, axis='x')

    # Add value labels
    for i, (name, pnl) in enumerate(zip(scenario_names, scenario_pnls)):
        ax2.text(pnl, i, f' ${pnl:,.0f}',
                va='center', ha='left' if pnl > 0 else 'right',
                fontsize=10, fontweight='bold')

    plt.tight_layout()
    plt.savefig(filename, dpi=300, bbox_inches='tight')
    print(f"Saved: {filename}")
    plt.close()

def main():
    """Generate all visualizations"""
    print("Generating yield curve visualizations...\n")

    curve = create_base_curve()

    plot_base_curve(curve)
    plot_parallel_shift(curve)
    plot_steepening_flattening(curve)
    plot_twist(curve)
    plot_butterfly(curve)
    plot_bear_bull_scenarios(curve)
    plot_key_rate_durations(curve)
    plot_scenario_analysis(curve)
    plot_duration_convexity(curve)
    plot_portfolio_analysis(curve)

    print("\nAll visualizations generated successfully!")
    print("Files saved in current directory with pattern: NN_description.png")

if __name__ == "__main__":
    main()
