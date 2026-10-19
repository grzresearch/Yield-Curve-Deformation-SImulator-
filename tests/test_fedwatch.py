import calendar
from datetime import date

import pytest

from yield_curve import FedFundsFuture, FedWatch

AS_OF = date(2026, 10, 19)
CALENDAR = [
    date(2026, 9, 16), date(2026, 10, 28), date(2026, 12, 9),
    date(2027, 1, 27), date(2027, 3, 17), date(2027, 4, 28),
]


def month_average(year, month, levels):
    """Average of a step path given as [(first day at level, level), ...]."""
    days = calendar.monthrange(year, month)[1]
    total = 0.0
    for day in range(1, days + 1):
        d = date(year, month, day)
        total += [lvl for start, lvl in levels if start <= d][-1]
    return total / days


def futures_for(levels, months):
    return [FedFundsFuture(y, m, 100 - month_average(y, m, levels)) for y, m in months]


MONTHS = [(2026, 10), (2026, 11), (2026, 12), (2027, 1), (2027, 2), (2027, 3), (2027, 4), (2027, 5)]


def test_recovers_probability_of_a_partly_priced_hike():
    # 40 % chance of +25 bp in October -> expected 3.88 + 0.10
    levels = [(date(2026, 1, 1), 3.88), (date(2026, 10, 29), 3.98)]
    fw = FedWatch(CALENDAR, futures_for(levels, MONTHS), 3.75, 4.00, AS_OF)
    october = fw.outlooks[0]
    assert october.meeting == date(2026, 10, 28)
    assert fw.rates[0] == pytest.approx(3.88)
    assert october.move_probabilities[25] == pytest.approx(0.4)
    assert october.move_probabilities[0] == pytest.approx(0.6)
    assert october.target_range_probabilities(3.75, 4.00)[1][:2] == pytest.approx((4.00, 4.25))


def test_chains_back_to_back_meeting_months():
    # Dec and Jan both hold meetings: Dec's after-rate must be solved from Dec itself.
    levels = [
        (date(2026, 1, 1), 3.88),
        (date(2026, 10, 29), 3.88),
        (date(2026, 12, 10), 3.73),   # 60 % of a 25 bp cut
        (date(2027, 1, 28), 3.63),    # 40 % of another
    ]
    fw = FedWatch(CALENDAR, futures_for(levels, MONTHS), 3.75, 4.00, AS_OF)
    dec, jan = fw.outlooks[1], fw.outlooks[2]
    assert dec.rate_after == pytest.approx(3.73)
    assert dec.move_probabilities[-25] == pytest.approx(0.6)
    assert jan.move_probabilities[-25] == pytest.approx(0.4)
    # Compounded tree: two cuts = 0.6 * 0.4
    assert jan.probabilities[-50] == pytest.approx(0.24)
    assert sum(jan.probabilities.values()) == pytest.approx(1)


def test_fully_priced_moves_are_certain():
    levels = [(date(2026, 1, 1), 3.88), (date(2026, 10, 29), 3.63)]
    fw = FedWatch(CALENDAR, futures_for(levels, MONTHS), 3.75, 4.00, AS_OF)
    assert fw.outlooks[0].move_probabilities == {-25: pytest.approx(1.0)}
    assert fw.outlooks[0].most_likely_change_bps == -25


def test_stops_at_first_meeting_without_a_contract():
    levels = [(date(2026, 1, 1), 3.88)]
    fw = FedWatch(CALENDAR, futures_for(levels, MONTHS[:3]), 3.75, 4.00, AS_OF)
    assert [o.meeting for o in fw.outlooks] == [date(2026, 10, 28), date(2026, 12, 9)]


def test_implied_policy_path_matches_expected_rates():
    levels = [(date(2026, 1, 1), 3.88), (date(2026, 10, 29), 3.98)]
    fw = FedWatch(CALENDAR, futures_for(levels, MONTHS), 3.75, 4.00, AS_OF)
    path = fw.implied_policy_path()
    assert path.start_rate == pytest.approx(3.88)
    assert path.levels == pytest.approx(tuple(fw.rates[1:]))
    assert fw.expected_path()[1][0] == date(2026, 10, 29)
