<script lang="ts">
  import type { Snippet } from 'svelte';
  import { app } from '../state.svelte';
  import Card from './Card.svelte';
  import DataTable from './DataTable.svelte';
  import Icon from './Icon.svelte';
  import { copyText, downloadCsv, slug, toDelimited, type TableData } from './table';

  let {
    title,
    subtitle,
    table,
    class: className = '',
    maxHeight,
    controls
  }: { title: string; subtitle?: string; table: TableData; class?: string; maxHeight?: number; controls?: Snippet } = $props();

  let copied = $state(false);
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
    <button class="btn ghost small icon" onclick={copy} title={copied ? app.t('copied') : app.t('copyTable')}>
      <Icon name={copied ? 'check' : 'copy'} size={15} />
      <span class="visually-hidden">{app.t('copyTable')}</span>
    </button>
    <button
      class="btn ghost small icon"
      onclick={() => downloadCsv(`${slug(title)}-${app.built?.date ?? app.asOf ?? ''}`, toDelimited(table, app.fmt, app.lang))}
      title={app.t('exportCsv')}
    >
      <Icon name="download" size={15} />
      <span class="visually-hidden">{app.t('exportCsv')}</span>
    </button>
  {/snippet}
  <DataTable {table} {maxHeight} caption={title} />
</Card>
