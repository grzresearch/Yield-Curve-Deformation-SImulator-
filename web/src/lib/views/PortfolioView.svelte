<script lang="ts">
  import { barChart, bySign } from '../charts/build';
  import { CurveDeformer, PortfolioRiskCalculator } from '../core';
  import { tenorLabel } from '../data/market';
  import { parseLocaleNumber } from '../format';
  import { scenarioLabel } from '../scenarios';
  import { EXAMPLE_PORTFOLIO, PRESET_LABELS, app, type PositionSpec } from '../state.svelte';
  import Card from '../ui/Card.svelte';
  import ChartCard from '../ui/ChartCard.svelte';
  import Icon from '../ui/Icon.svelte';
  import Kpi from '../ui/Kpi.svelte';
  import PasteDialog from '../ui/PasteDialog.svelte';
  import type { TableData } from '../ui/table';

  const curve = $derived(app.curve);
  const f = $derived(app.fmt);
  const p = $derived(app.palette);
  const portfolio = $derived(app.portfolioObject);
  const calc = $derived(curve && portfolio.length ? new PortfolioRiskCalculator(curve, portfolio) : null);
  const metrics = $derived(calc?.portfolioMetrics() ?? null);
  const value = $derived(curve ? portfolio.totalValue(curve) : 0);

  const rows = $derived.by(() => {
    if (!curve || !calc) return [];
    const contributions = calc.contributionToDuration();
    return portfolio.positions.map(({ bond, quantity }, i) => {
      const m = calc.single.calculateMetrics(bond);
      const price = bond.price(curve);
      return {
        spec: app.activePositions[i],
        price,
        value: price * quantity,
        weight: (price * quantity) / value,
        modified: m.modifiedDuration,
        dv01: m.dv01 * quantity,
        contribution: contributions[i].contribution,
        contributionPct: contributions[i].contributionPct
      };
    });
  });
  const rowFor = (spec: PositionSpec) => rows.find((r) => r.spec === spec);

  const labelOf = (spec: PositionSpec) => spec.label || `${f.num(spec.maturity, 1)}Y ${f.num(spec.coupon, 2)}%`;

  const contributionOption = $derived(
    barChart(p, {
      categories: rows.map((r) => labelOf(r.spec)),
      series: [{ name: app.t('contribution'), values: rows.map((r) => r.contribution), color: p.series[0] }],
      value: (v) => f.num(v, 3),
      axisFormat: (v) => f.num(v, 1),
      labels: rows.length <= 10
    })
  );
  const positionsTable = $derived<TableData>({
    columns: [
      { label: app.t('label') },
      { label: app.t('price'), numeric: true, format: (v) => f.money(v) },
      { label: app.t('marketValue'), numeric: true, format: (v) => f.money(v, 0) },
      { label: app.t('weight'), numeric: true, format: (v) => f.pct(v * 100, 1) },
      { label: app.t('modified'), numeric: true, format: (v) => f.num(v, 3) },
      { label: app.t('dv01'), numeric: true, format: (v) => f.money(v) },
      { label: app.t('contribution'), numeric: true, format: (v) => f.num(v, 3) },
      { label: '%', numeric: true, format: (v) => f.pct(v, 1) }
    ],
    rows: rows.map((r) => [labelOf(r.spec), r.price, r.value, r.weight, r.modified, r.dv01, r.contribution, r.contributionPct])
  });

  const krd = $derived(calc ? calc.portfolioKeyRateDurations() : { tenors: [], durations: [] });
  const krdOption = $derived(
    barChart(p, {
      categories: krd.tenors.map(tenorLabel),
      series: [{ name: app.t('duration'), values: krd.durations, color: p.series[0] }],
      value: (v) => f.num(v, 4),
      axisFormat: (v) => f.num(v, 1)
    })
  );
  const krdTable = $derived<TableData>({
    columns: [
      { label: app.t('keyRate') },
      { label: app.t('duration'), numeric: true, format: (v) => f.num(v, 4) }
    ],
    rows: krd.tenors.map((t, i) => [tenorLabel(t), krd.durations[i]])
  });

  // Scenario P&L over the stress-test set, plus the live shock and Fed scenario
  const scenarios = $derived.by(() => {
    if (!curve || !calc) return [];
    const deformer = new CurveDeformer(curve);
    const list = app.stress.map((s) => ({ name: scenarioLabel(s.scenario, app.t, f), result: deformer.run(s.scenario) }));
    if (app.policyResult) {
      list.push({ name: `${app.t('d_policy')}: ${app.t(PRESET_LABELS[app.policy.preset])}`, result: app.policyResult });
    }
    return list.map((s) => ({ ...s, pnl: calc.scenarioPnl(s.result) }));
  });
  const pnlOption = $derived(
    barChart(p, {
      categories: scenarios.map((s) => s.name),
      series: [{ name: app.t('pnl'), values: scenarios.map((s) => s.pnl.totalPnl), color: bySign(p) }],
      value: (v) => f.compactMoney(v),
      axisFormat: (v) => f.compactMoney(v),
      horizontal: true,
      labels: true
    })
  );
  const pnlTable = $derived<TableData>({
    columns: [
      { label: app.t('scenario') },
      { label: app.t('pnl'), numeric: true, format: (v) => f.money(v, 0), tone: (v) => (v > 0 ? 'gain' : v < 0 ? 'loss' : undefined) },
      { label: app.t('pnlPct'), numeric: true, format: (v) => f.pct(v, 3), tone: (v) => (v > 0 ? 'gain' : v < 0 ? 'loss' : undefined) }
    ],
    rows: scenarios.map((s) => [s.name, s.pnl.totalPnl, s.pnl.totalPnlPct])
  });

  // Editing
  let pasteOpen = $state(false);
  function applyPaste(table: string[][]) {
    const parsed: PositionSpec[] = [];
    for (const cells of table) {
      const numbers = cells.map((c) => parseLocaleNumber(c, app.lang));
      const hasLabel = !Number.isFinite(numbers[0]);
      const [face, coupon, maturity, frequency, quantity] = hasLabel ? numbers.slice(1) : numbers;
      if (![face, coupon, maturity].every(Number.isFinite)) continue; // header rows and blanks
      parsed.push({
        label: hasLabel ? cells[0] : '',
        face,
        coupon,
        maturity,
        frequency: [1, 2, 4, 12].includes(frequency) ? frequency : 2,
        quantity: Number.isFinite(quantity) ? quantity : 1
      });
    }
    if (parsed.length) app.portfolio = parsed;
  }

  function cell(spec: PositionSpec, key: 'face' | 'coupon' | 'maturity' | 'quantity') {
    return {
      value: f.input(spec[key]),
      onchange: (e: Event) => {
        const v = parseLocaleNumber((e.currentTarget as HTMLInputElement).value, app.lang);
        if (Number.isFinite(v)) spec[key] = v;
      }
    };
  }
