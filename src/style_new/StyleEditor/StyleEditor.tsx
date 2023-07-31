import React, { useMemo, useCallback } from 'react'

import {
  Font,
  Size,
  Cursor,
  Border,
  Padding,
  BoxShadow,
  Background,
  OverFlow
} from './plugins'

import type { StyleEditorProps } from './type'

import css from './StyleEditor.less'

const PLUGINS_MAP = {
  FONT: Font,
  SIZE: Size,
  CURSOR: Cursor,
  BORDER: Border,
  PADDING: Padding,
  BOXSHADOW: BoxShadow,
  BACKGROUND: Background,
  OverFlow: OverFlow
}

export default function ({defaultValue, options, onChange}: StyleEditorProps) {
  
  const handleValueChange: StyleEditorProps['onChange'] = useCallback((value) => {
    onChange(value)
  }, [])

  const editors = useMemo(() => {
    return options.map((option, index) => {
      let JSX
      let config = {}

      if (typeof option === 'string') {
        JSX = PLUGINS_MAP[option.toUpperCase() as keyof typeof PLUGINS_MAP]
      } else {
        JSX = PLUGINS_MAP[option.type.toUpperCase() as keyof typeof PLUGINS_MAP]
        config = option.config || config
      }
      
      return JSX && <JSX key={index} value={defaultValue} onChange={handleValueChange} config={config} />
    })
  }, [])

  return (
    <div className={css.style}>
      {editors}
    </div>
  )
}
