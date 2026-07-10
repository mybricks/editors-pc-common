import React, { CSSProperties, useCallback, useEffect, useState } from 'react'

import { Panel, Select } from '../../components'

import type { ChangeEvent, PanelBaseProps } from '../../type'

interface CursorProps extends PanelBaseProps {
  value: CSSProperties
  onChange: ChangeEvent
}

const CURSOR_OPTIONS = [
  {label: '帮助', value: 'help'},
  {label: '手', value: 'pointer'},
  {label: '文本可选中', value: 'text'},
  {label: '不可点击', value: 'not-allowed'},
  {label: '继承', value: 'inherit'},
  {label: '默认', value: 'default'},
]

// tooltip 内容过长时做截断，避免超长 dataURI 把浮层撑爆
const MAX_TIP_LENGTH = 300

export function Cursor ({value, onChange, config, showTitle, collapse}: CursorProps) {
  const [forceRenderKey, setForceRenderKey] = useState<number>(Math.random())
  const [isReset, setIsReset] = useState(false)

  const cursorValue = value?.cursor
  // 自定义光标（如 cursor: url("data:image/svg+xml;base64,...") ...）不在预置选项中，
  // 若直接把这段超长原始字符串丢给 Select 展示，会被截断成一堆看似乱码的字符。
  // 这里临时补一个"自定义"选项，让 Select 能匹配到，展示为友好文案，完整值通过 tip 提示。
  const isCustomCursor = typeof cursorValue === 'string'
    && cursorValue.length > 0
    && !CURSOR_OPTIONS.some(({value}) => value === cursorValue)
  const options = isCustomCursor
    ? [{label: '自定义', value: cursorValue}, ...CURSOR_OPTIONS]
    : CURSOR_OPTIONS
  const tip = isCustomCursor
    ? `{content:'自定义光标：${
        cursorValue.length > MAX_TIP_LENGTH ? `${cursorValue.slice(0, MAX_TIP_LENGTH)}...` : cursorValue
      }',position:'top'}`
    : undefined

  useEffect(() => {
    if (isReset && value?.cursor != null) {
      setIsReset(false)
    }
  }, [value, isReset])

  const refresh = useCallback(() => {
    onChange({ key: 'cursor', value: null })
    setIsReset(true)
    setForceRenderKey(prev => prev + 1)
  }, [onChange])

  return (
    <Panel title='光标' showTitle={showTitle} showReset={true} resetFunction={refresh} collapse={collapse}>
      <Panel.Content>
        <React.Fragment key={forceRenderKey}>
          <Select
            style={{padding: 0}}
            defaultValue={isReset ? undefined : cursorValue}
            options={options}
            tip={tip}
            onChange={(value) => onChange({key: 'cursor', value})}
          />
        </React.Fragment>
      </Panel.Content>
    </Panel>
  )
}
