import React, { CSSProperties } from 'react'

import { Panel, Slider } from '../../components'

import type { ChangeEvent } from '../../type'

interface OpacityProps {
  value: CSSProperties
  onChange: ChangeEvent
  config: {
    [key: string]: any
  }
  showTitle: boolean;
}

export function Opacity ({ value, onChange, config, showTitle }: OpacityProps) {
  return (
    <Panel title='不透明度' showTitle={showTitle}>
      <Panel.Content>
        <Slider
          defaultValue={typeof value.opacity === 'number' ? value.opacity : 1}
          onChange={(value) => onChange({key: 'opacity', value})}
        />
      </Panel.Content>
    </Panel>
  )
}