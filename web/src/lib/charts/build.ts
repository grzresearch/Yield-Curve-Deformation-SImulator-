/**
 * Chart option builders. The dataviz rules live here once - 2px lines,
 * 8px ringed markers, <=24px bars rounded at the data end, hairline grid,
 * crosshair tooltips that lead with the value - so views only pass data.
 */
import type { ChartOption } from './echarts';

export interface Palette {
  surface: string;
  ink: string;
  ink2: string;
  muted: string;
  grid: string;
  axis: string;
  border: string;
  series: string[];
  pos: string;
  neg: string;
  neutral: string;
  seqLo: string;
  seqHi: string;
  font: string;
}

/** Read the palette from the CSS tokens, the single source of truth for colour. */
export function readPalette(): Palette {
  const style = getComputedStyle(document.documentElement);
  const v = (name: string) => style.getPropertyValue(name).trim();
  return {
    surface: v('--surface'),
    ink: v('--ink'),
    ink2: v('--ink-2'),
    muted: v('--muted'),
    grid: v('--grid'),
    axis: v('--axis'),
    border: v('--border-strong'),
    series: [1, 2, 3, 4, 5, 6, 7, 8].map((i) => v(`--series-${i}`)),
    pos: v('--pos'),
    neg: v('--neg'),
    neutral: v('--neutral'),
    seqLo: v('--seq-lo'),
    seqHi: v('--seq-hi'),
    font: v('--font')
  };
}

const escapeHtml = (s: string) =>
  s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);

export interface TooltipRow {
  color: string;
  name: string;
  value: string;
  dashed?: boolean;
  bar?: boolean;
}

/** Tooltip body: header, then one row per series - value strong, name secondary, a line key. */
export function tooltipHtml(p: Palette, header: string, rows: TooltipRow[]): string {
  const key = (r: TooltipRow) =>
    r.bar
      ? `<span style="display:inline-block;width:10px;height:10px;border-radius:2px;background:${r.color}"></span>`
      : `<span style="display:inline-block;width:14px;height:0;border-top:2px ${r.dashed ? 'dashed' : 'solid'} ${r.color}"></span>`;
  const body = rows
    .map(
      (r) =>
        `<div style="display:flex;align-items:center;gap:8px;line-height:20px">${key(r)}` +
        `<strong style="color:${p.ink};font-weight:600;font-variant-numeric:tabular-nums">${escapeHtml(r.value)}</strong>` +
        `<span style="color:${p.ink2}">${escapeHtml(r.name)}</span></div>`
    )
    .join('');
  return `<div style="font-size:12px;color:${p.muted};margin-bottom:4px">${escapeHtml(header)}</div>${body}`;
}

function base(p: Palette, extra: Partial<Record<string, unknown>> = {}): Record<string, unknown> {
  return {
    backgroundColor: 'transparent',
    textStyle: { fontFamily: p.font, color: p.ink2, fontSize: 12 },
    animationDuration: 400,
    animationDurationUpdate: 250,
    animationEasingUpdate: 'cubicOut',
    aria: { enabled: true },
    tooltip: {
      confine: true,
      backgroundColor: p.surface,
      borderColor: p.border,
      borderWidth: 1,
      padding: [8, 10],
      extraCssText: 'border-radius:8px;box-shadow:0 4px 16px rgba(0,0,0,.12);',
      textStyle: { color: p.ink, fontFamily: p.font }
    },
    ...extra
  };
}

export interface AxisSpec {
  name?: string;
  type?: 'value' | 'time' | 'category' | 'log';
  min?: number | 'dataMin' | ((v: { min: number; max: number }) => number);
  max?: number | 'dataMax' | ((v: { min: number; max: number }) => number);
  format?: (v: number) => string;
  categories?: string[];
  scale?: boolean;
  interval?: number;
}

