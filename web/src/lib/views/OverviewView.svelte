<script lang="ts">
  import { barChart, bySign, lineChart } from '../charts/build';
  import { daysBetween } from '../core';
  import { buildCurve, indexOnOrBefore, pointsOn } from '../data/market';
  import { app } from '../state.svelte';
  import ChartCard from '../ui/ChartCard.svelte';
  import Icon from '../ui/Icon.svelte';
  import Kpi from '../ui/Kpi.svelte';
  import Segmented from '../ui/Segmented.svelte';
  import type { TableData } from '../ui/table';
  import FedWatchBars from './FedWatchBars.svelte';

  const ust = $derived(app.market!.treasury);
  const last = $derived(ust.history.length - 1);
  const latest = $derived(ust.history[last]);
  const prior = $derived(ust.history[Math.max(0, last - 1)]);
  const col = (label: string) => ust.labels.indexOf(label);
  const quote = (row: { rates: (number | null)[] }, label: string) => row.rates[col(label)] ?? NaN;

  const y10 = $derived(quote(latest, '10Y'));
  const y2 = $derived(quote(latest, '2Y'));
  const spread = $derived((y10 - y2) * 100);
  const spread3m = $derived((y10 - quote(latest, '3M')) * 100);
  const d10 = $derived((y10 - quote(prior, '10Y')) * 100);
  const d2 = $derived((y2 - quote(prior, '2Y')) * 100);
  const dSpread = $derived(spread - (quote(prior, '10Y') - quote(prior, '2Y')) * 100);

  const ff = $derived(app.market!.fedFunds);
  const next = $derived(app.fedwatch?.outlooks[0]);
  const daysToNext = $derived(next && app.asOf ? daysBetween(app.asOf, next.meeting) : null);

  type Period = '1w' | '1m' | '3m' | '1y';
  let period = $state<Period>('1m');
  const periodDays: Record<Period, number> = { '1w': 7, '1m': 30, '3m': 91, '1y': 365 };
  const periodLabel = $derived(
    { '1w': app.t('ago1w'), '1m': app.t('ago1m'), '3m': app.t('ago3m'), '1y': app.t('ago1y') }[period]
  );
  const pastIndex = $derived.by(() => {
    const d = new Date(`${latest.date}T00:00:00Z`);
    d.setUTCDate(d.getUTCDate() - periodDays[period]);
    return indexOnOrBefore(ust, d.toISOString().slice(0, 10));
  });
  const past = $derived(ust.history[pastIndex]);

  const p = $derived(app.palette);
  const f = $derived(app.fmt);

  const compareOption = $derived(
    lineChart(p, {
      x: { categories: ust.labels, name: app.t('tenor') },
      y: { name: app.t('yieldPct'), format: (v) => f.num(v, 1) },
      value: (v) => f.pct(v),
      header: (x) => String(x),
      series: [
        {
          name: f.date(latest.date),
          color: p.series[0],
          markers: true,
          data: latest.rates.map((r, i) => [ust.labels[i], r ?? NaN])
        },
        {
          name: `${f.date(past.date)} (${periodLabel})`,
          color: p.series[1],
          markers: true,
          dashed: true,
          data: past.rates.map((r, i) => [ust.labels[i], r ?? NaN])
        }
      ]
    })
  );

  const changes = $derived(ust.labels.map((_, i) => ((latest.rates[i] ?? NaN) - (past.rates[i] ?? NaN)) * 100));
  const changeOption = $derived(
    barChart(p, {
      categories: ust.labels,
      series: [{ name: app.t('changeBps'), values: changes, color: bySign(p, true) }],
      value: (v) => f.bps(v),
      axisFormat: (v) => f.num(v, 0)
    })
  );

  const compareTable = $derived<TableData>({
    columns: [
      { label: app.t('tenor') },
      { label: f.date(latest.date), numeric: true, format: (v) => f.pct(v) },
      { label: f.date(past.date), numeric: true, format: (v) => f.pct(v) },
      { label: app.t('changeBps'), numeric: true, format: (v) => f.bps(v) }
    ],
    rows: ust.labels.map((l, i) => [l, latest.rates[i], past.rates[i], Number.isFinite(changes[i]) ? changes[i] : null])
  });

  // History: policy rate with 2Y and 10Y (same unit, one axis)
  const histStart = $derived(ust.history[0].date);
  const historyOption = $derived(
    lineChart(p, {
      x: { type: 'time', format: (v) => f.monthYear(new Date(v).getUTCFullYear(), new Date(v).getUTCMonth() + 1) },
      y: { name: app.t('ratePct'), format: (v) => f.num(v, 1) },
      value: (v) => f.pct(v),
      header: (x) => f.date(new Date(Number(x)).toISOString().slice(0, 10)),
      series: [
        {
          name: '10Y',
          color: p.series[0],
          data: ust.history.map((r) => [r.date, r.rates[col('10Y')] ?? NaN])
        },
        {
          name: '2Y',
          color: p.series[1],
          data: ust.history.map((r) => [r.date, r.rates[col('2Y')] ?? NaN])
        },
        ...(ff
          ? [
              {
                name: 'EFFR',
                color: p.series[2],
                step: 'end' as const,
                data: ff.history.filter((h) => h.date >= histStart).map((h) => [h.date, h.effr] as [string, number])
              }
            ]
          : [])
      ]
    })
  );

  const historyTable = $derived<TableData>({
    columns: [
      { label: app.t('date') },
      { label: '2Y', numeric: true, format: (v) => f.pct(v) },
      { label: '10Y', numeric: true, format: (v) => f.pct(v) },
      { label: '2s10s', numeric: true, format: (v) => f.bps(v, 0) }
    ],
    rows: [...ust.history].reverse().map((r) => {
      const a = r.rates[col('2Y')];
      const b = r.rates[col('10Y')];
      return [r.date, a, b, a !== null && b !== null ? (b - a) * 100 : null];
    })
  });

  const spreadOption = $derived(
    lineChart(p, {
      x: { type: 'time', format: (v) => f.monthYear(new Date(v).getUTCFullYear(), new Date(v).getUTCMonth() + 1) },
      y: { name: app.t('bpsUnit'), format: (v) => f.num(v, 0) },
      value: (v) => f.bps(v, 0),
      header: (x) => f.date(new Date(Number(x)).toISOString().slice(0, 10)),
      legend: false,
      series: [
        {
          name: app.t('slope2s10s'),
          color: p.series[0],
          area: true,
          data: ust.history.map((r) => {
            const a = r.rates[col('2Y')];
            const b = r.rates[col('10Y')];
            return [r.date, a !== null && b !== null ? (b - a) * 100 : NaN];
          })
        }
      ]
    })
  );

  // US vs euro area: both as zero curves on a year axis
  const usZero = $derived(buildCurve(pointsOn(ust, last), 'par', 'cubic_spline', true, 2, latest.date).curve);
  const ecb = $derived(app.market!.ecb);
  const euZero = $derived(
    ecb ? buildCurve(pointsOn(ecb, ecb.history.length - 1), 'zero', 'cubic_spline', false, 1, ecb.asOf).curve : null
  );
  const grid = Array.from({ length: 120 }, (_, i) => 0.25 + (i * (30 - 0.25)) / 119);
  const usEuOption = $derived(
    lineChart(p, {
      x: { name: `${app.t('tenor')} (${app.t('years')})`, min: 0, max: 30, format: (v) => f.num(v, 0) },
      y: { name: app.t('zeroRate') + ' (%)', format: (v) => f.num(v, 1) },
      value: (v) => f.pct(v),
      header: (x) => `${f.num(Number(x), 1)} ${app.t('years')}`,
      series: [
        { name: `US Treasury · ${f.date(latest.date)}`, color: p.series[0], data: grid.map((t) => [t, usZero.rateAt(t)]) },
        ...(euZero && ecb
          ? [{ name: `EUR AAA · ${f.date(ecb.asOf)}`, color: p.series[1], data: grid.map((t) => [t, euZero.rateAt(t)] as [number, number]) }]
          : [])
      ]
    })
  );
  const usEuTable = $derived<TableData>({
    columns: [
      { label: `${app.t('tenor')} (${app.t('years')})`, numeric: true, format: (v) => f.num(v, 2) },
      { label: 'US Treasury', numeric: true, format: (v) => f.pct(v, 3) },
      { label: 'EUR AAA', numeric: true, format: (v) => f.pct(v, 3) },
      { label: 'Spread', numeric: true, format: (v) => f.bps(v, 0) }
    ],
    rows: [0.25, 0.5, 1, 2, 3, 5, 7, 10, 15, 20, 30].map((t) => {
      const us = usZero.rateAt(t);
      const eu = euZero ? euZero.rateAt(t) : null;
      return [t, us, eu, eu !== null ? (us - eu) * 100 : null];
    })
  });
