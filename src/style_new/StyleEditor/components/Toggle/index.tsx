import React, {
  useState,
  ReactNode,
  useCallback,
  CSSProperties
} from 'react'

import { Panel } from '../'

import css from './index.less'

interface ToggleProps {
  defaultValue?: any
  style?: CSSProperties
  onChange: (value: any) => void
  options: Array<{label: ReactNode, value: any}>
}

export function Toggle ({
  defaultValue,
  style = {},
  onChange,
  options
}: ToggleProps) {
  const [toggleIndex, setToggleIndex] = useState(options.findIndex(({value}) => value === defaultValue))

  const handleItemClick = useCallback((clickValue, clickIndex) => {
    setToggleIndex((toggleIndex) => {
      if (toggleIndex !== clickIndex) {
        onChange(clickValue)
      }
      return clickIndex
    })
  }, [])

  return (
    <Panel.Item style={{padding: 2, ...style}}>
      <div className={css.toggle}>
        {options.map((option, index) => {
          const { value, label } = option
          return (
            <div
              key={index}
              className={css.item}
              onClick={() => handleItemClick(value, index)}
            >
              {!index && <MoveBlock index={toggleIndex}/>}
              <div className={css.label}>{label}</div>
            </div>
          )
        })}
      </div>
    </Panel.Item>
  )
}

function MoveBlock ({index}: {index: number}) {
  return (
    <div
      className={css.moveBlock}
      style={{
        visibility: index === -1 ? 'hidden' : 'visible',
        transform: `translateX(calc(${100 * index}% + ${2 * index}px))`
      }}
    />
  )
}
