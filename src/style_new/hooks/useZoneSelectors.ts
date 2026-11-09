import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

import { elMatchesSelectorTail } from '../core/css-modules-match'
import { toElementArray } from '../core/dom'
import { getEffectedCssPropertyAndOptions } from '../core/get-effected-css'
import { collectDisplayZoneTabs } from '../core/zone-display-tabs'
import { clearStatePreview, getStatePreviewContext, onStatePreviewChange } from '../core/state-preview'
import {
  buildZoneEffectiveStyle,
  getZoneTabLabels,
  collectZoneTabs,
} from '../core/zone-tab'
import type { ZoneTab } from '../core/zone-tab'
import { collectAncestorStateLinkTab, createAncestorStateLink, hasAncestorStateLinkRule, withAncestorStateLinkSelector } from '../core/ancestor-state-link'
import { withExplicitStyleSelector } from '../core/apply-style-change'
import { uniqBy } from 'lodash'

const INIT_TABS: ZoneTab[] = [];
export function useZoneSelectors(editConfig: any, targetDom: any, _open: boolean) {
  const [activeZoneIdx, setActiveZoneIdx] = useState(0)
  const [previewRevision, setPreviewRevision] = useState(0)
  useEffect(() => onStatePreviewChange(() => setPreviewRevision(revision => revision + 1)), [])
  const customTargetRef = useRef(targetDom)
  const restoredLinkRef = useRef<{ target: unknown; tab?: ZoneTab }>({ target: targetDom })
  if (restoredLinkRef.current.target !== targetDom) restoredLinkRef.current = { target: targetDom }
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
    if (target) {
      const restored = restoredLinkRef.current.tab
      const normalTab = generatedTabs.find(tab => !tab.pseudo)
      const link = restored?.ancestorStateLink || (normalTab && createAncestorStateLink(target, normalTab.baseSelector, comId))
      if (normalTab && link) {
        const stateIndex = generatedTabs.findIndex(tab => tab.pseudo === link.pseudo)
        const baseTab = stateIndex >= 0 ? generatedTabs[stateIndex] : normalTab
        const linked = collectAncestorStateLinkTab(target, baseTab, link, comId)
        if (restored || hasAncestorStateLinkRule(linked, link)) {
          restoredLinkRef.current.tab = linked
          const label = getZoneTabLabels([linked.selector])[0]
          const linkedTab = resolveTabStyle({ ...linked, label })
          if (stateIndex >= 0) generatedTabs[stateIndex] = linkedTab
          else generatedTabs.push(linkedTab)
        }
      }
    }
    const targetCustomTabs = customTargetRef.current === targetDom ? customZoneTabs : INIT_TABS
    const customTabs = targetCustomTabs.map((tab) => {
      // 手动新增的 Tab 合入最新扫描规则，保留新增标记。
      if (tab.ancestorStateLink && target) return resolveTabStyle(collectAncestorStateLinkTab(target, tab, tab.ancestorStateLink, comId))
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
  }, [targetDom, comId, customZoneTabs, previewRevision])

  const zoneSelectorList = useMemo(() => zoneTabs.map((tab) => tab.selector), [zoneTabs])

  // 换选中直接回显当前元素的预览；没有记录则回到常规，不能沿用上一个元素的 tab。
  const prevTargetDomRef = useRef<unknown>(null)
  if (prevTargetDomRef.current !== targetDom) {
    prevTargetDomRef.current = targetDom
    const el = toElementArray(targetDom)[0] ?? null
    const preview = getStatePreviewContext(el)
    const linked = zoneTabs.find(tab => tab.linkedSelector)
    const idx = zoneTabs.findIndex(tab => tab.pseudo === (linked?.pseudo || preview?.pseudo || null))
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
      const linkedIdx = zoneTabs.findIndex(tab => tab.linkedSelector)
      if (linkedIdx >= 0 && !userSelectedRef.current) {
        setActiveZoneIdx(linkedIdx)
        return
      }
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
    customTargetRef.current = targetDom
    const existingIndex = zoneTabs.findIndex((item) => item.selector === tab.selector)
    const customIndex = customZoneTabs.findIndex((item) => item.selector === tab.selector)
    if (tab.ancestorStateLink) {
      const existingState = zoneTabs.find(item => item.pseudo === tab.pseudo)
      const linkedTab = existingState ? { ...tab, selector: existingState.selector, baseSelector: existingState.baseSelector } : tab
      setCustomZoneTabs(tabs => [...tabs.filter(item => item.pseudo !== tab.pseudo), linkedTab])
      setActiveZoneIdx(existingState ? zoneTabs.indexOf(existingState) : zoneTabs.length)
      userSelectedRef.current = true
      return
    }
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
  }, [customZoneTabs, zoneTabs, targetDom])

  const deleteZoneTab = useCallback((selector: string) => {
    const addedTab = zoneTabs.find((tab) => tab.selector === selector && tab.isAdded)
    if (!addedTab) return

    // 样式写入后 CSSOM 可能已更新，但 zoneTabs 仍被 useMemo 缓存；删除前补扫一次，
    // 确保能拿到新增状态刚写入的 CSSStyleRule。
    const latestTabs = collectZoneTabs(
      toElementArray(targetDom),
      [addedTab.baseSelector],
      comId,
      addedTab.linkedSelector ? { includeAncestorState: true } : undefined,
    )
    const styleRules = [
      ...zoneTabs.filter((tab) => tab.selector === selector).flatMap((tab) => tab.linkedRules || tab.sourceRules),
      ...latestTabs.filter((tab) => tab.selector === selector).flatMap((tab) => tab.sourceRules),
    ]
    const propertiesBySelector = new Map<string, string[]>()

    styleRules.forEach(({ rule, sourceSelector }) => {
      if (addedTab.linkedSelector && sourceSelector !== addedTab.linkedSelector) return
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
        if (addedTab.linkedSelector) {
          withAncestorStateLinkSelector(sourceSelector, () =>
            withExplicitStyleSelector(sourceSelector, () => editConfig.value.set({}, { selector: sourceSelector })))
        } else {
          editConfig.value.set({}, { selector: sourceSelector })
        }
      } finally {
        ;(window as any).__mybricks_style_deletions = null
      }
    })

    const target = toElementArray(targetDom)[0] ?? null
    if (!addedTab.linkedSelector && target && getStatePreviewContext(target)?.pseudo === addedTab.pseudo) {
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
