import { useMemo } from "react";
import { useThemeStore } from "../store/themeStore";

/**
 * Chart colors read from the same CSS variables the rest of the UI uses, so recharts follows light/dark
 * automatically. (The old charts hard-coded #E2E8F0 grid lines and a fixed blue, which glared in dark mode.)
 */
export function useChartTheme() {
  const theme = useThemeStore((s) => s.theme);
  return useMemo(() => {
    const css = getComputedStyle(document.documentElement);
    const c = (name: string) => `rgb(${css.getPropertyValue(name).trim().replace(/\s+/g, " ")})`;
    return {
      theme,
      grid: c("--line"),
      axis: c("--ink-3"),
      text: c("--ink-2"),
      ink: c("--ink"),
      tooltipBg: c("--raised"),
      tooltipBorder: c("--line-strong"),
      primary: c("--primary-fg"),
      success: c("--success-fg"),
      warning: c("--warning-fg"),
      danger: c("--danger-fg"),
      info: c("--info-fg"),
      series: [c("--primary-fg"), c("--success-fg"), c("--warning-fg"), c("--info-fg"), c("--danger-fg"), c("--m-faculty")],
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [theme]);
}
