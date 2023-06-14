import React, {
  ReactNode,
  CSSProperties,
  useState,
  useCallback
} from 'react'

import { Panel } from '../'

import css from './index.less'

interface SwitchProps {
  defaultValue?: boolean
  style?: CSSProperties
  children: ReactNode
  onChange: (value: boolean) => void
}

export function Switch ({
  style = {},
  children,
  defaultValue,
  onChange
}: SwitchProps) {
  const [switchValue, setSwitchValue] = useState(!!defaultValue)

  const handleClick = useCallback(() => {
    setSwitchValue(!switchValue)
    onChange(!switchValue)
  }, [switchValue])

  return (
    <Panel.Item className={css.switch} style={{...style, ...(switchValue ? {} : {backgroundColor: 'transparent'})}} onClick={handleClick}>
      {children}
    </Panel.Item>
  )
}
