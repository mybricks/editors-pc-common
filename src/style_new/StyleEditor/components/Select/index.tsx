import React, {
  useState,
  useCallback,
  CSSProperties
} from 'react'

import { Panel, Dropdown, DownOutlined } from '../'

import css from './index.less'

interface SelectProps {
  defaultValue: any
  style?: CSSProperties
  onChange: (value: any) => void
  options: Array<{value: any, label: string | number}>
  /** 是否展示下拉的icon */
  showIcon?: boolean
  labelClassName?: string
}

export function Select ({
  defaultValue,
  style = {},
  onChange,
  options,
  showIcon = true,
  labelClassName
}: SelectProps) {
  const [label, setLabel] = useState(options.find(({value}) => value === defaultValue)?.label || defaultValue)
  const [value, setValue] = useState(defaultValue)

  const handleDropDownClick = useCallback((clickValue) => {
    setValue((value: any) => {
      if (value !== clickValue) {
        setLabel(options.find(({value}) => value === clickValue)!.label)
        onChange(clickValue)
      }

      return clickValue
    })
  }, [])

  return (
    <Panel.Item style={style}>
      <Dropdown options={options} value={value} onClick={handleDropDownClick}>
        <div className={css.select} style={showIcon ? {} : {padding: 0}}>
          <div className={`${css.value}${labelClassName ? ` ${labelClassName}` : ''}`}>{label}</div>
          {showIcon && <span className={css.icon}>
            <DownOutlined />
          </span>}
        </div>
      </Dropdown>
    </Panel.Item>
  )
}
