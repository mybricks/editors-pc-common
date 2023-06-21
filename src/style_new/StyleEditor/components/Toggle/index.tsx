import React, {
  useState,
  ReactNode,
  useCallback,
  CSSProperties
} from 'react'

import { Panel } from '../'

import css from './index.less'
import { useUpdateEffect } from '../../hooks'

interface ToggleProps {
  defaultValue?: any
  style?: CSSProperties
  onChange: (value: any) => void
  options: Array<{label: ReactNode, value: any, tip?: string}>
}

export function Toggle ({
  defaultValue,
  style = {},
  onChange,
  options
}: ToggleProps) {
  const [toggleIndex, setToggleIndex] = useState(options.findIndex(({value}) => value === defaultValue))

  const handleItemClick = useCallback((index) => {
    setToggleIndex(index)
  }, [])

  useUpdateEffect(() => {
    onChange(options[toggleIndex].value)
  }, [toggleIndex])

  return (
    <Panel.Item style={{padding: 2, ...style}}>
      <div className={css.toggle}>
        {options.map((option, index) => {
          const { value, label, tip } = option
          return (
            <div
              data-mybricks-tip={tip}
              key={index}
              className={css.item}
              onClick={() => handleItemClick(index)}
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
