<script lang="ts">
  import { parseTable } from '../format';
  import { app } from '../state.svelte';

  let {
    open = $bindable(false),
    title,
    hint,
    onapply
  }: {
    open: boolean;
    title: string;
    hint: string;
    onapply: (rows: string[][]) => void;
  } = $props();

  let dialog: HTMLDialogElement;
  let text = $state('');
  const rows = $derived(parseTable(text));

  $effect(() => {
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  });

  function apply() {
    onapply(rows);
    text = '';
    open = false;
  }
</script>

<dialog bind:this={dialog} onclose={() => (open = false)} aria-labelledby="paste-title">
  <h2 id="paste-title">{title}</h2>
  <p class="hint">{hint}</p>
  <textarea bind:value={text} rows="9" spellcheck="false" placeholder={'2Y 3,50%\t1000\t3,5\t2\t2\t100'}></textarea>
  <div class="row foot">
    <span class="muted">{rows.length} ×</span>
    <span class="spacer"></span>
    <button class="btn" onclick={() => (open = false)}>{app.t('cancel')}</button>
    <button class="btn primary" onclick={apply} disabled={!rows.length}>{app.t('apply')}</button>
  </div>
</dialog>

<style>
  dialog {
    width: min(640px, calc(100vw - 32px));
    border: 1px solid var(--border-strong);
    border-radius: var(--radius);
    background: var(--surface);
    color: var(--ink);
    padding: 20px;
    display: none;
    flex-direction: column;
    gap: 10px;
  }

  dialog[open] {
    display: flex;
  }

  dialog::backdrop {
    background: rgba(0, 0, 0, 0.45);
  }

  h2 {
    font-size: 16px;
  }

  textarea {
    width: 100%;
    font-family: var(--mono);
    font-size: 12.5px;
    padding: 10px;
    border-radius: var(--radius-sm);
    border: 1px solid var(--border-strong);
    background: var(--page);
    resize: vertical;
  }

  .foot {
    justify-content: flex-end;
  }

  .spacer {
    flex: 1;
  }
</style>
