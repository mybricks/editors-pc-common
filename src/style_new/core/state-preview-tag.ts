/**
 * 状态预览的标记和识别工具。
 * 单独放一个文件，是因为 zone-tab、normal-style-preview 也要用它来排除
 * 预览样式，放进 state-preview.ts 会造成循环依赖。
 */

/** 预览标记属性名。改写后的选择器靠它匹配元素。 */
export const STATE_PREVIEW_ATTR = 'data-mybricks-state'

/**
 * 当前预览样式表。预览样式用 adoptedStyleSheets 挂载而不是 <style> 标签，
 * 这样大部分按标签扫描的代码天然看不到它，只有两处收集 adoptedStyleSheets
 * 的代码需要按 identity 把它排除（见 zone-tab.ts / normal-style-preview.ts）。
 */
let previewSheet: CSSStyleSheet | null = null

/** 预览期间的元素尺寸快照（预览开始时冻结）。 */
let previewSizes = new WeakMap<Element, [number, number]>()

/** 记录当前预览样式表，清除时置回 null。 */
export function setStatePreviewSheet(sheet: CSSStyleSheet | null): void {
  previewSheet = sheet
}

/** 是否为预览样式表。 */
export function isStatePreviewStyleSheet(sheet: unknown): boolean {
  return !!sheet && sheet === previewSheet
}

/** 记录预览开始时元素的冻结尺寸。 */
export function setStatePreviewSize(el: Element, width: number, height: number): void {
  previewSizes.set(el, [width, height])
}

/** 取预览冻结的尺寸；不在预览冻结名单里返回 null。 */
export function getStatePreviewSize(el: Element): [number, number] | null {
  return previewSizes.get(el) ?? null
}

/** 预览结束时清空冻结尺寸。 */
export function clearStatePreviewSizes(): void {
  previewSizes = new WeakMap()
}
