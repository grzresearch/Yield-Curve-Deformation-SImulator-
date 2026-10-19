<script lang="ts">
  import { echarts, type ChartOption } from '../charts/echarts';

  let { option, height = 300, label }: { option: ChartOption; height?: number; label: string } = $props();

  let element: HTMLDivElement;
  let chart = $state.raw<ReturnType<typeof echarts.init>>();

  $effect(() => {
    const instance = echarts.init(element, undefined, { renderer: 'svg' });
    chart = instance;
    const observer = new ResizeObserver(() => instance.resize());
    observer.observe(element);
    return () => {
      observer.disconnect();
      instance.dispose();
    };
  });

  $effect(() => {
    // Series carry stable ids, so replacing them lets ECharts morph lines between states.
    chart?.setOption(option, { replaceMerge: ['series', 'legend'], lazyUpdate: true });
  });
</script>

<div class="chart" bind:this={element} style:height="{height}px" role="img" aria-label={label}></div>

<style>
  .chart {
    width: 100%;
    min-width: 0;
  }
</style>
