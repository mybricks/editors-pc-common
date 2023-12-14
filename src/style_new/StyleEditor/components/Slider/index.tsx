import React, { useCallback, useState } from 'react'

import type { CSSProperties } from 'react'

import { Panel } from '../'

import css from './index.less'

interface SliderProps {
  defaultValue: number
  onChange: (value: number) => void
  style?: CSSProperties
}

export function Slider ({
  defaultValue,
  onChange,
  style
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
      </div>
    </Panel.Item>
  )
}