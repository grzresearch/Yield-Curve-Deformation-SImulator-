import type { Formatter } from '../format';

/** "3,75–4,00" for a cumulative change (bps) applied to today's target range. */
export function rangeLabel(change: number, lower: number, upper: number, fmt: Formatter): string {
  return `${fmt.num(lower + change / 100)}–${fmt.num(upper + change / 100)}`;
}
