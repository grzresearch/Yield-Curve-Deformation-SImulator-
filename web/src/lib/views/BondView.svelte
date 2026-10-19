<script lang="ts">
  import { barChart, lineChart } from '../charts/build';
  import { RiskCalculator, interp, priceChangeEstimate } from '../core';
  import { tenorLabel } from '../data/market';
  import { parseLocaleNumber } from '../format';
  import { app } from '../state.svelte';
  import Card from '../ui/Card.svelte';
  import ChartCard from '../ui/ChartCard.svelte';
  import DataTable from '../ui/DataTable.svelte';
  import Icon from '../ui/Icon.svelte';
  import Kpi from '../ui/Kpi.svelte';
  import NumberSlider from '../ui/NumberSlider.svelte';
  import Segmented from '../ui/Segmented.svelte';
  import type { TableData } from '../ui/table';

  const curve = $derived(app.curve);
  const bond = $derived(app.bondObject);
  const f = $derived(app.fmt);
  const p = $derived(app.palette);

  const calc = $derived(curve ? new RiskCalculator(curve) : null);
  const price = $derived(curve ? bond.price(curve) : NaN);
  const metrics = $derived(calc ? calc.calculateMetrics(bond) : null);
  const ytm = $derived(Number.isFinite(price) ? bond.yieldToMaturity(price) : NaN);

  function numberField(get: () => number, set: (v: number) => void) {
    return {
      value: f.input(get()),
      onchange: (e: Event) => {
        const v = parseLocaleNumber((e.currentTarget as HTMLInputElement).value, app.lang);
        if (Number.isFinite(v) && v >= 0) set(v);
      }
    };
  }

  // Price response to parallel shifts: exact vs approximations
  const shiftsBps = Array.from({ length: 61 }, (_, i) => -300 + i * 10);
  const response = $derived(
    curve && metrics
      ? shiftsBps.map((s) => ({
          shift: s,
          exact: ((bond.price(curve.shift(s)) - price) / price) * 100,
          duration: -metrics.modifiedDuration * (s / 10000) * 100,
          convexity: priceChangeEstimate(metrics, s)
        }))
      : []
  );
  const responseOption = $derived(
    lineChart(p, {
      x: { name: app.t('shiftBps'), min: -300, max: 300, interval: 100, format: (v) => f.num(v, 0), scale: false },
      y: { name: app.t('priceChangePct'), format: (v) => f.num(v, 0) },
      value: (v) => f.pct(v, 3),
      header: (x) => f.bps(Number(x), 0),
      series: [
        { name: app.t('exact'), color: p.series[0], data: response.map((r) => [r.shift, r.exact]) },
        { name: app.t('durationOnly'), color: p.series[1], dashed: true, data: response.map((r) => [r.shift, r.duration]) },
        { name: app.t('durationConvexity'), color: p.series[2], dashed: true, data: response.map((r) => [r.shift, r.convexity]) }
      ]
    })
  );
  const estimatesTable = $derived<TableData>({
    columns: [
      { label: app.t('shiftBps'), numeric: true, format: (v) => f.bps(v, 0) },
      { label: app.t('exact'), numeric: true, format: (v) => f.pct(v, 3) },
      { label: app.t('durationOnly'), numeric: true, format: (v) => f.pct(v, 3) },
      { label: app.t('durationConvexity'), numeric: true, format: (v) => f.pct(v, 3) },
      { label: `${app.t('error')} (D+C)`, numeric: true, format: (v) => f.bps(v * 100, 1) }
    ],
    rows: response
      .filter((r) => [-200, -100, -50, 50, 100, 200].includes(r.shift))
      .map((r) => [r.shift, r.exact, r.duration, r.convexity, r.convexity - r.exact])
  });

  // Cash flows
  const flowsTable = $derived<TableData>({
    columns: [
      { label: app.t('time'), numeric: true, format: (v) => f.num(v, 2) },
      { label: app.t('nominal'), numeric: true, format: (v) => f.money(v) },
      { label: app.t('discountFactor'), numeric: true, format: (v) => f.num(v, 6) },
      { label: app.t('presentValue'), numeric: true, format: (v) => f.money(v) }
    ],
    rows: curve ? bond.cashFlows.map((cf) => [cf.time, cf.amount, curve.discountFactor(cf.time), cf.amount * curve.discountFactor(cf.time)]) : []
  });
  const flowsOption = $derived(
    curve
      ? barChart(p, {
          categories: bond.cashFlows.map((cf) => f.num(cf.time, cf.time % 1 === 0 ? 0 : 2)),
          categoryName: app.t('time'),
          series: [
            { name: app.t('nominal'), values: bond.cashFlows.map((cf) => cf.amount), color: p.series[0] },
            { name: app.t('presentValue'), values: bond.cashFlows.map((cf) => cf.amount * curve.discountFactor(cf.time)), color: p.series[1] }
          ],
          value: (v) => f.money(v),
          axisFormat: (v) => f.num(v, 0),
          header: (c) => `${c} ${app.t('years')}`
        })
      : {}
  );

  // Key rate and partial durations
  let krdMode = $state<'key' | 'partial'>('key');
  const krd = $derived(calc ? calc.keyRateDurations(bond) : { tenors: [], durations: [] });
  const partial = $derived(calc ? calc.partialDurations(bond) : []);
  const krdData = $derived(
    krdMode === 'key'
      ? { labels: krd.tenors.map(tenorLabel), values: krd.durations }
      : { labels: app.built?.quotes.map((q) => q.label) ?? partial.map((x) => tenorLabel(x.tenor)), values: partial.map((x) => x.duration) }
  );
  const krdOption = $derived(
    barChart(p, {
      categories: krdData.labels,
      series: [{ name: app.t('duration'), values: krdData.values, color: p.series[0] }],
      value: (v) => f.num(v, 4),
      axisFormat: (v) => f.num(v, 1)
    })
  );
  const krdTable = $derived<TableData>({
    columns: [
      { label: krdMode === 'key' ? app.t('keyRate') : app.t('tenor') },
      { label: app.t('duration'), numeric: true, format: (v) => f.num(v, 4) }
    ],
    rows: [
      ...krdData.labels.map((l, i) => [l, krdData.values[i]] as [string, number]),
      [app.t('total'), krdData.values.reduce((s, x) => s + x, 0)]
    ]
  });

  // Value at risk
  const realised = $derived(
    app.volatility.length
      ? interp(bond.maturity, app.volatility.map((v) => v.tenor), app.volatility.map((v) => v.vol))
      : null
  );
  let vol = $state(90);
  let volTouched = $state(false);
  $effect(() => {
    if (!volTouched && realised !== null) vol = Math.round(realised);
  });
  let confidence = $state(0.99);
  let horizon = $state(10);
  const risk = $derived(
    calc
      ? {
          var: calc.valueAtRisk(bond, vol, confidence, horizon),
          es: calc.expectedShortfall(bond, vol, confidence, horizon)
        }
      : null
  );
