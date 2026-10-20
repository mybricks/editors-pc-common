import { collectDisplayZoneTabs } from './zone-display-tabs'

export type StyleVariation = {
  /** 展示名，如“常规”“悬浮态”“Hover”，跟随画布语言。 */
  title: string
  /** 变体的唯一标识，如 ".featureTag:active"。 */
  selector: string
  /** 伪类/伪元素本身，如 ":active"、"::before"；常规态为 null。 */
  pseudo: string | null
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
  }))
}

// ========== 变体变化订阅 ==========

type VariationsListener = () => void

const listeners = new Set<VariationsListener>()
let notifyTimer: ReturnType<typeof setTimeout> | undefined

/**
 * 订阅变体变化：变体列表真的变了才触发（不携带数据，收到后自己调 getVariations 重拉）。
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
