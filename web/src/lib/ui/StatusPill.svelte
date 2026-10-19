<script lang="ts">
  import type { SourceStatus } from '../data/market';
  import { app } from '../state.svelte';
  import Icon from './Icon.svelte';

  let { status }: { status: SourceStatus } = $props();

  const meta = $derived(
    {
      ok: { icon: 'check' as const, text: app.t('statusOk') },
      stale: { icon: 'warning' as const, text: app.t('statusStale') },
      error: { icon: 'error' as const, text: app.t('statusError') }
    }[status]
  );
</script>

<!-- Status always pairs colour with an icon and a label. -->
<span class="pill {status}"><Icon name={meta.icon} size={13} />{meta.text}</span>

<style>
  .pill {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    padding: 1px 8px 1px 6px;
    border-radius: 999px;
    font-size: 12px;
    font-weight: 500;
    border: 1px solid var(--border);
    color: var(--ink);
  }

  .ok :global(svg) {
    color: var(--good);
  }

  .stale :global(svg) {
    color: var(--warning);
  }

  .error :global(svg) {
    color: var(--critical);
  }
</style>
