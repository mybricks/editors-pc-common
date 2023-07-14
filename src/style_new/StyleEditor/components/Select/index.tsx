import React, {
  useState,
  ReactNode,
  useCallback,
  CSSProperties
} from 'react'

import { Panel, Dropdown, DownOutlined } from '../'

import css from './index.less'

interface SelectProps {
  prefix?: ReactNode
  defaultValue: any
  style?: CSSProperties
  onChange: (value: any) => void
  options: Array<{value: any, label: string | number}>
  /** 是否展示下拉的icon */
  showIcon?: boolean
  labelClassName?: string
  tip?: string
}

export function Select ({
  prefix,
  defaultValue,
  style = {},
  onChange,
  options,
  showIcon = true,
  labelClassName,
  tip
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
        <div data-mybricks-tip={tip} className={css.select} style={showIcon ? {} : {padding: 0}}>
          {prefix && <div className={css.prefix}>{prefix}</div>}
          <div className={`${css.value}${labelClassName ? ` ${labelClassName}` : ''}`}>{label}</div>
          {showIcon && <span className={css.icon}>
            <DownOutlined />
          </span>}
        </div>
      </Dropdown>
    </Panel.Item>
  )
}
