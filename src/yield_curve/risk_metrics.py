import numpy as np
from typing import Dict, List, Optional, Tuple
from dataclasses import dataclass

from .curve import YieldCurve
from .bond import Bond, BondPortfolio
from .deformations import CurveDeformer, DeformationResult


@dataclass
class RiskMetrics:
    macaulay_duration: float
    modified_duration: float
    effective_duration: float
    dv01: float
    convexity: float
    effective_convexity: float

    def price_change_estimate(self, yield_change_bps: float) -> float:
        dy = yield_change_bps / 10000
        duration_effect = -self.modified_duration * dy
        convexity_effect = 0.5 * self.convexity * (dy ** 2)
        return (duration_effect + convexity_effect) * 100


@dataclass
class KeyRateDurations:
    tenors: np.ndarray
    durations: np.ndarray

    def total_duration(self) -> float:
        return np.sum(self.durations)

    def to_dict(self) -> Dict[float, float]:
        return {t: d for t, d in zip(self.tenors, self.durations)}


@dataclass
class ScenarioRisk:
    scenario_name: str
    price_change: float
    price_change_pct: float
    duration_contribution: float
    convexity_contribution: float


class RiskCalculator:

    DEFAULT_SHOCK_BPS = 1

    def __init__(self, curve: YieldCurve):
        self.curve = curve
        self.deformer = CurveDeformer(curve)

    def calculate_metrics(self, bond: Bond) -> RiskMetrics:
        base_price = bond.price(self.curve)

        macaulay_dur = self._macaulay_duration(bond, base_price)
        mod_dur = self._modified_duration(bond, base_price, macaulay_dur)
        eff_dur = self._effective_duration(bond, base_price)
        dv01 = self._dv01(bond, base_price)
        conv = self._convexity(bond, base_price)
        eff_conv = self._effective_convexity(bond, base_price)

        return RiskMetrics(
            macaulay_duration=macaulay_dur,
            modified_duration=mod_dur,
            effective_duration=eff_dur,
            dv01=dv01,
            convexity=conv,
            effective_convexity=eff_conv
        )

    def _macaulay_duration(self, bond: Bond, base_price: float) -> float:
        if base_price == 0:
            return 0

        weighted_time = 0.0
        for cf in bond.cash_flows:
            df = self.curve.discount_factor(cf.time)
            pv = cf.amount * df
            weighted_time += cf.time * pv

        return weighted_time / base_price

    def _modified_duration(
        self,
        bond: Bond,
        base_price: float,
        macaulay_dur: float
    ) -> float:
        ytm = bond.yield_to_maturity(base_price)
        return macaulay_dur / (1 + ytm / 100 / bond.frequency)

    def _effective_duration(
        self,
        bond: Bond,
        base_price: float,
        shock_bps: float = DEFAULT_SHOCK_BPS
    ) -> float:
        curve_up = self.curve.shift(shock_bps)
        curve_down = self.curve.shift(-shock_bps)

        price_up = bond.price(curve_up)
        price_down = bond.price(curve_down)

        dy = 2 * shock_bps / 10000
        return (price_down - price_up) / (base_price * dy)

    def _dv01(
        self,
        bond: Bond,
        base_price: float,
        shock_bps: float = DEFAULT_SHOCK_BPS
    ) -> float:
        curve_up = self.curve.shift(shock_bps)
        price_up = bond.price(curve_up)
        return (base_price - price_up) / shock_bps

    def _convexity(self, bond: Bond, base_price: float) -> float:
        if base_price == 0:
            return 0

        weighted_time_sq = 0.0
        for cf in bond.cash_flows:
            df = self.curve.discount_factor(cf.time)
            pv = cf.amount * df
            weighted_time_sq += cf.time * (cf.time + 1 / bond.frequency) * pv

        ytm = bond.yield_to_maturity(base_price)
        discount_factor = (1 + ytm / 100 / bond.frequency) ** 2

        return weighted_time_sq / (base_price * discount_factor)

    def _effective_convexity(
        self,
        bond: Bond,
        base_price: float,
        shock_bps: float = DEFAULT_SHOCK_BPS
    ) -> float:
        curve_up = self.curve.shift(shock_bps)
        curve_down = self.curve.shift(-shock_bps)

        price_up = bond.price(curve_up)
        price_down = bond.price(curve_down)

        dy = shock_bps / 10000
        return (price_up + price_down - 2 * base_price) / (base_price * dy * dy)

    def key_rate_durations(
        self,
        bond: Bond,
        key_tenors: Optional[np.ndarray] = None,
        shock_bps: float = DEFAULT_SHOCK_BPS
    ) -> KeyRateDurations:
        if key_tenors is None:
            key_tenors = np.array([0.5, 1, 2, 3, 5, 7, 10, 20, 30])

        key_tenors = key_tenors[key_tenors <= bond.maturity * 1.5]

        base_price = bond.price(self.curve)
        durations = np.zeros(len(key_tenors))

        for i, key_tenor in enumerate(key_tenors):
            shocked_curve = self._shock_key_rate(key_tenor, shock_bps)
            price_up = bond.price(shocked_curve)

            shocked_curve_down = self._shock_key_rate(key_tenor, -shock_bps)
            price_down = bond.price(shocked_curve_down)

            dy = 2 * shock_bps / 10000
            durations[i] = (price_down - price_up) / (base_price * dy)

        return KeyRateDurations(tenors=key_tenors, durations=durations)

    def _shock_key_rate(
        self,
        key_tenor: float,
        shock_bps: float,
        width: float = 2.0
    ) -> YieldCurve:
        tenors = self.curve.tenors
        rates = self.curve.rates.copy()

        for i, t in enumerate(tenors):
            distance = abs(t - key_tenor)
            if distance <= width:
                weight = 1 - distance / width
                rates[i] += shock_bps / 100 * weight

        return YieldCurve(tenors, rates, interpolation=self.curve.interpolation)

    def partial_durations(
        self,
        bond: Bond,
        shock_bps: float = DEFAULT_SHOCK_BPS
    ) -> Dict[float, float]:
        base_price = bond.price(self.curve)
        partial_durs = {}

        for tenor in self.curve.tenors:
            shocked_curve_up = self._shock_single_point(tenor, shock_bps)
            shocked_curve_down = self._shock_single_point(tenor, -shock_bps)

            price_up = bond.price(shocked_curve_up)
            price_down = bond.price(shocked_curve_down)

            dy = 2 * shock_bps / 10000
            partial_durs[tenor] = (price_down - price_up) / (base_price * dy)

        return partial_durs

    def _shock_single_point(self, tenor: float, shock_bps: float) -> YieldCurve:
        tenors = self.curve.tenors
        rates = self.curve.rates.copy()

        idx = np.argmin(np.abs(tenors - tenor))
        rates[idx] += shock_bps / 100

        return YieldCurve(tenors, rates, interpolation=self.curve.interpolation)

    def scenario_analysis(
        self,
        bond: Bond,
        deformation_results: List[DeformationResult]
    ) -> List[ScenarioRisk]:
        base_price = bond.price(self.curve)
        metrics = self.calculate_metrics(bond)
        scenario_risks = []

        for result in deformation_results:
            new_price = bond.price(result.deformed_curve)
            price_change = new_price - base_price
            price_change_pct = (price_change / base_price) * 100

            avg_rate_change = np.mean(result.rate_changes) * 100
            duration_contrib = -metrics.modified_duration * avg_rate_change / 100
            convexity_contrib = (
                0.5 * metrics.convexity * (avg_rate_change / 100) ** 2
            )

            scenario_risks.append(ScenarioRisk(
                scenario_name=result.deformation_type.value,
                price_change=price_change,
                price_change_pct=price_change_pct,
                duration_contribution=duration_contrib * 100,
                convexity_contribution=convexity_contrib * 100
            ))

        return scenario_risks

    def value_at_risk(
        self,
        bond: Bond,
        yield_volatility_bps: float,
        confidence_level: float = 0.95,
        holding_period_days: int = 1
    ) -> float:
        from scipy.stats import norm

        base_price = bond.price(self.curve)
        metrics = self.calculate_metrics(bond)

        z_score = norm.ppf(confidence_level)
        scaled_vol = yield_volatility_bps * np.sqrt(holding_period_days / 252)
        var = base_price * metrics.modified_duration * scaled_vol / 10000 * z_score

        return var

    def expected_shortfall(
        self,
        bond: Bond,
        yield_volatility_bps: float,
        confidence_level: float = 0.95,
        holding_period_days: int = 1
    ) -> float:
        from scipy.stats import norm

        base_price = bond.price(self.curve)
        metrics = self.calculate_metrics(bond)

        z_score = norm.ppf(confidence_level)
        es_multiplier = norm.pdf(z_score) / (1 - confidence_level)

        scaled_vol = yield_volatility_bps * np.sqrt(holding_period_days / 252)
        es = (
            base_price * metrics.modified_duration *
            scaled_vol / 10000 * es_multiplier
        )

        return es


