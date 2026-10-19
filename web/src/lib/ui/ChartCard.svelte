<script lang="ts">
  import type { Snippet } from 'svelte';
  import type { ChartOption } from '../charts/echarts';
  import { app } from '../state.svelte';
  import Card from './Card.svelte';
  import DataTable from './DataTable.svelte';
  import EChart from './EChart.svelte';
  import Icon from './Icon.svelte';
  import { copyText, downloadCsv, slug, toDelimited, type TableData } from './table';

  let {
    title,
    subtitle,
    option,
    table,
    height = 300,
    class: className = '',
    controls,
    footer
  }: {
    title: string;
    subtitle?: string;
    option: ChartOption;
    table: TableData;
    height?: number;
    class?: string;
    controls?: Snippet;
    footer?: Snippet;
  } = $props();

  let showTable = $state(false);
  let copied = $state(false);

  const exportName = () => `${slug(title)}-${app.built?.date ?? new Date().toISOString().slice(0, 10)}`;

  async function copy() {
    if (await copyText(toDelimited(table, app.fmt, app.lang, '\t'))) {
      copied = true;
      setTimeout(() => (copied = false), 1600);
    }
  }
</script>

<Card {title} {subtitle} class={className}>
  {#snippet actions()}
    {@render controls?.()}
    <button
      class="btn ghost small"
      onclick={() => (showTable = !showTable)}
      aria-pressed={showTable}
      title={showTable ? app.t('showChart') : app.t('showTable')}
    >
      <Icon name={showTable ? 'chart' : 'table'} size={15} />
      <span class="label">{showTable ? app.t('showChart') : app.t('showTable')}</span>
    </button>
    <button class="btn ghost small icon" onclick={copy} title={copied ? app.t('copied') : app.t('copyTable')}>
      <Icon name={copied ? 'check' : 'copy'} size={15} />
      <span class="visually-hidden">{app.t('copyTable')}</span>
    </button>
    <button
      class="btn ghost small icon"
      onclick={() => downloadCsv(exportName(), toDelimited(table, app.fmt, app.lang))}
      title={app.t('exportCsv')}
    >
      <Icon name="download" size={15} />
      <span class="visually-hidden">{app.t('exportCsv')}</span>
    </button>
  {/snippet}

  {#if showTable}
    <DataTable {table} maxHeight={height + 40} caption={title} />
  {:else}
    <EChart {option} {height} label={subtitle ? `${title} – ${subtitle}` : title} />
  {/if}
  {@render footer?.()}
</Card>

<style>
  @media (max-width: 520px) {
    .label {
      display: none;
    }
  }
</style>
