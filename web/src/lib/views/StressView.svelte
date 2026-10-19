<script lang="ts">
  import { barChart, bySign } from '../charts/build';
  import { CurveDeformer, PortfolioRiskCalculator, type DeformationResult } from '../core';
  import { DEFAULT_STRESS, defaultParams, newId, scenarioLabel, toScenario, type ShockSpec } from '../scenarios';
  import { PRESET_LABELS, app } from '../state.svelte';
  import Card from '../ui/Card.svelte';
  import ChartCard from '../ui/ChartCard.svelte';
  import Icon from '../ui/Icon.svelte';
  import TableCard from '../ui/TableCard.svelte';
  import type { TableData } from '../ui/table';
  import ShockEditor from './ShockEditor.svelte';

  const curve = $derived(app.curve);
  const f = $derived(app.fmt);
  const p = $derived(app.palette);
  const nodes = $derived(app.built?.quotes.map((q) => ({ tenor: q.tenor, label: q.label })) ?? []);

  let includeFed = $state(true);
  let draft = $state<ShockSpec>({ type: 'parallel_shift', params: defaultParams('parallel_shift'), custom: {} });

  const results = $derived.by(() => {
    if (!curve) return [];
    const deformer = new CurveDeformer(curve);
    const list: { id: string | null; name: string; result: DeformationResult }[] = app.stress.map((s) => ({
      id: s.id,
      name: scenarioLabel(s.scenario, app.t, f),
      result: deformer.run(s.scenario)
    }));
    if (includeFed && app.policyResult) {
      list.push({ id: null, name: `${app.t('d_policy')}: ${app.t(PRESET_LABELS[app.policy.preset])}`, result: app.policyResult });
    }
    const bond = app.bondObject;
    const before = bond.price(curve);
    const portfolio = app.portfolioObject.length ? new PortfolioRiskCalculator(curve, app.portfolioObject) : null;
    return list.map((s) => {
      const shocked = s.result.deformedCurve;
      const pnl = portfolio?.scenarioPnl(s.result);
      return {
        ...s,
        d2: (shocked.rateAt(2) - curve.rateAt(2)) * 100,
        d10: (shocked.rateAt(10) - curve.rateAt(10)) * 100,
        slope: s.result.slopeChange * 100,
        bondPct: ((bond.price(shocked) - before) / before) * 100,
        pnl: pnl?.totalPnl ?? null,
        pnlPct: pnl?.totalPnlPct ?? null
      };
    });
  });

  const tone = (v: number) => (v > 0 ? 'gain' : v < 0 ? 'loss' : undefined);
  const matrix = $derived<TableData>({
    columns: [
      { label: app.t('scenario') },
      { label: app.t('d2y'), numeric: true, format: (v) => f.bps(v) },
      { label: app.t('d10y'), numeric: true, format: (v) => f.bps(v) },
      { label: app.t('slopeChange'), numeric: true, format: (v) => f.bps(v) },
      { label: app.t('bondPct'), numeric: true, format: (v) => f.pct(v, 3), tone },
      { label: app.t('portfolioPnl'), numeric: true, format: (v) => f.money(v, 0), tone },
      { label: app.t('pnlPct'), numeric: true, format: (v) => f.pct(v, 3), tone }
    ],
    rows: results.map((r) => [r.name, r.d2, r.d10, r.slope, r.bondPct, r.pnl, r.pnlPct])
  });

  const chartOption = $derived(
    barChart(p, {
      categories: results.map((r) => r.name),
      series: [{ name: app.t('portfolioPnl'), values: results.map((r) => r.pnl ?? 0), color: bySign(p) }],
      value: (v) => f.compactMoney(v),
      axisFormat: (v) => f.compactMoney(v),
      horizontal: true,
      labels: true
    })
  );

  function add() {
    app.stress.push({ id: newId(), scenario: toScenario($state.snapshot(draft)) });
  }
</script>

<div class="view">
  <div class="view-head">
    <div>
      <h1>{app.t('stTitle')}</h1>
      <p>{app.t('stSubtitle')}</p>
    </div>
  </div>

  <div class="grid">
    <Card class="span-4" title={app.t('stScenarios')}>
      {#snippet actions()}
        <button class="btn ghost small" onclick={() => (app.stress = DEFAULT_STRESS.map((s) => ({ ...s })))}>
          <Icon name="reset" size={15} />{app.t('reset')}
        </button>
      {/snippet}
      <ul class="scenarios">
        {#each app.stress as s, i (s.id)}
          <li>
            <span>{scenarioLabel(s.scenario, app.t, f)}</span>
            <button class="btn ghost small icon" onclick={() => app.stress.splice(i, 1)} title={app.t('remove')} aria-label={app.t('remove')}>
              <Icon name="trash" size={14} />
            </button>
          </li>
        {/each}
      </ul>
      <label class="row check">
        <input type="checkbox" bind:checked={includeFed} />
        {app.t('stIncludeFed')}
      </label>
      <div class="adder">
        <h3>{app.t('stAdd')}</h3>
        <ShockEditor bind:spec={draft} {nodes} />
        <button class="btn primary" onclick={add}><Icon name="plus" size={15} />{app.t('add')}</button>
      </div>
    </Card>

    <div class="span-8 stack">
      <TableCard title={app.t('stMatrix')} subtitle={app.built?.date ? f.date(app.built.date) : undefined} table={matrix} />
      <ChartCard title={app.t('stChart')} option={chartOption} table={matrix} height={Math.max(260, results.length * 30 + 40)} />
    </div>
  </div>
</div>

<style>
  .scenarios {
    list-style: none;
    margin: 0;
    padding: 0;
    display: flex;
    flex-direction: column;
    border: 1px solid var(--border);
    border-radius: var(--radius-sm);
  }

  .scenarios li {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
    padding: 4px 6px 4px 10px;
    border-bottom: 1px solid var(--border);
    font-size: 13px;
  }

  .scenarios li:last-child {
    border-bottom: 0;
  }

  .check {
    font-size: 12.5px;
    color: var(--ink-2);
    gap: 6px;
  }

  .adder {
    display: flex;
    flex-direction: column;
    gap: 12px;
    padding-top: 12px;
    border-top: 1px solid var(--border);
  }

  .adder h3 {
    font-size: 13px;
  }
</style>
