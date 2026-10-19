import type { YieldCurve } from './curve';

export interface CashFlow {
  time: number;
  amount: number;
  isPrincipal: boolean;
}

/** Port of `yield_curve.bond.Bond`. Coupon and yields in %, times in years. */
export class Bond {
  readonly faceValue: number;
  readonly couponRate: number;
  readonly maturity: number;
  readonly frequency: number;
  cashFlows: CashFlow[];

  constructor(faceValue: number, couponRate: number, maturity: number, frequency = 2) {
    this.faceValue = faceValue;
    this.couponRate = couponRate;
    this.maturity = maturity;
    this.frequency = frequency;
    this.cashFlows = this.generateCashFlows();
  }

  private generateCashFlows(): CashFlow[] {
    const period = 1 / this.frequency;
    const coupon = (this.faceValue * (this.couponRate / 100)) / this.frequency;
    const flows: CashFlow[] = [];
    let t = period;
    while (t < this.maturity - period / 2) {
      flows.push({ time: t, amount: coupon, isPrincipal: false });
      t += period;
    }
    flows.push({ time: this.maturity, amount: coupon + this.faceValue, isPrincipal: true });
    return flows;
  }

  price(curve: YieldCurve): number {
    let pv = 0;
    for (const cf of this.cashFlows) pv += cf.amount * curve.discountFactor(cf.time);
    return pv;
  }

  priceFromYield(ytm: number): number {
    let pv = 0;
    for (const cf of this.cashFlows) pv += cf.amount * Math.exp((-ytm / 100) * cf.time);
    return pv;
  }

  yieldToMaturity(price: number, initialGuess = 5.0, tolerance = 1e-8, maxIterations = 100): number {
    let ytm = initialGuess;
    for (let i = 0; i < maxIterations; i++) {
      const diff = this.priceFromYield(ytm) - price;
      if (Math.abs(diff) < tolerance) return ytm;
      const duration = this.modifiedDurationFromYield(ytm);
      if (duration === 0) break;
      ytm += diff / ((price * duration) / 100);
      ytm = Math.max(0.01, Math.min(ytm, 50));
    }
    return ytm;
  }

  private modifiedDurationFromYield(ytm: number): number {
    const price = this.priceFromYield(ytm);
    if (price === 0) return 0;
    let weighted = 0;
    for (const cf of this.cashFlows) weighted += cf.time * cf.amount * Math.exp((-ytm / 100) * cf.time);
    return weighted / price / (1 + ytm / 100 / this.frequency);
  }

  accruedInterest(daysSinceCoupon: number, daysInPeriod = 182): number {
    const coupon = (this.faceValue * (this.couponRate / 100)) / this.frequency;
    return coupon * (daysSinceCoupon / daysInPeriod);
  }

  currentYield(price: number): number {
    return ((this.faceValue * (this.couponRate / 100)) / price) * 100;
  }

  static zeroCoupon(faceValue: number, maturity: number): Bond {
    const bond = new Bond(faceValue, 0, maturity);
    bond.cashFlows = [{ time: maturity, amount: faceValue, isPrincipal: true }];
    return bond;
  }

  static parBond(faceValue: number, maturity: number, curve: YieldCurve): Bond {
    return new Bond(faceValue, curve.parRate(maturity), maturity);
  }

  toString(): string {
    return `Bond(coupon=${this.couponRate}%, maturity=${this.maturity}y, face=${this.faceValue})`;
  }
}

export interface Position {
  bond: Bond;
  quantity: number;
}

/** Port of `yield_curve.bond.BondPortfolio`. */
export class BondPortfolio {
  positions: Position[] = [];

  constructor(positions: Position[] = []) {
    this.positions = [...positions];
  }

  addPosition(bond: Bond, quantity: number): void {
    this.positions.push({ bond, quantity });
  }

  totalValue(curve: YieldCurve): number {
    return this.positions.reduce((sum, p) => sum + p.bond.price(curve) * p.quantity, 0);
  }

  positionValues(curve: YieldCurve): { bond: Bond; quantity: number; value: number }[] {
    return this.positions.map((p) => ({ ...p, value: p.bond.price(curve) * p.quantity }));
  }

  totalFaceValue(): number {
    return this.positions.reduce((sum, p) => sum + p.bond.faceValue * p.quantity, 0);
  }

  weightedAverageMaturity(): number {
    const total = this.totalFaceValue();
    if (total === 0) return 0;
    return this.positions.reduce((s, p) => s + p.bond.maturity * p.bond.faceValue * p.quantity, 0) / total;
  }

  get length(): number {
    return this.positions.length;
  }
}
