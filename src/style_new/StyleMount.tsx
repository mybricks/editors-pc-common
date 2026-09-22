import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'

import { deepCopy } from '../utils'
import StyleEditor, { StyleEditorProvider } from './StyleEditor'
import { buildStyleMutationChange } from './StyleEditor/helper/style-mutations'
import { initLiveStyle } from './StyleEditor/helper/gradient-border'
import type { ChangeEvent, StyleMutation } from './StyleEditor/type'
import type { EditorProps } from './type'
import { applyStyleChange } from './core/apply-style-change'
import type { ZoneWriteTarget } from './core/apply-style-change'
import { toElementArray } from './core/dom'
import { cssPropertyName, getStyleResolution, invalidateStyleResolution } from './core/style-property'
import { collectZoneTabs, mergeZoneTabsByState } from './core/zone-tab'
import type { ZoneTab } from './core/zone-tab'
import { expandFourShorthand } from './core/shorthand-normalizer'

const BOX_MODEL_KEYS = {
  margin: ['marginTop', 'marginRight', 'marginBottom', 'marginLeft'],
  padding: ['paddingTop', 'paddingRight', 'paddingBottom', 'paddingLeft'],
}

function mergeAuthoredBoxModelValues(
  setValue: Record<string, any>,
  authoredStyle?: Record<string, any>
) {
  const merged = deepCopy(setValue || {})
  if (!authoredStyle) return merged

  Object.entries(BOX_MODEL_KEYS).forEach(([shorthand, longhands]) => {
    const expanded = expandFourShorthand(authoredStyle[shorthand])
    if (expanded) {
      longhands.forEach((key, index) => {
        merged[key] = expanded[index]
      })
    }
    longhands.forEach((key) => {
      if (authoredStyle[key] != null && authoredStyle[key] !== '') {
        merged[key] = authoredStyle[key]
      }
    })
  })

  return merged
}

interface StyleProps extends EditorProps {
  [key: string]: any
}

