import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
// @ts-ignore
import MonacoEditor from '@mybricks/code-editor'

import { deepCopy } from '../utils'
import { applyStyleChange } from './core/apply-style-change'
import {
  diffStyleData,
  filterStyleForCssCode,
  parseToCssCode,
  parseToStyleData,
  resolveDisplaySelector,
  toLine,
} from './core/css-code-codec'
import { registerCSSPropertiesLanguage } from './css-properties-language'
import { fullScreenIcon } from './icon'
import css from './index.less'

const CSS_EDITOR_TITLE = 'CSS样式编辑'

export function CssEditor({
  popView,
  selector,
  initialStyle,
  editConfig,
  collapsedOptions,
  onBatchMetaChange,
  getDefaultOptions,
}: any) {
  const displaySelector = resolveDisplaySelector(selector)
  // baseline：编辑器回显快照，用于 blur 时 diff（含 CSSOM 回显值）
  // liveStyle：与可视化一致，只累积真正写入过的属性，避免把计算样式整包写进 less
  const [baselineStyle] = useState(() => filterStyleForCssCode(deepCopy(initialStyle || {})))
  const [cssValue, setCssValue] = useState(() => parseToCssCode(baselineStyle, displaySelector))
  const editorRef = useRef<MonacoEditor>(null)
  const baselineRef = useRef<Record<string, any>>(baselineStyle)
  const liveStyleRef = useRef<Record<string, any>>({})
  const defaultOptions = useMemo(() => getDefaultOptions?.('stylenew') ?? {}, [])
  const contextRef = useRef({ value: cssValue })
  const [editorHeight, setEditorHeight] = useState(300)
  const dragStartRef = useRef<{ y: number; h: number } | null>(null)

  const handleDragMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault()
    dragStartRef.current = { y: e.clientY, h: editorHeight }
    document.body.style.cursor = 'ns-resize'
    document.body.style.userSelect = 'none'

    const onMouseMove = (ev: MouseEvent) => {
      if (!dragStartRef.current) return
      const delta = ev.clientY - dragStartRef.current.y
      setEditorHeight(Math.max(80, dragStartRef.current.h + delta))
    }
    const onMouseUp = () => {
      dragStartRef.current = null
      document.body.style.cursor = ''
      document.body.style.userSelect = ''
      document.removeEventListener('mousemove', onMouseMove)
      document.removeEventListener('mouseup', onMouseUp)
    }
    document.addEventListener('mousemove', onMouseMove)
    document.addEventListener('mouseup', onMouseUp)
  }, [editorHeight])

  const onMounted = useCallback((editor: any, monaco: any) => {
    editorRef.current = editor
    registerCSSPropertiesLanguage(monaco)
  }, [])

  const onChange = useCallback((value: any) => {
    setCssValue(value)
    contextRef.current.value = value
  }, [])

  const onBlur = useCallback(() => {
    const nextStyle = parseToStyleData(contextRef.current.value, displaySelector)
    const changes = diffStyleData(baselineRef.current, nextStyle)
    if (changes.length === 0) return

    // 先检查本批是否有无效的新增/修改（属性名或值不合法）
    // CSS 变量（--xxx）和 var() 引用跳过校验
    const isInvalidChange = ({ key, value }: { key: string; value: any }) => {
      if (value === null) return false
      const prop = toLine(key)
      const strVal = String(value).replace(/\s*!important\s*$/, '').trim()
      if (prop.startsWith('--') || strVal.includes('var(')) return false
      if (typeof CSS === 'undefined') return false
      return !CSS.supports(prop, strVal)
    }
    const hasInvalidAdditions = changes.some(isInvalidChange)

    // 有无效新增时，删除操作一并拦截（防止 color→color11(无效) 意外删掉 color）
    // 无效的新增/修改本身始终跳过；有效变更正常写入
    const validChanges = changes.filter(({ key, value }) => {
      if (value === null) return !hasInvalidAdditions
      return !isInvalidChange({ key, value })
    })

    if (validChanges.length === 0) return

    const { nextLiveStyle, applied } = applyStyleChange({
      value: validChanges,
      liveStyle: liveStyleRef.current,
      collapsedOptions,
      editConfig,
      onBatchMetaChange,
    })

    if (applied) {
      liveStyleRef.current = nextLiveStyle
      // baseline 与编辑器内容对齐，供下次 diff
      baselineRef.current = filterStyleForCssCode(nextStyle)
    }
  }, [displaySelector, collapsedOptions, editConfig, onBatchMetaChange])

  const onFullscreen = useCallback(() => {
    popView?.(
      CSS_EDITOR_TITLE,
      () => {
        return <div className={css.modal}>{monaco}</div>
      },
      {
        onClose: () => {
          // const val = editorRef.current?.getValue();
        },
      }
    )
  }, [cssValue])

  const monaco = useMemo(() => {
    return (
      <MonacoEditor
        height="100%"
        onMounted={onMounted}
        value={cssValue}
        onChange={onChange}
        CDN={defaultOptions.CDN}
        onBlur={onBlur}
        language="css"
      />
    )
  }, [cssValue, onBlur, onChange, onMounted, defaultOptions.CDN])

  return (
    <div className={css.codeWrap}>
      <div className={css.inlineWrap}>
        <div className={css.body} style={{ height: editorHeight }}>
          <div data-mybricks-tip="放大" className={css.plus} onClick={onFullscreen}>
            {fullScreenIcon}
          </div>
          {monaco}
        </div>
        <div className={css.dragHandle} onMouseDown={handleDragMouseDown} />
      </div>
    </div>
  )
}
