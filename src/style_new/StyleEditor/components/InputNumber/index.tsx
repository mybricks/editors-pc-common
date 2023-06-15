import React, {
  useMemo,
  useState,
  useCallback
} from 'react'

import { Input, Select } from '..'
import { splitValueAndUnit } from '../../utils'
import { useInputNumber, useUpdateEffect } from '../../hooks'

import type { InputProps } from '..'

interface InputNumberProps extends InputProps {
  unitDisabledList?: Array<string> 
  unitOptions?: Array<{label: string, value: string}>
}

export function InputNumber ({
  defaultValue,
  onChange,
  // value,
  prefix,
  suffix: customSuffix,
  style = {},
  disabled = false,
  unitOptions,
  unitDisabledList = [],
  onFocus
}: InputNumberProps) {
  const [unit, setUnit] = useState(getUnit(defaultValue))
  const [number, handleNumberChange] = useInputNumber(defaultValue)
  const [displayValue, setDisplayValue] = useState(unit === defaultValue ? unit : number)

  const isDisabledUnit = useCallback(() => {
    return (unitDisabledList && unit) ? unitDisabledList.includes(unit) : disabled
  }, [unit, disabled])

  const suffix = useMemo(() => {
    if (customSuffix) {
      return customSuffix
    } else if (Array.isArray(unitOptions)) {
      return (
        <Select
          style={{padding: 0, fontSize: 10}}
          defaultValue={unit}
          options={unitOptions}
          showIcon={false}
          onChange={setUnit}
        />
      )
    }

    return null
  }, [])

  useUpdateEffect(() => {
    let changeValue = number
    if (unitDisabledList.includes(unit)) {
      setDisplayValue(unit)
      changeValue = unit
    } else {
      setDisplayValue(number)
      changeValue = number + unit
    }
    onChange(changeValue)
  }, [unit, number])

  return (
    <Input
      style={style}
      prefix={prefix}
      value={displayValue}
      onChange={handleNumberChange}
      suffix={suffix}
      disabled={isDisabledUnit()}
      onFocus={onFocus}
    />
  )
}

function getUnit (value: any) {
  const [, unit] = splitValueAndUnit(value)

  return unit || value
}
