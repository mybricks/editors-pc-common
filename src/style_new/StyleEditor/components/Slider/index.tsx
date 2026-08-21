import React, { useCallback, useState } from 'react'

import type { CSSProperties } from 'react'

import { Panel } from '../'
import { Variable } from '../../icons/Variable'

import css from './index.less'

interface SliderProps {
  defaultValue: number
  onChange: (value: number) => void
  style?: CSSProperties
  hasVariables?: boolean
  onApplyVariable?: () => void
}

export function Slider ({
  defaultValue,
  onChange,
  style,
  hasVariables,
  onApplyVariable,
}: SliderProps) {
  const [value, setValue] = useState(defaultValue)

  const onInputChange = useCallback((e) => {
    const value = Number(e.target.value)
    setValue(value > 1 ? 1 : value)
    onChange(value)
  }, [])

  return (
    <Panel.Item style={style}>
      <div className={css.slider}>
        <input
          type='range'
          min={0}
          max={1}
          step={0.01}
          value={value}
          onChange={onInputChange}
        />
        <input
          min={0}
          max={1}
          step={0.01}
          type='number'
          value={value}
          onChange={onInputChange}
        />
        {hasVariables && (
          <span
            className={css.varBtn}
            data-mybricks-tip='应用变量...'
            onClick={onApplyVariable}
          >
            <Variable />
          </span>
        )}
      </div>
    </Panel.Item>
  )
}