export function StyleMount({
  editConfig,
  options,
  setValue,
  authoredStyle,
  effectiveStyle,
  collapsedOptions,
  readonlyExpandedOptions,
  autoCollapseWhenUnusedProperty,
  finnalExcludeOptions,
  defaultValue,
  preserveImportantPriority,
  onBatchMetaChange,
}: StyleProps) {
  const [styleRevision, setStyleRevision] = useState(0)
  const zoneOptions = !Array.isArray(editConfig.options) ? editConfig.options as any : null
  const zoneTab: ZoneTab | undefined = zoneOptions?.zoneTab
  const target = (toElementArray(zoneOptions?.targetDom)[0] ?? null) as HTMLElement | null

  useEffect(() => {
    if (!zoneTab || !target) return
    let frame = 0
    const refresh = () => {
      cancelAnimationFrame(frame)
      frame = requestAnimationFrame(() => {
        const selectors = Array.from(new Set([
          zoneTab.baseSelector,
          ...Array.from(target.classList).map(name => '.' + name),
        ]))
        const tabs = mergeZoneTabsByState(collectZoneTabs([target], selectors, zoneOptions?.comId))
        const current = tabs.find(tab => tab.pseudo === zoneTab.pseudo)
        if (current) {
          zoneTab.sourceRules = current.sourceRules
          zoneTab.baseRules = current.baseRules
        }
        invalidateStyleResolution(zoneTab)
        setStyleRevision(revision => revision + 1)
      })
    }
    const observer = new MutationObserver(records => {
      const relevant = records.some(record => {
        const el = record.target.nodeType === 1 ? record.target as Element : record.target.parentElement
        return el?.tagName === 'STYLE' || el?.closest?.('style') ||
          (record.type === 'attributes' && !!el?.contains(target)) ||
          Array.from(record.addedNodes).concat(Array.from(record.removedNodes))
            .some(node => node.nodeType === 1 && /^(STYLE|LINK)$/.test((node as Element).tagName))
      })
      if (relevant) refresh()
    })
    observer.observe(target.getRootNode(), {
      subtree: true, childList: true, characterData: true,
      attributes: true, attributeFilter: ['style', 'class', 'data-style-info'],
    })
    return () => { observer.disconnect(); cancelAnimationFrame(frame) }
  }, [zoneTab, target])

  // 追踪每次 handleChange 实际写入后的完整样式快照，
  // 替代 stale 的 setValue prop，作为渐变边框保护逻辑的数据源。
  const importantPriorityCacheRef = useRef(new Map<string, boolean>())
  const zoneWriteTargetsRef = useRef(new Map<string, ZoneWriteTarget>())
  const liveStyleRef = useRef<Record<string, any>>(
    initLiveStyle(
      mergeAuthoredBoxModelValues(setValue || {}, authoredStyle),
      (defaultValue as any) || {}
    )
  )

  // 当 setValue 被外部改写时，同步更新 liveStyleRef。
  useEffect(() => {
    liveStyleRef.current = initLiveStyle(
      mergeAuthoredBoxModelValues(setValue || {}, authoredStyle),
      (defaultValue as any) || {}
    )
  }, [setValue, authoredStyle])

  const handleChange: ChangeEvent = useCallback(
    (value) => {
      const result = applyStyleChange({
        value: value as any,
        liveStyle: liveStyleRef.current,
        collapsedOptions,
        editConfig,
        options,
        preserveImportantPriority,
        importantPriorityCache: importantPriorityCacheRef.current,
        zoneWriteTargets: zoneWriteTargetsRef.current,
        onBatchMetaChange,
      })
      const { nextLiveStyle, applied } = result
      if (applied) {
        liveStyleRef.current = nextLiveStyle
        setStyleRevision(revision => revision + 1)
      }
      return result
    },
    [editConfig, options, collapsedOptions, preserveImportantPriority, onBatchMetaChange]
  )

  const applyStyleMutations = useCallback(
    (mutations: StyleMutation[]) =>
      handleChange(buildStyleMutationChange(mutations)),
    [handleChange]
  )

  const editorContext = useMemo(() => {
    const dom =
      !editConfig.options || Array.isArray(editConfig.options)
        ? null
        : (editConfig.options as any).targetDom ?? null
    const realDom = (toElementArray(dom)[0] ?? null) as HTMLElement | null
    const previewCache = new Map<string, string>()
    let computed: CSSStyleDeclaration | undefined
    const getStylePreview = (key: string, refresh = false) => {
      if (!realDom) return ''
      const property = cssPropertyName(key)
      if (refresh) {
        computed = (realDom.ownerDocument.defaultView || window).getComputedStyle(
          realDom, zoneTab?.pseudo?.startsWith('::') ? zoneTab.pseudo : null)
        previewCache.clear()
      }
      if (!previewCache.has(property)) {
        computed = computed || (realDom.ownerDocument.defaultView || window).getComputedStyle(
          realDom, zoneTab?.pseudo?.startsWith('::') ? zoneTab.pseudo : null)
        previewCache.set(property, computed.getPropertyValue(property))
      }
      return previewCache.get(property)!
    }
    const CDN = (editConfig as any).getDefaultOptions?.('stylenew')?.CDN
    return {
      editConfig: {
        ...editConfig,
        CDN,
      },
      autoCollapseWhenUnusedProperty,
      targetDom: realDom,
      authoredStyle,
      effectiveStyle,
      applyStyleMutations,
      getStyleProperty: zoneTab ? (key: string) => getStyleResolution(zoneTab, realDom).get(key) : undefined,
      getStylePreview,
    }
  }, [
    editConfig,
    autoCollapseWhenUnusedProperty,
    authoredStyle,
    effectiveStyle,
    applyStyleMutations,
    zoneTab,
    styleRevision,
  ])

  const panelValue = { ...defaultValue }
  if (zoneTab) {
    const resolution = getStyleResolution(zoneTab, target)
    Object.keys({ ...defaultValue, ...liveStyleRef.current }).forEach(key => {
      const winner = resolution.get(key).winner
      panelValue[key] = winner?.value ?? (editorContext.getStylePreview(key) || defaultValue[key])
    })
  }

  return (
    <StyleEditorProvider value={editorContext}>
      <StyleEditor
        defaultValue={panelValue}
        options={options}
        finnalExcludeOptions={finnalExcludeOptions}
        collapsedOptions={collapsedOptions}
        readonlyExpandedOptions={readonlyExpandedOptions}
        onChange={handleChange}
      />
    </StyleEditorProvider>
  )
}
