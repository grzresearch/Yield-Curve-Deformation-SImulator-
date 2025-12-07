# Yield Curve Deformation Simulator

A Python toolkit for simulating yield curve movements and analyzing fixed income risk metrics. Supports parallel shifts, steepening, flattening, twists, and butterfly deformations with comprehensive duration, DV01, and convexity calculations.

## Features

- **Yield Curve Modeling**
  - Multiple interpolation methods (cubic spline, PCHIP, linear)
  - Forward rate and discount factor calculations
  - Par rate derivation
  - Slope and curvature analytics

- **Curve Deformations**
  - Parallel shifts
  - Steepening / Flattening
  - Twist movements
  - Butterfly spreads (positive and negative)
  - Bear/Bull steepener and flattener scenarios
  - PCA-based deformations (level, slope, curvature)
  - Custom point-by-point deformations

- **Risk Metrics**
  - Macaulay Duration
  - Modified Duration
  - Effective Duration
  - DV01 (Dollar Value of 01)
  - Convexity and Effective Convexity
  - Key Rate Durations
  - Partial Durations
  - Value at Risk (VaR)
  - Expected Shortfall

- **Portfolio Analytics**
  - Aggregate portfolio risk metrics
  - Duration contribution analysis
  - Scenario P&L attribution

## Installation

```bash
pip install -r requirements.txt
```

## Quick Start

```python
import numpy as np
from yield_curve import YieldCurve, CurveDeformer, RiskCalculator, Bond

# Create a yield curve
tenors = np.array([0.25, 0.5, 1, 2, 3, 5, 7, 10, 20, 30])
rates = np.array([5.25, 5.20, 5.00, 4.50, 4.25, 4.00, 4.10, 4.25, 4.50, 4.60])
curve = YieldCurve(tenors, rates)

# Apply deformations
deformer = CurveDeformer(curve)
steep_result = deformer.steepening(50)  # 50 bps steepening
flat_result = deformer.flattening(25)   # 25 bps flattening
butterfly = deformer.positive_butterfly(25)  # Wings up, belly down

# Create a bond and calculate risk metrics
bond = Bond(face_value=1000, coupon_rate=4.0, maturity=10, frequency=2)
risk_calc = RiskCalculator(curve)
metrics = risk_calc.calculate_metrics(bond)

print(f"Modified Duration: {metrics.modified_duration:.4f}")
print(f"DV01: ${metrics.dv01:.4f}")
print(f"Convexity: {metrics.convexity:.4f}")
```

## Curve Deformations

### Parallel Shift
```python
result = deformer.parallel_shift(25)  # +25 bps across all tenors
```

### Steepening / Flattening
```python
# Steepening: short rates down, long rates up
result = deformer.steepening(magnitude_bps=50, pivot_tenor=5.0)

# Flattening: short rates up, long rates down
result = deformer.flattening(magnitude_bps=50, pivot_tenor=5.0)
```

### Twist
```python
# Independent control of short and long end movements
result = deformer.twist(short_shift_bps=-20, long_shift_bps=30, pivot_tenor=5.0)
```

### Butterfly
```python
# Positive butterfly: wings up, belly down
result = deformer.butterfly(wings_shift_bps=25, body_shift_bps=-25)

# Convenience methods
result = deformer.positive_butterfly(25)
result = deformer.negative_butterfly(25)
```

### Bear/Bull Scenarios
```python
# Bear steepener: long end rates rise
result = deformer.bear_steepener(long_end_shift_bps=40)

# Bull steepener: short end rates fall
result = deformer.bull_steepener(short_end_shift_bps=50)

# Bear flattener: short end rates rise
result = deformer.bear_flattener(short_end_shift_bps=30)

# Bull flattener: long end rates fall
result = deformer.bull_flattener(long_end_shift_bps=30)
```

## Risk Metrics

