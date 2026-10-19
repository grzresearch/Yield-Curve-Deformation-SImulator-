#!/usr/bin/env python3
"""Golden values from the Python toolkit for the dashboard's TypeScript port.

The dashboard re-implements ``yield_curve`` in TypeScript so it can run in the
browser. This script evaluates the Python reference on frozen inputs and
writes the results; ``web/tests/parity.test.ts`` asserts the port matches.
CI regenerates the file and fails if it differs from the committed copy.

Usage:
    python scripts/generate_parity_fixtures.py [web/tests/fixtures/parity.json]
"""

import json
import sys
from datetime import date
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

import numpy as np  # noqa: E402

from yield_curve import Bond, CurveDeformer, FedFundsFuture, FedWatch, PolicyPath, RiskCalculator, YieldCurve  # noqa: E402
from yield_curve.bond import BondPortfolio  # noqa: E402
from yield_curve.policy import policy_curve_shift, term_premium_loading  # noqa: E402
from yield_curve.risk_metrics import PortfolioRiskCalculator  # noqa: E402

README = {
    "tenors": [0.25, 0.5, 1, 2, 3, 5, 7, 10, 20, 30],
    "rates": [5.25, 5.20, 5.00, 4.50, 4.25, 4.00, 4.10, 4.25, 4.50, 4.60],
}
# U.S. Treasury par yields, 2026-10-16
TREASURY = {
    "tenors": [1 / 12, 1.5 / 12, 2 / 12, 0.25, 4 / 12, 0.5, 1, 2, 3, 5, 7, 10, 20, 30],
    "par": [4.12, 4.14, 4.17, 4.26, 4.32, 4.34, 4.46, 4.74, 4.82, 4.89, 4.98, 5.09, 5.47, 5.43],
}
# ECB AAA spot curve, 2026-10-15
ECB = {
    "tenors": [0.25, 0.5, 1, 2, 3, 5, 7, 10, 15, 20, 30],
    "rates": [2.5838, 2.7147, 2.8742, 2.9927, 3.0301, 3.1066, 3.218, 3.3904, 3.5969, 3.6933, 3.6713],
}
FEDWATCH = {
    "asOf": "2026-10-19",
    "targetLower": 3.75,
    "targetUpper": 4.00,
    "effr": 3.88,
    "calendar": [
        "2026-09-16", "2026-10-28", "2026-12-09", "2027-01-27", "2027-03-17", "2027-04-28",
        "2027-06-09", "2027-07-28", "2027-09-15", "2027-10-27", "2027-12-08",
    ],
    "futures": [
        [2026, 10, 96.115], [2026, 11, 96.085], [2026, 12, 95.93], [2027, 1, 95.86], [2027, 2, 95.77],
        [2027, 3, 95.7], [2027, 4, 95.6], [2027, 5, 95.525], [2027, 6, 95.465], [2027, 7, 95.43],
        [2027, 8, 95.41], [2027, 9, 95.4], [2027, 10, 95.395], [2027, 11, 95.395], [2027, 12, 95.39],
        [2028, 1, 95.395], [2028, 2, 95.4],
    ],
}
SAMPLE_TENORS = [0.05, 0.1, 0.25, 0.4, 0.75, 1.3, 2, 4.2, 6.5, 9.99, 12, 17.5, 25, 30, 33]
PAR_MATURITIES = [1 / 12, 0.25, 4 / 12, 0.5, 0.75, 1, 2, 5, 7.3, 10, 30]
BONDS = [
    {"face": 1000, "coupon": 4.0, "maturity": 10, "frequency": 2},
    {"face": 1000, "coupon": 3.5, "maturity": 2, "frequency": 2},
    {"face": 100, "coupon": 5.0, "maturity": 30, "frequency": 2},
    {"face": 100, "coupon": 2.25, "maturity": 7.3, "frequency": 1},
    {"face": 100, "coupon": 6.0, "maturity": 4.75, "frequency": 4},
]
SCENARIOS = [
    {"type": "parallel_shift", "shift_bps": 25},
    {"type": "parallel_shift", "shift_bps": -50},
    {"type": "steepening", "magnitude_bps": 50},
    {"type": "flattening", "magnitude_bps": 30, "pivot_tenor": 3, "short_tenor": 1, "long_tenor": 20},
    {"type": "twist", "short_shift_bps": -20, "long_shift_bps": 30},
    {"type": "butterfly", "wings_shift_bps": 25, "body_shift_bps": -25},
    {"type": "positive_butterfly", "magnitude_bps": 15},
    {"type": "negative_butterfly", "magnitude_bps": 40},
    {"type": "bear_steepener", "long_end_shift_bps": 40},
    {"type": "bull_steepener", "short_end_shift_bps": 50},
    {"type": "bear_flattener", "short_end_shift_bps": 30, "pivot_tenor": 3},
    {"type": "bull_flattener", "long_end_shift_bps": 30},
    {"type": "custom", "tenor_shifts": {"1": 10, "5": -5, "30": 20}},
    {"type": "pca", "level_shift": 10, "slope_shift": -20, "curvature_shift": 5},
]


def floats(values):
    return [float(v) for v in values]


def curve_report(curve: YieldCurve) -> dict:
    return {
        "rates": floats(curve.rates),
        "rateAt": floats(curve.rate_at(np.array(SAMPLE_TENORS))),
        "discountFactor": [curve.discount_factor(t) for t in SAMPLE_TENORS],
        "forward": [curve.forward_rate(t, t + 1.5) for t in SAMPLE_TENORS],
        "instantaneousForward": [curve.instantaneous_forward(t) for t in SAMPLE_TENORS],
        "parRate": [curve.par_rate(m) for m in PAR_MATURITIES],
        "slope": curve.slope(),
        "curvature": curve.curvature(),
    }


