import React, {
  ReactNode,
  CSSProperties,
  useState,
  useCallback
} from 'react'

import { Panel } from '../'

import css from './index.less'

export interface InputProps {
  prefix?: ReactNode
  suffix?: ReactNode
  defaultValue?: string | number
  value?: string | number
  style?: CSSProperties
  onChange: (value: string) => void
  disabled?: boolean
  onFocus?: React.FocusEventHandler<HTMLInputElement>
  onKeyDown?: React.KeyboardEventHandler<HTMLInputElement>
  tip?: string
}

export function Input ({
  defaultValue,
  onChange,
  value,
  prefix,
  suffix,
  style = {},
  disabled = false,
  onFocus = () => {},
  onKeyDown = () => {},
  tip
}: InputProps) {
  const [inputValue, setInputValue] = useState(defaultValue)

  const handleInputChange = useCallback((event) => {
    const value = event.target.value

    setInputValue(value)
    onChange?.(value)
  }, [])

  return (
    <Panel.Item style={style}>
      <div className={css.input} data-mybricks-tip={tip}>
        {prefix && <div className={css.prefix}>{prefix}</div>}
        <input
          value={value || inputValue}
          onChange={handleInputChange}
          disabled={disabled}
          onFocus={onFocus}
          onKeyDown={onKeyDown}
        />
        {suffix && <div className={css.suffix}>{suffix}</div>}
      </div>
    </Panel.Item>
  )  
}
