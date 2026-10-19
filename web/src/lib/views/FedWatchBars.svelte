<script lang="ts">
  import type { Snippet } from 'svelte';
  import { barChart } from '../charts/build';
  import type { MeetingOutlook } from '../core';
  import { app } from '../state.svelte';
  import ChartCard from '../ui/ChartCard.svelte';
  import type { TableData } from '../ui/table';
  import { rangeLabel } from './labels';

  let {
    outlook,
    compact = false,
    extra,
    controls
  }: { outlook: MeetingOutlook; compact?: boolean; extra?: Snippet; controls?: Snippet } = $props();

  const fw = $derived(app.fedwatch!);
  const f = $derived(app.fmt);

  const entries = $derived([...outlook.probabilities].filter(([, prob]) => prob >= 0.0005));
  const categories = $derived(
    entries.map(([change]) => {
      const label = rangeLabel(change, fw.targetLower, fw.targetUpper, f);
      return change === 0 ? `${label} (${app.t('fwCurrent')})` : label;
    })
  );
  const option = $derived(
    barChart(app.palette, {
      categories,
      series: [{ name: app.t('fwTargetProbs'), values: entries.map(([, prob]) => prob * 100), color: app.palette.series[0] }],
      value: (v) => f.pct(v, 1),
      axisFormat: (v) => `${f.num(v, 0)} %`,
      labels: true
    })
  );
  const table = $derived<TableData>({
    columns: [
      { label: app.t('kpiTarget') + ' (%)' },
      { label: app.t('fwTargetProbs'), numeric: true, format: (v) => f.pct(v * 100, 1) }
    ],
    rows: entries.map(([, prob], i) => [categories[i], prob])
  });
  const moveText = $derived(
    outlook.expectedChangeBps === 0 ? app.t('fwHold') : f.bps(outlook.expectedChangeBps, 1)
  );
</script>

<ChartCard
  title={compact ? app.t('nextMeetingOdds') : app.t('fwTargetProbs')}
  subtitle={app.t('fwTargetProbsSub', { d: f.date(outlook.meeting) })}
  {option}
  {table}
  height={compact ? 240 : 300}
  {controls}
>
  {#snippet footer()}
    <div class="row summary">
      <span class="muted">{app.t('fwExpected')}</span>
      <strong class="num">{moveText}</strong>
      <span class="muted">· {app.t('fwExpectedRate')}</span>
      <strong class="num">{f.pct(outlook.rateAfter, 3)}</strong>
      <span class="spacer"></span>
      {@render extra?.()}
    </div>
  {/snippet}
</ChartCard>

<style>
  .summary {
    font-size: 13px;
    gap: 6px;
  }

  .spacer {
    flex: 1;
  }
</style>
