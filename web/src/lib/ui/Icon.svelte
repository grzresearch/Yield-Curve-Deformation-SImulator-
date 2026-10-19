<script lang="ts" module>
  // 24px stroke icons, drawn for this dashboard.
  const PATHS = {
    market: 'M3 3v18h18 M7 15l4-4 3 3 6-7',
    curve: 'M3 20c3-1 5-4 7-8s4-7 11-8 M3 20h18',
    fedwatch: 'M12 3a9 9 0 1 0 9 9 M12 7v5l3 2 M16 3h5v5',
    policy: 'M4 21V10 M10 21V4 M16 21v-7 M22 21H2 M7 7l3-3 3 3',
    shocks: 'M3 12c2-4 4-4 6 0s4 4 6 0 4-4 6 0',
    bond: 'M4 6h16v12H4z M4 10h16 M8 14h3',
    portfolio: 'M3 7h18v13H3z M8 7V4h8v3 M3 12h18',
    stress: 'M12 3l9 16H3z M12 10v4 M12 17h.01',
    data: 'M4 6c0-1.7 3.6-3 8-3s8 1.3 8 3-3.6 3-8 3-8-1.3-8-3z M4 6v12c0 1.7 3.6 3 8 3s8-1.3 8-3V6 M4 12c0 1.7 3.6 3 8 3s8-1.3 8-3',
    sun: 'M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8z M12 2v2 M12 20v2 M4.9 4.9l1.4 1.4 M17.7 17.7l1.4 1.4 M2 12h2 M20 12h2 M4.9 19.1l1.4-1.4 M17.7 6.3l1.4-1.4',
    moon: 'M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z',
    table: 'M3 5h18v14H3z M3 10h18 M3 15h18 M9 5v14',
    chart: 'M3 3v18h18 M7 16V9 M12 16V5 M17 16v-4',
    download: 'M12 3v12 M7 10l5 5 5-5 M4 20h16',
    copy: 'M9 9h11v11H9z M5 15H4V4h11v1',
    plus: 'M12 5v14 M5 12h14',
    trash: 'M4 7h16 M10 11v6 M14 11v6 M6 7l1 13h10l1-13 M9 7V4h6v3',
    info: 'M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20z M12 16v-5 M12 8h.01',
    link: 'M10 14a5 5 0 0 0 7 0l3-3a5 5 0 0 0-7-7l-1 1 M14 10a5 5 0 0 0-7 0l-3 3a5 5 0 0 0 7 7l1-1',
    paste: 'M9 4h6v3H9z M7 5H5v16h14V5h-2 M9 12h6 M9 16h4',
    check: 'M5 12l5 5 9-10',
    warning: 'M12 3l9 16H3z M12 9v4 M12 16h.01',
    error: 'M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20z M15 9l-6 6 M9 9l6 6',
    external: 'M14 4h6v6 M20 4l-9 9 M18 14v6H4V6h6',
    reset: 'M4 4v6h6 M4 10a8 8 0 1 1 2 6'
  } as const;
  export type IconName = keyof typeof PATHS;
</script>

<script lang="ts">
  let { name, size = 18 }: { name: IconName; size?: number } = $props();
</script>

<svg
  width={size}
  height={size}
  viewBox="0 0 24 24"
  fill="none"
  stroke="currentColor"
  stroke-width="1.75"
  stroke-linecap="round"
  stroke-linejoin="round"
  aria-hidden="true"
>
  <path d={PATHS[name]} />
</svg>
