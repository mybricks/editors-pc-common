import React, { useCallback, useEffect, useMemo, useRef } from 'react'

import { deepCopy } from '../utils'
import StyleEditor, { StyleEditorProvider } from './StyleEditor'
import { initLiveStyle } from './StyleEditor/helper/gradient-border'
import type { ChangeEvent } from './StyleEditor/type'
import type { EditorProps } from './type'
import { applyStyleChange } from './core/apply-style-change'
import { toElementArray } from './core/dom'

interface StyleProps extends EditorProps {
  [key: string]: any
}

export function StyleMount({
  editConfig,
  options,
  setValue,
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
  const liveStyleRef = useRef<Record<string, any>>(
    initLiveStyle(deepCopy(setValue || {}), (defaultValue as any) || {})
  )

  // 当 setValue 被外部改写时，同步更新 liveStyleRef。
  useEffect(() => {
    liveStyleRef.current = initLiveStyle(deepCopy(setValue || {}), (defaultValue as any) || {})
  }, [setValue])

  const handleChange: ChangeEvent = useCallback(
    (value) => {
      const { nextLiveStyle, applied } = applyStyleChange({
        value: value as any,
        liveStyle: liveStyleRef.current,
        collapsedOptions,
        editConfig,
        options,
        preserveImportantPriority,
        importantPriorityCache: importantPriorityCacheRef.current,
        onBatchMetaChange,
      })
      if (applied) {
        liveStyleRef.current = nextLiveStyle
      }
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
    }
  }, [editConfig, autoCollapseWhenUnusedProperty])

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
