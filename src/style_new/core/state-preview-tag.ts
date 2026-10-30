/**
 * 状态预览的标记和识别工具。
 */

export const STATE_PREVIEW_ATTR = 'data-mybricks-state'

/** 当前编辑画布共用一张预览表；收集真实样式来源时排除。 */
let previewSheet: CSSStyleSheet | null = null
const previewSizes = new Map<Element, [number, number]>()

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
 * 同步仍需冻结尺寸的元素；共享祖先沿用首次快照，退出最后一份预览后释放。
 * 新增元素只在缺少快照时测量，并临时停用预览表，避免记录其他预览影响后的尺寸。
 */
export function syncStatePreviewSizes(elements: Set<Element>): void {
  // 1. 删除已无使用者的快照，仅收集本次新增的测量目标。
  for (const element of previewSizes.keys()) {
    if (!elements.has(element)) previewSizes.delete(element)
  }
  const missing = Array.from(elements).filter(element => !previewSizes.has(element))
  if (!missing.length) return
  // 2. 同步读取常规尺寸；无论测量是否成功，都在返回前恢复原来的启用状态。
  const sheets = previewSheet ? [{ sheet: previewSheet, disabled: previewSheet.disabled }] : []
  try {
    sheets.forEach(({ sheet }) => { sheet.disabled = true })
    missing.forEach(element => {
      previewSizes.set(element, [element.clientWidth, element.clientHeight])
    })
  } finally {
    sheets.forEach(({ sheet, disabled }) => { sheet.disabled = disabled })
  }
}

export function getStatePreviewSize(el: Element): [number, number] | null {
  return previewSizes.get(el) ?? null
}
