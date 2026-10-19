import type { Formatter } from '../format';
import type { Lang } from '../i18n';

export type Cell = string | number | null;

export interface Column {
  label: string;
  numeric?: boolean;
  format?: (value: number) => string;
  /** Extra class for a cell, e.g. gain/loss ink. */
  tone?: (value: number) => string | undefined;
}

export interface TableData {
  columns: Column[];
  rows: Cell[][];
}

export function displayCell(column: Column, value: Cell): string {
  if (value === null || value === undefined) return '–';
  if (typeof value === 'number') return column.format ? column.format(value) : String(value);
  return value;
}

/** Delimited text in the reader's Excel locale: German Excel wants ';' and decimal commas. */
export function toDelimited(table: TableData, fmt: Formatter, lang: Lang, separator?: string): string {
  const sep = separator ?? (lang === 'de' ? ';' : ',');
  const quote = (s: string) => (/[";\n,\t]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s);
  const cell = (v: Cell) => (v === null ? '' : typeof v === 'number' ? fmt.csvNumber(v) : quote(v));
  return [table.columns.map((c) => quote(c.label)), ...table.rows.map((r) => r.map(cell))]
    .map((r) => r.join(sep))
    .join('\r\n');
}

export function downloadCsv(name: string, text: string) {
  const blob = new Blob(['﻿' + text], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = Object.assign(document.createElement('a'), { href: url, download: `${name}.csv` });
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

export const slug = (s: string) =>
  s
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[^\w]+/g, '-')
    .replace(/^-|-$/g, '');
