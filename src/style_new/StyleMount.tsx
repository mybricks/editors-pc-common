import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'

import { deepCopy } from '../utils'
import StyleEditor, { StyleEditorProvider } from './StyleEditor'
import { buildStyleMutationChange } from './StyleEditor/helper/style-mutations'
import { initLiveStyle } from './StyleEditor/helper/gradient-border'
import type { ChangeEvent, StyleMutation } from './StyleEditor/type'
import type { EditorProps } from './type'
import { applyStyleChange, createStyleRemovalPlan } from './core/apply-style-change'
import type { ZoneWriteTarget } from './core/apply-style-change'
import { toElementArray } from './core/dom'
import { createBatchStyleClearPlans, cssPropertyName, getStyleResolution, invalidateStyleResolution } from './core/style-property'
import { buildZoneEffectiveStyle, buildZoneStateStyle, collectZoneTabs, mergeZoneTabsByState, refreshZoneTabSources } from './core/zone-tab'
import type { ZoneTab } from './core/zone-tab'
import { expandFourShorthand } from './core/shorthand-normalizer'
import { readNormalComputedStyle, readNormalStyleSignature } from './core/normal-style-preview'
import { recordPendingSoloValues, reconcilePendingSoloValues } from './core/solo-pending-style'
import type { PendingSoloValue } from './core/solo-pending-style'

const BOX_MODEL_KEYS = {
  margin: ['marginTop', 'marginRight', 'marginBottom', 'marginLeft'],
  padding: ['paddingTop', 'paddingRight', 'paddingBottom', 'paddingLeft'],
}