def risk_report(curve: YieldCurve) -> dict:
    calc = RiskCalculator(curve)
    deformer = CurveDeformer(curve)
    results = deformer.scenario_analysis(SCENARIOS)
    bonds = []
    for spec in BONDS:
        bond = Bond(spec["face"], spec["coupon"], spec["maturity"], spec["frequency"])
        price = bond.price(curve)
        m = calc.calculate_metrics(bond)
        krd = calc.key_rate_durations(bond)
        bonds.append({
            "price": price,
            "ytm": bond.yield_to_maturity(price),
            "currentYield": bond.current_yield(price),
            "metrics": [m.macaulay_duration, m.modified_duration, m.effective_duration,
                        m.dv01, m.convexity, m.effective_convexity],
            "priceChangeEstimate": [m.price_change_estimate(b) for b in (-100, -25, 50)],
            "krdTenors": floats(krd.tenors),
            "krd": floats(krd.durations),
            "partial": [float(v) for v in calc.partial_durations(bond).values()],
            "var": [calc.value_at_risk(bond, 80, c, d) for c, d in ((0.95, 1), (0.99, 10), (0.975, 5))],
            "es": [calc.expected_shortfall(bond, 80, c, d) for c, d in ((0.95, 1), (0.99, 10))],
            "scenarios": [
                [r.price_change, r.price_change_pct, r.duration_contribution, r.convexity_contribution]
                for r in calc.scenario_analysis(bond, results)
            ],
        })

    portfolio = BondPortfolio()
    for spec, qty in zip(BONDS[:4], (100, 200, 150, 50)):
        portfolio.add_position(Bond(spec["face"], spec["coupon"], spec["maturity"], spec["frequency"]), qty)
    port = PortfolioRiskCalculator(curve, portfolio)
    pm = port.portfolio_metrics()
    pnl, pnl_pct, positions = port.scenario_pnl(deformer.steepening(50))

    return {
        "deformations": [
            {"rateChanges": floats(r.rate_changes), "slopeChange": r.slope_change,
             "curvatureChange": r.curvature_change, "type": r.deformation_type.value}
            for r in results
        ],
        "bonds": bonds,
        "portfolio": {
            "value": portfolio.total_value(curve),
            "wam": portfolio.weighted_average_maturity(),
            "metrics": [pm.macaulay_duration, pm.modified_duration, pm.effective_duration,
                        pm.dv01, pm.convexity, pm.effective_convexity],
            "krd": floats(port.portfolio_key_rate_durations().durations),
            "contribution": [[c, pct] for _, c, pct in port.contribution_to_duration()],
            "steepeningPnl": [pnl, pnl_pct] + [p for _, p in positions],
        },
    }


def fedwatch_report() -> dict:
    fw = FedWatch(
        meetings=[date.fromisoformat(d) for d in FEDWATCH["calendar"]],
        futures=[FedFundsFuture(*f) for f in FEDWATCH["futures"]],
        target_lower=FEDWATCH["targetLower"],
        target_upper=FEDWATCH["targetUpper"],
        as_of=date.fromisoformat(FEDWATCH["asOf"]),
        effr=FEDWATCH["effr"],
    )
    market = fw.implied_policy_path()
    hold = PolicyPath.from_moves(market.as_of, market.start_rate, market.meetings, [0] * len(market.meetings))
    cuts = PolicyPath.from_moves(market.as_of, market.start_rate, market.meetings,
                                 [-25 if i % 2 == 0 else 0 for i in range(len(market.meetings))])
    tenors = np.array(TREASURY["tenors"])
    return {
        "meetings": [o.meeting.isoformat() for o in fw.outlooks],
        "rates": floats(fw.rates),
        "outlooks": [
            {"move": {str(k): v for k, v in o.move_probabilities.items()},
             "probabilities": {str(k): v for k, v in o.probabilities.items()},
             "mostLikely": o.most_likely_change_bps}
            for o in fw.outlooks
        ],
        "policy": {
            "termPremiumLoading": floats(term_premium_loading(tenors)),
            "hold": floats(policy_curve_shift(tenors, hold, market)),
            "holdPermanent": floats(policy_curve_shift(tenors, hold, market, half_life_years=None)),
            "cutsWithTermPremium": floats(policy_curve_shift(tenors, cuts, market, 0.75, 15)),
        },
    }


def main() -> int:
    out = Path(sys.argv[1] if len(sys.argv) > 1 else "web/tests/fixtures/parity.json")
    fixtures = {
        "inputs": {"readme": README, "treasury": TREASURY, "ecb": ECB, "fedwatch": FEDWATCH,
                   "sampleTenors": SAMPLE_TENORS, "parMaturities": PAR_MATURITIES,
                   "bonds": BONDS, "scenarios": SCENARIOS},
        "curves": {},
    }
    for interpolation in ("cubic_spline", "pchip", "linear"):
        readme = YieldCurve(np.array(README["tenors"]), np.array(README["rates"]), interpolation)
        treasury = YieldCurve.from_par_yields(np.array(TREASURY["tenors"]), np.array(TREASURY["par"]),
                                              interpolation=interpolation)
        ecb = YieldCurve(np.array(ECB["tenors"]), np.array(ECB["rates"]), interpolation)
        fixtures["curves"][interpolation] = {
            name: {**curve_report(curve), **risk_report(curve)}
            for name, curve in (("readme", readme), ("treasury", treasury), ("ecb", ecb))
        }
    fixtures["fedwatch"] = fedwatch_report()

    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(json.dumps(fixtures, indent=1) + "\n")
    print(f"wrote {out} ({out.stat().st_size / 1024:.0f} KiB)")
    return 0


if __name__ == "__main__":
    sys.exit(main())
