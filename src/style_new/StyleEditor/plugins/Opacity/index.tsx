import React, { CSSProperties } from 'react'

import { Panel, Slider } from '../../components'

import type { ChangeEvent, PanelBaseProps } from '../../type'

interface OpacityProps extends PanelBaseProps {
  value: CSSProperties
  onChange: ChangeEvent
}

export function Opacity ({ value, onChange, config, showTitle, collapse }: OpacityProps) {
  return (
    <Panel title='不透明度' showTitle={showTitle} collapse={collapse}>
      <Panel.Content>
        <Slider
          defaultValue={typeof value.opacity === 'number' ? value.opacity : 1}
          onChange={(value) => onChange({key: 'opacity', value})}
        />
      </Panel.Content>
    </Panel>
  )
}