<script lang="ts">
  let {
    label,
    value,
    delta,
    tone,
    sub
  }: {
    label: string;
    value: string;
    /** Signed delta text, e.g. "+3.0 bp vs prior day". */
    delta?: string;
    /** gain/loss ink when the delta is good or bad; neutral otherwise. */
    tone?: 'gain' | 'loss' | 'neutral';
    sub?: string;
  } = $props();
</script>

<div class="kpi">
  <div class="label">{label}</div>
  <div class="value">{value}</div>
  {#if delta}<div class="delta {tone ?? 'neutral'}">{delta}</div>{/if}
  {#if sub}<div class="sub">{sub}</div>{/if}
</div>

<style>
  .kpi {
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: var(--radius);
    box-shadow: var(--shadow);
    padding: 12px 14px;
    min-width: 0;
  }

  .label {
    font-size: 12px;
    color: var(--ink-2);
    font-weight: 500;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .value {
    font-size: 22px;
    font-weight: 600;
    letter-spacing: -0.015em;
    margin-top: 2px;
    white-space: nowrap;
  }

  .delta,
  .sub {
    font-size: 12px;
    margin-top: 2px;
  }

  .delta.neutral,
  .sub {
    color: var(--muted);
  }

  .delta.gain {
    color: var(--good-ink);
  }

  .delta.loss {
    color: var(--critical);
  }
</style>
