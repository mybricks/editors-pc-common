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
  defaultUnitValue?: string
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
  defaultUnitValue,
  onFocus,
  tip
}: InputNumberProps) {
  const [unit, setUnit] = useState<string>(getUnit(defaultValue, defaultUnitValue))
  const [number, handleNumberChange] = useInputNumber(defaultValue)
  const [displayValue, setDisplayValue] = useState(unit === defaultValue ? unit : number)

  const isDisabledUnit = useCallback(() => {
    return (unitDisabledList && unit) ? unitDisabledList.includes(unit) : disabled
  }, [unit, disabled])

  const onKeyDown = useCallback((e) => {
    const code = e.code

    if (['ArrowUp', 'ArrowDown'].includes(code)) {
      e.preventDefault()
      handleNumberChange(incrementDecrement(number, code))
    }
  }, [number])

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
    let changeValue = String(parseFloat(number))
    if (unitDisabledList.includes(unit)) {
      setDisplayValue(unit)
      changeValue = unit
    } else {
      setDisplayValue(number)
      changeValue = changeValue + unit
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
      onKeyDown={onKeyDown}
      tip={tip}
    />
  )
}

function getUnit (value: any, defaultUnitValue?: string) {
  const [, unit] = splitValueAndUnit(value)

  return unit || (typeof defaultUnitValue !== 'undefined' ? defaultUnitValue : value)
}

function incrementDecrement(inputNumber: string, keyEvent: 'ArrowUp' | 'ArrowDown') {
  if (inputNumber.includes('.')) {
    var decimalPlaces = inputNumber.split('.')[1].length
    var increment = Math.pow(10, -decimalPlaces)

    if (keyEvent === 'ArrowUp') {
      var updatedNumber = (parseFloat(inputNumber) + increment).toFixed(decimalPlaces)
    } else if (keyEvent === 'ArrowDown') {
      var updatedNumber = (parseFloat(inputNumber) - increment).toFixed(decimalPlaces)
    } else {
      var updatedNumber = inputNumber
    }
  } else {
    if (keyEvent === 'ArrowUp') {
      var updatedNumber = (parseFloat(inputNumber) + 1).toString()
    } else if (keyEvent === 'ArrowDown') {
      var updatedNumber = (parseFloat(inputNumber) - 1).toString()
    } else {
      var updatedNumber = inputNumber
    }
  }

  return updatedNumber
}