</script>

<div class="view">
  <div class="view-head">
    <div>
      <h1>{app.t('pfTitle')}</h1>
      <p>{app.t('pfSubtitle')}</p>
    </div>
  </div>

  {#if metrics}
    <div class="kpis">
      <Kpi label={app.t('marketValue')} value={f.compactMoney(value)} sub="{app.t('totalFace')} {f.compactMoney(portfolio.totalFaceValue())}" />
      <Kpi label={app.t('modified')} value={f.num(metrics.modifiedDuration, 3)} sub="{app.t('effective')} {f.num(metrics.effectiveDuration, 3)}" />
      <Kpi label={app.t('dv01')} value={f.money(metrics.dv01, 0)} sub={app.t('perBp')} />
      <Kpi label={app.t('convexity')} value={f.num(metrics.convexity, 2)} sub="{app.t('macaulay')} {f.num(metrics.macaulayDuration, 2)}" />
      <Kpi label={app.t('wam')} value="{f.num(portfolio.weightedAverageMaturity(), 2)} {app.t('years')}" sub="{portfolio.length} {app.t('positions')}" />
    </div>
  {/if}

  <Card title={app.t('positions')} subtitle={app.t('portfolioPasteHint')}>
    {#snippet actions()}
      <button class="btn small" onclick={() => (pasteOpen = true)}><Icon name="paste" size={15} />{app.t('pasteFromExcel')}</button>
      <button class="btn small" onclick={() => app.portfolio.push({ label: '', face: 1000, coupon: 4, maturity: 5, frequency: 2, quantity: 100 })}>
        <Icon name="plus" size={15} />{app.t('addPosition')}
      </button>
      <button class="btn ghost small" onclick={() => (app.portfolio = EXAMPLE_PORTFOLIO.map((x) => ({ ...x })))}>
        <Icon name="reset" size={15} />{app.t('example')}
      </button>
    {/snippet}
    <div class="table-wrap">
      <table class="data editable">
        <thead>
          <tr>
            <th>{app.t('label')}</th>
            <th class="n">{app.t('faceValue')}</th>
            <th class="n">{app.t('coupon')} %</th>
            <th class="n">{app.t('maturity')}</th>
            <th class="n">{app.t('frequency')}</th>
            <th class="n">{app.t('quantity')}</th>
            <th class="n">{app.t('marketValue')}</th>
            <th class="n">{app.t('weight')}</th>
            <th class="n">{app.t('modified')}</th>
            <th class="n">DV01</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {#each app.portfolio as spec, i}
            {@const r = rowFor(spec)}
            <tr>
              <td><input class="input label" bind:value={spec.label} placeholder={labelOf(spec)} aria-label={app.t('label')} /></td>
              <td><input class="input num" {...cell(spec, 'face')} aria-label={app.t('faceValue')} /></td>
              <td><input class="input num" {...cell(spec, 'coupon')} aria-label={app.t('coupon')} /></td>
              <td><input class="input num" {...cell(spec, 'maturity')} aria-label={app.t('maturity')} /></td>
              <td>
                <select class="select" bind:value={spec.frequency} aria-label={app.t('frequency')}>
                  {#each [1, 2, 4, 12] as n}<option value={n}>{n}</option>{/each}
                </select>
              </td>
              <td><input class="input num" {...cell(spec, 'quantity')} aria-label={app.t('quantity')} /></td>
              <td class="n">{r ? f.money(r.value, 0) : '–'}</td>
              <td class="n">{r ? f.pct(r.weight * 100, 1) : '–'}</td>
              <td class="n">{r ? f.num(r.modified, 2) : '–'}</td>
              <td class="n">{r ? f.money(r.dv01, 0) : '–'}</td>
              <td class="n">
                <button class="btn ghost small icon" onclick={() => app.portfolio.splice(i, 1)} title={app.t('remove')} aria-label={app.t('remove')}>
                  <Icon name="trash" size={15} />
                </button>
              </td>
            </tr>
          {:else}
            <tr><td colspan="11" class="muted">{app.t('emptyPortfolio')}</td></tr>
          {/each}
        </tbody>
      </table>
    </div>
  </Card>

  {#if calc}
    <div class="grid">
      <ChartCard class="span-6" title={app.t('contribution')} subtitle={app.t('contributionSub')} option={contributionOption} table={positionsTable} height={260} />
      <ChartCard class="span-6" title={app.t('portfolioKrd')} subtitle={app.t('krdSub')} option={krdOption} table={krdTable} height={260} />
      <ChartCard
        class="span-12"
        title={app.t('scenarioPnl')}
        subtitle={app.t('scenarioPnlSub')}
        option={pnlOption}
        table={pnlTable}
        height={Math.max(240, scenarios.length * 30 + 40)}
      />
    </div>
  {/if}
</div>

<PasteDialog bind:open={pasteOpen} title={app.t('pasteFromExcel')} hint={app.t('portfolioPasteHint')} onapply={applyPaste} />

<style>
  .editable td {
    padding: 4px 6px;
  }

  .editable .input {
    width: 100%;
    min-width: 72px;
  }

  .editable .input.label {
    min-width: 120px;
  }

  .editable .select {
    min-width: 56px;
    height: 28px;
  }
</style>