</script>

<div class="view">
  <div class="view-head">
    <div>
      <h1>{app.t('bdTitle')}</h1>
      <p>{app.t('bdSubtitle')}</p>
    </div>
  </div>

  {#if curve && metrics}
    <Card>
      <div class="inputs">
        <label class="field"><span>{app.t('faceValue')}</span><input class="input num" {...numberField(() => app.bond.face, (v) => (app.bond.face = v || 1))} /></label>
        <label class="field"><span>{app.t('coupon')} (%)</span><input class="input num" {...numberField(() => app.bond.coupon, (v) => (app.bond.coupon = v))} /></label>
        <label class="field"><span>{app.t('maturity')} ({app.t('years')})</span><input class="input num" {...numberField(() => app.bond.maturity, (v) => (app.bond.maturity = Math.max(0.1, v)))} /></label>
        <label class="field">
          <span>{app.t('frequency')}</span>
          <select class="select" bind:value={app.bond.frequency}>
            {#each [1, 2, 4, 12] as n}<option value={n}>{n}</option>{/each}
          </select>
        </label>
        <div class="row actions">
          <button class="btn" onclick={() => (app.bond.coupon = Math.round(curve.parRate(app.bond.maturity, app.bond.frequency) * 1000) / 1000)}>
            {app.t('setParCoupon')}
          </button>
          <button class="btn ghost" onclick={() => app.resetBond()}><Icon name="reset" size={15} />{app.t('reset')}</button>
        </div>
      </div>
    </Card>

    <div class="kpis">
      <Kpi label={app.t('price')} value={f.money(price)} sub="{f.num((price / bond.faceValue) * 100, 3)} % {app.t('nominal')}" />
      <Kpi label={app.t('ytm')} value={f.pct(ytm, 3)} sub="{app.t('currentYield')} {f.pct(bond.currentYield(price), 3)}" />
      <Kpi label={app.t('macaulay')} value={f.num(metrics.macaulayDuration, 3)} sub={app.t('years')} />
      <Kpi label={app.t('modified')} value={f.num(metrics.modifiedDuration, 3)} sub="{app.t('effective')} {f.num(metrics.effectiveDuration, 3)}" />
      <Kpi label={app.t('dv01')} value={f.money(metrics.dv01, 4)} sub={app.t('perBp')} />
      <Kpi label={app.t('convexity')} value={f.num(metrics.convexity, 2)} sub="{app.t('effConvexity')} {f.num(metrics.effectiveConvexity, 2)}" />
    </div>

    <div class="grid">
      <ChartCard class="span-7" title={app.t('priceYield')} subtitle={app.t('priceYieldSub')} option={responseOption} table={estimatesTable} height={300}>
        {#snippet footer()}
          <DataTable table={estimatesTable} caption={app.t('estimates')} />
        {/snippet}
      </ChartCard>

      <Card class="span-5" title={app.t('varTitle')} subtitle={app.t('varSub')}>
        <NumberSlider
          label={app.t('volatility')}
          bind:value={() => vol, (v) => ((vol = v), (volTouched = true))}
          min={5}
          max={300}
          step={1}
          unit={app.t('bpsUnit')}
          format={(v) => f.num(v, 0)}
          hint={realised !== null ? `${app.t('realisedVol')}: ${f.num(realised, 0)} ${app.t('bpsUnit')}` : undefined}
        />
        <div class="row between">
          <span class="field"><span>{app.t('confidence')}</span>
            <Segmented label={app.t('confidence')} bind:value={confidence} options={[{ value: 0.95, label: '95 %' }, { value: 0.975, label: f.pct(97.5, 1) }, { value: 0.99, label: '99 %' }]} />
          </span>
          <span class="field"><span>{app.t('horizon')}</span>
            <Segmented label={app.t('horizon')} bind:value={horizon} options={[1, 10, 20, 250].map((d) => ({ value: d, label: `${d}` }))} />
          </span>
        </div>
        {#if risk}
          <div class="risk">
            <div>
              <span class="muted">{app.t('var')} · {f.pct(confidence * 100, 1)} · {horizon} {app.t('days')}</span>
              <strong>{f.money(risk.var)}</strong>
              <span class="muted">{f.pct((risk.var / price) * 100, 2)} {app.t('ofPrice')}</span>
            </div>
            <div>
              <span class="muted">{app.t('es')}</span>
              <strong>{f.money(risk.es)}</strong>
              <span class="muted">{f.pct((risk.es / price) * 100, 2)} {app.t('ofPrice')}</span>
            </div>
          </div>
        {/if}
      </Card>

      <ChartCard class="span-6" title={app.t('krdTitle')} subtitle={app.t('krdSub')} option={krdOption} table={krdTable} height={280}>
        {#snippet controls()}
          <Segmented label={app.t('krdTitle')} bind:value={krdMode} options={[{ value: 'key', label: app.t('keyRate') }, { value: 'partial', label: app.t('partial') }]} />
        {/snippet}
      </ChartCard>
      <ChartCard class="span-6" title={app.t('cashFlows')} subtitle={app.t('cashFlowsSub')} option={flowsOption} table={flowsTable} height={280} />
    </div>
  {/if}
</div>

<style>
  .inputs {
    display: grid;
    grid-template-columns: repeat(4, minmax(110px, 160px)) 1fr;
    gap: 12px;
    align-items: end;
  }

  .actions {
    justify-content: flex-end;
  }

  .between {
    justify-content: space-between;
    align-items: flex-end;
    gap: 12px;
  }

  .risk {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 12px;
  }

  .risk > div {
    display: flex;
    flex-direction: column;
    gap: 2px;
    padding: 10px 12px;
    border-radius: var(--radius-sm);
    background: var(--surface-2);
    font-size: 12px;
  }

  .risk strong {
    font-size: 20px;
    font-weight: 600;
  }

  @media (max-width: 900px) {
    .inputs {
      grid-template-columns: repeat(2, minmax(0, 1fr));
    }

    .actions {
      grid-column: span 2;
      justify-content: flex-start;
    }
  }
</style>
