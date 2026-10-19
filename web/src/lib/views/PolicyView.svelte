<script lang="ts">
  import { barChart, bySign, lineChart } from '../charts/build';
  import { PortfolioRiskCalculator, addDays } from '../core';
  import { PRESET_LABELS, app, type PolicyPreset } from '../state.svelte';
  import Card from '../ui/Card.svelte';
  import ChartCard from '../ui/ChartCard.svelte';
  import DataTable from '../ui/DataTable.svelte';
  import Icon from '../ui/Icon.svelte';
  import Kpi from '../ui/Kpi.svelte';
  import NumberSlider from '../ui/NumberSlider.svelte';
  import Segmented from '../ui/Segmented.svelte';
  import type { TableData } from '../ui/table';
  import { denseTenors, sample } from './curveHelpers';

  const fw = $derived(app.fedwatch);
  const paths = $derived(app.policyPaths);
  const result = $derived(app.policyResult);
  const base = $derived(app.curve);
  const f = $derived(app.fmt);
  const p = $derived(app.palette);

  const presets = $derived(
    (Object.keys(PRESET_LABELS) as PolicyPreset[]).map((value) => ({ value, label: app.t(PRESET_LABELS[value]) }))
  );

  function step(index: number, delta: number) {
    const moves = app.policyMoves.map((m) => Math.round(m / 25) * 25);
    moves[index] = Math.max(-200, Math.min(200, moves[index] + delta));
    app.policy.custom = moves;
    app.policy.preset = 'custom';
  }

  let permanent = $state(app.policy.halfLife === null);
  let halfLife = $state(app.policy.halfLife ?? 2);
  $effect(() => {
    app.policy.halfLife = permanent ? null : halfLife;
  });

  // Policy path chart. After the final meeting the market path is held flat and
  // the scenario's surprise fades towards it with the chosen half-life.
  const TAIL_MONTHS = 24;
  const pathOption = $derived.by(() => {
    if (!paths) return {};
    const { market, scenario } = paths;
    const effective = market.meetings.map((m) => addDays(m, 1));
    const lastDate = effective[effective.length - 1];
    const marketLast = market.levels[market.levels.length - 1];
    const surprise = scenario.levels[scenario.levels.length - 1] - marketLast;
    const step = (path: typeof market): [string, number][] => [
      [path.asOf, path.startRate],
      ...effective.map((d, i) => [d, path.levels[i]] as [string, number])
    ];
    const at = (months: number) => addDays(lastDate, Math.round((months / 12) * 365));
    const fade: [string, number][] = Array.from({ length: TAIL_MONTHS + 1 }, (_, k) => {
      const decay = app.policy.halfLife === null ? 1 : Math.pow(2, -k / 12 / app.policy.halfLife);
      return [at(k), marketLast + surprise * decay];
    });
    return lineChart(p, {
      x: { type: 'time', format: (v) => f.monthYear(new Date(v).getUTCFullYear(), new Date(v).getUTCMonth() + 1) },
      y: { name: app.t('ratePct'), format: (v) => f.num(v, 2) },
      value: (v) => f.pct(v, 3),
      header: (x) => f.date(new Date(Number(x)).toISOString().slice(0, 10)),
      series: [
        { name: app.t('marketPath'), color: p.series[0], step: 'end', markers: true, data: step(market) },
        { name: app.t('scenarioPath'), color: p.series[1], step: 'end', markers: true, data: step(scenario) },
        {
          name: `${app.t('marketPath')} ›`,
          color: p.series[0],
          dashed: true,
          hideInLegend: true,
          data: [
            [lastDate, marketLast],
            [at(TAIL_MONTHS), marketLast]
          ]
        },
        { name: `${app.t('scenarioPath')} ›`, color: p.series[1], dashed: true, hideInLegend: true, data: fade }
      ]
    });
  });

  const pathTable = $derived<TableData>({
    columns: [
      { label: app.t('fwMeeting') },
      { label: app.t('marketPath'), numeric: true, format: (v) => f.pct(v, 3) },
      { label: app.t('scenarioPath'), numeric: true, format: (v) => f.pct(v, 3) },
      { label: 'δ', numeric: true, format: (v) => f.bps(v, 1) }
    ],
    rows: paths
      ? paths.market.meetings.map((m, i) => [
          f.date(m),
          paths.market.levels[i],
          paths.scenario.levels[i],
          (paths.scenario.levels[i] - paths.market.levels[i]) * 100
        ])
      : []
  });

  const grid = $derived(base ? denseTenors(base) : []);
  const curveOption = $derived(
    base && result
      ? lineChart(p, {
          x: { name: `${app.t('tenor')} (${app.t('years')})`, min: 0, max: grid[grid.length - 1], format: (v) => f.num(v, 0) },
          y: { name: app.t('zeroRate') + ' (%)', format: (v) => f.num(v, 2) },
          value: (v) => f.pct(v, 3),
          header: (x) => `${f.num(Number(x), 2)} ${app.t('years')}`,
          series: [
            { name: app.t('base'), color: p.series[0], data: sample(grid, (t) => base.rateAt(t)) },
            { name: app.t('scenarioPath'), color: p.series[1], data: sample(grid, (t) => result.deformedCurve.rateAt(t)) }
          ]
        })
      : {}
  );

  const nodeLabels = $derived(app.built?.quotes.map((q) => q.label) ?? []);
  const shifts = $derived(result ? result.rateChanges.map((r) => r * 100) : []);
  const shiftOption = $derived(
    barChart(p, {
      categories: nodeLabels,
      series: [{ name: app.t('changeBps'), values: shifts, color: bySign(p, true) }],
      value: (v) => f.bps(v),
      axisFormat: (v) => f.num(v, 0)
    })
  );
  const shiftTable = $derived<TableData>({
    columns: [
      { label: app.t('tenor') },
      { label: app.t('base'), numeric: true, format: (v) => f.pct(v, 3) },
      { label: app.t('scenarioPath'), numeric: true, format: (v) => f.pct(v, 3) },
      { label: app.t('changeBps'), numeric: true, format: (v) => f.bps(v, 2) }
    ],
    rows: result ? nodeLabels.map((l, i) => [l, result.originalCurve.rates[i], result.deformedCurve.rates[i], shifts[i]]) : []
  });

  const impact = $derived.by(() => {
    if (!base || !result) return null;
    const bond = app.bondObject;
    const before = bond.price(base);
    const after = bond.price(result.deformedCurve);
    const portfolio = app.portfolioObject.length ? new PortfolioRiskCalculator(base, app.portfolioObject).scenarioPnl(result) : null;
    return {
      d2: (result.deformedCurve.rateAt(2) - base.rateAt(2)) * 100,
      d10: (result.deformedCurve.rateAt(10) - base.rateAt(10)) * 100,
      slope: result.slopeChange * 100,
      bond: after - before,
      bondPct: ((after - before) / before) * 100,
      portfolio
    };
  });

  const positionsTable = $derived<TableData>({
    columns: [
      { label: app.t('label') },
      { label: app.t('pnl'), numeric: true, format: (v) => f.money(v), tone: (v) => (v > 0 ? 'gain' : v < 0 ? 'loss' : undefined) }
    ],
    rows: impact?.portfolio
      ? impact.portfolio.positions.map((x, i) => [app.activePositions[i].label || x.bond.toString(), x.pnl])
      : []
  });

  const tone = (v: number) => (v > 0.0005 ? 'gain' : v < -0.0005 ? 'loss' : 'neutral') as 'gain' | 'loss' | 'neutral';
