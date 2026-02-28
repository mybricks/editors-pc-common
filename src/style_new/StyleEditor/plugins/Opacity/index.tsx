import React, { CSSProperties, useCallback, useEffect, useMemo, useState } from 'react'

import { Panel, Slider } from '../../components'

import type { ChangeEvent, PanelBaseProps } from '../../type'

interface OpacityProps extends PanelBaseProps {
  value: CSSProperties
  onChange: ChangeEvent
}

export function Opacity ({ value, onChange, config, showTitle, collapse }: OpacityProps) {
  const [forceRenderKey, setForceRenderKey] = useState<number>(Math.random())
  const [isReset, setIsReset] = useState(false)

  const defaultValue = useMemo(() => {
    if (isReset) return 1
    return isNaN(parseFloat(value?.opacity as any)) ? 1 : parseFloat(value?.opacity as any)
  }, [value, isReset])

  useEffect(() => {
    if (isReset && value?.opacity != null) {
      setIsReset(false)
    }
  }, [value, isReset])

  const refresh = useCallback(() => {
    onChange({ key: 'opacity', value: null })
    setIsReset(true)
    setForceRenderKey(prev => prev + 1)
  }, [onChange])

  return (
    <Panel title='不透明度' showTitle={showTitle} showReset={true} resetFunction={refresh} collapse={collapse}>
      <Panel.Content>
        <React.Fragment key={forceRenderKey}>
          <Slider
            defaultValue={defaultValue}
            onChange={(value) => onChange({key: 'opacity', value})}
          />
        </React.Fragment>
      </Panel.Content>
    </Panel>
  )
}