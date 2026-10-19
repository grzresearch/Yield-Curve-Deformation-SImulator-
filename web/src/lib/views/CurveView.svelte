<script lang="ts">
  import { lineChart } from '../charts/build';
  import { YieldCurve, type Interpolation } from '../core';
  import { tenorLabel } from '../data/market';
  import { parseLocaleNumber } from '../format';
  import { app } from '../state.svelte';
  import Card from '../ui/Card.svelte';
  import ChartCard from '../ui/ChartCard.svelte';
  import DataTable from '../ui/DataTable.svelte';
  import Icon from '../ui/Icon.svelte';
  import PasteDialog from '../ui/PasteDialog.svelte';
  import Segmented from '../ui/Segmented.svelte';
  import type { TableData } from '../ui/table';
  import { denseTenors, sample } from './curveHelpers';

  const curve = $derived(app.curve);
  const built = $derived(app.built);
  const f = $derived(app.fmt);
  const p = $derived(app.palette);

  let scale = $state<'value' | 'log'>('value');
  const grid = $derived(curve ? denseTenors(curve) : []);
  const xAxis = $derived({
    name: `${app.t('tenor')} (${app.t('years')})`,
    type: scale,
    min: scale === 'log' ? grid[0] : 0,
    max: grid[grid.length - 1],
    format: (v: number) => f.num(v, v < 1 ? 2 : 0)
  });
  const header = (x: number | string) => `${f.num(Number(x), 2)} ${app.t('years')}`;

  const curvesOption = $derived.by(() => {
    if (!curve || !built) return {};
    const quoted = built.quoteBasis === 'par' ? app.t('parYield') : app.t('zeroRate');
    return lineChart(p, {
      x: xAxis,
      y: { name: app.t('ratePct'), format: (v) => f.num(v, 1) },
      value: (v) => f.pct(v, 3),
      header,
      series: [
        { name: app.t('zeroRate'), color: p.series[0], data: sample(grid, (t) => curve.rateAt(t)) },
        { name: app.t('parYield'), color: p.series[1], data: sample(grid, (t) => curve.parRate(t)) },
        { name: app.t('forwardRate'), color: p.series[2], dashed: true, data: sample(grid, (t) => curve.instantaneousForward(t)) },
        {
          name: `${app.t('quoted')} (${quoted})`,
          color: p.series[0],
          pointsOnly: true,
          data: built.quotes.map((q) => [q.tenor, q.rate] as [number, number])
        }
      ]
    });
  });

  const dfOption = $derived(
    curve
      ? lineChart(p, {
          x: xAxis,
          y: { name: app.t('discountFactor'), format: (v) => f.num(v, 2), min: 0, max: 1 },
          value: (v) => f.num(v, 5),
          header,
          legend: false,
          series: [{ name: app.t('discountFactor'), color: p.series[0], area: true, data: sample(grid, (t) => curve.discountFactor(t)) }]
        })
      : {}
  );

  const methods: Interpolation[] = ['cubic_spline', 'pchip', 'linear'];
  const methodLabel = (m: Interpolation) =>
    app.t(m === 'cubic_spline' ? 'interpCubic' : m === 'pchip' ? 'interpPchip' : 'interpLinear');
  const variants = $derived(
    curve ? methods.map((m) => ({ method: m, curve: new YieldCurve(curve.tenors, curve.rates, m) })) : []
  );
  const interpOption = $derived(
    curve
      ? lineChart(p, {
          x: xAxis,
          y: { name: app.t('zeroRate') + ' (%)', format: (v) => f.num(v, 2) },
          value: (v) => f.pct(v, 3),
          header,
          series: variants.map((v, i) => ({
            name: methodLabel(v.method),
            color: p.series[i],
            dashed: i === 2,
            markers: false,
            data: sample(grid, (t) => v.curve.rateAt(t))
          }))
        })
      : {}
  );

  const nodesTable = $derived<TableData>({
    columns: [
      { label: app.t('tenor') },
      { label: app.t('years'), numeric: true, format: (v) => f.num(v, 3) },
      { label: app.t('quoted'), numeric: true, format: (v) => f.pct(v, 3) },
      { label: app.t('zeroRate'), numeric: true, format: (v) => f.pct(v, 4) },
      { label: app.t('parYield'), numeric: true, format: (v) => f.pct(v, 4) },
      { label: app.t('forwardRate'), numeric: true, format: (v) => f.pct(v, 4) },
      { label: app.t('discountFactor'), numeric: true, format: (v) => f.num(v, 6) }
    ],
    rows:
      curve && built
        ? curve.tenors.map((t, i) => [
            built.quotes[i]?.label ?? tenorLabel(t),
            t,
            built.quotes[i]?.rate ?? null,
            curve.rates[i],
            curve.parRate(t),
            curve.instantaneousForward(t),
            curve.discountFactor(t)
          ])
        : []
  });

  const interpTable = $derived<TableData>({
    columns: [
      { label: `${app.t('tenor')} (${app.t('years')})`, numeric: true, format: (v) => f.num(v, 2) },
      ...variants.map((v) => ({ label: methodLabel(v.method), numeric: true, format: (x: number) => f.pct(x, 4) }))
    ],
    rows: [0.75, 1.5, 4, 6, 8.5, 12.5, 15, 25].map((t) => [t, ...variants.map((v) => v.curve.rateAt(t))])
  });

  // Calculator
  let at = $state(4);
  let t1 = $state(2);
  let t2 = $state(5);
  let parMaturity = $state(7);
  const calc = $derived(
    curve
      ? {
          rate: curve.rateAt(at),
          forward: t2 > t1 ? curve.forwardRate(t1, t2) : NaN,
          par: parMaturity > 0 ? curve.parRate(parMaturity) : NaN,
          df: curve.discountFactor(at)
        }
      : null
  );

  // Custom curve editing
  let pasteOpen = $state(false);
  function applyPaste(rows: string[][]) {
    const points = rows
      .map((r) => ({ tenor: parseLocaleNumber(r[0], app.lang), rate: parseLocaleNumber(r[1], app.lang) }))
      .filter((x) => Number.isFinite(x.tenor) && Number.isFinite(x.rate) && x.tenor > 0)
      .map((x) => ({ ...x, label: tenorLabel(x.tenor) }));
    if (points.length >= 2) app.customCurve = points;
  }
  function numberInput(value: number, set: (v: number) => void) {
    return {
      value: app.fmt.input(value),
      onchange: (e: Event) => {
        const v = parseLocaleNumber((e.currentTarget as HTMLInputElement).value, app.lang);
        if (Number.isFinite(v)) set(v);
      }
    };
  }
