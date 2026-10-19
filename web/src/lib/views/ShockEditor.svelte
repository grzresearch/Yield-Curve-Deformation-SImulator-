<script lang="ts">
  import type { MessageKey } from '../i18n';
  import { SHOCK_PARAMS, SHOCK_TYPES, constrainParams, defaultParams, type ShockSpec, type ShockType } from '../scenarios';
  import { app } from '../state.svelte';
  import NumberSlider from '../ui/NumberSlider.svelte';

  let { spec = $bindable(), nodes }: { spec: ShockSpec; nodes: { tenor: number; label: string }[] } = $props();

  function setType(type: ShockType) {
    spec.type = type;
    spec.params = defaultParams(type);
    if (type === 'custom' && !Object.keys(spec.custom).length) {
      spec.custom = Object.fromEntries(nodes.map((n) => [String(n.tenor), n.tenor <= 2 ? -10 : n.tenor >= 10 ? 15 : 0]));
    }
  }

  const params = $derived(SHOCK_PARAMS[spec.type]);
  const constrained = $derived(constrainParams(spec.type, spec.params));
</script>

<div class="editor">
  <label class="field">
    <span>{app.t('shType')}</span>
    <select class="select" value={spec.type} onchange={(e) => setType((e.currentTarget as HTMLSelectElement).value as ShockType)}>
      {#each SHOCK_TYPES as type}
        <option value={type}>{app.t(`d_${type}` as MessageKey)}</option>
      {/each}
    </select>
  </label>

  {#if spec.type === 'custom'}
    <div class="custom">
      {#each nodes as node}
        {@const key = String(node.tenor)}
        <label class="node">
          <span>{node.label}</span>
          <input
            class="input num"
            type="number"
            step="1"
            value={spec.custom[key] ?? 0}
            oninput={(e) => (spec.custom[key] = Number((e.currentTarget as HTMLInputElement).value) || 0)}
          />
        </label>
      {/each}
    </div>
  {:else}
    {#each params as param (spec.type + param.key)}
      <NumberSlider
        label={app.t(`p_${param.key}` as MessageKey)}
        bind:value={spec.params[param.key]}
        min={param.min}
        max={param.max}
        step={param.step}
        unit={param.unit === 'bps' ? app.t('bpsUnit') : app.t('years')}
        format={(v) => app.fmt.num(v, param.unit === 'bps' ? 0 : 2)}
      />
      {#if constrained[param.key] !== spec.params[param.key]}
        <p class="hint">→ {app.fmt.num(constrained[param.key], 2)}</p>
      {/if}
    {/each}
  {/if}
</div>

<style>
  .editor {
    display: flex;
    flex-direction: column;
    gap: 14px;
  }

  .custom {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(76px, 1fr));
    gap: 8px;
  }

  .node {
    display: flex;
    flex-direction: column;
    gap: 2px;
    font-size: 12px;
    color: var(--ink-2);
  }

  .node .input {
    height: 28px;
    width: 100%;
  }
</style>
