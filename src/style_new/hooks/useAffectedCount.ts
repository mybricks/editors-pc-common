import { useEffect, useState } from 'react'

import { getDocument } from '../core/dom'

export function useAffectedCount(
  activeZoneIdx: number,
  zoneSelectorList: string[],
  finalSelector: string | string[] | undefined
) {
  const [affectedCount, setAffectedCount] = useState<number | null>(null)

  useEffect(() => {
    const root = getDocument()
    // 遍历所有带 data-zone-selector 的元素，比对其中记录的原始选择器列表。
    function countByZoneSelector(sel: string): number {
      const zoneEls = (root as any).querySelectorAll?.('[data-zone-selector]') ?? []
      return Array.from(zoneEls).filter((el: any) => {
        try {
          const sels: string[] = JSON.parse(el.getAttribute('data-zone-selector'))
          return Array.isArray(sels) && sels.includes(sel)
        } catch {
          return false
        }
      }).length
    }

    // 无打标场景（finalSelector fallback）：元素没有 data-zone-selector，直接用 CSS 选择器查找。
    // 先去掉伪类（::before / :hover 等），避免 querySelectorAll 报错。
    function countByCssSelector(sel: string): number {
      const base = sel.replace(/:{1,2}[a-zA-Z\-]+(\([^)]*\))?/g, '').trim()
      try {
        return (root as any).querySelectorAll?.(base)?.length ?? 0
      } catch {
        return 0
      }
    }

    const activeSelector = zoneSelectorList[activeZoneIdx]
    if (activeSelector) {
      setAffectedCount(countByZoneSelector(activeSelector))
      return
    }

    // zoneSelectorList 为空时降级：用编辑器配置中的 finalSelector 统计受影响元素数。
    // 连 finalSelector 也没有，则无法计算，置为 null（区别于 0）表示"未知"，提示条静默不展示。
    if (!finalSelector) {
      setAffectedCount(null)
      return
    }
    const fallbackSelectors = Array.isArray(finalSelector) ? finalSelector : [finalSelector]
    setAffectedCount(fallbackSelectors.reduce((sum, s) => sum + countByCssSelector(s), 0))
  }, [activeZoneIdx, zoneSelectorList, finalSelector])

  return affectedCount
}
