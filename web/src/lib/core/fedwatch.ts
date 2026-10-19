/**
 * FOMC target-rate probabilities from 30-Day Fed Funds futures - the CME
 * FedWatch methodology (port of `yield_curve.fedwatch`).
 */
import { addDays, daysInMonth, parts } from './dates';
import type { PolicyPath } from './policy';

export const STEP_BPS = 25;
const PROBABILITY_FLOOR = 1e-12;

export interface FedFundsFuture {
  year: number;
  month: number;
  price: number;
}

export interface MeetingOutlook {
  meeting: string;
  rateBefore: number;
  rateAfter: number;
  expectedChangeBps: number;
  /** This meeting's move in bps -> probability. */
  moveProbabilities: Map<number, number>;
  /** Cumulative change versus today's target range in bps -> probability. */
  probabilities: Map<number, number>;
  mostLikelyChangeBps: number;
}

type YearMonth = number; // year * 12 + (month - 1), so neighbours differ by one

const ym = (year: number, month: number): YearMonth => year * 12 + month - 1;

export class FedWatch {
  readonly meetings: string[] = [];
  readonly rates: number[];
  readonly outlooks: MeetingOutlook[];
  private readonly implied = new Map<YearMonth, number>();
  private readonly meetingMonths: Set<YearMonth>;
  private readonly horizon: YearMonth | null;

  constructor(
    calendar: readonly string[],
    futures: readonly FedFundsFuture[],
    readonly targetLower: number,
    readonly targetUpper: number,
    readonly asOf: string,
    readonly effr: number | null = null,
    readonly stepBps = STEP_BPS
  ) {
    for (const f of futures) this.implied.set(ym(f.year, f.month), 100 - f.price);
    this.meetingMonths = new Set(calendar.map((m) => ym(parts(m).year, parts(m).month)));
    this.horizon = this.meetingMonths.size ? Math.max(...this.meetingMonths) : null;

    for (const m of [...calendar].filter((d) => d >= asOf).sort()) {
      if (!this.implied.has(this.monthOf(m))) break;
      this.meetings.push(m);
    }
    this.rates = this.expectedRates();
    this.outlooks = this.probabilityTree();
  }

  get targetMid(): number {
    return (this.targetLower + this.targetUpper) / 2;
  }

  private monthOf(iso: string): YearMonth {
    const p = parts(iso);
    return ym(p.year, p.month);
  }

  private isClean(month: YearMonth): boolean {
    return this.horizon !== null && month <= this.horizon && !this.meetingMonths.has(month) && this.implied.has(month);
  }

  private split(meeting: string) {
    const p = parts(meeting);
    const before = p.day / daysInMonth(p.year, p.month);
    return { average: this.implied.get(this.monthOf(meeting))!, before, after: 1 - before };
  }

  private startingRate(): number {
    if (!this.meetings.length) return this.effr ?? this.targetMid;
    const first = this.meetings[0];
    const month = this.monthOf(first);
    if (this.isClean(month - 1)) return this.implied.get(month - 1)!;
    const { average, before, after } = this.split(first);
    if (this.isClean(month + 1) && before > 0) return (average - after * this.implied.get(month + 1)!) / before;
    return this.effr ?? average;
  }

  private expectedRates(): number[] {
    const rates = [this.startingRate()];
    for (const meeting of this.meetings) {
      const following = this.monthOf(meeting) + 1;
      const { average, before, after } = this.split(meeting);
      const previous = rates[rates.length - 1];
      if (this.isClean(following)) rates.push(this.implied.get(following)!);
      else if (after > 0) rates.push((average - before * previous) / after);
      else rates.push(this.implied.get(following) ?? previous);
    }
    return rates;
  }

  private probabilityTree(): MeetingOutlook[] {
    const step = this.stepBps / 100;
    let distribution = new Map<number, number>([[0, 1]]);
    return this.meetings.map((meeting, j) => {
      const rateBefore = this.rates[j];
      const rateAfter = this.rates[j + 1];
      let steps = (rateAfter - rateBefore) / step;
      if (Math.abs(steps - Math.round(steps)) < 1e-9) steps = Math.round(steps);
      const lower = Math.floor(steps);
      const pUp = steps - lower;
      const move = new Map<number, number>();
      for (const [change, p] of [
        [lower * this.stepBps, 1 - pUp],
        [(lower + 1) * this.stepBps, pUp]
      ]) {
        if (p > PROBABILITY_FLOOR) move.set(change, p);
      }

      const compounded = new Map<number, number>();
      for (const [cumulative, pCum] of distribution) {
        for (const [change, pMove] of move) {
          const key = cumulative + change;
          compounded.set(key, (compounded.get(key) ?? 0) + pCum * pMove);
        }
      }
      distribution = new Map([...compounded].filter(([, p]) => p > PROBABILITY_FLOOR).sort((a, b) => a[0] - b[0]));

      let mostLikely = 0;
      let best = -1;
      for (const [change, p] of distribution) {
        if (p > best) [mostLikely, best] = [change, p];
      }
      return {
        meeting,
        rateBefore,
        rateAfter,
        expectedChangeBps: (rateAfter - rateBefore) * 100,
        moveProbabilities: move,
        probabilities: distribution,
        mostLikelyChangeBps: mostLikely
      };
    });
  }

  /** Expected EFFR today and the day after each covered meeting. */
  expectedPath(): { date: string; rate: number }[] {
    return [this.asOf, ...this.meetings.map((m) => addDays(m, 1))].map((date, i) => ({ date, rate: this.rates[i] }));
  }

  impliedPolicyPath(): PolicyPath {
    return { asOf: this.asOf, startRate: this.rates[0], meetings: [...this.meetings], levels: this.rates.slice(1) };
  }
}
