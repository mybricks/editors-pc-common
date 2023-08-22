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

const DEFAULT_CONFIG = {
  disableBorderStyle: false,
  disableBorderWidth: false,
  disableBorderColor: false,
  disableBorderRadius: false,
  useImportant: false
}

export function Border ({value, onChange, config}: BorderProps) {
  const [{
    disableBorderWidth,
    disableBorderColor,
    disableBorderStyle,
    disableBorderRadius,
    useImportant
  }] = useState(Object.assign(DEFAULT_CONFIG, config))
  const [{borderToggleValue, radiusToggleValue}, setToggleValue] = useState(getToggleDefaultValue(value))
  const defaultBorderValue = useMemo(() => {
    const defaultValue = Object.assign({}, value)
    Object.keys(defaultValue).forEach((key) => {
      // TODO: 全局处理
      // @ts-ignore
      defaultValue[key] = defaultValue[key].replace(/!.*$/, '')
    })
    return defaultValue
  }, [])
  const [borderValue, setBorderValue] = useState(defaultBorderValue)
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
        // TODO
        value: `${value[key]}${useImportant ? '!important' : ''}`
      }
    }))
  }, [])

  const borderConfig = useMemo(() => {
    if (disableBorderWidth && disableBorderColor && disableBorderStyle) {
      return null
    }
    if (borderToggleValue === 'all') {
      return (
        <div className={css.row}>
          <Panel.Content style={{padding: 3}}>
            <Panel.Item className={css.editArea} style={{padding: '0px 8px'}}>
              <div className={css.icon}>
                <BorderAllOutlined />
              </div>
              {disableBorderWidth ? null : (
                <InputNumber
                  tip='边框宽度'
                  style={DEFAULT_STYLE}
                  defaultValue={borderValue.borderTopWidth}
                  suffix={'px'}
                  onChange={(value) => {
                    const borderStyle = borderValue.borderTopStyle === 'none' ? 'solid' : borderValue.borderTopStyle
                    handleChange({
                      borderTopWidth: value,
                      borderRightWidth: value,
                      borderBottomWidth: value,
                      borderLeftWidth: value,
                      borderTopStyle: borderStyle,
                      borderRightStyle: borderStyle,
                      borderBottomStyle: borderStyle,
                      borderLeftStyle: borderStyle
                    })
                  }}
                />
              )}
              {disableBorderColor ? null : (
                <ColorEditor
                  // tip='边框颜色'
                  style={{padding: 0, marginLeft: 5}}
                  defaultValue={borderValue.borderTopColor}
                  onChange={(value) => handleChange({
                    borderTopColor: value,
                    borderRightColor: value,
                    borderBottomColor: value,
                    borderLeftColor: value,
                  })}
                />
              )}
              {disableBorderStyle ? null : (
                <Select
                  tip="边框线条样式"
                  style={{padding: 0, width: 28, minWidth: 28, marginLeft: 0, textAlign: 'right'}}
                  labelClassName={css.label}
                  value={borderValue.borderTopStyle}
                  options={BORDER_STYLE_OPTIONS}
                  showIcon={false}
                  onChange={(value) =>
                    handleChange({
                      borderTopStyle: value,
                      borderRightStyle: value,
                      borderBottomStyle: value,
                      borderLeftStyle: value,
                    })
                  }
                />
              )}
            </Panel.Item>
          </Panel.Content>
          <div
            data-mybricks-tip={`{content:'四条边同时配置',position:'left'}`}
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
                  {disableBorderWidth ? null : (
                    <InputNumber
                      tip='上边框宽度'
                      style={DEFAULT_STYLE}
                      defaultValue={borderValue.borderTopWidth}
                      suffix={'px'}
                      onChange={(value) => handleChange({borderTopWidth: value, borderTopStyle: borderValue.borderTopStyle === 'none' ? 'solid' : borderValue.borderTopStyle})}
                    />
                  )}
                  {disableBorderColor ? null : (
                    <ColorEditor
                      // tip='上边框颜色'
                      style={{padding: 0, marginLeft: 5}}
                      defaultValue={borderValue.borderTopColor}
                      onChange={(value) => handleChange({borderTopColor: value})}
                    />
                  )}
                  {disableBorderStyle ? null : (
                    <Select
                      tip='上边框线条样式'
                      style={{padding: 0, width: 28, minWidth: 28, marginLeft: 0, textAlign: 'right'}}
                      labelClassName={css.label}
                      value={borderValue.borderTopStyle}
                      options={BORDER_STYLE_OPTIONS}
                      showIcon={false}
                      onChange={(value) => handleChange({borderTopStyle: value})}
                    />
                  )}
                </Panel.Item>
              </Panel.Content>
              <div
                data-mybricks-tip={`{content:'四条边单独配置',position:'left'}`}
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
                  {disableBorderWidth ? null : (
                    <InputNumber
                      tip='右边框宽度'
                      style={DEFAULT_STYLE}
                      defaultValue={borderValue.borderRightWidth}
                      suffix={'px'}
                      onChange={(value) => handleChange({borderRightWidth: value, borderRightStyle: borderValue.borderRightStyle === 'none' ? 'solid' : borderValue.borderRightStyle})}
                    />
                  )}
                  {disableBorderColor ? null : (
                    <ColorEditor
                      // tip='右边框颜色'
                      style={{padding: 0, marginLeft: 5}}
                      defaultValue={borderValue.borderRightColor}
                      onChange={(value) => handleChange({borderRightColor: value})}
                    />
                  )}
                  {disableBorderStyle ? null : (
                    <Select
                      tip='右边框线条样式'
                      style={{padding: 0, width: 28, minWidth: 28, marginLeft: 0, textAlign: 'right'}}
                      labelClassName={css.label}
                      value={borderValue.borderRightStyle}
                      options={BORDER_STYLE_OPTIONS}
                      showIcon={false}
                      onChange={(value) => handleChange({borderRightStyle: value})}
                    />
                  )}
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
                  {disableBorderWidth ? null : (
                    <InputNumber
                      tip='下边框宽度'
                      style={DEFAULT_STYLE}
                      defaultValue={borderValue.borderBottomWidth}
                      suffix={'px'}
                      onChange={(value) => handleChange({borderBottomWidth: value, borderBottomStyle: borderValue.borderBottomStyle === 'none' ? 'solid' : borderValue.borderBottomStyle})}
                    />
                  )}
                  {disableBorderColor ? null : (
                    <ColorEditor
                      // tip='下边框颜色'
                      style={{padding: 0, marginLeft: 5}}
                      defaultValue={borderValue.borderBottomColor}
                      onChange={(value) => handleChange({borderBottomColor: value})}
                    />
                  )}
                  {disableBorderStyle ? null : (
                    <Select
                      tip='下边框线条样式'
                      style={{padding: 0, width: 28, minWidth: 28, marginLeft: 0, textAlign: 'right'}}
                      labelClassName={css.label}
                      value={borderValue.borderBottomStyle}
                      options={BORDER_STYLE_OPTIONS}
                      showIcon={false}
                      onChange={(value) => handleChange({borderBottomStyle: value})}
                    />
                  )}
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
                  {disableBorderWidth ? null : (
                    <InputNumber
                      tip='左边框宽度'
                      style={DEFAULT_STYLE}
                      defaultValue={borderValue.borderLeftWidth}
                      suffix={'px'}
                      onChange={(value) => handleChange({borderLeftWidth: value, borderLeftStyle: borderValue.borderLeftStyle === 'none' ? 'solid' : borderValue.borderLeftStyle})}
                    />
                  )}
                  {disableBorderColor ? null : (
                    <ColorEditor
                      // tip='左边框颜色'
                      style={{padding: 0, marginLeft: 5}}
                      defaultValue={borderValue.borderLeftColor}
                      onChange={(value) => handleChange({borderLeftColor: value})}
                    />
                  )}
                  {disableBorderStyle ? null : (
                    <Select
                      tip='左边框线条样式'
                      style={{padding: 0, width: 28, minWidth: 28, marginLeft: 0, textAlign: 'right'}}
                      labelClassName={css.label}
                      value={borderValue.borderLeftStyle}
                      options={BORDER_STYLE_OPTIONS}
                      showIcon={false}
                      onChange={(value) => handleChange({borderLeftStyle: value})}
                    />
                  )}
                </Panel.Item>
              </Panel.Content>
              <div className={css.actionIcon} />
            </div>
          </div>
        </div>
      )
    }
  }, [borderToggleValue, borderValue])

  const radiusConfig = useMemo(() => {
    if (disableBorderRadius) {
      return null
    }
    if (radiusToggleValue === 'all') {
      return (
        <div className={css.row}>
          <Panel.Content style={{padding: 3}}>
            <Panel.Item className={css.editArea} style={{padding: '0px 8px'}}>
              <div className={css.icon}>
                <BorderRadiusSplitOutlined />
              </div>
              <InputNumber
                tip='圆角半径'
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
            data-mybricks-tip={`{content:'四角同时配置',position:'left'}`}
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
                tip='左上角半径'
                style={DEFAULT_STYLE}
                defaultValue={borderValue.borderTopLeftRadius}
                unitOptions={UNIT_OPTIONS}
                onChange={(value) => handleChange({borderTopLeftRadius: value})}
                onFocus={() => setSplitRadiusIcon(<BorderTopLeftRadiusOutlined />)}
              />
              <InputNumber
                tip='右上角半径'
                style={DEFAULT_STYLE}
                defaultValue={borderValue.borderTopRightRadius}
                unitOptions={UNIT_OPTIONS}
                onChange={(value) => handleChange({borderTopRightRadius: value})}
                onFocus={() => setSplitRadiusIcon(<BorderTopRightRadiusOutlined />)}
              />
              <InputNumber
                tip='右下角半径'
                style={DEFAULT_STYLE}
                defaultValue={borderValue.borderBottomRightRadius}
                unitOptions={UNIT_OPTIONS}
                onChange={(value) => handleChange({borderBottomRightRadius: value})}
                onFocus={() => setSplitRadiusIcon(<BorderBottomRightRadiusOutlined />)}
              />
              <InputNumber
                tip='左下角半径'
                style={DEFAULT_STYLE}
                defaultValue={borderValue.borderBottomLeftRadius}
                unitOptions={UNIT_OPTIONS}
                onChange={(value) => handleChange({borderBottomLeftRadius: value})}
                onFocus={() => setSplitRadiusIcon(<BorderBottomLeftRadiusOutlined />)}
              />
            </Panel.Item>
          </Panel.Content>
          <div
            data-mybricks-tip={`{content:'四角单独配置',position:'left'}`}
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
