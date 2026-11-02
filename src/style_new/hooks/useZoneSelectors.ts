import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

import { elMatchesSelectorTail } from '../core/css-modules-match'
import { toElementArray } from '../core/dom'
import { getEffectedCssPropertyAndOptions } from '../core/get-effected-css'
import { collectDisplayZoneTabs } from '../core/zone-display-tabs'
import { clearStatePreview, getStatePreviewContext, onStatePreviewChange } from '../core/state-preview'
import {
  buildZoneEffectiveStyle,
  collectZoneTabs,
} from '../core/zone-tab'
import type { ZoneTab } from '../core/zone-tab'
import { uniqBy } from 'lodash'

const INIT_TABS: ZoneTab[] = [];
export function useZoneSelectors(editConfig: any, targetDom: any, _open: boolean) {
  const [activeZoneIdx, setActiveZoneIdx] = useState(0)
  const [customZoneTabs, setCustomZoneTabs] = useState<ZoneTab[]>(INIT_TABS)
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

  const { zoneTabs, mergedTabs, originTabs } = useMemo(() => {
    const domList = toElementArray(targetDom)
    const target = domList[0] as HTMLElement | undefined
    const resolveTabStyle = (tab: ZoneTab): ZoneTab => {
      if (!target) return tab
      const effectedCssResult = getEffectedCssPropertyAndOptions(target, tab.selector, comId, tab)
      return {
        ...tab,
        target,
        effectedCssResult,
        effectiveStyle: buildZoneEffectiveStyle(tab, effectedCssResult[0] as Record<string, unknown>, target),
      }
    }

    // 变体列表管线与对外 getVariations 共享（core/zone-display-tabs），
    // 面板在共享结果上继续算每个 tab 的生效样式。
    const { displayTabs, mergedTabs, originTabs } = collectDisplayZoneTabs(domList, comId)
    const generatedTabs = displayTabs.map(({ tab, label }) =>
      resolveTabStyle({ ...tab, label, effectiveStyle: tab.effectiveStyle ?? {} })
    )
    const customTabs = customZoneTabs.map((tab) => {
      // 手动新增的 Tab 合入最新扫描规则，保留新增标记。
      const generated = generatedTabs.find((item) => item.selector === tab.selector)
      if (generated) {
        return { ...tab, ...generated, isAdded: tab.isAdded }
      }
      return resolveTabStyle(tab)
    })
    return {
      zoneTabs: uniqBy([...generatedTabs, ...customTabs].reverse(), (tab) => tab.selector).reverse(),
      mergedTabs,
      originTabs,
    }
  }, [targetDom, comId, customZoneTabs])

  const zoneSelectorList = useMemo(() => zoneTabs.map((tab) => tab.selector), [zoneTabs])

  // 换选中直接回显当前元素的预览；没有记录则回到常规，不能沿用上一个元素的 tab。
  const prevTargetDomRef = useRef<unknown>(null)
  if (prevTargetDomRef.current !== targetDom) {
    prevTargetDomRef.current = targetDom
    const el = toElementArray(targetDom)[0] ?? null
    const preview = getStatePreviewContext(el)
    const idx = zoneTabs.findIndex(tab => tab.pseudo === (preview?.pseudo ?? null))
    setActiveZoneIdx(idx >= 0 ? idx : 0)
  }

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
      // 只回显该元素所属的预览会话，父子或同类 class 不再隐式继承面板状态。
      const preview = getStatePreviewContext(el)
      if (preview) {
        const previewIdx = zoneSelectorList.findIndex((sel) => sel.endsWith(preview.pseudo))
        if (previewIdx >= 0) {
          setActiveZoneIdx(previewIdx)
          return
        }
        // 新增 tab 尚未提交到列表时，保留本次用户选择，避免预览通知抢先切回常规。
        if (userSelectedRef.current) return
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

    let previewPseudo = getStatePreviewContext(el)?.pseudo
    const unsubscribe = onStatePreviewChange(() => {
      const nextPseudo = getStatePreviewContext(el)?.pseudo
      if (nextPseudo === previewPseudo) return
      previewPseudo = nextPseudo
      syncActiveIdx()
    })
    const observer = new MutationObserver(() => {
      userSelectedRef.current = false
      syncActiveIdx()
    })
    observer.observe(el, { attributes: true, attributeFilter: ['class'] })
    return () => { observer.disconnect(); unsubscribe() }
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

    const target = toElementArray(targetDom)[0] ?? null
    if (target && getStatePreviewContext(target)?.pseudo === addedTab.pseudo) {
      clearStatePreview(target)
      setActiveZoneIdx(Math.max(0, zoneTabs.findIndex(tab => !tab.pseudo)))
    }
    setCustomZoneTabs((tabs) => tabs.filter((tab) => tab.selector !== selector))
    userSelectedRef.current = true
  }, [comId, editConfig, targetDom, zoneTabs])

  return {
    zoneSelectorList,
    zoneTabs,
    mergedTabs,
    originTabs,
    activeZoneIdx,
    setActiveZoneIdx: setActiveZoneIdxByUser,
    addZoneTab,
    deleteZoneTab,
    // 供外部区分「用户手动点了 tab」和「换元素后自动对齐」两种情况
    userSelectedRef,
  }
}
