import React, { CSSProperties } from 'react'

import { Panel, Select } from '../../components'

import type { ChangeEvent } from '../../type'

interface CursorProps {
  value: CSSProperties
  onChange: ChangeEvent
  config: {
    [key: string]: any
  }
}

const CURSOR_OPTIONS = [
  {label: '继承', value: 'inherit'},
  {label: '默认', value: 'default'},
  {label: '帮助', value: 'help'},
  {label: '手', value: 'pointer'},
  {label: '文本可选中', value: 'text'},
  {label: '不可点击', value: 'not-allowed'}
]

export function Cursor ({value, onChange, config}: CursorProps) {
  return (
    <Panel title='光标'>
      <Panel.Content>
        <Select
          style={{padding: 0}}
          defaultValue={value.cursor}
          options={CURSOR_OPTIONS}
          onChange={(value) => onChange({key: 'cursor', value})}
        />
      </Panel.Content>
      光标配置
    </Panel>
  )
}
