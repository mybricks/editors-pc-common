import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

import { elMatchesSelectorTail } from '../core/css-modules-match'
import { toElementArray } from '../core/dom'
import { getEffectedCssPropertyAndOptions } from '../core/get-effected-css'
import { collectDisplayZoneTabs } from '../core/zone-display-tabs'
import { getStatePreviewContext, isStatePreviewSurface } from '../core/state-preview'
import {
  buildZoneEffectiveStyle,
  collectZoneTabs,
} from '../core/zone-tab'
import type { ZoneTab } from '../core/zone-tab'
import { uniqBy } from 'lodash'

const INIT_TABS: ZoneTab[] = [];
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
    setCustomZoneTabs(INIT_TABS)
  }, [targetDom])

  const zoneTabs = useMemo<ZoneTab[]>(() => {
    const domList = toElementArray(targetDom)

    // 变体列表管线与对外 getVariations 共享（core/zone-display-tabs），
    // 面板在共享结果上继续算每个 tab 的生效样式。
    const displayTabs = collectDisplayZoneTabs(domList, comId)
    const generatedTabs = displayTabs.map(({ tab, label }) => {
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
        label,
        effectiveStyle,
      }
    })
    const customTabs = customZoneTabs.map((tab) => {
      // 手动新增的 Tab 合入最新扫描规则，保留新增标记。
      const generated = generatedTabs.find((item) => item.selector === tab.selector)
      if (generated) {
        return { ...tab, ...generated, isAdded: tab.isAdded }
      }
      const target = domList[0] as HTMLElement | undefined
      if (!target) return tab
      const [styleValues] = getEffectedCssPropertyAndOptions(target, tab.selector, comId, tab)
      return {
        ...tab,
        effectiveStyle: buildZoneEffectiveStyle(tab, styleValues as Record<string, unknown>, target),
      }
    })
    return uniqBy([...generatedTabs, ...customTabs].reverse(), (tab) => tab.selector).reverse()
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
      // 预览还跟着这个元素（或其同类元素）时，对齐回那个状态 tab；用户手动点基础态才退出
      const preview = getStatePreviewContext()
      if (preview && isStatePreviewSurface(el)) {
        const previewIdx = zoneSelectorList.findIndex((sel) => sel.endsWith(preview.pseudo))
        if (previewIdx >= 0) {
          setActiveZoneIdx(previewIdx)
          return
        }
      }
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
      setActiveZoneIdx((prev) => (prev >= zoneSelectorList.length ? zoneSelectorList.length - 1 : prev))
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
    setActiveZoneIdx(uniqBy([...zoneTabs, ...customZoneTabs], (t) => t.selector).length)
    userSelectedRef.current = true
  }, [customZoneTabs, zoneTabs])

  const deleteZoneTab = useCallback((selector: string) => {
    const addedTab = zoneTabs.find((tab) => tab.selector === selector && tab.isAdded)
    if (!addedTab) return

    // 样式写入后 CSSOM 可能已更新，但 zoneTabs 仍被 useMemo 缓存；删除前补扫一次，
    // 确保能拿到新增状态刚写入的 CSSStyleRule。
    const latestTabs = collectZoneTabs(
      toElementArray(targetDom),
      [addedTab.baseSelector],
      comId,
    )
    const styleRules = [
      ...zoneTabs.filter((tab) => tab.selector === selector).flatMap((tab) => tab.sourceRules),
      ...latestTabs.filter((tab) => tab.selector === selector).flatMap((tab) => tab.sourceRules),
    ]
    const propertiesBySelector = new Map<string, string[]>()

    styleRules.forEach(({ rule, sourceSelector }) => {
      if (!rule?.style) return
      const writeSelector = sourceSelector || addedTab.selector
      const properties = propertiesBySelector.get(writeSelector) || []
      for (let index = 0; index < rule.style.length; index++) {
        const property = rule.style.item(index)
        if (property && !properties.includes(property)) properties.push(property)
      }
      if (properties.length) propertiesBySelector.set(writeSelector, properties)
    })

    propertiesBySelector.forEach((properties, sourceSelector) => {
      try {
        // 宿主通过 side-channel 区分「删除声明」和「写入空对象」。
        ;(window as any).__mybricks_style_deletions = properties
        editConfig.value.set({}, { selector: sourceSelector })
      } finally {
        ;(window as any).__mybricks_style_deletions = null
      }
    })

    setCustomZoneTabs((tabs) => tabs.filter((tab) => tab.selector !== selector))
    userSelectedRef.current = true
  }, [comId, editConfig, targetDom, zoneTabs])

  return {
    zoneSelectorList,
    zoneTabs,
    activeZoneIdx,
    setActiveZoneIdx: setActiveZoneIdxByUser,
    addZoneTab,
    deleteZoneTab,
    // 供外部区分「用户手动点了 tab」和「换元素后自动对齐」两种情况
    userSelectedRef,
  }
}
