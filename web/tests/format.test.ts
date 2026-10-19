import { describe, expect, it } from 'vitest';
import { formatter, parseLocaleNumber, parseTable } from '../src/lib/format';

describe('parseLocaleNumber', () => {
  it.each([
    ['4,25', 'de', 4.25],
    ['4.25', 'de', 4.25],
    ['1.000', 'de', 1000],
    ['1.234,5', 'de', 1234.5],
    ['1,000', 'en', 1000],
    ['1,234.5', 'en', 1234.5],
    ['4,25', 'en', 4.25],
    ['−12,5', 'de', -12.5],
    ['3,5 %', 'de', 3.5],
    ['', 'de', NaN]
  ] as const)('%s (%s) → %s', (text, lang, expected) => {
    expect(parseLocaleNumber(text, lang)).toBe(expected);
  });
});

describe('formatter', () => {
  it('formats inputs without grouping so they parse back', () => {
    for (const lang of ['de', 'en'] as const) {
      const f = formatter(lang, null);
      for (const x of [1000, 1234.5, -0.25, 4.125]) expect(parseLocaleNumber(f.input(x), lang)).toBe(x);
    }
  });

  it('uses a typographic minus and basis-point units', () => {
    expect(formatter('de', null).bps(-12.34)).toBe('−12,3 Bp');
    expect(formatter('en', null).bps(5, 0)).toBe('+5 bp');
  });
});

describe('parseTable', () => {
  it('detects tab, semicolon and comma separators', () => {
    expect(parseTable('a\tb\n1\t2')).toEqual([['a', 'b'], ['1', '2']]);
    expect(parseTable('1;2,5\n3;4')).toEqual([['1', '2,5'], ['3', '4']]);
    expect(parseTable('1,2\n3,4')).toEqual([['1', '2'], ['3', '4']]);
  });
});
