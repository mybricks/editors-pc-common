import React, { CSSProperties, useMemo } from 'react'

import { Panel, Slider } from '../../components'

import type { ChangeEvent, PanelBaseProps } from '../../type'

interface OpacityProps extends PanelBaseProps {
  value: CSSProperties
  onChange: ChangeEvent
}

export function Opacity ({ value, onChange, config, showTitle, collapse }: OpacityProps) {

  const defaultValue = useMemo(() => {
    return isNaN(parseFloat(value?.opacity as any)) ? 1 : parseFloat(value?.opacity as any)
  }, [value])

  return (
    <Panel title='不透明度' showTitle={showTitle} collapse={collapse}>
      <Panel.Content>
        <Slider
          defaultValue={defaultValue}
          onChange={(value) => onChange({key: 'opacity', value})}
        />
      </Panel.Content>
    </Panel>
  )
}