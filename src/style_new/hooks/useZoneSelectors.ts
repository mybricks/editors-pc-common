import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

import {
  buildZoneSelectorsFromCssom,
  collectSubjectClassSelectors,
  fallbackZoneSelectorsFromClassnames,
} from '../core/build-zone-selectors-from-cssom'
import { elMatchesSelectorTail } from '../core/css-modules-match'
import { toElementArray } from '../core/dom'
import { scanPseudoSelectors } from '../core/scan-pseudo-selectors'

export function useZoneSelectors(editConfig: any, targetDom: any, _open: boolean) {
  const [activeZoneIdx, setActiveZoneIdx] = useState(0)
  // 用户手动点 tab 后，禁止被「按 DOM class 对齐」立刻打回基础态（:hover / 状态类等）
  const userSelectedRef = useRef(false)

  const comId = useMemo(() => {
    if (!editConfig.options || Array.isArray(editConfig.options)) return ''
    return (editConfig.options as any).comId ?? ''
  }, [editConfig])

  // 换选中元素时，恢复自动对齐
  useEffect(() => {
    userSelectedRef.current = false
  }, [targetDom])

  const zoneSelectorList = useMemo(() => {
    const domList = toElementArray(targetDom)

    const result: string[] = []
    const baseSelectors: string[] = []

    for (const dom of domList) {
      // CSSOM 先收集组件样式表命中的选择器（含后代路径），内部已用 classList 补自身 class。
      // 无 comId / CSSOM 为空时直接用 classList；纯标签节点再走祖先+tag 兜底。
      // :hover 等伪类由 scanPseudoSelectors 另扫 CSSOM，不在这里拼。
      let bases = comId
        ? buildZoneSelectorsFromCssom(dom, comId)
        : collectSubjectClassSelectors(dom)
      if (!bases.length) {
        bases = fallbackZoneSelectorsFromClassnames(dom)
      }

      for (const s of bases) {
        if (!baseSelectors.includes(s)) baseSelectors.push(s)
        if (!result.includes(s)) result.push(s)
      }
    }

    for (const pseudo of scanPseudoSelectors(baseSelectors, comId)) {
      if (!result.includes(pseudo) && !/:nth-child\(\d+\)$/.test(pseudo)) {
        result.push(pseudo)
      }
    }
    return result
  }, [targetDom, comId])

  // 按 DOM class 对齐 activeZoneIdx：
  // - 仅在「未手动选 tab」时做初始/列表变化对齐
  // - class 真实变化时（MutationObserver）始终对齐，并清除手动选择标记
  useEffect(() => {
    const el = toElementArray(targetDom)[0] ?? null
    if (!el || zoneSelectorList.length === 0) {
      setActiveZoneIdx(0)
      return
    }

    function syncActiveIdx() {
      const idx = zoneSelectorList.findIndex((sel) => {
        const lastPart = sel.trim().split(/\s+/).pop() || ''
        if (/:{1,2}[a-zA-Z\-]+(?:\([^)]*\))?$/.test(lastPart)) return false
        const base = sel.replace(/:{1,2}[a-zA-Z\-]+(\([^)]*\))?/g, '').trim()
        return !!base && elMatchesSelectorTail(el as Element, base)
      })
      setActiveZoneIdx(idx >= 0 ? idx : 0)
    }

    if (!userSelectedRef.current) {
      syncActiveIdx()
    } else {
      setActiveZoneIdx((prev) => (prev >= zoneSelectorList.length ? 0 : prev))
    }

    const observer = new MutationObserver(() => {
      userSelectedRef.current = false
      syncActiveIdx()
    })
    observer.observe(el, { attributes: true, attributeFilter: ['class'] })
    return () => observer.disconnect()
  }, [targetDom, zoneSelectorList])

  const setActiveZoneIdxByUser = useCallback((idx: number) => {
    userSelectedRef.current = true
    setActiveZoneIdx(idx)
  }, [])

  return {
    zoneSelectorList,
    activeZoneIdx,
    setActiveZoneIdx: setActiveZoneIdxByUser,
  }
}
