"""FOMC target-rate probabilities from 30-Day Fed Funds futures.

A re-implementation of the methodology CME Group publishes for its FedWatch
Tool, on the same instrument (CBOT 30-Day Federal Funds futures, ZQ):

1. A contract settles to the average daily effective fed funds rate (EFFR) of
   its delivery month, so ``100 - price`` is the expected monthly average.
2. In an FOMC month that average splits around the decision day ``d`` of an
   ``N``-day month: ``avg = d/N * rate_before + (N-d)/N * rate_after``.
   A month without a meeting pins the rate directly, so whenever the month
   after a meeting is meeting-free its contract gives ``rate_after``; otherwise
   ``rate_after`` is solved from the meeting month itself, chaining forward.
3. The expected change at each meeting is split between the two nearest
   multiples of 25 bp, and the meeting-by-meeting splits compound into a
   probability tree over target ranges.
"""

import calendar
from dataclasses import dataclass
from datetime import date, timedelta
from math import floor
from typing import Dict, List, Optional, Sequence, Tuple

from .policy import PolicyPath

STEP_BPS = 25
_PROBABILITY_FLOOR = 1e-12


@dataclass(frozen=True)
class FedFundsFuture:
    year: int
    month: int
    price: float

    @property
    def implied_rate(self) -> float:
        return 100.0 - self.price


@dataclass(frozen=True)
class MeetingOutlook:
    meeting: date
    rate_before: float
    rate_after: float
    move_probabilities: Dict[int, float]
    probabilities: Dict[int, float]

    @property
    def expected_change_bps(self) -> float:
        return (self.rate_after - self.rate_before) * 100

    @property
    def most_likely_change_bps(self) -> int:
        """Most likely cumulative change versus today's target range."""
        return max(self.probabilities, key=self.probabilities.get)

    def target_range_probabilities(
        self,
        target_lower: float,
        target_upper: float
    ) -> List[Tuple[float, float, float]]:
        return [
            (target_lower + change / 100, target_upper + change / 100, p)
            for change, p in sorted(self.probabilities.items())
        ]


def _next_month(year: int, month: int) -> Tuple[int, int]:
    return (year + 1, 1) if month == 12 else (year, month + 1)


def _previous_month(year: int, month: int) -> Tuple[int, int]:
    return (year - 1, 12) if month == 1 else (year, month - 1)


class FedWatch:

    def __init__(
        self,
        meetings: Sequence[date],
        futures: Sequence[FedFundsFuture],
        target_lower: float,
        target_upper: float,
        as_of: date,
        effr: Optional[float] = None,
        step_bps: int = STEP_BPS
    ):
        self.as_of = as_of
        self.target_lower = target_lower
        self.target_upper = target_upper
        self.effr = effr
        self.step_bps = step_bps

        self._implied = {(f.year, f.month): f.implied_rate for f in futures}
        calendar_months = {(m.year, m.month) for m in meetings}
        self._meeting_months = calendar_months
        self._calendar_horizon = max(calendar_months) if calendar_months else None

        upcoming = sorted(m for m in meetings if m >= as_of)
        self.meetings: List[date] = []
        for m in upcoming:
            if (m.year, m.month) not in self._implied:
                break
            self.meetings.append(m)

        self.rates = self._expected_rates()
        self.outlooks = self._probability_tree()

    def _is_clean(self, year_month: Tuple[int, int]) -> bool:
        """A priced month known to contain no FOMC decision."""
        return (
            self._calendar_horizon is not None
            and year_month <= self._calendar_horizon
            and year_month not in self._meeting_months
            and year_month in self._implied
        )

    def _split(self, meeting: date) -> Tuple[float, float, float]:
        days = calendar.monthrange(meeting.year, meeting.month)[1]
        before = meeting.day / days
        return self._implied[(meeting.year, meeting.month)], before, 1 - before

    def _starting_rate(self) -> float:
        if not self.meetings:
            return self.effr if self.effr is not None else self.target_mid
        first = self.meetings[0]
        previous = _previous_month(first.year, first.month)
        following = _next_month(first.year, first.month)

        if self._is_clean(previous):
            return self._implied[previous]
        average, before, after = self._split(first)
        if self._is_clean(following) and before > 0:
            return (average - after * self._implied[following]) / before
        if self.effr is not None:
            return self.effr
        return average

    def _expected_rates(self) -> List[float]:
        rates = [self._starting_rate()]
        for meeting in self.meetings:
            following = _next_month(meeting.year, meeting.month)
            average, before, after = self._split(meeting)
            if self._is_clean(following):
                rate_after = self._implied[following]
            elif after > 0:
                rate_after = (average - before * rates[-1]) / after
            else:
                rate_after = self._implied.get(following, rates[-1])
            rates.append(rate_after)
        return rates

    def _probability_tree(self) -> List[MeetingOutlook]:
        step = self.step_bps / 100
        distribution = {0: 1.0}
        outlooks = []

        for meeting, before, after in zip(self.meetings, self.rates[:-1], self.rates[1:]):
            steps = (after - before) / step
            if abs(steps - round(steps)) < 1e-9:
                steps = float(round(steps))
            lower = floor(steps)
            p_up = steps - lower
            move = {
                change: p for change, p in (
                    (lower * self.step_bps, 1 - p_up),
                    ((lower + 1) * self.step_bps, p_up)
                ) if p > _PROBABILITY_FLOOR
            }

            compounded: Dict[int, float] = {}
            for cumulative, p_cum in distribution.items():
                for change, p_move in move.items():
                    key = cumulative + change
                    compounded[key] = compounded.get(key, 0.0) + p_cum * p_move
            distribution = {
                k: p for k, p in sorted(compounded.items()) if p > _PROBABILITY_FLOOR
            }

            outlooks.append(MeetingOutlook(
                meeting=meeting,
                rate_before=before,
                rate_after=after,
                move_probabilities=move,
                probabilities=dict(distribution)
            ))
        return outlooks

    @property
    def target_mid(self) -> float:
        return (self.target_lower + self.target_upper) / 2

    def expected_path(self) -> List[Tuple[date, float]]:
        """Expected EFFR today and after each covered meeting."""
        dates = [self.as_of] + [m + timedelta(days=1) for m in self.meetings]
        return list(zip(dates, self.rates))

    def implied_policy_path(self) -> PolicyPath:
        """The market-implied path, as the baseline for policy scenarios."""
        return PolicyPath(
            as_of=self.as_of,
            start_rate=self.rates[0],
            meetings=tuple(self.meetings),
            levels=tuple(self.rates[1:])
        )