function axis(p: Palette, spec: AxisSpec, orientation: 'x' | 'y'): Record<string, unknown> {
  const isX = orientation === 'x';
  return {
    type: spec.type ?? (spec.categories ? 'category' : 'value'),
    data: spec.categories,
    name: spec.name,
    nameLocation: 'middle',
    nameGap: isX ? 28 : 44,
    nameTextStyle: { color: p.muted, fontSize: 11 },
    min: spec.min,
    max: spec.max,
    scale: spec.scale ?? !isX,
    interval: spec.interval,
    axisLine: { show: isX, lineStyle: { color: p.axis } },
    axisTick: { show: false },
    axisLabel: {
      color: p.muted,
      fontSize: 11,
      hideOverlap: true,
      formatter: spec.format ? (v: number) => spec.format!(v) : undefined
    },
    splitLine: { show: !isX || spec.type === 'time', lineStyle: { color: p.grid, width: 1 } },
    axisPointer: { lineStyle: { color: p.axis, width: 1 } }
  };
}

const grid = (legend: boolean, xName: boolean) => ({
  left: 8,
  right: 16,
  top: legend ? 40 : 16,
  bottom: xName ? 30 : 8,
  outerBoundsMode: 'same',
  outerBoundsContain: 'axisLabel'
});

// One row that pages on narrow screens, so a legend never wraps into the plot.
const legendSpec = (p: Palette) => ({
  type: 'scroll',
  pageIconColor: p.ink2,
  pageIconInactiveColor: p.axis,
  pageTextStyle: { color: p.muted },
  top: 0,
  left: 0,
  icon: 'roundRect',
  itemWidth: 14,
  itemHeight: 3,
  itemGap: 16,
  textStyle: { color: p.ink2, fontSize: 12 }
});

export interface LineSeries {
  name: string;
  data: [number | string, number][];
  color: string;
  dashed?: boolean;
  step?: 'start' | 'end' | 'middle';
  area?: boolean;
  /** Show the data points (curve nodes). */
  markers?: boolean;
  /** Points only, no connecting line (quoted inputs). */
  pointsOnly?: boolean;
  /** Continuation of another series: drawn, but not listed again in the legend. */
  hideInLegend?: boolean;
  smooth?: boolean;
  width?: number;
  z?: number;
}

export interface LineChartSpec {
  series: LineSeries[];
  x: AxisSpec;
  y: AxisSpec;
  value: (v: number) => string;
  header: (x: number | string) => string;
  legend?: boolean;
  markLinesX?: { value: number | string; label: string }[];
  band?: { from: number; to: number; label: string; color: string };
}

export function lineChart(p: Palette, spec: LineChartSpec): ChartOption {
  const legend = spec.legend ?? spec.series.length > 1;
  return base(p, {
    legend: legend ? { ...legendSpec(p), data: spec.series.filter((s) => !s.hideInLegend).map((s) => s.name) } : undefined,
    grid: grid(legend, !!spec.x.name),
    xAxis: axis(p, spec.x, 'x'),
    yAxis: axis(p, spec.y, 'y'),
    tooltip: {
      ...(base(p).tooltip as object),
      trigger: 'axis',
      axisPointer: { type: 'line', snap: true },
      formatter: (params: { axisValue: number | string; seriesName: string; value: [number, number]; seriesIndex: number }[]) =>
        tooltipHtml(
          p,
          spec.header(params[0]?.axisValue),
          params
            .filter((x) => x.value && Number.isFinite(x.value[1]))
            .map((x) => ({
              color: spec.series[x.seriesIndex].color,
              name: x.seriesName,
              value: spec.value(x.value[1]),
              dashed: spec.series[x.seriesIndex].dashed
            }))
        )
    },
    series: spec.series.map((s, i) => ({
      id: s.name,
      name: s.name,
      type: 'line',
      data: s.data,
      step: s.step,
      smooth: s.smooth ?? false,
      showSymbol: !!s.markers || !!s.pointsOnly,
      symbol: 'circle',
      symbolSize: 8,
      z: s.z ?? 2 + i,
      itemStyle: { color: s.color, borderColor: p.surface, borderWidth: 2 },
      lineStyle: {
        color: s.color,
        width: s.pointsOnly ? 0 : s.width ?? 2,
        opacity: s.pointsOnly ? 0 : 1,
        type: s.dashed ? [6, 4] : 'solid',
        cap: 'round',
        join: 'round'
      },
      areaStyle: s.area ? { color: s.color, opacity: 0.1 } : undefined,
      emphasis: { focus: 'none', scale: 1.25 },
      markLine:
        i === 0 && spec.markLinesX?.length
          ? {
              silent: true,
              symbol: 'none',
              lineStyle: { color: p.axis, width: 1, type: 'solid' },
              label: { color: p.muted, fontSize: 11, formatter: '{b}', position: 'insideEndTop' },
              data: spec.markLinesX.map((m) => ({ xAxis: m.value, name: m.label }))
            }
          : undefined,
      markArea:
        i === 0 && spec.band
          ? {
              silent: true,
              itemStyle: { color: spec.band.color, opacity: 0.12 },
              label: { color: p.muted, fontSize: 11, position: 'insideBottomRight' },
              data: [[{ yAxis: spec.band.from, name: spec.band.label }, { yAxis: spec.band.to }]]
            }
          : undefined
    }))
  });
}

