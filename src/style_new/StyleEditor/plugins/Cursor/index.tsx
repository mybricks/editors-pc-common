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

export function Cursor ({value, onChange, config, showTitle, collapse}: CursorProps) {
  const [forceRenderKey, setForceRenderKey] = useState<number>(Math.random())
  const [isReset, setIsReset] = useState(false)

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
            defaultValue={isReset ? undefined : value.cursor}
            options={CURSOR_OPTIONS}
            onChange={(value) => onChange({key: 'cursor', value})}
          />
        </React.Fragment>
      </Panel.Content>
    </Panel>
  )
}
