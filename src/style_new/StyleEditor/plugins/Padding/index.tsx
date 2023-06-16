import React, { CSSProperties } from 'react'

import {
  Panel,
  Input,
  InputNumber,
  PaddingTopOutlined,
  PaddingLeftOutlined,
  PaddingRightOutlined,
  PaddingBottomOutlined
} from '../../components'
import { useInputNumberObject } from '../../hooks'

import type { ChangeEvent } from '../../type'

import css from './index.less'

interface PaddingProps {
  value: CSSProperties
  onChange: ChangeEvent
  config: {
    [key: string]: any
  }
}

export function Padding ({value, onChange, config}: PaddingProps) {
  return (
    <Panel title='内边距'>
      <Panel.Content>
        <Panel.Item style={{padding: 0, backgroundColor: 'transparent'}}>
          <div className={css.editArea}>
            <InputNumber
              prefix={<PaddingTopOutlined />}
              defaultValue={value.paddingTop}
              onChange={(value) => onChange({key: 'paddingTop', value})}
            />
            <InputNumber
              prefix={<PaddingRightOutlined />}
              defaultValue={value.paddingRight}
              onChange={(value) => onChange({key: 'paddingRight', value})}
            />
          </div>
        </Panel.Item>
      </Panel.Content>
      <Panel.Content>
        <Panel.Item style={{padding: 0, backgroundColor: 'transparent'}}>
          <div className={css.editArea}>
            <InputNumber
              prefix={<PaddingBottomOutlined />}
              defaultValue={value.paddingBottom}
              onChange={(value) => onChange({key: 'paddingBottom', value})}
            />
            <InputNumber
              prefix={<PaddingLeftOutlined />}
              defaultValue={value.paddingLeft}
              onChange={(value) => onChange({key: 'paddingLeft', value})}
            />
          </div>
        </Panel.Item>
      </Panel.Content>
    </Panel>
  )
}

