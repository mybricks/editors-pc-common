import React, { useCallback, useEffect, useMemo, useRef } from 'react'

import { deepCopy } from '../utils'
import StyleEditor, { StyleEditorProvider } from './StyleEditor'
import { initLiveStyle } from './StyleEditor/helper/gradient-border'
import type { ChangeEvent } from './StyleEditor/type'
import type { EditorProps } from './type'
import { applyStyleChange } from './core/apply-style-change'
import type { ZoneWriteTarget } from './core/apply-style-change'
import { toElementArray } from './core/dom'
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
  collapsedOptions,
  readonlyExpandedOptions,
  autoCollapseWhenUnusedProperty,
  finnalExcludeOptions,
  defaultValue,
  preserveImportantPriority,
  onBatchMetaChange,
}: StyleProps) {
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
      }
      return result
    },
    [editConfig, options, collapsedOptions, preserveImportantPriority, onBatchMetaChange]
  )

  const editorContext = useMemo(() => {
    const dom =
      !editConfig.options || Array.isArray(editConfig.options)
        ? null
        : (editConfig.options as any).targetDom ?? null
    const realDom = (toElementArray(dom)[0] ?? null) as HTMLElement | null
    const CDN = (editConfig as any).getDefaultOptions?.('stylenew')?.CDN
    return {
      editConfig: {
        ...editConfig,
        CDN,
      },
      autoCollapseWhenUnusedProperty,
      targetDom: realDom,
      authoredStyle,
    }
  }, [editConfig, autoCollapseWhenUnusedProperty, authoredStyle])

  return (
    <StyleEditorProvider value={editorContext}>
      <StyleEditor
        defaultValue={defaultValue}
        options={options}
        finnalExcludeOptions={finnalExcludeOptions}
        collapsedOptions={collapsedOptions}
        readonlyExpandedOptions={readonlyExpandedOptions}
        onChange={handleChange}
      />
    </StyleEditorProvider>
  )
}