</script>

<div class="view">
  <div class="view-head">
    <div>
      <h1>{app.t('psTitle')}</h1>
      <p>{app.t('psSubtitle')}</p>
    </div>
  </div>

  {#if app.source !== 'ust'}
    <div class="note">
      <Icon name="info" />
      <span>{app.t('psEcbNote')}</span>
      <button class="btn small" onclick={() => (app.source = 'ust')}>{app.t('switchToUst')}</button>
    </div>
  {/if}

  {#if !fw || !paths}
    <div class="note"><Icon name="info" />{app.t('fwNoData')}</div>
  {:else}
    <div class="grid">
      <Card class="span-4" title={app.t('psPresets')}>
        <Segmented label={app.t('psPresets')} wrap bind:value={app.policy.preset} options={presets} />

        <div class="table-wrap">
          <table class="data meetings">
            <thead>
              <tr>
                <th>{app.t('fwMeeting')}</th>
                <th class="n">{app.t('psMarketMove')}</th>
                <th class="n">{app.t('psYourMove')}</th>
              </tr>
            </thead>
            <tbody>
              {#each fw.outlooks as o, i}
                <tr>
                  <td>{f.shortDate(o.meeting)}</td>
                  <td class="n muted">{f.bps(o.expectedChangeBps, 1)}</td>
                  <td class="n">
                    <span class="stepper">
                      <button class="btn small icon" onclick={() => step(i, -25)} aria-label="−25">−</button>
                      <strong class="num">{f.bps(app.policyMoves[i] ?? 0, app.policy.preset === 'market' ? 1 : 0)}</strong>
                      <button class="btn small icon" onclick={() => step(i, 25)} aria-label="+25">+</button>
                    </span>
                  </td>
                </tr>
              {/each}
            </tbody>
          </table>
        </div>

        <div class="stack">
          <NumberSlider
            label={app.t('psHalfLife')}
            bind:value={halfLife}
            min={0.25}
            max={10}
            step={0.25}
            unit={app.t('years')}
            format={(v) => f.num(v, 2)}
          />
          <label class="row check">
            <input type="checkbox" bind:checked={permanent} />
            {app.t('permanent')}
          </label>
          <p class="hint">{app.t('psHalfLifeHint')}</p>
          <NumberSlider
            label={app.t('psTermPremium')}
            bind:value={app.policy.termPremium}
            min={-100}
            max={100}
            step={1}
            unit={app.t('bpsUnit')}
            format={(v) => f.num(v, 0)}
            hint={app.t('psTermPremiumHint')}
          />
        </div>
      </Card>

      <div class="span-8 stack">
        {#if impact}
          <div class="kpis">
            <Kpi label={app.t('psSurprise2y')} value={f.bps(impact.d2)} />
            <Kpi label={app.t('psSurprise10y')} value={f.bps(impact.d10)} />
            <Kpi label={app.t('slopeChange')} value={f.bps(impact.slope)} />
            <Kpi
              label={app.t('psBondImpact')}
              value={f.money(impact.bond)}
              delta="{f.signed(impact.bondPct, 2)} %"
              tone={tone(impact.bond)}
            />
            {#if impact.portfolio}
              <Kpi
                label={app.t('psPortfolioImpact')}
                value={f.compactMoney(impact.portfolio.totalPnl)}
                delta="{f.signed(impact.portfolio.totalPnlPct, 2)} %"
                tone={tone(impact.portfolio.totalPnl)}
              />
            {/if}
          </div>
        {/if}
        <ChartCard title={app.t('psPathChart')} subtitle={app.t('fwPathSub')} option={pathOption} table={pathTable} height={280} />
        <ChartCard title={app.t('psShiftChart')} subtitle={app.t('changeBps')} option={shiftOption} table={shiftTable} height={220} />
      </div>

      <ChartCard class="span-7" title={app.t('psCurveChart')} subtitle={app.built?.date ? f.date(app.built.date) : undefined} option={curveOption} table={shiftTable} height={280} />
      {#if impact?.portfolio}
        <Card class="span-5" title={app.t('psPortfolioImpact')} subtitle={app.t('positions')}>
          <DataTable table={positionsTable} />
        </Card>
      {/if}
      <Card class="span-12" title={app.t('psModel')}>
        <p class="model">{app.t('psModelText')}</p>
        <div class="formula">
          <code>Δz(τ) = (1/τ)·∫₀^τ δ(s) ds + TP·w(τ)</code>
          <code>δ(s) = δ(H)·2^(−(s−H)/h), s &gt; H</code>
        </div>
      </Card>
    </div>
  {/if}
</div>

<style>
  .meetings td,
  .meetings th {
    padding: 5px 8px;
  }

  .stepper {
    display: inline-flex;
    align-items: center;
    gap: 6px;
  }

  .stepper strong {
    min-width: 64px;
    text-align: center;
    font-size: 12.5px;
  }

  .check {
    font-size: 12.5px;
    color: var(--ink-2);
    gap: 6px;
  }

  .model {
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
