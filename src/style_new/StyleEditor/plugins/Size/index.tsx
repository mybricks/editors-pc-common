import React, { useState, CSSProperties } from 'react'

import {
  Panel,
  InputNumber,
  WidthOutlined,
  HeightOutlined
} from '../../components'

import type { ChangeEvent } from '../../type'

const UNIT_OPTIONS = [
  {label: '%', value: '%'},
  {label: 'px', value: 'px'},
  {label: '继承', value: 'inherit'},
  {label: '默认', value: 'auto'}
]
const UNIT_DISABLED_LIST = ['auto', 'inherit']

interface SizeProps {
  value: CSSProperties
  onChange: ChangeEvent
  config: {
    [key: string]: any
  }
}

const DEFAULT_CONFIG = {
  disableWidth: false,
  disableHeight: false
}

export function Size ({value, onChange, config}: SizeProps) {
  const [cfg] = useState(Object.assign(DEFAULT_CONFIG, config))

  return (
    <Panel title='尺寸'>
      <Panel.Content>
        {cfg.disableWidth ? null : (
          <InputNumber
            tip='宽'
            prefix={<WidthOutlined />}
            defaultValue={value.width}
            unitOptions={UNIT_OPTIONS}
            unitDisabledList={UNIT_DISABLED_LIST}
            onChange={(value) => onChange({key: 'width', value})}
          />
        )}
        {cfg.disableHeight ? null : (
          <InputNumber
            tip='高'
            prefix={<HeightOutlined />}
            defaultValue={value.height}
            unitOptions={UNIT_OPTIONS}
            unitDisabledList={UNIT_DISABLED_LIST}
            onChange={(value) => onChange({key: 'height', value})}
          />
        )}
      </Panel.Content>
    </Panel>
  )
}
