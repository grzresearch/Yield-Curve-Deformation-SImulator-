<script lang="ts">
  import { barChart, bySign, lineChart } from '../charts/build';
  import { PortfolioRiskCalculator } from '../core';
  import type { MessageKey } from '../i18n';
  import { newId, toScenario } from '../scenarios';
  import { app } from '../state.svelte';
  import Card from '../ui/Card.svelte';
  import ChartCard from '../ui/ChartCard.svelte';
  import Icon from '../ui/Icon.svelte';
  import Kpi from '../ui/Kpi.svelte';
  import type { TableData } from '../ui/table';
  import { denseTenors, sample } from './curveHelpers';
  import ShockEditor from './ShockEditor.svelte';

  const base = $derived(app.curve);
  const result = $derived(app.shockResult);
  const f = $derived(app.fmt);
  const p = $derived(app.palette);
  const nodes = $derived(app.built?.quotes.map((q) => ({ tenor: q.tenor, label: q.label })) ?? []);
  const grid = $derived(base ? denseTenors(base) : []);

  const interpretationKey = $derived(`i_${app.shock.type}` as MessageKey);

  const curveOption = $derived(
    base && result
      ? lineChart(p, {
          x: { name: `${app.t('tenor')} (${app.t('years')})`, min: 0, max: grid[grid.length - 1], format: (v) => f.num(v, 0) },
          y: { name: app.t('zeroRate') + ' (%)', format: (v) => f.num(v, 2) },
          value: (v) => f.pct(v, 3),
          header: (x) => `${f.num(Number(x), 2)} ${app.t('years')}`,
          series: [
            { name: app.t('base'), color: p.series[0], data: sample(grid, (t) => base.rateAt(t)) },
            {
              name: app.t(`d_${app.shock.type}` as MessageKey),
              color: p.series[1],
              data: sample(grid, (t) => result.deformedCurve.rateAt(t))
            },
            {
              name: app.t('shocked') + ' · ' + app.t('nodesTable'),
              color: p.series[1],
              pointsOnly: true,
              data: result.deformedCurve.tenors.map((t, i) => [t, result.deformedCurve.rates[i]] as [number, number])
            }
          ]
        })
      : {}
  );

  const shifts = $derived(result ? result.rateChanges.map((r) => r * 100) : []);
  const shiftOption = $derived(
    barChart(p, {
      categories: nodes.map((n) => n.label),
      series: [{ name: app.t('changeBps'), values: shifts, color: bySign(p, true) }],
      value: (v) => f.bps(v),
      axisFormat: (v) => f.num(v, 0)
    })
  );

  const table = $derived<TableData>({
    columns: [
      { label: app.t('tenor') },
      { label: app.t('base'), numeric: true, format: (v) => f.pct(v, 3) },
      { label: app.t('shocked'), numeric: true, format: (v) => f.pct(v, 3) },
      { label: app.t('changeBps'), numeric: true, format: (v) => f.bps(v, 2) }
    ],
    rows: result ? nodes.map((n, i) => [n.label, result.originalCurve.rates[i], result.deformedCurve.rates[i], shifts[i]]) : []
  });

  const impact = $derived.by(() => {
    if (!base || !result) return null;
    const before = app.bondObject.price(base);
    const after = app.bondObject.price(result.deformedCurve);
    return {
      bond: after - before,
      bondPct: ((after - before) / before) * 100,
      portfolio: app.portfolioObject.length
        ? new PortfolioRiskCalculator(base, app.portfolioObject).scenarioPnl(result)
        : null
    };
  });

  let added = $state(false);
  function addToStress() {
    app.stress.push({ id: newId(), scenario: toScenario($state.snapshot(app.shock)) });
    added = true;
    setTimeout(() => (added = false), 1800);
  }

  const tone = (v: number) => (v > 0.0005 ? 'gain' : v < -0.0005 ? 'loss' : 'neutral') as 'gain' | 'loss' | 'neutral';
</script>

<div class="view">
  <div class="view-head">
    <div>
      <h1>{app.t('shTitle')}</h1>
      <p>{app.t('shSubtitle')}</p>
    </div>
  </div>

  <div class="grid">
    <Card class="span-4" title={app.t('shParams')}>
      <ShockEditor bind:spec={app.shock} {nodes} />
      <div class="interpretation">
        <h3>{app.t('shInterpretation')}</h3>
        <p>{app.t(interpretationKey)}</p>
      </div>
      <button class="btn" onclick={addToStress}>
        <Icon name={added ? 'check' : 'plus'} size={15} />{added ? app.t('addedToStress') : app.t('useInStress')}
      </button>
    </Card>

    <div class="span-8 stack">
      {#if result && impact}
        <div class="kpis">
          <Kpi label={app.t('slopeChange')} value={f.bps(result.slopeChange * 100)} />
          <Kpi label={app.t('curvatureChange')} value={f.bps(result.curvatureChange * 100)} />
          <Kpi label={app.t('bondPnl')} value={f.money(impact.bond)} delta="{f.signed(impact.bondPct, 2)} %" tone={tone(impact.bond)} />
          {#if impact.portfolio}
            <Kpi
              label={app.t('portfolioPnl')}
              value={f.compactMoney(impact.portfolio.totalPnl)}
              delta="{f.signed(impact.portfolio.totalPnlPct, 2)} %"
              tone={tone(impact.portfolio.totalPnl)}
            />
          {/if}
        </div>
      {/if}
      <ChartCard title={app.t('shCurves')} subtitle={app.built?.date ? f.date(app.built.date) : undefined} option={curveOption} {table} height={320} />
      <ChartCard title={app.t('shShifts')} subtitle={app.t('changeBps')} option={shiftOption} {table} height={220} />
    </div>
  </div>
</div>

<style>
  .interpretation {
    padding: 12px;
    border-radius: var(--radius-sm);
    background: var(--surface-2);
  }

  .interpretation h3 {
    font-size: 12.5px;
    color: var(--ink-2);
    margin-bottom: 4px;
  }

  .interpretation p {
    font-size: 13px;
    line-height: 1.55;
  }
</style>
