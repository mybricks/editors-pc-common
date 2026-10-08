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
import { buildZoneStateStyle, collectZoneTabs, mergeZoneTabsByState } from './core/zone-tab'
import type { ZoneTab } from './core/zone-tab'
import { expandFourShorthand } from './core/shorthand-normalizer'
import { readNormalComputedStyle, readNormalStyleSignature } from './core/normal-style-preview'

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
  const target = (toElementArray(zoneOptions?.targetDom)[0] ?? null) as HTMLElement | null

  useEffect(() => {
    if (!zoneTab || !target) return
    let frame = 0
    const refresh = () => {
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
            zoneTab.sourceRules = current.sourceRules
            zoneTab.baseRules = current.baseRules
          }
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

  const handleChange = useCallback(
    (value: Parameters<ChangeEvent>[0], removeKeys?: readonly string[]) => {
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

  const removeStyleProperties = useCallback(
    (keys: readonly string[]) => handleChange([], keys),
    [handleChange]
  )

  const panelEffectiveStyle = useMemo(() => zoneTab?.pseudo
    ? buildZoneStateStyle(
        zoneTab, Object.keys({ ...defaultValue, ...liveStyleRef.current, ...effectiveStyle }), target
      )
    : effectiveStyle,
    [zoneTab, defaultValue, effectiveStyle, setValue, target, styleRevision]
  )

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
      langType: (window as any).__lang_type__,
      effectiveStyle: panelEffectiveStyle,
      applyStyleMutations,
      getStyleProperty: zoneTab ? (key: string) => getStyleResolution(zoneTab, realDom).get(key) : undefined,
      getStyleClearPlans: zoneTab ? (keys: readonly string[]) =>
        createBatchStyleClearPlans(keys, getStyleResolution(zoneTab, realDom), realDom) : undefined,
      removeStyleProperties: zoneTab ? removeStyleProperties : undefined,
      getStyleRemovalState: zoneTab ? (keys: readonly string[]) =>
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
    styleRevision,
    previewRevision,
    normalStyleSignature,
  ])

  const panelValue = { ...defaultValue }
  if (zoneTab) {
    const resolution = getStyleResolution(zoneTab, target)
    Object.keys({ ...defaultValue, ...liveStyleRef.current }).forEach(key => {
      if (zoneTab.pseudo) {
        panelValue[key] = editorContext.effectiveStyle?.[key]?.value
        return
      }
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
