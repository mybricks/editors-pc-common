/**
 * 状态预览的标记和识别工具。
 */

export const STATE_PREVIEW_ATTR = 'data-mybricks-state'

/** 当前编辑画布共用一张预览表；收集真实样式来源时排除。 */
let previewSheet: CSSStyleSheet | null = null
let previewSizes = new Map<string, [number, number]>()

export function registerStatePreviewSheet(sheet: CSSStyleSheet): void {
  previewSheet = sheet
}

export function unregisterStatePreviewSheet(sheet: CSSStyleSheet): void {
  if (previewSheet === sheet) previewSheet = null
}

export function isStatePreviewStyleSheet(sheet: unknown): boolean {
  return previewSheet === sheet
}

/**
 * 按 DOM 位置生成尺寸缓存 key，区分同 class 元素，也覆盖无 class 的祖先。
 * selectors 仅供本轮复用路径；>>> 表示跨 ShadowRoot，不用于查询 DOM。
 * 节点位置变化时 key 随之变化。
 */
function getSizeSelector(element: Element, selectors: Map<Element, string>): string {
  // 1. 复用本轮已计算的路径。
  const cached = selectors.get(element)
  if (cached) return cached
  // 2. 获取父级或 ShadowRoot 宿主的路径。
  const parent = element.parentNode as Element | Document | ShadowRoot
  let prefix = ''
  if (parent.nodeType === 1) {
    prefix = `${getSizeSelector(parent as Element, selectors)} > `
  } else if ('host' in parent) {
    prefix = `${getSizeSelector(parent.host, selectors)} >>> `
  }
  // 3. 按兄弟顺序生成路径，返回当前节点的结果。
  Array.from(parent.children).forEach((child, index) => {
    selectors.set(child, `${prefix}:nth-child(${index + 1})`)
  })
  return selectors.get(element)!
}

/**
 * 同步仍需冻结尺寸的元素；共享祖先沿用首次快照，退出最后一份预览后释放。
 * 新增元素只在缺少快照时测量，并临时停用预览表，避免记录其他预览影响后的尺寸。
 */
export function syncStatePreviewSizes(elements: Set<Element>): void {
  // 1. 按当前路径 selector 复用尺寸，只保留仍在预览尺寸链中的路径。
  const selectors = new Map<Element, string>()
  const nextSizes = new Map<string, [number, number]>()
  const missing: Array<{ element: Element; selector: string }> = []
  elements.forEach(element => {
    const selector = getSizeSelector(element, selectors)
    const size = previewSizes.get(selector)
    if (size) nextSizes.set(selector, size)
    else missing.push({ element, selector })
  })
  // 只保留当前使用者；路径生成时的 DOM 引用只存在于本次调用内。
  previewSizes = nextSizes
  if (!missing.length) return
  // 2. 同步读取常规尺寸；无论测量是否成功，都在返回前恢复原来的启用状态。
  const sheets = previewSheet ? [{ sheet: previewSheet, disabled: previewSheet.disabled }] : []
  try {
    sheets.forEach(({ sheet }) => { sheet.disabled = true })
    missing.forEach(({ element, selector }) => {
      previewSizes.set(selector, [element.clientWidth, element.clientHeight])
    })
  } finally {
    sheets.forEach(({ sheet, disabled }) => { sheet.disabled = disabled })
  }
}

export function getStatePreviewSize(el: Element): [number, number] | null {
  if (!previewSizes.size) return null
  const selector = getSizeSelector(el, new Map())
  return previewSizes.get(selector) ?? null
}
