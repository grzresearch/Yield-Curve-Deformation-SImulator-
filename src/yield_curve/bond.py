import numpy as np
from typing import Optional, List, Tuple
from dataclasses import dataclass

from .curve import YieldCurve


@dataclass
class CashFlow:
    time: float
    amount: float
    is_principal: bool = False


class Bond:

    def __init__(
        self,
        face_value: float,
        coupon_rate: float,
        maturity: float,
        frequency: int = 2,
        settlement_date: Optional[str] = None
    ):
        self.face_value = face_value
        self.coupon_rate = coupon_rate
        self.maturity = maturity
        self.frequency = frequency
        self.settlement_date = settlement_date
        self._generate_cash_flows()

    def _generate_cash_flows(self):
        period = 1 / self.frequency
        coupon_payment = self.face_value * (self.coupon_rate / 100) / self.frequency

        self.cash_flows: List[CashFlow] = []
        t = period

        while t < self.maturity - period / 2:
            self.cash_flows.append(CashFlow(time=t, amount=coupon_payment))
            t += period

        final_payment = coupon_payment + self.face_value
        self.cash_flows.append(
            CashFlow(time=self.maturity, amount=final_payment, is_principal=True)
        )

    def price(self, curve: YieldCurve) -> float:
        pv = 0.0
        for cf in self.cash_flows:
            df = curve.discount_factor(cf.time)
            pv += cf.amount * df
        return pv

    def price_from_yield(self, ytm: float) -> float:
        pv = 0.0
        for cf in self.cash_flows:
            df = np.exp(-ytm / 100 * cf.time)
            pv += cf.amount * df
        return pv

    def yield_to_maturity(
        self,
        price: float,
        initial_guess: float = 5.0,
        tolerance: float = 1e-8,
        max_iterations: int = 100
    ) -> float:
        ytm = initial_guess

        for _ in range(max_iterations):
            calc_price = self.price_from_yield(ytm)
            price_diff = calc_price - price

            if abs(price_diff) < tolerance:
                return ytm

            dur = self._modified_duration_from_yield(ytm)
            if dur == 0:
                break

            ytm_adjustment = price_diff / (price * dur / 100)
            ytm += ytm_adjustment

            ytm = max(0.01, min(ytm, 50))

        return ytm

    def _modified_duration_from_yield(self, ytm: float) -> float:
        price = self.price_from_yield(ytm)
        if price == 0:
            return 0

        weighted_time = 0.0
        for cf in self.cash_flows:
            df = np.exp(-ytm / 100 * cf.time)
            weighted_time += cf.time * cf.amount * df

        macaulay_duration = weighted_time / price
        return macaulay_duration / (1 + ytm / 100 / self.frequency)

    def accrued_interest(self, days_since_coupon: int, days_in_period: int = 182) -> float:
        coupon_payment = self.face_value * (self.coupon_rate / 100) / self.frequency
        return coupon_payment * (days_since_coupon / days_in_period)

    def dirty_price(self, clean_price: float, accrued: float) -> float:
        return clean_price + accrued

    def clean_price(self, dirty_price: float, accrued: float) -> float:
        return dirty_price - accrued

    def current_yield(self, price: float) -> float:
        annual_coupon = self.face_value * (self.coupon_rate / 100)
        return (annual_coupon / price) * 100

    def get_cash_flow_schedule(self) -> List[Tuple[float, float]]:
        return [(cf.time, cf.amount) for cf in self.cash_flows]

    @classmethod
    def zero_coupon(cls, face_value: float, maturity: float) -> "Bond":
        bond = cls(face_value=face_value, coupon_rate=0, maturity=maturity)
        bond.cash_flows = [CashFlow(time=maturity, amount=face_value, is_principal=True)]
        return bond

    @classmethod
    def par_bond(cls, face_value: float, maturity: float, curve: YieldCurve) -> "Bond":
        par_rate = curve.par_rate(maturity)
        return cls(face_value=face_value, coupon_rate=par_rate, maturity=maturity)

    def __repr__(self) -> str:
        return (
            f"Bond(coupon={self.coupon_rate}%, maturity={self.maturity}y, "
            f"face={self.face_value})"
        )


class BondPortfolio:

    def __init__(self):
        self.positions: List[Tuple[Bond, float]] = []

    def add_position(self, bond: Bond, quantity: float):
        self.positions.append((bond, quantity))

    def remove_position(self, index: int):
        if 0 <= index < len(self.positions):
            self.positions.pop(index)

    def total_value(self, curve: YieldCurve) -> float:
        total = 0.0
        for bond, qty in self.positions:
            total += bond.price(curve) * qty
        return total

    def position_values(self, curve: YieldCurve) -> List[Tuple[Bond, float, float]]:
        values = []
        for bond, qty in self.positions:
            price = bond.price(curve)
            values.append((bond, qty, price * qty))
        return values

    def total_face_value(self) -> float:
        return sum(bond.face_value * qty for bond, qty in self.positions)

    def weighted_average_maturity(self) -> float:
        total_face = self.total_face_value()
        if total_face == 0:
            return 0
        weighted = sum(
            bond.maturity * bond.face_value * qty
            for bond, qty in self.positions
        )
        return weighted / total_face

    def __len__(self) -> int:
        return len(self.positions)