class PortfolioRiskCalculator:

    def __init__(self, curve: YieldCurve, portfolio: BondPortfolio):
        self.curve = curve
        self.portfolio = portfolio
        self.single_risk = RiskCalculator(curve)

    def portfolio_metrics(self) -> RiskMetrics:
        total_value = self.portfolio.total_value(self.curve)
        if total_value == 0:
            return RiskMetrics(0, 0, 0, 0, 0, 0)

        weighted_mac_dur = 0.0
        weighted_mod_dur = 0.0
        weighted_eff_dur = 0.0
        total_dv01 = 0.0
        weighted_conv = 0.0
        weighted_eff_conv = 0.0

        for bond, qty in self.portfolio.positions:
            price = bond.price(self.curve)
            position_value = price * qty
            weight = position_value / total_value

            metrics = self.single_risk.calculate_metrics(bond)

            weighted_mac_dur += weight * metrics.macaulay_duration
            weighted_mod_dur += weight * metrics.modified_duration
            weighted_eff_dur += weight * metrics.effective_duration
            total_dv01 += metrics.dv01 * qty
            weighted_conv += weight * metrics.convexity
            weighted_eff_conv += weight * metrics.effective_convexity

        return RiskMetrics(
            macaulay_duration=weighted_mac_dur,
            modified_duration=weighted_mod_dur,
            effective_duration=weighted_eff_dur,
            dv01=total_dv01,
            convexity=weighted_conv,
            effective_convexity=weighted_eff_conv
        )

    def portfolio_key_rate_durations(
        self,
        key_tenors: Optional[np.ndarray] = None
    ) -> KeyRateDurations:
        if key_tenors is None:
            key_tenors = np.array([0.5, 1, 2, 3, 5, 7, 10, 20, 30])

        total_value = self.portfolio.total_value(self.curve)
        if total_value == 0:
            return KeyRateDurations(key_tenors, np.zeros(len(key_tenors)))

        aggregated_krds = np.zeros(len(key_tenors))

        for bond, qty in self.portfolio.positions:
            price = bond.price(self.curve)
            position_value = price * qty
            weight = position_value / total_value

            bond_krds = self.single_risk.key_rate_durations(bond, key_tenors)

            for i, krd in enumerate(bond_krds.durations):
                aggregated_krds[i] += weight * krd

        return KeyRateDurations(tenors=key_tenors, durations=aggregated_krds)

    def contribution_to_duration(self) -> List[Tuple[Bond, float, float]]:
        total_value = self.portfolio.total_value(self.curve)
        portfolio_metrics = self.portfolio_metrics()
        contributions = []

        for bond, qty in self.portfolio.positions:
            price = bond.price(self.curve)
            position_value = price * qty
            weight = position_value / total_value

            bond_metrics = self.single_risk.calculate_metrics(bond)
            contribution = weight * bond_metrics.modified_duration
            contribution_pct = (
                contribution / portfolio_metrics.modified_duration * 100
                if portfolio_metrics.modified_duration != 0 else 0
            )

            contributions.append((bond, contribution, contribution_pct))

        return contributions

    def scenario_pnl(
        self,
        deformation_result: DeformationResult
    ) -> Tuple[float, float, List[Tuple[Bond, float]]]:
        base_value = self.portfolio.total_value(self.curve)
        new_value = self.portfolio.total_value(deformation_result.deformed_curve)

        total_pnl = new_value - base_value
        total_pnl_pct = (total_pnl / base_value) * 100 if base_value != 0 else 0

        position_pnls = []
        for bond, qty in self.portfolio.positions:
            base_price = bond.price(self.curve)
            new_price = bond.price(deformation_result.deformed_curve)
            pnl = (new_price - base_price) * qty
            position_pnls.append((bond, pnl))

        return total_pnl, total_pnl_pct, position_pnls
