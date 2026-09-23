import { useLayoutEffect, useState } from 'react'

import { elMatchesSelectorTail } from '../core/css-modules-match'
import { getDocument } from '../core/dom'
import type { ZoneTab } from '../core/zone-tab'

function stripPseudos(sel: string): string {
  return sel.replace(/:{1,2}[a-zA-Z\-]+(\([^)]*\))?/g, '').trim()
}

/**
 * 在当前页面内统计匹配选择器的元素数，无页面边界时回退到组件根。
 * 优先 querySelectorAll；CSS Modules 短名查不到时，用末段短名 + elMatchesSelectorTail 兜底。
 */
function findByCssSelector(
  sel: string,
  comId?: string,
  anchor?: Element | null
): Element[] {
  const base = stripPseudos(sel)
  if (!base) return []

  const doc = getDocument()
  // 优先限制到当前页面，避免跨页面统计同名 selector。
  const pageRoot = anchor?.closest?.('[data-desn-page]')
  const scope: ParentNode =
    pageRoot || (comId && (doc as Document | ShadowRoot).getElementById?.(comId)) || doc

  try {
    const nodes = (scope as ParentNode & { querySelectorAll: typeof document.querySelectorAll })
      .querySelectorAll?.(base)
    if (nodes && nodes.length > 0) return Array.from(nodes)
  } catch {
    /* Modules 短名或非法选择器 */
  }

  const rootEl = scope instanceof Element ? scope : null
  const descendants = Array.from(
    (scope as ParentNode & { querySelectorAll: typeof document.querySelectorAll })
      .querySelectorAll?.('*') ?? []
  ) as Element[]
  const candidates = rootEl ? [rootEl, ...descendants] : descendants

  return candidates.filter((el) => elMatchesSelectorTail(el, base))
}

export function useAffectedCount(
  activeZoneIdx: number,
  zoneTabs: ZoneTab[],
  finalSelector: string | string[] | undefined,
  comId?: string,
  anchor?: Element | null
) {
  const [affectedCount, setAffectedCount] = useState<number | null>(null)

  useLayoutEffect(() => {
    const activeTab = zoneTabs[activeZoneIdx]
    if (activeTab) {
      const affectedSelectors = activeTab.affectedSelectors?.length
        ? activeTab.affectedSelectors
        : [activeTab.selector]
      const affectedElements = new Set<Element>()
      affectedSelectors.forEach((selector) => {
        findByCssSelector(selector, comId, anchor).forEach((element) => {
          affectedElements.add(element)
        })
      })
      const count = affectedElements.size
      setAffectedCount((prev) => (prev === count ? prev : count))
      return
    }

    // zoneSelectorList 为空时降级：用编辑器配置中的 finalSelector 统计
    if (!finalSelector) {
      setAffectedCount((prev) => (prev === null ? prev : null))
      return
    }
    const fallbackSelectors = Array.isArray(finalSelector) ? finalSelector : [finalSelector]
    const count = fallbackSelectors.reduce(
      (sum, selector) => sum + findByCssSelector(selector, comId, anchor).length,
      0
    )
    setAffectedCount((prev) => (prev === count ? prev : count))
  }, [activeZoneIdx, zoneTabs, finalSelector, comId, anchor])

  return affectedCount
}
