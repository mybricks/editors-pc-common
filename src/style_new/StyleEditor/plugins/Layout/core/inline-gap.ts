import {
  getStyleResolution, cssPropertyName, hasFallbackStyleCandidate,
  isSourceInline, readInlineStyleProperties, readStaticInlineStyleInfo, resolveEffectiveStyleSource,
} from "../../../../core/style-property";
import type { ZoneTab } from "../../../../core/zone-tab";

const GAP_KEYS = ['rowGap', 'columnGap'] as const;

/** 返回 false 表示无法定位静态内联声明，由调用方继续走原 onChange。 */
export function applyInlineGapChange(target: HTMLElement, zoneTab: ZoneTab, changes: [string, any][]): boolean {
  const resolution = getStyleResolution(zoneTab, target);
  const inlineProperties = readInlineStyleProperties(target);
  const authoredKeys = ['gap', ...GAP_KEYS].filter(key => inlineProperties.has(cssPropertyName(key)));
  if (authoredKeys.length && authoredKeys.every(key => readStaticInlineStyleInfo(target, key, true))) {
    // style={{ gap: '23px' }} 改列间距为 30px，直接写 rowGap: '23px', columnGap: '30px'。
    // 清空一轴时保留另一轴；有 class 后备值则写 unset，避免旧间距重新生效。
    const style: Record<string, any> = { gap: null };
    GAP_KEYS.forEach(key => {
      const source = resolveEffectiveStyleSource(resolution.get(key).candidates.filter(isSourceInline));
      if (source) style[key] = source.value;
    });
    changes.forEach(([key, value]) => {
      style[key] = value === null && hasFallbackStyleCandidate(resolution.get(key)) ? 'unset' : value;
    });
    // 复用 Layout 已有的样式计划，同时更新 JSX、DOM 和源码位置。
    (window as any).__mybricks_applyStylePlan({ changes: [{
      target, selector: 'inline', lessFile: '', style,
    }] });
    Object.entries(style).forEach(([key, value]) => resolution.record(key, value, 'inline'));
    return true;
  }
  return false;
}
