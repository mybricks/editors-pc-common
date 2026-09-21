import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

import {
  buildZoneSelectorsFromCssom,
  collectSubjectClassSelectors,
  fallbackZoneSelectorsFromClassnames,
} from '../core/build-zone-selectors-from-cssom'
import { elMatchesSelectorTail } from '../core/css-modules-match'
import { toElementArray } from '../core/dom'
import { scanPseudoSelectors } from '../core/scan-pseudo-selectors'
import { getEffectedCssPropertyAndOptions } from '../core/get-effected-css'
import {
  buildZoneEffectiveStyle,
  collectZoneTabs,
  getZoneTabLabels,
  mergeZoneTabsByState,
} from '../core/zone-tab'
import type { ZoneTab } from '../core/zone-tab'

export function useZoneSelectors(editConfig: any, targetDom: any, _open: boolean) {
  const [activeZoneIdx, setActiveZoneIdx] = useState(0)
  const [customZoneTabs, setCustomZoneTabs] = useState<ZoneTab[]>([])
  // 用户手动点 tab 后，禁止被「按 DOM class 对齐」立刻打回基础态（:hover / 状态类等）
  const userSelectedRef = useRef(false)

  const comId = useMemo(() => {
    if (!editConfig.options || Array.isArray(editConfig.options)) return ''
    return (editConfig.options as any).comId ?? ''
  }, [editConfig])

  // 换选中元素时，恢复自动对齐
  useEffect(() => {
    userSelectedRef.current = false
    setCustomZoneTabs([])
  }, [targetDom])

  const zoneTabs = useMemo<ZoneTab[]>(() => {
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

    const tabs = collectZoneTabs(domList, baseSelectors, comId)
    const tabKeys = new Set(tabs.map((tab) => tab.selector))
    for (const pseudo of scanPseudoSelectors(baseSelectors, comId, domList)) {
      if (!tabKeys.has(pseudo) && !/:nth-child\(\d+\)$/.test(pseudo)) {
        const baseSelector = [...baseSelectors]
          .sort((a, b) => b.length - a.length)
          .find((base) => pseudo.startsWith(base)) || pseudo
        tabs.push({
          selector: pseudo,
          baseSelector,
          pseudo: pseudo.slice(baseSelector.length) || null,
          sourceRules: [],
          baseRules: [],
          effectiveStyle: {},
        })
      }
    }
    // 保持 CSSOM 命中顺序，同时把没有可读 sourceRule 的兼容 fallback 放在末尾。
    const ordered = result.map((selector) => tabs.find((tab) => tab.selector === selector)).filter(Boolean) as ZoneTab[]
    tabs.filter((tab) => !result.includes(tab.selector)).forEach((tab) => ordered.push(tab))
    const merged = mergeZoneTabsByState(ordered)
    const labels = getZoneTabLabels(merged.map((tab) => tab.selector))
    const generatedTabs = merged.map((tab, index) => {
      const target = domList[0] as HTMLElement | undefined
      let effectiveStyle = tab.effectiveStyle ?? {}
      if (target) {
        const [styleValues] = getEffectedCssPropertyAndOptions(
          target,
          tab.selector,
          comId,
          tab,
        )
        effectiveStyle = buildZoneEffectiveStyle(tab, styleValues as Record<string, unknown>, target)
      }
      return {
        ...tab,
        label: labels[index],
        effectiveStyle,
      }
    })
    const customTabs = customZoneTabs.map((tab) => {
      const target = domList[0] as HTMLElement | undefined
      if (!target) return tab
      const [styleValues] = getEffectedCssPropertyAndOptions(target, tab.selector, comId, tab)
      return {
        ...tab,
        effectiveStyle: buildZoneEffectiveStyle(tab, styleValues as Record<string, unknown>, target),
      }
    })
    return [...generatedTabs, ...customTabs]
  }, [targetDom, comId, customZoneTabs])

  const zoneSelectorList = useMemo(() => zoneTabs.map((tab) => tab.selector), [zoneTabs])

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

  const addZoneTab = useCallback((tab: ZoneTab) => {
    const existingIndex = zoneTabs.findIndex((item) => item.selector === tab.selector)
    const customIndex = customZoneTabs.findIndex((item) => item.selector === tab.selector)
    if (existingIndex >= 0) {
      setActiveZoneIdx(existingIndex)
      userSelectedRef.current = true
      return
    }
    if (customIndex >= 0) {
      setActiveZoneIdx(zoneTabs.length + customIndex)
      userSelectedRef.current = true
      return
    }
    setCustomZoneTabs((tabs) => {
      return [...tabs, tab]
    })
    setActiveZoneIdx(zoneTabs.length + customZoneTabs.length)
    userSelectedRef.current = true
  }, [customZoneTabs, zoneTabs])

  return {
    zoneSelectorList,
    zoneTabs,
    activeZoneIdx,
    setActiveZoneIdx: setActiveZoneIdxByUser,
    addZoneTab,
  }
}
