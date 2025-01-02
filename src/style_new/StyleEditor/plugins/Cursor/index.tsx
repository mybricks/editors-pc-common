import React, { CSSProperties } from 'react'

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

export function Cursor ({value, onChange, config, showTitle, collapse}: CursorProps) {
  return (
    <Panel title='光标' showTitle={showTitle} collapse={collapse}>
      <Panel.Content>
        <Select
          style={{padding: 0}}
          defaultValue={value.cursor}
          options={CURSOR_OPTIONS}
          onChange={(value) => onChange({key: 'cursor', value})}
        />
      </Panel.Content>
    </Panel>
  )
}
