<script lang="ts">
  import type { MessageKey } from '../i18n';
  import { app } from '../state.svelte';
  import Card from '../ui/Card.svelte';
  import Icon from '../ui/Icon.svelte';
  import StatusPill from '../ui/StatusPill.svelte';
  import { copyText } from '../ui/table';

  const market = $derived(app.market!);
  const f = $derived(app.fmt);
  const base = new URL('./data/', location.href).href;

  const SOURCE_NAMES: Record<string, string> = {
    treasury: 'U.S. Treasury Par Yield Curve',
    ecb: 'ECB Euro Area AAA Yield Curve',
    fedFunds: 'Effective Federal Funds Rate',
    fomc: 'FOMC Calendar',
    futures: '30-Day Fed Funds Futures (ZQ)'
  };
  const asOf: Record<string, string | undefined> = $derived({
    treasury: market.treasury?.asOf,
    ecb: market.ecb?.asOf,
    fedFunds: market.fedFunds?.asOf,
    futures: market.futures?.asOf,
    fomc: undefined
  });

  const FEEDS: { file: string; label: MessageKey }[] = [
    { file: 'treasury_par_yields.csv', label: 'dtFeedTreasury' },
    { file: 'treasury_zero_curve.csv', label: 'dtFeedZero' },
    { file: 'ecb_aaa_spot_rates.csv', label: 'dtFeedEcb' },
    { file: 'fedwatch_probabilities.csv', label: 'dtFeedFedwatch' }
  ];
  let feed = $state(FEEDS[0].file);

  const script = $derived(`let
    Source = Csv.Document(
        Web.Contents("${base}${feed}"),
        [Delimiter = ",", Encoding = 65001, QuoteStyle = QuoteStyle.Csv]
    ),
    Headers = Table.PromoteHeaders(Source, [PromoteAllScalars = true]),
    Typed = Table.TransformColumnTypes(
        Headers,
        List.Transform(
            Table.ColumnNames(Headers),
            each {_, if List.Contains({"date", "meeting"}, _) then type date
                     else if _ = "tenor" then type text else type number}
        ),
        "en-US"
    )
in
    Typed`);

  const python = $derived(`import json, urllib.request
from yield_curve import YieldCurve, Bond, RiskCalculator

market = json.load(urllib.request.urlopen("${base}market.json"))
ust = market["treasury"]
latest = ust["history"][-1]
points = [(t, r) for t, r in zip(ust["tenors"], latest["rates"]) if r is not None]

curve = YieldCurve.from_par_yields([t for t, _ in points], [r for _, r in points])
metrics = RiskCalculator(curve).calculate_metrics(Bond(1000, 4.0, 10))
print(latest["date"], metrics)`);

  let copiedScript = $state<string | null>(null);
  async function copy(which: string, text: string) {
    if (await copyText(text)) {
      copiedScript = which;
      setTimeout(() => (copiedScript = null), 1600);
    }
  }
</script>

<div class="view">
  <div class="view-head">
    <div>
      <h1>{app.t('dtTitle')}</h1>
      <p>{app.t('dtSubtitle')}</p>
    </div>
  </div>

  <div class="grid">
    <Card class="span-7" title={app.t('dtSources')} subtitle="{app.t('dataAsOf')} {f.dateTime(market.generatedAt)}">
      <div class="table-wrap">
        <table class="data">
          <thead>
            <tr>
              <th>{app.t('dtFeed')}</th>
              <th>{app.t('dtStatus')}</th>
              <th>{app.t('dataAsOf')}</th>
              <th>{app.t('dtProvider')}</th>
            </tr>
          </thead>
          <tbody>
            {#each Object.entries(market.sources) as [key, source]}
              <tr>
                <td>{SOURCE_NAMES[key] ?? key}</td>
                <td title={source.error ?? ''}><StatusPill status={source.status} /></td>
                <td class="num">{asOf[key] ? f.date(asOf[key]!) : source.fetchedAt ? f.date(source.fetchedAt.slice(0, 10)) : '–'}</td>
                <td><a href={source.url} target="_blank" rel="noopener">{source.provider}</a></td>
              </tr>
            {/each}
          </tbody>
        </table>
      </div>
      <p class="hint">{app.t('dtRefresh')}</p>
    </Card>

    <Card class="span-5" title={app.t('dtDownloads')}>
      <ul class="downloads">
        {#each FEEDS as item}
          <li><a href="{base}{item.file}" download><Icon name="download" size={15} />{app.t(item.label)}</a><code>{item.file}</code></li>
        {/each}
        <li><a href="{base}market.json" download><Icon name="download" size={15} />{app.t('dtFeedJson')}</a><code>market.json</code></li>
      </ul>
    </Card>

    <Card class="span-7" title={app.t('dtPowerQuery')} subtitle={app.t('dtPowerQueryHint')}>
      {#snippet actions()}
        <select class="select" bind:value={feed} aria-label={app.t('dtFeed')}>
          {#each FEEDS as item}<option value={item.file}>{app.t(item.label)}</option>{/each}
        </select>
        <button class="btn small" onclick={() => copy('pq', script)}>
          <Icon name={copiedScript === 'pq' ? 'check' : 'copy'} size={15} />{app.t('copyScript')}
        </button>
      {/snippet}
      <pre><code>{script}</code></pre>
    </Card>

    <Card class="span-5" title={app.t('dtPython')} subtitle={app.t('dtPythonHint')}>
      {#snippet actions()}
        <button class="btn small" onclick={() => copy('py', python)}>
          <Icon name={copiedScript === 'py' ? 'check' : 'copy'} size={15} />{app.t('copyScript')}
        </button>
      {/snippet}
      <pre><code>{python}</code></pre>
    </Card>

    <Card class="span-12" title={app.t('dtPrivacy')}>
      <p class="secondary">{app.t('dtPrivacyText')}</p>
      <p class="secondary">{app.t('fwDisclaimer')}</p>
    </Card>
  </div>
</div>

<style>
  pre {
    margin: 0;
    padding: 12px 14px;
    border-radius: var(--radius-sm);
    background: var(--surface-2);
    overflow-x: auto;
    line-height: 1.55;
  }

  .downloads {
    list-style: none;
    margin: 0;
    padding: 0;
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  .downloads li {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 8px;
    padding: 8px 0;
    border-bottom: 1px solid var(--border);
    flex-wrap: wrap;
  }

  .downloads li:last-child {
    border-bottom: 0;
  }

  .downloads a {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    font-weight: 500;
  }

  .downloads code {
    color: var(--muted);
  }
</style>
