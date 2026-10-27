import { collectDisplayZoneTabs } from './zone-display-tabs'
import { applyStatePreview, clearStatePreview, isPreviewablePseudo, refreshStatePreview } from './state-preview'

export type StyleVariation = {
  /** 展示名，如“常规”“悬浮态”“Hover”，跟随画布语言。 */
  title: string
  /** 变体的唯一标识，如 ".featureTag:active"。 */
  selector: string
  /** 伪类/伪元素本身，如 ":active"、"::before"；常规态为 null。 */
  pseudo: string | null
  /** 是否为面板当前选中的变体。 */
  focused: boolean
  /** 切换到该变体：toolbar 点击时直接调，不用再传 dom/comId/伪类 */
  select: () => boolean
}

/**
 * 返回元素当前的变体列表，和样式面板顶部的 tab 一致。
 * 每次调用都重新扫描页面 CSS，结果永远是最新的。
 */
export function getVariations(dom: HTMLElement, comId: string): StyleVariation[] {
  if (!dom) return []
  const tabs = collectDisplayZoneTabs([dom], comId)
  // 默认常规
  const focusSelector =
    tabs.find(({ tab }) => tab.selector === focusedSelector)?.tab.selector
    ?? tabs.find(({ tab }) => !tab.pseudo)?.tab.selector
    ?? null
  return tabs.map(({ tab, label }) => ({
    title: label,
    selector: tab.selector,
    pseudo: tab.pseudo,
    focused: tab.selector === focusSelector,
    select: () => useVariation(dom, comId, tab.pseudo, tabs),
  }))
}

// ========== 变体变化订阅 ==========

type VariationsListener = () => void

const listeners = new Set<VariationsListener>()
let notifyTimer: ReturnType<typeof setTimeout> | undefined

/**
 * 订阅变体变化：变体列表或选中状态真的变了才触发（不携带数据，收到后自己调 getVariations 重拉）。
 * 返回退订函数。
 */
export function onVariationsChange(listener: () => void): () => void {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

/** 变体列表确认变化后面板调用：150ms 内多次调用合并为一次通知。 */
export function notifyVariationsChange(): void {
  if (notifyTimer) clearTimeout(notifyTimer)
  notifyTimer = setTimeout(() => {
    notifyTimer = undefined
    listeners.forEach((listener) => listener())
  }, 150)
}

// 面板当前选中的变体（如 '.payItem:hover'）；面板没挂载时为 null。
// getVariations 靠它给 focused 字段赋值。
let focusedSelector: string | null = null

// 面板选中变体时调用；只有真变了才通知引擎重拉（引擎拉 getVariations 就能看到最新选中）
export function setFocusedVariation(selector: string | null): void {
  if (focusedSelector === selector) return
  focusedSelector = selector
  notifyVariationsChange()
}

type VariationFocusHandler = (selector: string) => boolean

let focusHandler: VariationFocusHandler | null = null

// 面板挂载时把「切变体 tab」的能力注册进来，卸载时退掉；useVariation 就是转调它
export function registerVariationFocusHandler(handler: VariationFocusHandler): () => void {
  focusHandler = handler
  return () => {
    if (focusHandler === handler) focusHandler = null
  }
}

/**
 * 选中某个变体，效果等同用户手动点 tab：
 * - 面板挂载时：根据引擎方选择的来回显变体至样式面板
 * - 面板没挂载时：直接应用变体预览样式
 * 变体不存在时返回 false
 */
export function useVariation(
  dom: HTMLElement,
  comId: string,
  pseudo: string | null,
  tabs?: ReturnType<typeof collectDisplayZoneTabs>
): boolean {
  if (!dom) return false
  const found = (tabs ?? collectDisplayZoneTabs([dom], comId)).find(({ tab }) => tab.pseudo === pseudo)
  if (!found) return false
  const { tab } = found
  if (focusHandler) {
    if (focusHandler(tab.selector)) return true
    // 面板在但没接住（比如面板正在编辑别的元素），下面自己应用
  }
  // 伪元素（如 ::before）不预览，只切状态
  if (tab.pseudo && isPreviewablePseudo(tab.pseudo)) {
    applyStatePreview(dom, tab, comId ? { comId } : undefined)
  } else {
    clearStatePreview()
  }
  setFocusedVariation(tab.selector)
  return true
}

/**
 * 提供给引擎在 undo 后调用触发变体预览样式刷新
 */
export function emitUndo(): void {
  refreshStatePreview()
}

/**
 * 提供给引擎在 redo 后调用触发变体预览样式刷新
 */
export function emitRedo(): void {
  refreshStatePreview()
}


/**
 * 提供给引擎在 undo all 后调用触发变体预览样式刷新
 */
export function emitUndoAll(): void {
  clearStatePreview()
}
