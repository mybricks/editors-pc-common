import { useLayoutEffect, useState } from 'react'

import { getDocument } from '../core/dom'
import { collectAffectedElements } from '../core/get-similar-zones'
import type { ZoneTab } from '../core/zone-tab'

export function useAffectedCount(
  activeZoneIdx: number,
  zoneTabs: ZoneTab[],
  finalSelector: string | string[] | undefined,
  comId?: string,
  anchor?: Element | null
) {
  const [affectedCount, setAffectedCount] = useState<number | null>(null)

  useLayoutEffect(() => {
    const activeTab = zoneTabs[activeZoneIdx] || null
    if (!activeTab && !finalSelector) {
      setAffectedCount((prev) => (prev === null ? prev : null))
      return
    }

    const doc = getDocument()
    // 优先限制到当前页面，避免跨页面统计同名 selector。
    const scope = anchor?.closest('[data-desn-page]')
      || (comId && doc.getElementById(comId)) || doc
    const fallbackSelectors: string[] = []
    if (Array.isArray(finalSelector)) fallbackSelectors.push(...finalSelector)
    else if (finalSelector) fallbackSelectors.push(finalSelector)
    const affectedElements = collectAffectedElements(activeTab, fallbackSelectors, scope, anchor || null, comId)
    const count = affectedElements.size
    setAffectedCount((prev) => (prev === count ? prev : count))

  }, [activeZoneIdx, zoneTabs, finalSelector, comId, anchor])

  return affectedCount
}
