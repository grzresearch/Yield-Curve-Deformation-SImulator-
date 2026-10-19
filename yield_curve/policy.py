"""Monetary-policy transmission: from an FOMC rate path to a yield-curve shift.

Under the expectations hypothesis a continuously compounded zero rate is the
average expected overnight rate over its life plus a term premium:

    z(tau) = 1/tau * integral_0^tau E[r(s)] ds + tp(tau)

The market already prices an expected path (see ``fedwatch``), so only the
*surprise* delta(s) = r_scenario(s) - r_market(s) moves the curve. Beyond the
last modelled meeting the surprise decays with a half-life h, which decides
how far it reaches into the long end:

    dz(tau) = 1/tau * integral_0^tau delta(s) ds + dtp(tau)

The term-premium shock dtp loads on the complement of the Nelson-Siegel slope
factor (zero at the short end, rising towards the long end) and is scaled to
equal ``term_premium_bps`` at the 10-year point.
"""

import numpy as np
from dataclasses import dataclass
from datetime import date, timedelta
from typing import Optional, Sequence, Tuple

DAYS_PER_YEAR = 365.0

# Diebold-Li (2006) decay of the Nelson-Siegel slope loading, per year.
NELSON_SIEGEL_DECAY = 0.0609 * 12
TERM_PREMIUM_ANCHOR_TENOR = 10.0


@dataclass(frozen=True)
class PolicyPath:
    """Piecewise-constant overnight policy rate (%), changing the day after
    each FOMC decision."""

    as_of: date
    start_rate: float
    meetings: Tuple[date, ...]
    levels: Tuple[float, ...]

    def __post_init__(self):
        if len(self.meetings) != len(self.levels):
            raise ValueError("Each meeting needs exactly one post-meeting level")

    @classmethod
    def from_moves(
        cls,
        as_of: date,
        start_rate: float,
        meetings: Sequence[date],
        moves_bps: Sequence[float]
    ) -> "PolicyPath":
        levels = start_rate + np.cumsum(np.asarray(moves_bps, dtype=float)) / 100
        return cls(as_of, start_rate, tuple(meetings), tuple(float(x) for x in levels))

    @property
    def change_times(self) -> np.ndarray:
        """Years from ``as_of`` until each new level takes effect."""
        return np.array([
            (m + timedelta(days=1) - self.as_of).days / DAYS_PER_YEAR
            for m in self.meetings
        ])

    def rate_at(self, t: float) -> float:
        level = self.start_rate
        for change, new_level in zip(self.change_times, self.levels):
            if t >= change:
                level = new_level
        return level


def _surprise_segments(scenario: PolicyPath, baseline: PolicyPath):
    if scenario.as_of != baseline.as_of:
        raise ValueError("Scenario and baseline must share the same as-of date")

    breaks = np.unique(np.concatenate([[0.0], scenario.change_times, baseline.change_times]))
    breaks = breaks[breaks >= 0]
    values = np.array([scenario.rate_at(t) - baseline.rate_at(t) for t in breaks])
    return breaks, values


def _integrated_surprise(
    tau: float,
    breaks: np.ndarray,
    values: np.ndarray,
    half_life_years: Optional[float]
) -> float:
    horizon = breaks[-1]
    total = 0.0
    for start, end, value in zip(breaks[:-1], breaks[1:], values[:-1]):
        total += value * max(0.0, min(tau, end) - start)

    tail = max(0.0, tau - horizon)
    if tail > 0:
        if half_life_years is None or np.isinf(half_life_years):
            total += values[-1] * tail
        elif half_life_years > 0:
            rate = np.log(2) / half_life_years
            total += values[-1] * (1 - np.exp(-rate * tail)) / rate
    return total


def policy_rate_shift(
    tenors: np.ndarray,
    scenario: PolicyPath,
    baseline: PolicyPath,
    half_life_years: Optional[float] = 2.0
) -> np.ndarray:
    """Zero-rate change in bps at each tenor caused by the policy surprise."""
    breaks, values = _surprise_segments(scenario, baseline)
    return np.array([
        _integrated_surprise(float(t), breaks, values, half_life_years) / t * 100
        if t > 0 else values[0] * 100
        for t in np.asarray(tenors, dtype=float)
    ])


def term_premium_loading(
    tenors: np.ndarray,
    decay: float = NELSON_SIEGEL_DECAY,
    anchor_tenor: float = TERM_PREMIUM_ANCHOR_TENOR
) -> np.ndarray:
    def long_end(t):
        x = decay * np.asarray(t, dtype=float)
        with np.errstate(divide="ignore", invalid="ignore"):
            slope = np.where(x > 0, (1 - np.exp(-x)) / x, 1.0)
        return 1 - slope

    return long_end(tenors) / long_end(anchor_tenor)


def policy_curve_shift(
    tenors: np.ndarray,
    scenario: PolicyPath,
    baseline: PolicyPath,
    half_life_years: Optional[float] = 2.0,
    term_premium_bps: float = 0.0
) -> np.ndarray:
    """Total zero-rate change in bps: policy surprise plus term-premium shock."""
    return (
        policy_rate_shift(tenors, scenario, baseline, half_life_years) +
        term_premium_bps * term_premium_loading(tenors)
    )
