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
  style = {},
  disabled = false,
  unitOptions,
  unitDisabledList = []
}: InputNumberProps) {
  const [unit, setUnit] = useState(getUnit(defaultValue))
  const [number, handleNumberChange] = useInputNumber(defaultValue)
  const [displayValue, setDisplayValue] = useState(unit === defaultValue ? unit : number)

  const isDisabledUnit = useCallback(() => {
    return (unitDisabledList && unit) ? unitDisabledList.includes(unit) : disabled
  }, [unit, disabled])

  const suffix = useMemo(() => {
    if (Array.isArray(unitOptions)) {
      return (
        <Select
          style={{padding: 0}}
          defaultValue={unit}
          options={unitOptions}
          showIcon={false}
          // onChange={(value) => handleSuffixChange({key: 'widthUnit', value})}
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
      prefix={prefix}
      value={displayValue}
      onChange={handleNumberChange}
      suffix={suffix}
      disabled={isDisabledUnit()}
    />
  )
}

function getUnit (value: any) {
  const [, unit] = splitValueAndUnit(value)

  return unit || value
}
