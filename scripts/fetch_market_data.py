#!/usr/bin/env python3
"""Fetch the market data the dashboard runs on and write it as one JSON file.

Sources (all free, no API keys):
  * U.S. Treasury  - daily par yield curve (home.treasury.gov)
  * ECB            - euro area AAA government spot curve (data-api.ecb.europa.eu)
  * New York Fed   - effective fed funds rate and target range (markets.newyorkfed.org)
  * Federal Reserve - FOMC meeting calendar (federalreserve.gov)
  * CBOT 30-Day Fed Funds futures (ZQ) - delayed settlement prices via Yahoo Finance

Every source is fetched independently. When one fails, its last good value is
carried forward from ``--baseline`` (normally the copy currently deployed on
GitHub Pages) and flagged ``stale``, so one flaky endpoint never takes the
dashboard down. Only the standard library is used.

Usage:
    python scripts/fetch_market_data.py --out web/public/data/market.json \\
        [--baseline https://<user>.github.io/<repo>/data/market.json] \\
        [--baseline web/public/data/market.json]
"""

import argparse
import calendar
import csv
import io
import json
import re
import sys
import time
import traceback
import urllib.request
from datetime import date, datetime, timedelta, timezone
from pathlib import Path

SCHEMA_VERSION = 1
# A short, honest client id. Full browser UA strings get rate-limited by Yahoo,
# which then expects cookies; every source accepts this one.
USER_AGENT = (
    "Mozilla/5.0 (compatible; yield-curve-dashboard/1.0; "
    "+https://github.com/grzresearch/Yield-Curve-Deformation-SImulator-)"
)

TREASURY_URL = (
    "https://home.treasury.gov/resource-center/data-chart-center/interest-rates/"
    "daily-treasury-rates.csv/{year}/all?type=daily_treasury_yield_curve"
    "&field_tdr_date_value={year}&page&_format=csv"
)
TREASURY_COLUMNS = [
    ("1 Mo", "1M", 1 / 12), ("1.5 Month", "6W", 1.5 / 12), ("2 Mo", "2M", 2 / 12),
    ("3 Mo", "3M", 0.25), ("4 Mo", "4M", 4 / 12), ("6 Mo", "6M", 0.5),
    ("1 Yr", "1Y", 1), ("2 Yr", "2Y", 2), ("3 Yr", "3Y", 3), ("5 Yr", "5Y", 5),
    ("7 Yr", "7Y", 7), ("10 Yr", "10Y", 10), ("20 Yr", "20Y", 20), ("30 Yr", "30Y", 30),
]

ECB_URL = (
    "https://data-api.ecb.europa.eu/service/data/YC/B.U2.EUR.4F.G_N_A.SV_C_YM.{keys}"
    "?lastNObservations={n}&format=csvdata&detail=dataonly"
)
ECB_TENORS = [
    ("SR_3M", "3M", 0.25), ("SR_6M", "6M", 0.5), ("SR_1Y", "1Y", 1), ("SR_2Y", "2Y", 2),
    ("SR_3Y", "3Y", 3), ("SR_5Y", "5Y", 5), ("SR_7Y", "7Y", 7), ("SR_10Y", "10Y", 10),
    ("SR_15Y", "15Y", 15), ("SR_20Y", "20Y", 20), ("SR_30Y", "30Y", 30),
]

EFFR_URL = "https://markets.newyorkfed.org/api/rates/unsecured/effr/last/{n}.json"
FOMC_URL = "https://www.federalreserve.gov/monetarypolicy/fomccalendars.htm"
YAHOO_SPARK_URL = "https://query1.finance.yahoo.com/v7/finance/spark?symbols={symbols}&range=5d&interval=1d"
YAHOO_CHART_URL = "https://query1.finance.yahoo.com/v8/finance/chart/{symbol}?range=5d&interval=1d"
FUTURES_MONTH_CODES = "FGHJKMNQUVXZ"
FUTURES_MONTHS_AHEAD = 24

MONTH_ABBREVIATIONS = {name[:3]: i for i, name in enumerate(calendar.month_name) if name}


def http_get(url: str, retries: int = 3, timeout: int = 30) -> bytes:
    last_error = None
    for attempt in range(retries):
        try:
            request = urllib.request.Request(url, headers={"User-Agent": USER_AGENT})
            with urllib.request.urlopen(request, timeout=timeout) as response:
                return response.read()
        except Exception as error:  # noqa: BLE001 - retried, then re-raised
            last_error = error
            time.sleep(2 ** attempt)
    raise last_error


