<script lang="ts">
  import { loadMarket } from './lib/data/market';
  import type { MessageKey } from './lib/i18n';
  import { app, VIEWS, type View } from './lib/state.svelte';
  import CurveControls from './lib/ui/CurveControls.svelte';
  import Icon, { type IconName } from './lib/ui/Icon.svelte';
  import BondView from './lib/views/BondView.svelte';
  import CurveView from './lib/views/CurveView.svelte';
  import DataView from './lib/views/DataView.svelte';
  import FedWatchView from './lib/views/FedWatchView.svelte';
  import OverviewView from './lib/views/OverviewView.svelte';
  import PolicyView from './lib/views/PolicyView.svelte';
  import PortfolioView from './lib/views/PortfolioView.svelte';
  import ShocksView from './lib/views/ShocksView.svelte';
  import StressView from './lib/views/StressView.svelte';

  const NAV: { group: MessageKey; items: { view: View; icon: IconName; label: MessageKey }[] }[] = [
    {
      group: 'groupMarket',
      items: [
        { view: 'overview', icon: 'market', label: 'navOverview' },
        { view: 'curve', icon: 'curve', label: 'navCurve' },
        { view: 'fedwatch', icon: 'fedwatch', label: 'navFedwatch' }
      ]
    },
    {
      group: 'groupSimulate',
      items: [
        { view: 'policy', icon: 'policy', label: 'navPolicy' },
        { view: 'shocks', icon: 'shocks', label: 'navShocks' }
      ]
    },
    {
      group: 'groupRisk',
      items: [
        { view: 'bond', icon: 'bond', label: 'navBond' },
        { view: 'portfolio', icon: 'portfolio', label: 'navPortfolio' },
        { view: 'stress', icon: 'stress', label: 'navStress' }
      ]
    }
  ];

  const CURVE_VIEWS: View[] = ['curve', 'policy', 'shocks', 'bond', 'portfolio', 'stress'];

  function readHash() {
    const view = location.hash.replace(/^#\/?/, '').split('?')[0] as View;
    if (VIEWS.includes(view)) app.view = view;
  }
  readHash();

  $effect(() => {
    window.addEventListener('hashchange', readHash);
    loadMarket()
      .then((market) => (app.market = market))
      .catch((error) => (app.loadError = String(error)));
    return () => window.removeEventListener('hashchange', readHash);
  });

  $effect(() => {
    const target = `#/${app.view}`;
    if (location.hash.split('?')[0] !== target) history.pushState(null, '', target);
    window.scrollTo({ top: 0 });
  });

  $effect(() => {
    document.documentElement.lang = app.lang;
    document.title = `${app.t(NAV.flatMap((g) => g.items).find((i) => i.view === app.view)?.label ?? 'navData')} · ${app.t('appName')}`;
  });

  $effect(() => app.persist());

  const stale = $derived(
    app.market ? Object.values(app.market.sources).some((s) => s.status !== 'ok') : false
  );

  let shared = $state(false);
  async function share() {
    try {
      await navigator.clipboard.writeText(app.shareUrl());
      shared = true;
      setTimeout(() => (shared = false), 2200);
    } catch {
      prompt(app.t('shareLink'), app.shareUrl());
    }
  }
</script>

<div class="shell">
  <header class="topbar">
    <a class="brand" href="#/overview" aria-label={app.t('appName')}>
      <svg viewBox="0 0 32 32" width="28" height="28" aria-hidden="true">
        <rect width="32" height="32" rx="8" fill="var(--accent)" />
        <path d="M6 23c4-1 6-5 9-10s5-7 11-7" fill="none" stroke="#fff" stroke-width="2.5" stroke-linecap="round" />
        <path d="M6 25c4-.5 7-3 10-7s6-6 10-6" fill="none" stroke="#fff" stroke-opacity=".55" stroke-width="2" stroke-linecap="round" />
      </svg>
      <span class="brand-text">
        <strong>{app.t('appName')}</strong>
        <span>{app.t('appTagline')}</span>
      </span>
    </a>

    <div class="top-actions">
      {#if app.market}
        <a class="data-status" href="#/data" title={app.t('navData')}>
          <span class="dot" class:stale></span>
          <span class="status-text">{stale ? app.t('dataStale') : app.t('dataLive')}</span>
          <span class="muted num">{app.fmt.date(app.market.treasury.asOf)}</span>
        </a>
      {/if}
      <button class="btn ghost small" onclick={share} title={app.t('shareLink')}>
        <Icon name={shared ? 'check' : 'link'} size={15} />
        <span class="hide-sm">{shared ? app.t('linkCopied') : app.t('shareLink')}</span>
      </button>
      <div class="lang" role="group" aria-label={app.t('langToggle')}>
        <button class:active={app.lang === 'de'} onclick={() => (app.lang = 'de')}>DE</button>
        <button class:active={app.lang === 'en'} onclick={() => (app.lang = 'en')}>EN</button>
      </div>
      <button
        class="btn ghost icon"
        onclick={() => (app.themePreference = app.theme === 'dark' ? 'light' : 'dark')}
        title={app.t('themeToggle')}
        aria-label={app.t('themeToggle')}
      >
        <Icon name={app.theme === 'dark' ? 'sun' : 'moon'} />
      </button>
    </div>
  </header>

  <nav class="sidebar" aria-label="Navigation">
    <div class="sidebar-inner">
    {#each NAV as group}
      <div class="nav-group">
        <div class="nav-title">{app.t(group.group)}</div>
        {#each group.items as item}
          <a href="#/{item.view}" class:active={app.view === item.view} aria-current={app.view === item.view ? 'page' : undefined}>
            <Icon name={item.icon} />
            <span>{app.t(item.label)}</span>
          </a>
        {/each}
      </div>
    {/each}
    <div class="nav-group bottom">
      <a href="#/data" class:active={app.view === 'data'} aria-current={app.view === 'data' ? 'page' : undefined}>
        <Icon name="data" />
        <span>{app.t('navData')}</span>
      </a>
    </div>
    </div>
  </nav>

  <main>
    {#if app.loadError}
      <div class="note"><Icon name="error" />{app.t('loadError')}: {app.loadError}</div>
    {:else if !app.market}
      <div class="loading muted">{app.t('loading')}</div>
    {:else}
      {#if CURVE_VIEWS.includes(app.view)}<CurveControls />{/if}
      {#key app.view}
        <div class="page">
          {#if app.view === 'overview'}<OverviewView />
          {:else if app.view === 'curve'}<CurveView />
          {:else if app.view === 'fedwatch'}<FedWatchView />
          {:else if app.view === 'policy'}<PolicyView />
          {:else if app.view === 'shocks'}<ShocksView />
          {:else if app.view === 'bond'}<BondView />
          {:else if app.view === 'portfolio'}<PortfolioView />
          {:else if app.view === 'stress'}<StressView />
          {:else}<DataView />{/if}
        </div>
      {/key}
    {/if}
    <footer class="muted">
      {app.t('footerNote')} ·
      <a href="https://github.com/gelatotrade/Yield-Curve-Deformation-SImulator-" target="_blank" rel="noopener">GitHub</a>
    </footer>
  </main>
</div>

<style>
  .shell {
    display: grid;
    grid-template-columns: 232px minmax(0, 1fr);
    grid-template-rows: 56px 1fr;
    min-height: 100vh;
  }

  .topbar {
    grid-column: 1 / -1;
    position: sticky;
    top: 0;
    z-index: 20;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    padding: 0 16px;
    background: color-mix(in srgb, var(--surface) 92%, transparent);
    backdrop-filter: saturate(1.4) blur(8px);
    border-bottom: 1px solid var(--border);
  }

  .brand {
    display: flex;
    align-items: center;
    gap: 10px;
    color: var(--ink);
    text-decoration: none;
    min-width: 0;
  }

  .brand-text {
    display: flex;
    flex-direction: column;
    line-height: 1.2;
    min-width: 0;
  }

  .brand-text strong {
    font-size: 14.5px;
  }

  .brand-text span {
    font-size: 11.5px;
    color: var(--muted);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .top-actions {
    display: flex;
    align-items: center;
    gap: 6px;
  }

  .data-status {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 4px 10px;
    border-radius: 999px;
    border: 1px solid var(--border);
    color: var(--ink);
    text-decoration: none;
    font-size: 12.5px;
  }

  .dot {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    background: var(--good);
    box-shadow: 0 0 0 3px color-mix(in srgb, var(--good) 22%, transparent);
  }

  .dot.stale {
    background: var(--warning);
    box-shadow: 0 0 0 3px color-mix(in srgb, var(--warning) 22%, transparent);
  }

  .lang {
    display: inline-flex;
    border: 1px solid var(--border-strong);
    border-radius: var(--radius-sm);
    overflow: hidden;
  }

  .lang button {
    border: 0;
    background: transparent;
    color: var(--ink-2);
    font-size: 12px;
    font-weight: 600;
    height: 28px;
    padding: 0 9px;
    cursor: pointer;
  }

  .lang button.active {
    background: var(--accent-wash);
    color: var(--accent-ink);
  }

  .sidebar {
    border-right: 1px solid var(--border);
    background: var(--surface);
  }

  .sidebar-inner {
    position: sticky;
    top: 56px;
    height: calc(100vh - 56px);
    overflow-y: auto;
    display: flex;
    flex-direction: column;
    gap: 18px;
    padding: 18px 12px;
  }

  .nav-group {
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  .nav-group.bottom {
    margin-top: auto;
  }

  .nav-title {
    font-size: 11px;
    font-weight: 600;
    color: var(--muted);
    text-transform: uppercase;
    letter-spacing: 0.06em;
    padding: 0 10px 6px;
  }

  .sidebar a {
    position: relative;
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 7px 10px;
    border-radius: var(--radius-sm);
    color: var(--ink-2);
    text-decoration: none;
    font-size: 13.5px;
    font-weight: 500;
  }

  .sidebar a:hover {
    background: var(--surface-hover);
    color: var(--ink);
  }

  .sidebar a.active {
    background: var(--accent-wash);
    color: var(--accent-ink);
  }

  main {
    min-width: 0;
    padding: 20px 24px 32px;
    display: flex;
    flex-direction: column;
    gap: 16px;
  }

  .page {
    animation: enter 220ms ease-out;
  }

  @keyframes enter {
    from {
      opacity: 0;
      transform: translateY(4px);
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .page {
      animation: none;
    }
  }

  .loading {
    padding: 48px 0;
    text-align: center;
  }

  footer {
    margin-top: auto;
    padding-top: 12px;
    font-size: 12px;
  }

  @media (max-width: 1023px) {
    .shell {
      grid-template-columns: minmax(0, 1fr);
      grid-template-rows: 56px auto 1fr;
    }

    .sidebar {
      position: sticky;
      top: 56px;
      z-index: 15;
      border-right: 0;
      border-bottom: 1px solid var(--border);
    }

    .sidebar-inner {
      position: static;
      height: auto;
      flex-direction: row;
      gap: 4px;
      padding: 6px 12px;
      overflow-x: auto;
      scrollbar-width: none;
    }

    .nav-group {
      flex-direction: row;
      gap: 2px;
    }

    .nav-group.bottom {
      margin-top: 0;
    }

    .nav-title {
      display: none;
    }

    .sidebar a {
      white-space: nowrap;
      padding: 6px 10px;
    }

    main {
      padding: 16px;
    }
  }

  @media (max-width: 520px) {
    .brand-text {
      display: none;
    }
  }

  @media (max-width: 640px) {
    .brand-text span,
    .status-text,
    .hide-sm {
      display: none;
    }

    .topbar {
      padding: 0 12px;
    }
  }
</style>
