import React, {
  useMemo,
  useState,
  useCallback,
  CSSProperties
} from 'react'

import ColorUtil from 'color'

import { Panel, Colorpicker } from '../'

import css from './index.less'

interface ColorEditorProps {
  defaultValue: any
  style?: CSSProperties
  onChange: (value: any) => void
  tip?: string
}

export function ColorEditor ({
  defaultValue,
  style = {},
  onChange,
  tip
}: ColorEditorProps) {
  const [value, setValue] = useState(getHex(defaultValue))
  const [finalValue, setFinalValue] = useState(value)

  const handleInputChange = useCallback((e) => {
    const value = e.target.value
    setValue(value)
    try {
      const hex = getHex(value)
      setFinalValue(hex)
      onChange(hex)
    } catch {}
  }, [])

  const handleInputBlur = useCallback(() => {
    if (value !== finalValue) {
      setValue(finalValue)
    }
  }, [value, finalValue])

  const handleColorpickerChange = useCallback((color) => {
    const hex = getHex(color.hexa)
    setValue(hex)
    setFinalValue(hex)
    onChange(hex)
  }, [])

  const input = useMemo(() => {
    return (
      <input
        value={value}
        className={css.input}
        onChange={handleInputChange}
        onBlur={handleInputBlur}
      />
    )
  }, [value])

  const block = useMemo(() => {
    return (
      <Colorpicker value={finalValue} onChange={handleColorpickerChange}>
        <div
          className={css.block}
          style={{
            background: new ColorUtil(finalValue).alpha() !== 0 ? finalValue : 'url("data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAYAAAAf8/9hAAAAAXNSR0IArs4c6QAAADFJREFUOE9jZGBgEGHAD97gk2YcNYBhmIQBgWSAP52AwoAQwJvQRg1gACckQoC2gQgAIF8IscwEtKYAAAAASUVORK5CYII=") left center, white'
          }}
        />
      </Colorpicker>
    )
  }, [finalValue])

  return (
    <Panel.Item style={style}>
      <div className={css.color} data-mybricks-tip={tip}>
        {block}
        {input}
      </div>
    </Panel.Item>
  )
}

const getHex = (str: string) => {
  const color = new ColorUtil(str)
  return (color.alpha() === 1 ? color.hex() : color.hexa()).toLowerCase()
}
