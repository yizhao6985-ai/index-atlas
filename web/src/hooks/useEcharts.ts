import type { EChartsCoreOption } from "echarts/core";
import * as echarts from "echarts/core";
import { useEffect, useRef } from "react";

/**
 * 在 div 上挂载 ECharts：随 option 更新 setOption，容器尺寸变化时 resize。
 * `onChartReady` 在首帧 chart 已 init 时调用，可 `chart.on("click", …)`，返回的函数在卸载时执行。
 */
export function useEcharts(
  option: EChartsCoreOption,
  onChartReady?: (chart: echarts.ECharts) => void | (() => void),
) {
  const ref = useRef<HTMLDivElement>(null);
  const chartRef = useRef<echarts.ECharts | null>(null);
  const onChartReadyRef = useRef(onChartReady);
  onChartReadyRef.current = onChartReady;

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const chart = echarts.init(el);
    chartRef.current = chart;
    chart.setOption(option);

    const chartCleanup = onChartReadyRef.current?.(chart);

    const ro = new ResizeObserver(() => chart.resize());
    ro.observe(el);

    return () => {
      if (typeof chartCleanup === "function") chartCleanup();
      ro.disconnect();
      chart.dispose();
      chartRef.current = null;
    };
  }, []);

  useEffect(() => {
    chartRef.current?.setOption(option, true);
  }, [option]);

  return ref;
}
