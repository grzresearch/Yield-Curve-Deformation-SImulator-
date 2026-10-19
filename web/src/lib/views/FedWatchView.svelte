<script lang="ts">
  import { lineChart } from '../charts/build';
  import { addDays } from '../core';
  import { app } from '../state.svelte';
  import Card from '../ui/Card.svelte';
  import ChartCard from '../ui/ChartCard.svelte';
  import DataTable from '../ui/DataTable.svelte';
  import Icon from '../ui/Icon.svelte';
  import Kpi from '../ui/Kpi.svelte';
  import Segmented from '../ui/Segmented.svelte';
  import { copyText, downloadCsv, toDelimited, type TableData } from '../ui/table';
  import FedWatchBars from './FedWatchBars.svelte';
  import { rangeLabel } from './labels';

  const fw = $derived(app.fedwatch);
  const futures = $derived(app.market!.futures);
  const f = $derived(app.fmt);
  const p = $derived(app.palette);

  let selected = $state(0);
  const outlook = $derived(fw?.outlooks[Math.min(selected, (fw?.outlooks.length ?? 1) - 1)]);

  const changes = $derived(
    fw ? [...new Set(fw.outlooks.flatMap((o) => [...o.probabilities].filter(([, q]) => q >= 0.0005).map(([c]) => c)))].sort((a, b) => a - b) : []
  );

  const matrix = $derived<TableData>({
    columns: [
      { label: app.t('fwMeeting') },
      ...changes.map((c) => ({
        label: rangeLabel(c, fw!.targetLower, fw!.targetUpper, f),
        numeric: true,
        format: (v: number) => (v >= 0.0005 ? f.pct(v * 100, 1) : '')
      }))
    ],
    rows: (fw?.outlooks ?? []).map((o) => [f.date(o.meeting), ...changes.map((c) => o.probabilities.get(c) ?? 0)])
  });

  let matrixCopied = $state(false);
  async function copyMatrix() {
    if (await copyText(toDelimited(matrix, f, app.lang, '\t'))) {
      matrixCopied = true;
      setTimeout(() => (matrixCopied = false), 1600);
    }
  }

  const pathOption = $derived.by(() => {
    if (!fw) return {};
    const path = fw.expectedPath();
    const end = addDays(path[path.length - 1].date, 45);
    return lineChart(p, {
      x: { type: 'time', format: (v) => f.monthYear(new Date(v).getUTCFullYear(), new Date(v).getUTCMonth() + 1) },
      y: { name: app.t('ratePct'), format: (v) => f.num(v, 2) },
      value: (v) => f.pct(v, 3),
      header: (x) => f.date(new Date(Number(x)).toISOString().slice(0, 10)),
      legend: false,
      band: { from: fw.targetLower, to: fw.targetUpper, label: app.t('fwTargetBand'), color: p.series[0] },
      series: [
        {
          name: app.t('fwExpectedRate'),
          color: p.series[0],
          step: 'end',
          markers: true,
          data: [...path.map((x) => [x.date, x.rate] as [string, number]), [end, path[path.length - 1].rate]]
        }
      ]
    });
  });

  const pathTable = $derived<TableData>({
    columns: [
      { label: app.t('fwMeeting') },
      { label: app.t('fwExpectedRate'), numeric: true, format: (v) => f.pct(v, 3) },
      { label: app.t('fwExpected'), numeric: true, format: (v) => f.bps(v, 1) },
      { label: app.t('fwMostLikely') },
      { label: '%', numeric: true, format: (v) => f.pct(v * 100, 1) }
    ],
    rows: (fw?.outlooks ?? []).map((o) => [
      f.date(o.meeting),
      o.rateAfter,
      o.expectedChangeBps,
      rangeLabel(o.mostLikelyChangeBps, fw!.targetLower, fw!.targetUpper, f),
      o.probabilities.get(o.mostLikelyChangeBps) ?? 0
    ])
  });

  const futuresTable = $derived<TableData>({
    columns: [
      { label: app.t('fwContract') },
      { label: app.t('fwMonth') },
      { label: app.t('price'), numeric: true, format: (v) => f.num(v, 3) },
      { label: app.t('fwImplied'), numeric: true, format: (v) => f.pct(v, 3) },
      { label: app.t('fwSettle') }
    ],
    rows: (futures?.contracts ?? []).map((c) => [c.symbol, f.monthYear(c.year, c.month), c.price, 100 - c.price, f.date(c.date)])
  });

  const shade = (q: number) =>
    q < 0.0005
      ? ''
      : `background: color-mix(in oklab, var(--seq-hi) ${Math.round(8 + q * 82)}%, var(--surface)); color: ${q > 0.5 ? 'var(--surface)' : 'var(--ink)'}`;
</script>

