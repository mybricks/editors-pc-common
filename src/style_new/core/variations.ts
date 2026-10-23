import { collectDisplayZoneTabs } from './zone-display-tabs'
import { applyStatePreview, clearStatePreview, refreshStatePreview } from './state-preview'

export type StyleVariation = {
  /** 展示名，如“常规”“悬浮态”“Hover”，跟随画布语言。 */
  title: string
  /** 变体的唯一标识，如 ".featureTag:active"。 */
  selector: string
  /** 伪类/伪元素本身，如 ":active"、"::before"；常规态为 null。 */
  pseudo: string | null
  /** 是否为面板当前选中的变体。 */
  focused: boolean
}

/**
 * 返回元素当前的变体列表，和样式面板顶部的 tab 一致。
 * 每次调用都重新扫描页面 CSS，结果永远是最新的。
 */
export function getVariations(dom: HTMLElement, comId: string): StyleVariation[] {
  if (!dom) return []

  return collectDisplayZoneTabs([dom], comId).map(({ tab, label }) => ({
    title: label,
    selector: tab.selector,
    pseudo: tab.pseudo,
    focused: tab.selector === focusedSelector,
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
 * 选中某个变体：面板切到该变体的 tab，效果等同用户手动点 tab
 * 选中伪类变体（如 :hover）时，画布上的样式预览会跟着生效。
 * 面板没挂载、或当前元素的变体列表里没有这个 selector 时返回 false。
 */
export function useVariation(selector: string): boolean {
  return focusHandler ? focusHandler(selector) : false
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

/**
 * bu
y * 返回 false 表示该元素没有这个变体
 */
export function selectVariation(dom: HTMLElement, comId: string, selector: string): boolean {
  if (!dom) return false
  const found = collectDisplayZoneTabs([dom], comId).find(({ tab }) => tab.selector === selector)
  if (!found) return false
  // 面板在场先借它切：面板的 tab 会跟过去，预览和 focused 由面板自己的 effect 更新
  if (useVariation(selector)) return true
  const { tab } = found
  if (tab.pseudo) {
    // 预览范围和面板默认一致：同类元素一起（需要 comId）
    applyStatePreview(dom, tab, comId ? { comId } : undefined)
  } else {
    // 切回常规 = 收回预览
    clearStatePreview()
  }
  setFocusedVariation(selector)
  return true
}
