<script lang="ts">
  import type { Snippet } from 'svelte';

  let {
    title,
    subtitle,
    actions,
    children,
    class: className = '',
    pad = true
  }: {
    title?: string;
    subtitle?: string;
    actions?: Snippet;
    children: Snippet;
    class?: string;
    pad?: boolean;
  } = $props();
</script>

<section class="card {className}" class:pad>
  {#if title || actions}
    <header>
      <div class="titles">
        {#if title}<h2>{title}</h2>{/if}
        {#if subtitle}<p>{subtitle}</p>{/if}
      </div>
      {#if actions}<div class="actions">{@render actions()}</div>{/if}
    </header>
  {/if}
  {@render children()}
</section>

<style>
  .card {
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: var(--radius);
    box-shadow: var(--shadow);
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: 12px;
  }

  .pad {
    padding: 16px;
  }

  header {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 8px 12px;
    flex-wrap: wrap;
  }

  .titles {
    min-width: 0;
  }

  h2 {
    font-size: 14.5px;
  }

  p {
    font-size: 12.5px;
    color: var(--muted);
    margin-top: 2px;
  }

  .actions {
    display: flex;
    gap: 4px;
    align-items: center;
    flex-wrap: wrap;
  }
</style>
