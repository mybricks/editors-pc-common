import React, { CSSProperties } from 'react'

import { Panel, Slider } from '../../components'

import type { ChangeEvent } from '../../type'

interface OpacityProps {
  value: CSSProperties
  onChange: ChangeEvent
  config: {
    [key: string]: any
  }
}

export function Opacity ({ value, onChange, config }: OpacityProps) {
  return (
    <Panel title='不透明度'>
      <Panel.Content>
        <Slider
          defaultValue={typeof value.opacity === 'number' ? value.opacity : 1}
          onChange={(value) => onChange({key: 'opacity', value})}
        />
      </Panel.Content>
    </Panel>
  )
}