### Single Bond Analysis
```python
risk_calc = RiskCalculator(curve)
metrics = risk_calc.calculate_metrics(bond)

# Access individual metrics
print(f"Macaulay Duration: {metrics.macaulay_duration:.4f} years")
print(f"Modified Duration: {metrics.modified_duration:.4f}")
print(f"Effective Duration: {metrics.effective_duration:.4f}")
print(f"DV01: ${metrics.dv01:.4f}")
print(f"Convexity: {metrics.convexity:.4f}")

# Price change estimate
pct_change = metrics.price_change_estimate(yield_change_bps=50)
```

### Key Rate Durations
```python
krds = risk_calc.key_rate_durations(bond)
for tenor, krd in krds.to_dict().items():
    print(f"{tenor}Y: {krd:.4f}")
```

### Portfolio Analysis
```python
from yield_curve.bond import BondPortfolio
from yield_curve.risk_metrics import PortfolioRiskCalculator

portfolio = BondPortfolio()
portfolio.add_position(Bond(1000, 3.5, 2, 2), quantity=100)
portfolio.add_position(Bond(1000, 4.0, 5, 2), quantity=200)
portfolio.add_position(Bond(1000, 4.5, 10, 2), quantity=150)

port_risk = PortfolioRiskCalculator(curve, portfolio)
port_metrics = port_risk.portfolio_metrics()

print(f"Portfolio Duration: {port_metrics.modified_duration:.4f}")
print(f"Portfolio DV01: ${port_metrics.dv01:.4f}")
```

## Scenario Analysis

```python
scenarios = [
    {"type": "parallel_shift", "shift_bps": 25},
    {"type": "steepening", "magnitude_bps": 50},
    {"type": "butterfly", "wings_shift_bps": 25, "body_shift_bps": -25},
]

results = deformer.scenario_analysis(scenarios)
scenario_risks = risk_calc.scenario_analysis(bond, results)

for risk in scenario_risks:
    print(f"{risk.scenario_name}: {risk.price_change_pct:.4f}%")
```

## API Reference

### YieldCurve
- `rate_at(tenor)` - Get interpolated rate at any tenor
- `forward_rate(t1, t2)` - Calculate forward rate between two times
- `discount_factor(t)` - Get discount factor at time t
- `par_rate(maturity)` - Calculate par rate for given maturity
- `slope(short, long)` - Calculate curve slope
- `curvature(short, mid, long)` - Calculate curve curvature
- `shift(bps)` - Create parallel-shifted curve

### CurveDeformer
- `parallel_shift(shift_bps)`
- `steepening(magnitude_bps, pivot_tenor)`
- `flattening(magnitude_bps, pivot_tenor)`
- `twist(short_shift_bps, long_shift_bps, pivot_tenor)`
- `butterfly(wings_shift_bps, body_shift_bps)`
- `bear_steepener(long_end_shift_bps)`
- `bull_steepener(short_end_shift_bps)`
- `bear_flattener(short_end_shift_bps)`
- `bull_flattener(long_end_shift_bps)`
- `pca_deformation(level, slope, curvature)`
- `custom_deformation(tenor_shifts)`
- `scenario_analysis(scenarios)`

### RiskCalculator
- `calculate_metrics(bond)` - Returns RiskMetrics dataclass
- `key_rate_durations(bond, key_tenors)`
- `partial_durations(bond)`
- `scenario_analysis(bond, deformation_results)`
- `value_at_risk(bond, yield_vol, confidence, holding_period)`
- `expected_shortfall(bond, yield_vol, confidence, holding_period)`

### Bond
- `price(curve)` - Calculate bond price from yield curve
- `price_from_yield(ytm)` - Calculate price from yield to maturity
- `yield_to_maturity(price)` - Solve for YTM given price
- `current_yield(price)` - Calculate current yield

## Examples

See the `examples/` directory for comprehensive usage examples:
- `basic_usage.py` - Full demonstration of all features

## License

MIT License
