#!/usr/bin/env python3
"""Turn market.json into flat CSV feeds for Excel Power Query.

Raw series are passed through; derived values (zero curve, forwards,
FedWatch probabilities) come from the ``yield_curve`` toolkit itself, so the
spreadsheet sees exactly the numbers the dashboard computes. Files use
UTF-8, comma separators and dot decimals - load them with the en-US locale
(see the dashboard's "Data & API" page for a ready-made Power Query script).

Usage:
    python scripts/export_excel_feeds.py web/public/data/market.json
"""

import csv
import json
import sys
from datetime import date, datetime, timezone
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

import numpy as np  # noqa: E402

from yield_curve import FedFundsFuture, FedWatch, YieldCurve  # noqa: E402


def write_csv(path: Path, header, rows):
    with path.open("w", newline="", encoding="utf-8") as handle:
        writer = csv.writer(handle)
        writer.writerow(header)
        writer.writerows(rows)
    print(f"wrote {path}")


def blank(value):
    return "" if value is None else value


def export_history(out: Path, name: str, source: dict):
    write_csv(
        out / f"{name}.csv",
        ["date"] + source["labels"],
        ([row["date"]] + [blank(r) for r in row["rates"]] for row in source["history"]),
    )


def export_curve(out: Path, treasury: dict):
    latest = treasury["history"][-1]
    points = [(t, l, r) for t, l, r in zip(treasury["tenors"], treasury["labels"], latest["rates"]) if r is not None]
    tenors = np.array([p[0] for p in points])
    par = np.array([p[2] for p in points])
    curve = YieldCurve.from_par_yields(tenors, par, frequency=treasury["frequency"], curve_date=latest["date"])

    rows = []
    for (tenor, label, par_yield), zero in zip(points, curve.rates):
        rows.append([
            latest["date"], label, round(tenor, 6), par_yield, round(zero, 6),
            round(curve.instantaneous_forward(tenor), 6), round(curve.discount_factor(tenor), 8),
        ])
    write_csv(
        out / "treasury_zero_curve.csv",
        ["date", "tenor", "years", "par_yield", "zero_rate_cc", "forward_rate", "discount_factor"],
        rows,
    )


def export_fedwatch(out: Path, market: dict):
    fed_funds, futures = market["fedFunds"], market["futures"]
    as_of = datetime.fromisoformat(market["generatedAt"]).astimezone(timezone.utc).date()
    fedwatch = FedWatch(
        meetings=[date.fromisoformat(m["decision"]) for m in market["fomc"]["meetings"]],
        futures=[FedFundsFuture(c["year"], c["month"], c["price"]) for c in futures["contracts"]],
        target_lower=fed_funds["targetLower"],
        target_upper=fed_funds["targetUpper"],
        as_of=as_of,
        effr=fed_funds["effr"],
    )

    changes = sorted({c for o in fedwatch.outlooks for c in o.probabilities})
    lower, upper = fed_funds["targetLower"], fed_funds["targetUpper"]
    ranges = [f"{lower + c / 100:.2f}-{upper + c / 100:.2f}" for c in changes]
    rows = []
    for outlook in fedwatch.outlooks:
        rows.append(
            [outlook.meeting.isoformat(), round(outlook.rate_before, 4), round(outlook.rate_after, 4),
             round(outlook.expected_change_bps, 2)]
            + [round(outlook.probabilities.get(c, 0.0), 6) for c in changes]
        )
    write_csv(
        out / "fedwatch_probabilities.csv",
        ["meeting", "expected_effr_before", "expected_effr_after", "expected_change_bps"] + ranges,
        rows,
    )


def main() -> int:
    market_path = Path(sys.argv[1] if len(sys.argv) > 1 else "web/public/data/market.json")
    market = json.loads(market_path.read_text())
    out = market_path.parent

    export_history(out, "treasury_par_yields", market["treasury"])
    export_curve(out, market["treasury"])
    if "ecb" in market:
        export_history(out, "ecb_aaa_spot_rates", market["ecb"])
    if {"fedFunds", "futures", "fomc"} <= market.keys():
        export_fedwatch(out, market)
    return 0


if __name__ == "__main__":
    sys.exit(main())
