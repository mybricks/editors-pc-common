import React, {
  useMemo,
  useState,
  useCallback,
  CSSProperties
} from 'react'

import {
  Panel,
  Select,
  ColorEditor,
  InputNumber,
  BorderAllOutlined,
  BorderSplitOutlined,
  BorderTopWidthOutlined,
  BorderLeftWidthOutlined,
  BorderRightWidthOutlined,
  BorderRadiusSplitOutlined,
  BorderBottomWidthOutlined,
  BorderTopLeftRadiusOutlined,
  BorderTopRightRadiusOutlined,
  BorderBottomLeftRadiusOutlined,
  BorderBottomRightRadiusOutlined
} from '../../components'
import { allEqual } from '../../utils'
import { useUpdateEffect } from '../../hooks'

import type { ChangeEvent } from '../../type'

import css from './index.less'

interface BorderProps {
  value: CSSProperties
  onChange: ChangeEvent
  config: {
    [key: string]: any
  }
}

const BORDER_STYLE_OPTIONS = [
  { label: '无', value: 'none' },
  { label: '实线', value: 'solid' },
  { label: '虚线', value: 'dashed' },
]
const UNIT_OPTIONS = [
  {label: 'px', value: 'px'},
  {label: '%', value: '%'}
]
const DEFAULT_STYLE = {
  padding: 0,
  fontSize: 10,
  minWidth: 41,
  maxWidth: 41,
  marginLeft: 4
}

