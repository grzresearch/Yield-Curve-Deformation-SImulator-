import type { Lang } from './i18n';

const NBSP = ' ';
const MINUS = '−';

export interface Formatter {
  locale: string;
  num(x: number, digits?: number): string;
  pct(x: number, digits?: number): string;
  bps(x: number, digits?: number, signed?: boolean): string;
  signed(x: number, digits?: number): string;
  money(x: number, digits?: number): string;
  compactMoney(x: number): string;
  years(x: number, digits?: number): string;
  date(iso: string): string;
  shortDate(iso: string): string;
  monthYear(year: number, month: number): string;
  dateTime(iso: string): string;
  /** Plain number for CSV in the user's Excel locale. */
  csvNumber(x: number): string;
  /** Editable value: locale decimal mark, no grouping, ASCII minus. */
  input(x: number, maxDigits?: number): string;
}

export function formatter(lang: Lang, currency: string | null): Formatter {
  const locale = lang === 'de' ? 'de-DE' : 'en-US';
  const cache = new Map<string, Intl.NumberFormat>();
  const nf = (min: number, max: number, extra: Intl.NumberFormatOptions = {}) => {
    const key = `${min}|${max}|${JSON.stringify(extra)}`;
    if (!cache.has(key)) {
      cache.set(key, new Intl.NumberFormat(locale, { minimumFractionDigits: min, maximumFractionDigits: max, ...extra }));
    }
    return cache.get(key)!;
  };
  const fixMinus = (s: string) => s.replace('-', MINUS);
  const bpUnit = lang === 'de' ? 'Bp' : 'bp';

  return {
    locale,
    num: (x, digits = 2) => fixMinus(nf(digits, digits).format(x)),
    pct: (x, digits = 2) => fixMinus(nf(digits, digits).format(x)) + NBSP + '%',
    bps: (x, digits = 1, signed = true) =>
      fixMinus(nf(digits, digits, signed ? { signDisplay: 'exceptZero' } : {}).format(x)) + NBSP + bpUnit,
    signed: (x, digits = 2) => fixMinus(nf(digits, digits, { signDisplay: 'exceptZero' }).format(x)),
    money: (x, digits = 2) =>
      fixMinus(
        currency
          ? nf(digits, digits, { style: 'currency', currency }).format(x)
          : nf(digits, digits).format(x)
      ),
    compactMoney: (x) =>
      Math.abs(x) < 1e6
        ? fixMinus(nf(0, 0, currency ? { style: 'currency', currency } : {}).format(x))
        : fixMinus(
            new Intl.NumberFormat(locale, {
              notation: 'compact',
              maximumFractionDigits: 2,
              ...(currency ? { style: 'currency', currency } : {})
            }).format(x)
          ),
    years: (x, digits = 2) => fixMinus(nf(digits, digits).format(x)),
    date: (iso) =>
      new Date(`${iso}T12:00:00Z`).toLocaleDateString(locale, { day: '2-digit', month: '2-digit', year: 'numeric', timeZone: 'UTC' }),
    shortDate: (iso) =>
      new Date(`${iso}T12:00:00Z`).toLocaleDateString(locale, { day: 'numeric', month: 'short', year: '2-digit', timeZone: 'UTC' }),
    monthYear: (year, month) =>
      new Date(Date.UTC(year, month - 1, 15)).toLocaleDateString(locale, { month: 'short', year: 'numeric', timeZone: 'UTC' }),
    dateTime: (iso) =>
      new Date(iso).toLocaleString(locale, { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', timeZoneName: 'short' }),
    csvNumber: (x) => (lang === 'de' ? String(x).replace('.', ',') : String(x)),
    input: (x, maxDigits = 6) => nf(0, maxDigits, { useGrouping: false }).format(x).replace(MINUS, '-')
  };
}

/**
 * Parse a number typed or pasted in either locale ("1.234,5", "1,234.5", "4,25").
 * A lone separator followed by exactly three digits ("1.000") is read as
 * grouping in the reader's own language and as a decimal mark otherwise.
 */
export function parseLocaleNumber(text: string, lang: Lang = 'en'): number {
  const s = text.trim().replace(/\s|\u00a0|%/g, '').replace(MINUS, '-');
  if (!s) return NaN;
  const lastComma = s.lastIndexOf(',');
  const lastDot = s.lastIndexOf('.');
  const grouping = lang === 'de' ? '.' : ',';
  let normalised = s;
  if (lastComma > -1 && lastDot > -1) {
    normalised = lastComma > lastDot ? s.replace(/\./g, '').replace(',', '.') : s.replace(/,/g, '');
  } else if (new RegExp(`^-?\\d{1,3}(\\${grouping}\\d{3})+$`).test(s)) {
    normalised = s.split(grouping).join('');
  } else if (lastComma > -1) {
    normalised = s.replace(',', '.');
  }
  return Number(normalised);
}

/** Split pasted spreadsheet text into rows of cells (tab, semicolon or comma separated). */
export function parseTable(text: string): string[][] {
  const lines = text.split(/\r?\n/).filter((l) => l.trim());
  if (!lines.length) return [];
  const sample = lines[0];
  const separator = sample.includes('\t') ? '\t' : sample.includes(';') ? ';' : ',';
  return lines.map((l) => l.split(separator).map((c) => c.trim()));
}
