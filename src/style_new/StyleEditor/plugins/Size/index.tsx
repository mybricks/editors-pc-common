import React, {
  useState,
  useCallback,
  CSSProperties 
} from 'react'

import {
  Panel,
  Input,
  Select,
  WidthOutlined,
  HeightOutlined
} from '../../components'
import { splitValueAndUnit } from '../../utils'
import { useInputNumberObject } from '../../hooks'

import type { ChangeEvent } from '../../type'

const UNIT_OPTIONS = [
  {label: '%', value: '%'},
  {label: 'px', value: 'px'},
  {label: '默认', value: 'inherit'}
]
const WHITELIST_VALUES = ['inherit']
const UNIT_TO_STYLE_KEY: { [key: string]: string } = {
  widthUnit: 'width',
  heightUnit: 'height'
}
const STYLE_KEY_TO_UNIT: { [key: string]: string } = {
  width: 'widthUnit',
  height: 'heightUnit'
}

interface SizeProps {
  value: CSSProperties
  onChange: ChangeEvent
  config: {
    [key: string]: any
  }
}

export function Size ({value, onChange, config}: SizeProps) {

  const [{widthUnit, heightUnit}, setUnits] = useState(getUnits(value))
  const [inputValue, handleChange] = useInputNumberObject({width: value.width, height: value.height}, ({key, value}) => {
    onChange({key, value: WHITELIST_VALUES.includes(value) ? value : value + (key === 'width' ? widthUnit : heightUnit)})
  }, WHITELIST_VALUES)

  const handleSuffixChange = useCallback(({key, value}) => {
    const styleKey = UNIT_TO_STYLE_KEY[key]
    setUnits((units) => {
      return {
        ...units,
        [key]: value
      }
    })
    Promise.resolve().then(() => {
      handleChange({key: styleKey, value: WHITELIST_VALUES.includes(value) ? value : '10'})
    })
  }, [])

  return (
    <Panel title='尺寸'>
      <Panel.Content>
        <Input
          prefix={<WidthOutlined />}
          suffix={(
            <Select
              style={{padding: 0}}
              defaultValue={widthUnit}
              options={UNIT_OPTIONS}
              showIcon={false}
              onChange={(value) => handleSuffixChange({key: 'widthUnit', value})}
            />
          )}
          value={inputValue.width}
          disabled={WHITELIST_VALUES.includes(widthUnit)}
          onChange={(value) => handleChange({key: 'width', value})}
        />
        <Input
          prefix={<HeightOutlined />}
          suffix={(
            <Select
              style={{padding: 0}}
              defaultValue={heightUnit}
              options={UNIT_OPTIONS}
              showIcon={false}
              onChange={(value) => handleSuffixChange({key: 'heightUnit', value})}
            />
          )}
          value={inputValue.height}
          disabled={WHITELIST_VALUES.includes(heightUnit)}
          onChange={(value) => handleChange({key: 'height', value})}
        />
      </Panel.Content>
    </Panel>
  )
}

function getUnits ({width, height}: CSSProperties) {
  const [widthValue, widthUnit] = splitValueAndUnit(`${width}`)
  const [heightValue, heightUnit] = splitValueAndUnit(`${height}`)

  return {
    widthUnit: widthValue === null ? width : widthUnit,
    heightUnit: heightValue === null ? height : heightUnit,
  } as {widthUnit: string, heightUnit: string}
}
