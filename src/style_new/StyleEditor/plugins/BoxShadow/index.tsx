import React, { useState, CSSProperties } from 'react'

import {
  Panel,
  Select,
  ColorEditor,
  InputNumber,
  BoxShadowOfsetXOutlined,
  BoxShadowOfsetYOutlined,
  BoxShadowBlurRadiusOutlined,
  BoxShadowSpreadRadiusOutlined
} from '../../components'
import { useUpdateEffect } from '../../hooks'

import type { ChangeEvent } from '../../type'

interface BoxShadowProps {
  value: CSSProperties
  onChange: ChangeEvent
  config: {
    [key: string]: any
  }
}

const INSET_OPTIONS = [
  {label: '向内', value: true},
  {label: '向外', value: false}
]

export function BoxShadow ({value, onChange, config}: BoxShadowProps) {
  const [boxShadowValues, setBoxShadowValues] = useState(getInitValue(value.boxShadow))

  useUpdateEffect(() => {
    const {
      inset,
      offsetX,
      offsetY,
      blurRadius,
      spreadRadius,
      color
    } = boxShadowValues
    let value = ''
    if (inset) {
      value = value + 'inset '
    }
    onChange({key: 'boxShadow', value: value + `${offsetX} ${offsetY} ${blurRadius} ${spreadRadius} ${color}`})
  }, [boxShadowValues])

  return (
    <Panel title='阴影'>
      <Panel.Content>
        <Select
          tip='扩散方式'
          style={{width: 98, padding: 0}}
          defaultValue={boxShadowValues.inset}
          options={INSET_OPTIONS}
          onChange={(value) => setBoxShadowValues((boxShadowValues) => {
            return {
              ...boxShadowValues,
              inset: value
            }
          })}
        />
        <InputNumber
          tip='x轴偏移'
          style={{flex: '1 1 0%'}}
          prefix={<BoxShadowOfsetXOutlined />}
          defaultValue={boxShadowValues.offsetX}
          onChange={(value) => setBoxShadowValues((boxShadowValues) => {
            return {
              ...boxShadowValues,
              offsetX: value
            }
          })}
        />
        <InputNumber
          tip='y轴偏移'
          style={{flex: '1 1 0%'}}
          prefix={<BoxShadowOfsetYOutlined />}
          defaultValue={boxShadowValues.offsetY}
          onChange={(value) => setBoxShadowValues((boxShadowValues) => {
            return {
              ...boxShadowValues,
              offsetY: value
            }
          })}
        />
      </Panel.Content>
      <Panel.Content>
        <ColorEditor
          tip='颜色'
          style={{width: 98}}
          defaultValue={boxShadowValues.color}
          onChange={(value) => setBoxShadowValues((boxShadowValues) => {
            return {
              ...boxShadowValues,
              color: value
            }
          })}
        />
        <InputNumber
          tip='模糊'
          style={{flex: '1 1 0%'}}
          prefix={<BoxShadowBlurRadiusOutlined />}
          defaultValue={boxShadowValues.blurRadius}
          onChange={(value) => setBoxShadowValues((boxShadowValues) => {
            return {
              ...boxShadowValues,
              blurRadius: value
            }
          })}
        />
        <InputNumber
          tip='扩散'
          style={{flex: '1 1 0%'}}
          prefix={<BoxShadowSpreadRadiusOutlined />}
          defaultValue={boxShadowValues.spreadRadius}
          onChange={(value) => setBoxShadowValues((boxShadowValues) => {
            return {
              ...boxShadowValues,
              spreadRadius: value
            }
          })}
        />
      </Panel.Content>
    </Panel>
  )
}

function getInitValue (boxShadow: string | undefined) {
  const result = {
    inset: false,
    offsetX: '0px',
    offsetY: '0xp',
    blurRadius: '0px',
    spreadRadius: '0px',
    color: '#ffffff'
  }

  if (!boxShadow) {
    return result
  }

  const args = boxShadow.split(/\s(?![^(]*\))/)  

  if (args.length < 2) {
    return result
  }

  if (args[0] === 'inset') {
    result.inset = true
    args.shift()
  } else if (args.at(-1) === 'inset') {
    result.inset = true
    args.pop()
  }

  if (isNaN(parseFloat(args[0]))) {
    result.color = args[0]
    args.shift()
  } else if (isNaN(parseFloat(args.at(-1) as string))) {
    result.color = args.at(-1) as string
    args.pop()
  }

  const [offsetX = '0px', offsetY = '0px', blurRadius = '0px', spreadRadius = '0px'] = args

  result.offsetX = offsetX
  result.offsetY = offsetY
  result.blurRadius = blurRadius
  result.spreadRadius = spreadRadius

  return result
}

