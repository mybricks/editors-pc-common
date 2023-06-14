import React, {
  CSSProperties
} from 'react'

import {
  Panel,
  Input,
  Select,
  ColorEditor,
  BorderTopWidthOutlined,
  BorderLeftWidthOutlined,
  BorderRightWidthOutlined,
  BorderBottomWidthOutlined,
  BorderTopLeftRadiusOutlined,
  BorderTopRightRadiusOutlined,
  BorderBottomRightRadiusOutlined,
  BorderBottomLeftRadiusOutlined
} from '../../components'
import { useInputNumberObject } from '../../hooks'

import css from './index.less'

interface BorderProps {
  value: CSSProperties
  onChange: (value: {key: string, value: any}) => void
  config: {
    [key: string]: any
  }
}

const BORDER_STYLE_OPTIONS = [
  { label: '无', value: 'none' },
  { label: '实线', value: 'solid' },
  { label: '虚线', value: 'dashed' },
]

export function Border ({value, onChange, config}: BorderProps) {

  const [{
    borderTopLeftRadius,
    borderTopRightRadius,
    borderBottomRightRadius,
    borderBottomLeftRadius,
    borderTopWidth,
    borderBottomWidth,
    borderLeftWidth,
    borderRightWidth
  }, handleChange] = useInputNumberObject({
    borderTopLeftRadius: value.borderTopLeftRadius,
    borderTopRightRadius: value.borderTopRightRadius,
    borderBottomRightRadius: value.borderBottomRightRadius,
    borderBottomLeftRadius: value.borderBottomLeftRadius,
    borderTopWidth: value.borderTopWidth,
    borderBottomWidth: value.borderBottomWidth,
    borderLeftWidth: value.borderLeftWidth,
    borderRightWidth: value.borderRightWidth
  }, ({key, value}) => {
    onChange({key, value: value + 'px'})
  })

  return (
    <Panel title='描边'>
      <Panel.Content>
        <Select
          style={{padding: 0}}
          defaultValue={value.borderStyle}
          options={BORDER_STYLE_OPTIONS}
          onChange={(value) => onChange({key: 'borderStyle', value})}
        />
      </Panel.Content>
      <Panel.Content>
        <ColorEditor
          defaultValue={value.borderColor}
          onChange={(value) => onChange({key: 'borderColor', value})}
        />
      </Panel.Content>
      <Panel.Content>
        <Panel.Item style={{padding: 0, backgroundColor: 'transparent'}}>
          <div className={css.editArea}>
            <Input
              prefix={<BorderTopLeftRadiusOutlined />}
              value={borderTopLeftRadius}
              onChange={(value) => handleChange({key: 'borderTopLeftRadius', value})}
            />
            <Input
              prefix={<BorderTopRightRadiusOutlined />}
              value={borderTopRightRadius}
              onChange={(value) => handleChange({key: 'borderTopRightRadius', value})}
            />
          </div>
        </Panel.Item>
      </Panel.Content>
      <Panel.Content>
        <Panel.Item style={{padding: 0, backgroundColor: 'transparent'}}>
          <div className={css.editArea}>
            <Input
              prefix={<BorderBottomRightRadiusOutlined />}
              value={borderBottomRightRadius}
              onChange={(value) => handleChange({key: 'borderBottomRightRadius', value})}
            />
            <Input
              prefix={<BorderBottomLeftRadiusOutlined />}
              value={borderBottomLeftRadius}
              onChange={(value) => handleChange({key: 'borderBottomLeftRadius', value})}
            />
          </div>
        </Panel.Item>
      </Panel.Content>
      <Panel.Content>
        <Panel.Item style={{padding: 0, backgroundColor: 'transparent'}}>
          <div className={css.editArea}>
            <Input
              prefix={<BorderTopWidthOutlined />}
              value={borderTopWidth}
              onChange={(value) => handleChange({key: 'borderTopWidth', value})}
            />
            <Input
              prefix={<BorderRightWidthOutlined />}
              value={borderRightWidth}
              onChange={(value) => handleChange({key: 'borderRightWidth', value})}
            />
          </div>
        </Panel.Item>
      </Panel.Content>
      <Panel.Content>
        <Panel.Item style={{padding: 0, backgroundColor: 'transparent'}}>
          <div className={css.editArea}>
            <Input
              prefix={<BorderBottomWidthOutlined />}
              value={borderBottomWidth}
              onChange={(value) => handleChange({key: 'borderBottomWidth', value})}
            />
            <Input
              prefix={<BorderLeftWidthOutlined />}
              value={borderLeftWidth}
              onChange={(value) => handleChange({key: 'borderLeftWidth', value})}
            />
          </div>
        </Panel.Item>
      </Panel.Content>
    </Panel>
  )
}

