import { elMatchesSelectorTail } from './css-modules-match'
import { buildZoneSelectorsFromCssom } from './build-zone-selectors-from-cssom'

function stripPseudos(sel: string): string {
  return sel.replace(/:{1,2}[a-zA-Z\-]+(\([^)]*\))?/g, '').trim()
}

// 优先 querySelectorAll；CSS Modules 哈希类名查不到时用 elMatchesSelectorTail 兜底。
function findElementsBySelector(sel: string, scopeEle: Element | Document): Element[] {
  const base = stripPseudos(sel)
  if (!base) return []

  try {
    const nodes = scopeEle.querySelectorAll(base)
    if (nodes && nodes.length > 0) return Array.from(nodes)
  } catch { /* 哈希短名或非法选择器，走兜底 */ }

  const rootEl = scopeEle instanceof Element ? scopeEle : null
  const descendants = Array.from(scopeEle.querySelectorAll('*')) as Element[]
  const candidates = rootEl ? [rootEl, ...descendants] : descendants

  return candidates.filter((el) => elMatchesSelectorTail(el, base))
}

/**
 * 返回 scopeEle 范围内所有与 fromEle 共享同一 selector 的 DOM 元素（含 fromEle 自身）。
 * selector 经 CSSOM 扫描得出，与编辑器"影响 N 个区域"计数保持一致。
 */
export function getSimilarZones(
  fromEle: HTMLElement,
  scopeEle: Element | Document,
  comId: string
): HTMLElement[] {
  if (!fromEle || !scopeEle) return []

  const selectors = buildZoneSelectorsFromCssom(fromEle, comId)
  if (!selectors.length) return []

  const result = new Set<HTMLElement>()

  for (const sel of selectors) {
    const matched = findElementsBySelector(sel, scopeEle)
    for (const el of matched) {
      result.add(el as HTMLElement)
    }
  }

  return Array.from(result)
}
