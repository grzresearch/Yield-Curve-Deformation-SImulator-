<script lang="ts">
  import type { Interpolation } from '../core';
  import type { CurveSourceId } from '../data/market';
  import { app } from '../state.svelte';
  import Segmented from './Segmented.svelte';

  const sources = $derived<{ value: CurveSourceId; label: string }[]>([
    { value: 'ust', label: app.t('sourceUst') },
    ...(app.market?.ecb ? [{ value: 'ecb' as const, label: app.t('sourceEcb') }] : []),
    { value: 'sample', label: app.t('sourceSample') },
    { value: 'custom', label: app.t('sourceCustom') }
  ]);

  const interpolations = $derived<{ value: Interpolation; label: string }[]>([
    { value: 'cubic_spline', label: app.t('interpCubic') },
    { value: 'pchip', label: app.t('interpPchip') },
    { value: 'linear', label: app.t('interpLinear') }
  ]);

  const history = $derived(app.series?.history ?? []);
  const dateValue = $derived(app.built?.date ?? '');
  const isLatest = $derived(app.curveDate === null);

  const slope = $derived(app.curve ? app.curve.slope() * 100 : null);
</script>

<!-- One control row above the content it scopes: every chart below uses this curve. -->
<div class="controls" role="group" aria-label={app.t('curveSource')}>
  <label class="field">
    <span>{app.t('curveSource')}</span>
    <select class="select" bind:value={app.source}>
      {#each sources as s}<option value={s.value}>{s.label}</option>{/each}
    </select>
  </label>

  {#if history.length}
    <label class="field">
      <span>{app.t('curveDate')}</span>
      <span class="row nowrap">
        <input
          class="input"
          type="date"
          min={history[0].date}
          max={history[history.length - 1].date}
          value={dateValue}
          onchange={(e) => {
            const v = (e.currentTarget as HTMLInputElement).value;
            app.curveDate = v && v < history[history.length - 1].date ? v : null;
          }}
        />
        {#if !isLatest}
          <button class="btn small" onclick={() => (app.curveDate = null)}>{app.t('latest')}</button>
        {/if}
      </span>
    </label>
  {/if}

  {#if app.series?.basis === 'par'}
    <div class="field">
      <span title={app.t('basisHint')}>{app.t('basis')}</span>
      <Segmented
        label={app.t('basis')}
        options={[
          { value: 'zero', label: app.t('basisZero') },
          { value: 'par', label: app.t('basisPar') }
        ]}
        bind:value={() => (app.bootstrap ? 'zero' : 'par'), (v) => (app.bootstrap = v === 'zero')}
      />
    </div>
  {/if}

  <label class="field">
    <span>{app.t('interpolation')}</span>
    <select class="select" bind:value={app.interpolation}>
      {#each interpolations as i}<option value={i.value}>{i.label}</option>{/each}
    </select>
  </label>

  {#if app.built}
    <div class="summary">
      <span class="muted">{app.t('slope2s10s')}</span>
      <strong class="num">{slope !== null ? app.fmt.bps(slope) : '–'}</strong>
      {#if app.built.date}<span class="muted">· {app.fmt.date(app.built.date)}</span>{/if}
    </div>
  {/if}
</div>

<style>
  .controls {
    display: flex;
    flex-wrap: wrap;
    align-items: flex-end;
    gap: 10px 14px;
    padding: 12px 14px;
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: var(--radius);
  }

  .nowrap {
    flex-wrap: nowrap;
  }

  .summary {
    margin-left: auto;
    display: flex;
    gap: 6px;
    align-items: baseline;
    font-size: 13px;
    padding-bottom: 6px;
  }

  @media (max-width: 760px) {
    .controls > .field {
      flex: 1 1 140px;
    }

    .summary {
      margin-left: 0;
    }
  }
</style>