</script>

<div class="view">
  <div class="view-head">
    <div>
      <h1>{app.t('cvTitle')}</h1>
      <p>{app.t('cvSubtitle')}</p>
    </div>
  </div>

  {#if curve && built}
    <div class="grid">
      <ChartCard class="span-8" title={app.t('curvesChart')} subtitle={app.t('forwardNote')} option={curvesOption} table={nodesTable} height={340}>
        {#snippet controls()}
          <Segmented
            label="Scale"
            bind:value={scale}
            options={[
              { value: 'value', label: 'lin' },
              { value: 'log', label: 'log' }
            ]}
          />
        {/snippet}
      </ChartCard>

      <Card class="span-4" title={app.t('calculator')}>
        {#if calc}
          <div class="calc">
            <label class="field">
              <span>{app.t('calcRateAt')}</span>
              <span class="row"><input class="input num" type="number" step="0.25" min="0.01" bind:value={at} /> {app.t('years')}</span>
            </label>
            <div class="out"><span>{app.t('zeroRate')}</span><strong class="num">{f.pct(calc.rate, 4)}</strong></div>
            <div class="out"><span>{app.t('discountFactor')}</span><strong class="num">{f.num(calc.df, 6)}</strong></div>

            <label class="field">
              <span>{app.t('calcForward')}</span>
              <span class="row">
                <input class="input num" type="number" step="0.25" min="0" bind:value={t1} />
                –
                <input class="input num" type="number" step="0.25" min="0.25" bind:value={t2} />
                {app.t('years')}
              </span>
            </label>
            <div class="out"><span>Forward {f.num(t1, 2)} → {f.num(t2, 2)}</span><strong class="num">{Number.isFinite(calc.forward) ? f.pct(calc.forward, 4) : '–'}</strong></div>

            <label class="field">
              <span>{app.t('calcPar')}</span>
              <span class="row"><input class="input num" type="number" step="0.5" min="0.25" bind:value={parMaturity} /> {app.t('years')}</span>
            </label>
            <div class="out"><span>{app.t('parYield')}</span><strong class="num">{Number.isFinite(calc.par) ? f.pct(calc.par, 4) : '–'}</strong></div>

            <div class="sep"></div>
            <div class="out"><span>{app.t('slope2s10s')}</span><strong class="num">{f.bps(curve.slope() * 100)}</strong></div>
            <div class="out"><span>{app.t('curvature')}</span><strong class="num">{f.bps(curve.curvature() * 100)}</strong></div>
          </div>
        {/if}
      </Card>

      <ChartCard class="span-6" title={app.t('dfChart')} subtitle="exp(−z(t)·t)" option={dfOption} table={nodesTable} height={260} />
      <ChartCard class="span-6" title={app.t('interpCompare')} subtitle={app.t('interpCompareSub')} option={interpOption} table={interpTable} height={260} />

      <Card class="span-12" title={app.t('nodesTable')} subtitle={app.source === 'custom' ? app.t('customCurveHint') : app.t('basisHint')}>
        {#snippet actions()}
          {#if app.source === 'custom'}
            <button class="btn small" onclick={() => (pasteOpen = true)}><Icon name="paste" size={15} />{app.t('pasteFromExcel')}</button>
            <button
              class="btn small"
              onclick={() => {
                const last = app.customCurve[app.customCurve.length - 1];
                app.customCurve.push({ tenor: (last?.tenor ?? 0) + 1, label: '', rate: last?.rate ?? 3 });
              }}
            >
              <Icon name="plus" size={15} />{app.t('add')}
            </button>
          {/if}
        {/snippet}
        {#if app.source === 'custom'}
          <div class="table-wrap">
            <table class="data">
              <thead>
                <tr>
                  <th class="n">{app.t('tenor')} ({app.t('years')})</th>
                  <th class="n">{app.t('zeroRate')} (%)</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {#each app.customCurve as point, i}
                  <tr>
                    <td><input class="input num" {...numberInput(point.tenor, (v) => (point.tenor = v))} aria-label={app.t('tenor')} /></td>
                    <td><input class="input num" {...numberInput(point.rate, (v) => (point.rate = v))} aria-label={app.t('zeroRate')} /></td>
                    <td class="n">
                      <button class="btn ghost small icon" onclick={() => app.customCurve.splice(i, 1)} disabled={app.customCurve.length <= 2} title={app.t('remove')}>
                        <Icon name="trash" size={15} />
                      </button>
                    </td>
                  </tr>
                {/each}
              </tbody>
            </table>
          </div>
        {:else}
          <DataTable table={nodesTable} />
        {/if}
      </Card>
    </div>
  {/if}
</div>

<PasteDialog bind:open={pasteOpen} title={app.t('pasteFromExcel')} hint={app.t('customCurveHint')} onapply={applyPaste} />

<style>
  .calc {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .calc .input {
    width: 84px;
  }

  .out {
    display: flex;
    justify-content: space-between;
    align-items: baseline;
    gap: 8px;
    font-size: 13px;
    color: var(--ink-2);
    padding-bottom: 4px;
    border-bottom: 1px solid var(--border);
  }

  .out strong {
    color: var(--ink);
    font-size: 14px;
  }

  .sep {
    height: 6px;
  }
</style>