def fetch_treasury(today: date) -> dict:
    rows = {}
    for year in (today.year - 1, today.year):
        text = http_get(TREASURY_URL.format(year=year)).decode("utf-8-sig")
        for record in csv.DictReader(io.StringIO(text)):
            day = datetime.strptime(record["Date"], "%m/%d/%Y").date().isoformat()
            rates = []
            for column, _, _ in TREASURY_COLUMNS:
                value = (record.get(column) or "").strip()
                rates.append(round(float(value), 4) if value not in ("", "N/A") else None)
            rows[day] = rates

    if not rows:
        raise ValueError("Treasury returned no rows")
    history = [{"date": d, "rates": rows[d]} for d in sorted(rows)]
    return {
        "name": "U.S. Treasury par yield curve",
        "basis": "par",
        "frequency": 2,
        "labels": [label for _, label, _ in TREASURY_COLUMNS],
        "tenors": [round(t, 6) for _, _, t in TREASURY_COLUMNS],
        "asOf": history[-1]["date"],
        "history": history,
    }


def fetch_ecb(observations: int = 540) -> dict:
    keys = "+".join(key for key, _, _ in ECB_TENORS)
    text = http_get(ECB_URL.format(keys=keys, n=observations), timeout=60).decode("utf-8")
    index = {key: i for i, (key, _, _) in enumerate(ECB_TENORS)}
    rows = {}
    for record in csv.DictReader(io.StringIO(text)):
        tenor_key = record["KEY"].rsplit(".", 1)[-1]
        if tenor_key not in index or not record["OBS_VALUE"]:
            continue
        rows.setdefault(record["TIME_PERIOD"], [None] * len(ECB_TENORS))[index[tenor_key]] = round(
            float(record["OBS_VALUE"]), 4
        )

    if not rows:
        raise ValueError("ECB returned no observations")
    history = [{"date": d, "rates": rows[d]} for d in sorted(rows)]
    return {
        "name": "Euro area AAA government spot curve (ECB, Svensson)",
        "basis": "zero",
        "frequency": 1,
        "labels": [label for _, label, _ in ECB_TENORS],
        "tenors": [t for _, _, t in ECB_TENORS],
        "asOf": history[-1]["date"],
        "history": history,
    }


def fetch_effr(observations: int = 520) -> dict:
    data = json.loads(http_get(EFFR_URL.format(n=observations)))
    rates = sorted(data["refRates"], key=lambda r: r["effectiveDate"])
    if not rates:
        raise ValueError("NY Fed returned no EFFR observations")
    latest = rates[-1]
    return {
        "asOf": latest["effectiveDate"],
        "effr": latest["percentRate"],
        "targetLower": latest["targetRateFrom"],
        "targetUpper": latest["targetRateTo"],
        "history": [
            {
                "date": r["effectiveDate"],
                "effr": r["percentRate"],
                "lower": r["targetRateFrom"],
                "upper": r["targetRateTo"],
            }
            for r in rates
        ],
    }


def _month_number(text: str) -> int:
    return MONTH_ABBREVIATIONS[text.strip()[:3].title()]


def parse_fomc_calendar(html: str) -> list:
    """Scheduled decision days from the Fed's calendar page, every year it lists.

    Month cells read like "October" or "Apr/May", date cells like "27-28",
    "17-18*" (* = with economic projections) or "30-1" across a month end.
    """
    headings = sorted(
        (m.start(), int(m.group(1))) for m in re.finditer(r"(\d{4}) FOMC Meetings", html)
    )
    meetings = []
    for i, (start, year) in enumerate(headings):
        end = headings[i + 1][0] if i + 1 < len(headings) else len(html)
        section = html[start:end]
        months = re.findall(r'fomc-meeting__month[^>]*><strong>([^<]+)</strong>', section)
        days = re.findall(r'fomc-meeting__date[^>]*>([^<]+)</div>', section)
        for month_text, day_text in zip(months, days):
            numbers = [int(x) for x in re.findall(r"\d+", day_text)]
            if not numbers or not re.match(r"^\s*\d+(-\d+)?\*?\s*$", day_text):
                continue  # notation votes, unscheduled meetings
            parts = month_text.split("/")
            first_month, decision_month = _month_number(parts[0]), _month_number(parts[-1])
            meetings.append({
                "start": date(year, first_month, numbers[0]).isoformat(),
                "decision": date(year, decision_month, numbers[-1]).isoformat(),
                "projections": "*" in day_text,
            })
    return sorted(meetings, key=lambda m: m["decision"])


def fetch_fomc() -> dict:
    meetings = parse_fomc_calendar(http_get(FOMC_URL).decode("utf-8-sig"))
    if len(meetings) < 8:
        raise ValueError(f"FOMC calendar parse found only {len(meetings)} meetings")
    return {"meetings": meetings}


def futures_symbols(today: date) -> list:
    symbols = []
    year, month = today.year, today.month
    for _ in range(FUTURES_MONTHS_AHEAD):
        symbols.append((f"ZQ{FUTURES_MONTH_CODES[month - 1]}{year % 100:02d}", year, month))
        year, month = (year + 1, 1) if month == 12 else (year, month + 1)
    return symbols


def _quote_from_chart(response: dict):
    meta = response.get("meta", {})
    closes = (response.get("indicators", {}).get("quote") or [{}])[0].get("close") or []
    stamps = response.get("timestamp") or []
    offset = meta.get("gmtoffset", 0)
    for stamp, close in reversed(list(zip(stamps, closes))):
        if close is not None:
            session = datetime.fromtimestamp(stamp + offset, tz=timezone.utc).date()
            return {"price": round(close, 4), "date": session.isoformat()}
    return None


