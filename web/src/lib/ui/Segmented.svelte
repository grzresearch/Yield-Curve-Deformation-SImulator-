<script lang="ts" generics="T extends string | number">
  let {
    options,
    value = $bindable(),
    label,
    wrap = false
  }: {
    options: { value: T; label: string }[];
    value: T;
    label: string;
    wrap?: boolean;
  } = $props();
</script>

<div class="segmented" class:wrap role="radiogroup" aria-label={label}>
  {#each options as option}
    <button
      role="radio"
      aria-checked={option.value === value}
      class:active={option.value === value}
      onclick={() => (value = option.value)}
    >
      {option.label}
    </button>
  {/each}
</div>

<style>
  .segmented {
    display: inline-flex;
    padding: 2px;
    gap: 2px;
    border-radius: var(--radius-sm);
    background: var(--surface-2);
    border: 1px solid var(--border);
    max-width: 100%;
    overflow-x: auto;
    scrollbar-width: none;
  }

  .segmented.wrap {
    flex-wrap: wrap;
    overflow: visible;
  }

  button {
    border: 0;
    background: transparent;
    color: var(--ink-2);
    font-size: 12.5px;
    font-weight: 500;
    height: 26px;
    padding: 0 10px;
    border-radius: 6px;
    cursor: pointer;
    white-space: nowrap;
  }

  button:hover {
    color: var(--ink);
  }

  button.active {
    background: var(--surface);
    color: var(--ink);
    box-shadow: 0 0 0 1px var(--border-strong);
  }
</style>
