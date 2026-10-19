<script lang="ts">
  import { parseLocaleNumber } from '../format';
  import { app } from '../state.svelte';

  let {
    label,
    value = $bindable(),
    min,
    max,
    step = 1,
    unit,
    format,
    hint
  }: {
    label: string;
    value: number;
    min: number;
    max: number;
    step?: number;
    unit?: string;
    format?: (v: number) => string;
    hint?: string;
  } = $props();

  const id = `ns-${Math.random().toString(36).slice(2, 9)}`;
  let draft = $state<string | null>(null);

  const shown = $derived(draft ?? (format ? format(value) : app.fmt.input(value)));
  const fill = $derived(((Math.min(max, Math.max(min, value)) - min) / (max - min)) * 100);

  function commit() {
    if (draft === null) return;
    const parsed = parseLocaleNumber(draft, app.lang);
    if (Number.isFinite(parsed)) value = Math.min(max, Math.max(min, parsed));
    draft = null;
  }
</script>

<div class="slider">
  <div class="top">
    <label for={id}>{label}</label>
    <span class="entry">
      <input
        class="input num"
        aria-label={label}
        value={shown}
        onfocus={(e) => (draft = (e.currentTarget as HTMLInputElement).value)}
        oninput={(e) => (draft = (e.currentTarget as HTMLInputElement).value)}
        onblur={commit}
        onkeydown={(e) => e.key === 'Enter' && (e.currentTarget as HTMLInputElement).blur()}
      />
      {#if unit}<span class="unit">{unit}</span>{/if}
    </span>
  </div>
  <input
    {id}
    type="range"
    {min}
    {max}
    {step}
    bind:value
    style:--fill="{fill}%"
  />
  {#if hint}<p class="hint">{hint}</p>{/if}
</div>

<style>
  .slider {
    display: flex;
    flex-direction: column;
    gap: 6px;
    min-width: 0;
  }

  .top {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
  }

  label {
    font-size: 12.5px;
    color: var(--ink-2);
    font-weight: 500;
  }

  .entry {
    display: inline-flex;
    align-items: center;
    gap: 4px;
  }

  .entry .input {
    width: 76px;
    height: 28px;
    padding: 0 8px;
  }

  .unit {
    font-size: 12px;
    color: var(--muted);
    min-width: 18px;
  }

  input[type='range'] {
    appearance: none;
    width: 100%;
    height: 18px;
    background: transparent;
    margin: 0;
    cursor: pointer;
  }

  input[type='range']::-webkit-slider-runnable-track {
    height: 4px;
    border-radius: 2px;
    background: linear-gradient(to right, var(--accent) var(--fill), var(--grid) var(--fill));
  }

  input[type='range']::-moz-range-track {
    height: 4px;
    border-radius: 2px;
    background: linear-gradient(to right, var(--accent) var(--fill), var(--grid) var(--fill));
  }

  input[type='range']::-webkit-slider-thumb {
    appearance: none;
    width: 16px;
    height: 16px;
    margin-top: -6px;
    border-radius: 50%;
    background: var(--surface);
    border: 2px solid var(--accent);
    box-shadow: 0 1px 2px rgba(0, 0, 0, 0.2);
  }

  input[type='range']::-moz-range-thumb {
    width: 12px;
    height: 12px;
    border-radius: 50%;
    background: var(--surface);
    border: 2px solid var(--accent);
  }
</style>