<div class="view">
  <div class="view-head">
    <div>
      <h1>{app.t('fwTitle')}</h1>
      <p>{app.t('fwSubtitle')}</p>
    </div>
  </div>

  {#if !fw || !outlook}
    <div class="note"><Icon name="info" />{app.t('fwNoData')}</div>
  {:else}
    <div class="kpis">
      <Kpi label={app.t('kpiTarget')} value="{f.num(fw.targetLower)}–{f.num(fw.targetUpper)} %" sub="FOMC" />
      <Kpi label={app.t('kpiEffr')} value={f.pct(app.market!.fedFunds!.effr)} sub="{app.t('dataAsOf')} {f.date(app.market!.fedFunds!.asOf)}" />
      <Kpi label={app.t('kpiNextFomc')} value={f.date(fw.outlooks[0].meeting)} sub="{app.t('fwExpected')} {f.bps(fw.outlooks[0].expectedChangeBps)}" />
      <Kpi
        label="{app.t('fwExpectedRate')} · {f.date(fw.outlooks[fw.outlooks.length - 1].meeting)}"
        value={f.pct(fw.rates[fw.rates.length - 1], 2)}
        sub="{f.bps((fw.rates[fw.rates.length - 1] - fw.rates[0]) * 100)} {app.t('vsPeriod')} {app.t('today')}"
      />
    </div>

    <div class="row">
      <span class="muted">{app.t('fwMeeting')}</span>
      <Segmented
        label={app.t('fwMeeting')}
        wrap
        bind:value={selected}
        options={fw.outlooks.map((o, i) => ({ value: i, label: f.shortDate(o.meeting) }))}
      />
    </div>

    <div class="grid">
      <div class="span-6"><FedWatchBars {outlook} /></div>
      <ChartCard class="span-6" title={app.t('fwPath')} subtitle={app.t('fwPathSub')} option={pathOption} table={pathTable} height={300} />

      <Card class="span-12" title={app.t('fwMatrix')} subtitle={app.t('fwMatrixSub')}>
        {#snippet actions()}
          <button class="btn ghost small icon" onclick={copyMatrix} title={app.t('copyTable')}>
            <Icon name={matrixCopied ? 'check' : 'copy'} size={15} />
          </button>
          <button class="btn ghost small icon" onclick={() => downloadCsv(`fedwatch-${app.asOf}`, toDelimited(matrix, f, app.lang))} title={app.t('exportCsv')}>
            <Icon name="download" size={15} />
          </button>
        {/snippet}
        <div class="table-wrap">
          <table class="data matrix">
            <thead>
              <tr>
                <th scope="col">{app.t('fwMeeting')}</th>
                {#each changes as c}
                  <th class="n" scope="col" class:current={c === 0}>{rangeLabel(c, fw.targetLower, fw.targetUpper, f)}</th>
                {/each}
              </tr>
            </thead>
            <tbody>
              {#each fw.outlooks as o, i}
                <tr class:selected={i === selected} onclick={() => (selected = i)}>
                  <th scope="row">{f.date(o.meeting)}</th>
                  {#each changes as c}
                    {@const q = o.probabilities.get(c) ?? 0}
                    <td class="n" style={shade(q)}>{q >= 0.0005 ? f.pct(q * 100, 1) : ''}</td>
                  {/each}
                </tr>
              {/each}
            </tbody>
          </table>
        </div>
      </Card>

      <Card class="span-7" title={app.t('fwFutures')} subtitle={futures?.instrument}>
        <DataTable table={futuresTable} maxHeight={420} />
      </Card>

      <Card class="span-5" title={app.t('fwMethod')}>
        <p class="method">{app.t('fwMethodText')}</p>
        {@const before = app.lang === 'de' ? 'vor' : 'before'}
        {@const after = app.lang === 'de' ? 'nach' : 'after'}
        <div class="formula">
          <code>avg<sub>M</sub> = d/N · r<sub>{before}</sub> + (N−d)/N · r<sub>{after}</sub></code>
          <code>k = (r<sub>{after}</sub> − r<sub>{before}</sub>) / {f.num(0.25)}</code>
          <code>P(⌊k⌋+1 · 25 bp) = k − ⌊k⌋</code>
        </div>
        <div class="note"><Icon name="info" /><span>{app.t('fwDisclaimer')}</span></div>
      </Card>
    </div>
  {/if}
</div>

<style>
  .matrix th[scope='row'] {
    position: sticky;
    left: 0;
    background: var(--surface);
    z-index: 1;
  }

  .matrix td {
    min-width: 76px;
    transition: background 150ms ease;
  }

  .matrix tbody tr {
    cursor: pointer;
  }

  .matrix tbody tr.selected th {
    color: var(--accent-ink);
  }

  .matrix th.current {
    color: var(--ink);
  }

  .method {
    color: var(--ink-2);
    font-size: 13px;
    line-height: 1.6;
  }

  .formula {
    display: flex;
    flex-direction: column;
    gap: 4px;
    padding: 10px 12px;
    background: var(--surface-2);
    border-radius: var(--radius-sm);
  }
</style>