export interface BarSeries {
  name: string;
  values: number[];
  /** One colour for the series, or per value (diverging by sign). */
  color: string | ((v: number) => string);
}

export interface BarChartSpec {
  categories: string[];
  series: BarSeries[];
  value: (v: number) => string;
  axisFormat?: (v: number) => string;
  horizontal?: boolean;
  axisName?: string;
  categoryName?: string;
  labels?: boolean;
  header?: (category: string) => string;
}

/** Diverging colour by sign: blue for positive, red for negative. */
export const bySign = (p: Palette, invert = false) => (v: number) => ((v >= 0) !== invert ? p.pos : p.neg);

export function barChart(p: Palette, spec: BarChartSpec): ChartOption {
  const legend = spec.series.length > 1;
  const horizontal = !!spec.horizontal;
  const valueAxis = {
    ...axis(p, { name: spec.axisName, format: spec.axisFormat, scale: false }, horizontal ? 'x' : 'y'),
    // Leave room at both ends for value labels on positive and negative bars.
    boundaryGap: spec.labels ? ['14%', '14%'] : undefined
  };
  const categoryAxis = axis(p, { categories: spec.categories, name: spec.categoryName }, horizontal ? 'y' : 'x');
  const radius = (v: number) =>
    horizontal ? (v >= 0 ? [0, 4, 4, 0] : [4, 0, 0, 4]) : v >= 0 ? [4, 4, 0, 0] : [0, 0, 4, 4];
  const colorOf = (s: BarSeries, v: number) => (typeof s.color === 'function' ? s.color(v) : s.color);

  return base(p, {
    legend: legend
      ? {
          ...legendSpec(p),
          itemWidth: 10,
          itemHeight: 10,
          data: spec.series.map((s) => ({ name: s.name, itemStyle: { color: colorOf(s, 1) } }))
        }
      : undefined,
    grid: {
      ...grid(legend, !!spec.axisName || !!spec.categoryName),
      right: 16,
      top: legend ? 40 : spec.labels && !horizontal ? 24 : 16
    },
    xAxis: horizontal ? { ...valueAxis, splitLine: { show: true, lineStyle: { color: p.grid } } } : categoryAxis,
    yAxis: horizontal ? { ...categoryAxis, inverse: true, axisLine: { show: true, lineStyle: { color: p.axis } } } : valueAxis,
    tooltip: {
      ...(base(p).tooltip as object),
      trigger: 'axis',
      axisPointer: { type: 'shadow', shadowStyle: { color: p.grid, opacity: 0.35 } },
      formatter: (params: { axisValue: string; seriesName: string; value: number; seriesIndex: number }[]) =>
        tooltipHtml(
          p,
          spec.header ? spec.header(params[0]?.axisValue) : params[0]?.axisValue,
          params.map((x) => ({
            color: colorOf(spec.series[x.seriesIndex], x.value),
            name: x.seriesName,
            value: spec.value(x.value),
            bar: true
          }))
        )
    },
    series: spec.series.map((s) => ({
      id: s.name,
      name: s.name,
      type: 'bar',
      barMaxWidth: 24,
      barGap: '20%',
      barCategoryGap: '35%',
      data: s.values.map((v) => ({
        value: v,
        itemStyle: { color: colorOf(s, v), borderRadius: radius(v) },
        label: spec.labels
          ? { position: horizontal ? (v >= 0 ? 'right' : 'left') : v >= 0 ? 'top' : 'bottom' }
          : undefined
      })),
      label: spec.labels
        ? {
            show: true,
            color: p.ink2,
            fontSize: 11,
            formatter: (x: { value: number }) => spec.value(x.value)
          }
        : undefined,
      labelLayout: horizontal ? undefined : { hideOverlap: true }
    }))
  });
}