</script>

<div class="view">
  <div class="view-head">
    <div>
      <h1>{app.t('ovTitle')}</h1>
      <p>{app.t('ovSubtitle')}</p>
    </div>
  </div>

  <div class="kpis">
    <Kpi label={app.t('kpi10y')} value={f.pct(y10)} delta="{f.bps(d10)} {app.t('dayDelta')}" />
    <Kpi label={app.t('kpi2y')} value={f.pct(y2)} delta="{f.bps(d2)} {app.t('dayDelta')}" />
    <Kpi label={app.t('slope2s10s')} value={f.bps(spread, 0)} delta="{f.bps(dSpread)} {app.t('dayDelta')}" />
    <Kpi label={app.t('slope3m10y')} value={f.bps(spread3m, 0)} sub="US Treasury" />
    {#if ff}
      <Kpi
        label={app.t('kpiEffr')}
        value={f.pct(ff.effr)}
        sub="{app.t('kpiTarget')} {f.num(ff.targetLower)}–{f.num(ff.targetUpper)} %"
      />
    {/if}
    {#if next}
      {@const probability = next.probabilities.get(next.mostLikelyChangeBps) ?? 0}
      <Kpi
        label={app.t('kpiNextFomc')}
        value={f.date(next.meeting)}
        sub="{daysToNext === 0 ? app.t('today') : app.t('inDays', { n: daysToNext ?? '–' })} · {next.mostLikelyChangeBps === 0
          ? app.t('fwHold')
          : f.bps(next.mostLikelyChangeBps, 0)} {f.pct(probability * 100, 0)}"
      />
    {/if}
  </div>

  <div class="grid">
    <ChartCard
      class="span-8"
      title={app.t('curveCompare')}
      subtitle="US Treasury · {app.t('curveCompareSub')}"
      option={compareOption}
      table={compareTable}
      height={300}
    >
      {#snippet controls()}
        <Segmented
          label={app.t('curveCompare')}
          bind:value={period}
          options={[
            { value: '1w', label: '1W' },
            { value: '1m', label: '1M' },
            { value: '3m', label: '3M' },
            { value: '1y', label: app.lang === 'de' ? '1J' : '1Y' }
          ]}
        />
      {/snippet}
    </ChartCard>

    <ChartCard
      class="span-4"
      title={app.t('changeByTenor')}
      subtitle="{app.t('vsPeriod')} {f.date(past.date)}"
      option={changeOption}
      table={compareTable}
      height={300}
    />

    {#if next && app.fedwatch}
      <div class="span-5">
        <FedWatchBars outlook={next} compact>
          {#snippet extra()}
            <a class="btn small" href="#/fedwatch">{app.t('openFedwatch')} <Icon name="external" size={13} /></a>
          {/snippet}
        </FedWatchBars>
      </div>
    {/if}

    <ChartCard
      class={next ? 'span-7' : 'span-12'}
      title={app.t('usVsEuro')}
      subtitle={app.t('usVsEuroSub')}
      option={usEuOption}
      table={usEuTable}
      height={300}
    />

    <ChartCard
      class="span-7"
      title={app.t('ratesHistory')}
      subtitle="EFFR (NY Fed) · 2Y · 10Y"
      option={historyOption}
      table={historyTable}
      height={300}
    />

    <ChartCard
      class="span-5"
      title={app.t('spreadHistory')}
      subtitle="10Y − 2Y"
      option={spreadOption}
      table={historyTable}
      height={300}
    />
  </div>
</div>
