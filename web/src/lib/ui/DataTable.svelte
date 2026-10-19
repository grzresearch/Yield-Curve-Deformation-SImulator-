<script lang="ts">
  import { displayCell, type TableData } from './table';

  let { table, maxHeight, caption }: { table: TableData; maxHeight?: number; caption?: string } = $props();
</script>

<div class="table-wrap" style:max-height={maxHeight ? `${maxHeight}px` : undefined}>
  <table class="data">
    {#if caption}<caption class="visually-hidden">{caption}</caption>{/if}
    <thead>
      <tr>
        {#each table.columns as column}
          <th class:n={column.numeric} scope="col">{column.label}</th>
        {/each}
      </tr>
    </thead>
    <tbody>
      {#each table.rows as row}
        <tr>
          {#each row as cell, i}
            {@const column = table.columns[i]}
            <td class:n={column.numeric} class={typeof cell === 'number' ? column.tone?.(cell) : undefined}>
              {displayCell(column, cell)}
            </td>
          {/each}
        </tr>
      {/each}
    </tbody>
  </table>
</div>
