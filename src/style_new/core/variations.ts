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

/** 每个元素上一次的变体列表指纹，用来判断变体这次有没有真的变化。 */
const lastSignatures = new WeakMap<HTMLElement, string>()
const listeners = new Set<VariationsListener>()
let notifyTimer: ReturnType<typeof setTimeout> | undefined

function variationsSignature(variations: StyleVariation[]): string {
  // 只用 selector 生成指纹；title 会随语言变，不能算进去。
  return variations.map((item) => item.selector).join('\u0001')
}

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

/** 记录变体列表的初始快照，作为之后“有没有变化”的比对起点。 */
export function seedVariationsBaseline(dom: HTMLElement, comId: string): void {
  if (lastSignatures.has(dom)) return
  lastSignatures.set(dom, variationsSignature(getVariations(dom, comId)))
}

/**
 * 样式真正写入页面后调用：重算变体、和上次比对，变了才通知。
 * 150ms 防抖，连续多次写入只通知最后一次。
 */
export function notifyVariationsChange(target: HTMLElement, comId: string): void {
  if (notifyTimer) clearTimeout(notifyTimer)
  notifyTimer = setTimeout(() => {
    notifyTimer = undefined
    const signature = variationsSignature(getVariations(target, comId))
    if (lastSignatures.get(target) === signature) return
    lastSignatures.set(target, signature)
    listeners.forEach((listener) => listener())
  }, 150)
}