def fetch_futures(today: date) -> dict:
    wanted = futures_symbols(today)
    by_symbol = {}
    for chunk_start in range(0, len(wanted), 12):
        chunk = wanted[chunk_start:chunk_start + 12]
        url = YAHOO_SPARK_URL.format(symbols=",".join(f"{s}.CBT" for s, _, _ in chunk))
        try:
            data = json.loads(http_get(url))
            for result in data.get("spark", {}).get("result", []):
                responses = result.get("response") or []
                quote = _quote_from_chart(responses[0]) if responses else None
                if quote:
                    by_symbol[result["symbol"].split(".")[0]] = quote
        except Exception:  # noqa: BLE001 - fall back to one request per contract
            for symbol, _, _ in chunk:
                try:
                    data = json.loads(http_get(YAHOO_CHART_URL.format(symbol=f"{symbol}.CBT"), retries=1))
                    quote = _quote_from_chart(data["chart"]["result"][0])
                    if quote:
                        by_symbol[symbol] = quote
                except Exception:  # noqa: BLE001 - expired or unlisted month
                    continue

    contracts = [
        {"symbol": symbol, "year": year, "month": month, **by_symbol[symbol]}
        for symbol, year, month in wanted if symbol in by_symbol
    ]
    if len(contracts) < 3:
        raise ValueError(f"Only {len(contracts)} fed funds futures quotes received")
    return {
        "instrument": "CBOT 30-Day Federal Funds futures (ZQ), delayed settlement",
        "asOf": max(c["date"] for c in contracts),
        "contracts": contracts,
    }


def load_baseline(location: str) -> dict:
    try:
        if location.startswith("http"):
            return json.loads(http_get(location, retries=2))
        return json.loads(Path(location).read_text())
    except Exception as error:  # noqa: BLE001 - a missing baseline is not fatal
        print(f"baseline {location} unavailable ({error})", file=sys.stderr)
        return {}


def merge_baselines(locations) -> dict:
    """Per source, the first baseline that has it wins (live site, then the committed snapshot)."""
    merged = {"sources": {}}
    for location in locations:
        baseline = load_baseline(location)
        for key in SOURCES:
            if key in baseline and key not in merged:
                merged[key] = baseline[key]
                merged["sources"][key] = baseline.get("sources", {}).get(key, {})
    return merged


SOURCES = {
    "treasury": ("U.S. Department of the Treasury", "https://home.treasury.gov/resource-center/data-chart-center/interest-rates/TextView?type=daily_treasury_yield_curve", fetch_treasury),
    "ecb": ("European Central Bank", "https://data.ecb.europa.eu/data/datasets/YC", lambda today: fetch_ecb()),
    "fedFunds": ("Federal Reserve Bank of New York", "https://www.newyorkfed.org/markets/reference-rates/effr", lambda today: fetch_effr()),
    "fomc": ("Board of Governors of the Federal Reserve System", FOMC_URL, lambda today: fetch_fomc()),
    "futures": ("CBOT via Yahoo Finance (delayed)", "https://www.cmegroup.com/markets/interest-rates/stirs/30-day-federal-fund.html", fetch_futures),
}


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--out", required=True, type=Path)
    parser.add_argument(
        "--baseline", action="append", default=[],
        help="URL or path of a previous market.json; repeatable, earlier ones take precedence",
    )
    args = parser.parse_args()

    now = datetime.now(timezone.utc)
    today = now.date()
    baseline = merge_baselines(args.baseline)
    result = {"schema": SCHEMA_VERSION, "generatedAt": now.isoformat(timespec="seconds"), "sources": {}}

    for key, (provider, url, fetch) in SOURCES.items():
        status = {"provider": provider, "url": url}
        try:
            result[key] = fetch(today)
            status.update(status="ok", fetchedAt=now.isoformat(timespec="seconds"))
            print(f"{key:9s} ok    as of {result[key].get('asOf', '-')}")
        except Exception as error:  # noqa: BLE001 - recorded per source
            previous = baseline.get(key)
            previous_status = baseline.get("sources", {}).get(key, {})
            status.update(
                status="stale" if previous else "error",
                error=f"{type(error).__name__}: {error}",
                fetchedAt=previous_status.get("fetchedAt"),
            )
            if previous:
                result[key] = previous
            print(f"{key:9s} {status['status']:5s} {status['error']}", file=sys.stderr)
            traceback.print_exc(limit=1, file=sys.stderr)
        result["sources"][key] = status

    if "treasury" not in result:
        print("No yield curve available - refusing to publish an empty dashboard", file=sys.stderr)
        return 1

    args.out.parent.mkdir(parents=True, exist_ok=True)
    args.out.write_text(json.dumps(result, separators=(",", ":")))
    print(f"wrote {args.out} ({args.out.stat().st_size / 1024:.0f} KiB)")
    return 0


if __name__ == "__main__":
    sys.exit(main())