export function Border ({value, onChange, config}: BorderProps) {
  const [{borderToggleValue, radiusToggleValue}, setToggleValue] = useState(getToggleDefaultValue(value))
  const [borderValue, setBorderValue] = useState({...value})
  const [splitRadiusIcon, setSplitRadiusIcon] = useState(<BorderTopLeftRadiusOutlined />)

  const handleChange = useCallback((value) => {
    setBorderValue((val) => {
      return {
        ...val,
        ...value
      }
    })
    onChange(Object.keys(value).map((key) => {
      return {
        key,
        value: value[key]
      }
    }))
  }, [])

  const borderConfig = useMemo(() => {
    if (borderToggleValue === 'all') {
      return (
        <div className={css.row}>
          <Panel.Content style={{padding: 3}}>
            <Panel.Item className={css.editArea} style={{padding: '0px 8px'}}>
              <div className={css.icon}>
                <BorderAllOutlined />
              </div>
              <InputNumber
                style={DEFAULT_STYLE}
                defaultValue={borderValue.borderTopWidth}
                suffix={'px'}
                onChange={(value) => handleChange({
                  borderTopWidth: value,
                  borderRightWidth: value,
                  borderBottomWidth: value,
                  borderLeftWidth: value,
                })}
              />
              <ColorEditor
                style={{padding: 0, marginLeft: 9}}
                defaultValue={borderValue.borderTopColor}
                onChange={(value) => handleChange({
                  borderTopColor: value,
                  borderRightColor: value,
                  borderBottomColor: value,
                  borderLeftColor: value,
                })}
              />
              <Select
                style={{padding: 0, width: 40, textAlign: 'right'}}
                labelClassName={css.label}
                defaultValue={borderValue.borderTopStyle}
                options={BORDER_STYLE_OPTIONS}
                showIcon={false}
                onChange={(value) => handleChange({
                  borderTopStyle: value,
                  borderRightStyle: value,
                  borderBottomStyle: value,
                  borderLeftStyle: value,
                })}
              />
            </Panel.Item>
          </Panel.Content>
          <div
            className={css.actionIcon}
            onClick={() => handleToggleChange({key: 'borderToggleValue', value: 'split'})}
          >
            <BorderAllOutlined />
          </div>
        </div>
      )
    } else {
      return (
        <div className={css.row}>
          <div className={css.col}>
            <div className={css.row}>
              <Panel.Content style={{padding: 3}}>
                <Panel.Item className={css.editArea} style={{padding: '0px 8px'}}>
                  <div className={css.icon}>
                    <BorderTopWidthOutlined />
                  </div>
                  <InputNumber
                    style={DEFAULT_STYLE}
                    defaultValue={borderValue.borderTopWidth}
                    suffix={'px'}
                    onChange={(value) => handleChange({borderTopWidth: value})}
                  />
                  <ColorEditor
                    style={{padding: 0, marginLeft: 9}}
                    defaultValue={borderValue.borderTopColor}
                    onChange={(value) => handleChange({borderTopColor: value})}
                  />
                  <Select
                    style={{padding: 0, width: 40}}
                    labelClassName={css.label}
                    defaultValue={borderValue.borderTopStyle}
                    options={BORDER_STYLE_OPTIONS}
                    showIcon={false}
                    onChange={(value) => handleChange({borderTopStyle: value})}
                  />
                </Panel.Item>
              </Panel.Content>
              <div
                className={css.actionIcon}
                onClick={() => handleToggleChange({key: 'borderToggleValue', value: 'all'})}
              >
                <BorderSplitOutlined />
              </div>
            </div>

            <div className={css.row}>
              <Panel.Content style={{padding: 3}}>
                <Panel.Item className={css.editArea} style={{padding: '0px 8px'}}>
                  <div className={css.icon}>
                    <BorderRightWidthOutlined />
                  </div>
                  <InputNumber
                    style={DEFAULT_STYLE}
                    defaultValue={borderValue.borderRightWidth}
                    suffix={'px'}
                    onChange={(value) => handleChange({borderRightWidth: value})}
                  />
                  <ColorEditor
                    style={{padding: 0, marginLeft: 9}}
                    defaultValue={borderValue.borderRightColor}
                    onChange={(value) => handleChange({borderRightColor: value})}
                  />
                  <Select
                    style={{padding: 0, width: 40}}
                    labelClassName={css.label}
                    defaultValue={borderValue.borderRightStyle}
                    options={BORDER_STYLE_OPTIONS}
                    showIcon={false}
                    onChange={(value) => handleChange({borderRightStyle: value})}
                  />
                </Panel.Item>
              </Panel.Content>
              <div className={css.actionIcon} />
            </div>

            <div className={css.row}>
              <Panel.Content style={{padding: 3}}>
                <Panel.Item className={css.editArea} style={{padding: '0px 8px'}}>
                  <div className={css.icon}>
                    <BorderBottomWidthOutlined />
                  </div>
                  <InputNumber
                    style={DEFAULT_STYLE}
                    defaultValue={borderValue.borderBottomWidth}
                    suffix={'px'}
                    onChange={(value) => handleChange({borderBottomWidth: value})}
                  />
                  <ColorEditor
                    style={{padding: 0, marginLeft: 9}}
                    defaultValue={borderValue.borderBottomColor}
                    onChange={(value) => handleChange({borderBottomColor: value})}
                  />
                  <Select
                    style={{padding: 0, width: 40}}
                    labelClassName={css.label}
                    defaultValue={borderValue.borderBottomStyle}
                    options={BORDER_STYLE_OPTIONS}
                    showIcon={false}
                    onChange={(value) => handleChange({borderBottomStyle: value})}
                  />
                </Panel.Item>
              </Panel.Content>
              <div className={css.actionIcon} />
            </div>
            
            <div className={css.row}>
              <Panel.Content style={{padding: 3}}>
                <Panel.Item className={css.editArea} style={{padding: '0px 8px'}}>
                  <div className={css.icon}>
                    <BorderLeftWidthOutlined />
                  </div>
                  <InputNumber
                    style={DEFAULT_STYLE}
                    defaultValue={borderValue.borderLeftWidth}
                    suffix={'px'}
                    onChange={(value) => handleChange({borderLeftWidth: value})}
                  />
                  <ColorEditor
                    style={{padding: 0, marginLeft: 9}}
                    defaultValue={borderValue.borderLeftColor}
                    onChange={(value) => handleChange({borderLeftColor: value})}
                  />
                  <Select
                    style={{padding: 0, width: 40}}
                    labelClassName={css.label}
                    defaultValue={borderValue.borderLeftStyle}
                    options={BORDER_STYLE_OPTIONS}
                    showIcon={false}
                    onChange={(value) => handleChange({borderLeftStyle: value})}
                  />
                </Panel.Item>
              </Panel.Content>
              <div className={css.actionIcon} />
            </div>
          </div>
        </div>
      )
    }
  }, [borderToggleValue])

  const radiusConfig = useMemo(() => {
    if (radiusToggleValue === 'all') {
      return (
        <div className={css.row}>
          <Panel.Content style={{padding: 3}}>
            <Panel.Item className={css.editArea} style={{padding: '0px 8px'}}>
              <div className={css.icon}>
                <BorderRadiusSplitOutlined />
              </div>
              <InputNumber
                style={DEFAULT_STYLE}
                defaultValue={borderValue.borderTopLeftRadius}
                unitOptions={UNIT_OPTIONS}
                onChange={(value) => handleChange({
                  borderTopLeftRadius: value,
                  borderBottomLeftRadius: value,
                  borderBottomRightRadius: value,
                  borderTopRightRadius: value
                })}
              />
            </Panel.Item>
          </Panel.Content>
          <div
            className={css.actionIcon}
            onClick={() => handleToggleChange({key: 'radiusToggleValue', value: 'split'})}
          >
            <BorderRadiusSplitOutlined />
          </div>
        </div>
      )
    } else {
      return (
        <div className={css.row}>
          <Panel.Content style={{padding: 3}}>
            <Panel.Item className={css.editArea} style={{padding: '0px 8px'}}>
              <div className={css.icon}>
                {splitRadiusIcon}
              </div>
              <InputNumber
                style={DEFAULT_STYLE}
                defaultValue={borderValue.borderTopLeftRadius}
                unitOptions={UNIT_OPTIONS}
                onChange={(value) => handleChange({borderTopLeftRadius: value})}
                onFocus={() => setSplitRadiusIcon(<BorderTopLeftRadiusOutlined />)}
              />
              <InputNumber
                style={DEFAULT_STYLE}
                defaultValue={borderValue.borderTopRightRadius}
                unitOptions={UNIT_OPTIONS}
                onChange={(value) => handleChange({borderTopRightRadius: value})}
                onFocus={() => setSplitRadiusIcon(<BorderTopRightRadiusOutlined />)}
              />
              <InputNumber
                style={DEFAULT_STYLE}
                defaultValue={borderValue.borderBottomLeftRadius}
                unitOptions={UNIT_OPTIONS}
                onChange={(value) => handleChange({borderBottomLeftRadius: value})}
                onFocus={() => setSplitRadiusIcon(<BorderBottomLeftRadiusOutlined />)}
              />
              <InputNumber
                style={DEFAULT_STYLE}
                defaultValue={borderValue.borderBottomRightRadius}
                unitOptions={UNIT_OPTIONS}
                onChange={(value) => handleChange({borderBottomRightRadius: value})}
                onFocus={() => setSplitRadiusIcon(<BorderBottomRightRadiusOutlined />)}
              />
            </Panel.Item>
          </Panel.Content>
          <div
            className={css.actionIcon}
            onClick={() => handleToggleChange({key: 'radiusToggleValue', value: 'all'})}
          >
            <BorderTopLeftRadiusOutlined />
          </div>
        </div>
      )
    }
  }, [radiusToggleValue, splitRadiusIcon])

  const handleToggleChange = useCallback(({key, value}) => {
    setToggleValue((val) => {
      return {
        ...val,
        [key]: value
      }
    })
  }, [borderValue])

  useUpdateEffect(() => {
    handleChange({
      borderTopColor: borderValue.borderTopColor,
      borderRightColor: borderValue.borderTopColor,
      borderBottomColor: borderValue.borderTopColor,
      borderLeftColor: borderValue.borderTopColor,
      borderTopStyle: borderValue.borderTopStyle,
      borderRightStyle: borderValue.borderTopStyle,
      borderBottomStyle: borderValue.borderTopStyle,
      borderLeftStyle: borderValue.borderTopStyle,
      borderTopWidth: borderValue.borderTopWidth,
      borderRightWidth: borderValue.borderTopWidth,
      borderBottomWidth: borderValue.borderTopWidth,
      borderLeftWidth: borderValue.borderTopWidth
    })
  }, [borderToggleValue])

  useUpdateEffect(() => {
    handleChange({
      borderTopLeftRadius: borderValue.borderTopLeftRadius,
      borderTopRightRadius: borderValue.borderTopLeftRadius,
      borderBottomLeftRadius: borderValue.borderTopLeftRadius,
      borderBottomRightRadius: borderValue.borderTopLeftRadius
    })
  }, [radiusToggleValue])

  return (
    <Panel title='描边'>
      {borderConfig}
      {radiusConfig}
    </Panel>
  )
}

function getToggleDefaultValue (value: CSSProperties) {
  return {
    borderToggleValue: (
      allEqual([value.borderTopWidth, value.borderRightWidth, value.borderBottomWidth, value.borderLeftWidth]) && 
      allEqual([value.borderTopStyle, value.borderRightStyle, value.borderBottomStyle, value.borderLeftStyle]) && 
      allEqual([value.borderTopColor, value.borderRightColor, value.borderBottomColor, value.borderLeftColor])) ? 'all' : 'split',
    radiusToggleValue: allEqual([value.borderTopLeftRadius, value.borderTopRightRadius, value.borderBottomRightRadius, value.borderBottomLeftRadius]) ? 'all' : 'split'
  }
}