const PREVIEW_PSEUDO_STATES = new Set([':hover', ':focus', ':active', ':disabled'])

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
  onStyleSourceChange,
}: StyleProps) {
  const [styleRevision, setStyleRevision] = useState(0)
  const [previewRevision, setPreviewRevision] = useState(0)
  const normalPreviewRef = useRef<{
    target: HTMLElement
    baseSelector: string
    styleRevision: number
    styleSources: readonly unknown[]
    normalStyleSignature?: string
    values: Map<string, string | undefined>
  } | null>(null)
  const zoneOptions = !Array.isArray(editConfig.options) ? editConfig.options as any : null
  const zoneTab: ZoneTab | undefined = zoneOptions?.zoneTab
  const isSoloEdit = !!zoneOptions?.soloEdit
  const target = (toElementArray(zoneOptions?.targetDom)[0] ?? null) as HTMLElement | null

  useEffect(() => {
    if (!zoneTab || !target) return
    let frame = 0
    let sourceChangePending = false
    const refresh = (sourceChanged: boolean) => {
      sourceChangePending = sourceChangePending || sourceChanged
      cancelAnimationFrame(frame)
      frame = requestAnimationFrame(() => {
        // 重编译后的旧节点已失去祖先作用域，不能用它清空 class 来源。
        // 内联值和源码范围仍会更新，下面的缓存失效与回显刷新不能跳过。
        if (target.isConnected) {
          const selectors = Array.from(new Set([
            zoneTab.baseSelector,
            ...Array.from(target.classList).map(name => '.' + name),
          ]))
          const tabs = mergeZoneTabsByState(collectZoneTabs([target], selectors, zoneOptions?.comId))
          const current = tabs.find(tab => tab.pseudo === zoneTab.pseudo)
          if (current) {
            refreshZoneTabSources(zoneTab, current)
          }
        }
        invalidateStyleResolution(zoneTab)
        setStyleRevision(revision => revision + 1)
        if (sourceChangePending) onStyleSourceChange?.()
        sourceChangePending = false
      })
    }
    const observer = new MutationObserver(records => {
      const sourceChanged = records.some(record => {
        const el = record.target.nodeType === 1 ? record.target as Element : record.target.parentElement
        return el?.tagName === 'STYLE' || el?.closest?.('style') ||
          Array.from(record.addedNodes).concat(Array.from(record.removedNodes))
            .some(node => node.nodeType === 1 && /^(STYLE|LINK)$/.test((node as Element).tagName))
      })
      const targetChanged = records.some(record => {
        if (record.type !== 'attributes') return false
        const el = record.target as Element
        return el.contains(target)
      })
      if (sourceChanged || targetChanged) refresh(sourceChanged)
    })
    observer.observe(target.getRootNode(), {
      subtree: true, childList: true, characterData: true,
      attributes: true, attributeFilter: ['style', 'class', 'data-style-info'],
    })
    return () => { observer.disconnect(); cancelAnimationFrame(frame) }
  }, [zoneTab, target, onStyleSourceChange])

  useEffect(() => {
    if (!zoneTab?.pseudo || !PREVIEW_PSEUDO_STATES.has(zoneTab.pseudo) || !target) return
    const doc = target.ownerDocument
    const view = doc.defaultView
    let frame = 0
    const refreshPreview = () => {
      view?.cancelAnimationFrame(frame)
      frame = view?.requestAnimationFrame(() => setPreviewRevision(revision => revision + 1)) ?? 0
    }
    const refreshStyle = () => setStyleRevision(revision => revision + 1)
    const events = ['pointerover', 'pointerout', 'pointerdown', 'pointerup', 'focusin', 'focusout']
    events.forEach(event => doc.addEventListener(event, refreshPreview, true))
    view?.addEventListener('resize', refreshStyle)
    return () => {
      events.forEach(event => doc.removeEventListener(event, refreshPreview, true))
      view?.removeEventListener('resize', refreshStyle)
      view?.cancelAnimationFrame(frame)
    }
  }, [zoneTab, target])

  // 追踪每次 handleChange 实际写入后的完整样式快照，
  // 替代 stale 的 setValue prop，作为渐变边框保护逻辑的数据源。
  const importantPriorityCacheRef = useRef(new Map<string, boolean>())
  const zoneWriteTargetsRef = useRef(new Map<string, ZoneWriteTarget>())
  const pendingSoloValuesRef = useRef(new Map<string, PendingSoloValue>())
  const liveStyleRef = useRef<Record<string, any>>(
    initLiveStyle(
      mergeAuthoredBoxModelValues(setValue || {}, isSoloEdit ? undefined : authoredStyle),
      (defaultValue as any) || {}
    )
  )

  // 当 setValue 被外部改写时，同步更新 liveStyleRef。
  useEffect(() => {
    liveStyleRef.current = initLiveStyle(
      mergeAuthoredBoxModelValues(setValue || {}, isSoloEdit ? undefined : authoredStyle),
      (defaultValue as any) || {}
    )
    if (isSoloEdit) {
      reconcilePendingSoloValues(pendingSoloValuesRef.current, setValue, liveStyleRef.current)
    }
  }, [setValue, authoredStyle, isSoloEdit])

  const handleChange = useCallback(
    (value: Parameters<ChangeEvent>[0], removeKeys?: readonly string[]) => {
      const previousLiveStyle = liveStyleRef.current
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
        removeKeys,
      })
      const { nextLiveStyle, applied } = result
      if (applied) {
        liveStyleRef.current = nextLiveStyle
        if (isSoloEdit) {
          const changes = Array.isArray(value) ? value : [value]
          recordPendingSoloValues(pendingSoloValuesRef.current, changes, previousLiveStyle, nextLiveStyle)
          removeKeys?.forEach(key => pendingSoloValuesRef.current.delete(key))
        }
        setStyleRevision(revision => revision + 1)
      }
      return result
    },
    [editConfig, options, collapsedOptions, preserveImportantPriority, onBatchMetaChange, isSoloEdit]
  )

  const applyStyleMutations = useCallback(
    (mutations: StyleMutation[]) =>
      handleChange(buildStyleMutationChange(mutations)),
    [handleChange]
  )

  const removeStyleProperties = useCallback(
    (keys: readonly string[]) => handleChange([], keys),
    [handleChange]
  )

  const panelEffectiveStyle = useMemo(() => {
    if (zoneTab?.pseudo) {
      return buildZoneStateStyle(
        zoneTab, Object.keys({ ...defaultValue, ...liveStyleRef.current, ...effectiveStyle }), target
      )
    }
    if (!isSoloEdit || !zoneTab) {
      if (!zoneTab?.excludedStyleKeys?.length) return effectiveStyle
      const resolution = getStyleResolution(zoneTab, target)
      const batchStyle = { ...effectiveStyle }
      zoneTab.excludedStyleKeys.forEach(key => {
        const item = batchStyle[key]
        const winner = resolution.get(key).winner
        if (item && winner) {
          batchStyle[key] = { ...item, computedValue: String(item.value ?? winner.value) }
        }
      })
      return batchStyle
    }

    const resolution = getStyleResolution(zoneTab, target)
    const styleValues: Record<string, unknown> = { ...defaultValue, ...liveStyleRef.current }
    Object.entries(effectiveStyle || {}).forEach(([key, item]) => {
      if (!(key in styleValues)) styleValues[key] = item.value ?? item.computedValue
    })
    Object.keys(styleValues).forEach(key => {
      const winner = resolution.get(key).winner
      if (winner) styleValues[key] = winner.value
      const pending = pendingSoloValuesRef.current.get(key)
      if (pending && setValue?.[pending.sourceKey] !== pending.sourceValue) {
        styleValues[key] = pending.value
      }
    })
    return buildZoneEffectiveStyle(zoneTab, styleValues, target)
  }, [zoneTab, isSoloEdit, defaultValue, effectiveStyle, setValue, target, styleRevision])

  // 仅样式来源更新时比较常规态依赖；鼠标进出只刷新预览，不重复扫描样式表。
  const normalStyleSignature = useMemo(() => zoneTab?.pseudo && PREVIEW_PSEUDO_STATES.has(zoneTab.pseudo)
    ? readNormalStyleSignature(target)
    : undefined,
    [target, zoneTab, styleRevision, setValue, authoredStyle, effectiveStyle, defaultValue]
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
      // 原有清除/联动预览保持语义；伪类的只读输入框回显走独立接口。
      if (zoneTab?.pseudo) return ''
      if (!realDom) return ''
      if (zoneTab?.excludedStyleKeys?.includes(key)) {
        return getStyleResolution(zoneTab, realDom).get(key).winner?.value ?? ''
      }
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
    // 真实交互态下不读取被污染的计算值。当前目标仅修改伪类规则时，
    // 常规态来源未变，可继续使用已有可信快照，避免其他字段瞬间变空。
    const normalComputed = zoneTab?.pseudo && PREVIEW_PSEUDO_STATES.has(zoneTab.pseudo)
      ? readNormalComputedStyle(realDom)
      : undefined
    const styleSources = [setValue, authoredStyle, effectiveStyle, defaultValue]
    const previousNormalPreview = normalPreviewRef.current
    const reusablePreview = previousNormalPreview &&
      previousNormalPreview.target === realDom &&
      previousNormalPreview.baseSelector === zoneTab?.baseSelector &&
      ((previousNormalPreview.styleRevision === styleRevision &&
        previousNormalPreview.styleSources.every((source, index) => source === styleSources[index])) ||
        (normalStyleSignature !== undefined && previousNormalPreview.normalStyleSignature === normalStyleSignature))
      ? previousNormalPreview.values
      : undefined
    const displayPreviewCache = normalComputed
      ? new Map<string, string | undefined>()
      : reusablePreview
    if (normalComputed && realDom && zoneTab) {
      normalPreviewRef.current = {
        target: realDom,
        baseSelector: zoneTab.baseSelector,
        styleRevision,
        styleSources,
        normalStyleSignature,
        values: displayPreviewCache!,
      }
    }
    const getStyleDisplayPreview = (key: string) => {
      if (!displayPreviewCache) return undefined
      const property = cssPropertyName(key)
      if (normalComputed && !displayPreviewCache.has(property)) {
        displayPreviewCache.set(property, normalComputed.getPropertyValue(property).trim() || undefined)
      }
      return displayPreviewCache.get(property)
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
      effectiveStyle: panelEffectiveStyle,
      applyStyleMutations,
      getStyleProperty: zoneTab && !isSoloEdit ? (key: string) => getStyleResolution(zoneTab, realDom).get(key) : undefined,
      getStyleClearPlans: zoneTab && !isSoloEdit ? (keys: readonly string[]) =>
        createBatchStyleClearPlans(keys, getStyleResolution(zoneTab, realDom), realDom) : undefined,
      removeStyleProperties: zoneTab && !isSoloEdit ? removeStyleProperties : undefined,
      getStyleRemovalState: zoneTab && !isSoloEdit ? (keys: readonly string[]) =>
        createStyleRemovalPlan(keys, getStyleResolution(zoneTab, realDom), realDom, liveStyleRef.current) : undefined,
      getStylePreview,
      getStyleDisplayPreview,
    }
  }, [
    editConfig,
    autoCollapseWhenUnusedProperty,
    authoredStyle,
    defaultValue,
    effectiveStyle,
    setValue,
    panelEffectiveStyle,
    applyStyleMutations,
    removeStyleProperties,
    zoneTab,
    isSoloEdit,
    styleRevision,
    previewRevision,
    normalStyleSignature,
  ])

  const panelValue = { ...defaultValue }
  if (zoneTab) {
    const resolution = getStyleResolution(zoneTab, target)
    Object.keys({ ...defaultValue, ...liveStyleRef.current }).forEach(key => {
      if (zoneTab.pseudo || isSoloEdit) {
        panelValue[key] = editorContext.effectiveStyle?.[key]?.value ?? defaultValue[key]
        return
      }
      const winner = resolution.get(key).winner
      const soloOnly = zoneTab.excludedStyleKeys?.includes(key) && !winner
      panelValue[key] = winner?.value ?? (soloOnly ? defaultValue[key] : (editorContext.getStylePreview(key) || defaultValue[key]))
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
