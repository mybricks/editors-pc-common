import React, { useCallback, useMemo, useRef, useState } from 'react'
// @ts-ignore
import MonacoEditor from '@mybricks/code-editor'

import { deepCopy } from '../utils'
import { parseToCssCode, parseToStyleData } from './core/css-code-codec'
import { fullScreenIcon } from './icon'
import css from './index.less'

const CSS_EDITOR_TITLE = 'CSS样式编辑'

function getDefaultValue({ value, selector }: any) {
  const styleValue = deepCopy(value.get() || {})
  return parseToCssCode(styleValue, selector)
}

export function CssEditor({
  popView,
  options,
  value,
  selector,
  onChange: onPropsChange,
  getDefaultOptions,
}: any) {
  const [cssValue, setCssValue] = useState(getDefaultValue({ value, selector }))
  const editorRef = useRef<MonacoEditor>(null)
  const defaultOptions = useMemo(() => getDefaultOptions?.('stylenew') ?? {}, [])
  const [context] = useState({ value: cssValue })

  const onMounted = useCallback((editor: any) => {
    editorRef.current = editor
  }, [])

  const onChange = useCallback((value: any) => {
    setCssValue(value)
    context.value = value
  }, [])

  const onBlur = useCallback(() => {
    const newStyleData = parseToStyleData(context.value, selector)
    onPropsChange(newStyleData)
  }, [])

  const onFullscreen = useCallback(() => {
    popView(
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
  }, [cssValue])

  return (
    <div className={css.codeWrap}>
      <div className={css.inlineWrap}>
        <div className={css.body}>
          <div data-mybricks-tip="放大" className={css.plus} onClick={onFullscreen}>
            {fullScreenIcon}
          </div>
          {monaco}
        </div>
      </div>
    </div>
  )
}
