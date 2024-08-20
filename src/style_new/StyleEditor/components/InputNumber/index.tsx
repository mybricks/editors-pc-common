import React, {
  useMemo,
  useState,
  useCallback
} from 'react'

import { Input, Select } from '..'
import { splitValueAndUnit } from '../../utils'
import { useInputNumber, useUpdateEffect } from '../../hooks'

import type { InputProps } from '..'

interface UnitOption {
  label: string;
  value: string;
}
interface InputNumberProps extends InputProps {
  defaultUnitValue?: string
  unitDisabledList?: Array<string> 
  unitOptions?: Array<UnitOption>
  allowNegative?: boolean,
  showIcon?: boolean
  prefixTip?: string
  type?: string
}

export function InputNumber ({
  defaultValue,
  onChange,
  value,
  prefix,
  prefixTip,
  suffix: customSuffix,
  style = {},
  disabled = false,
  unitOptions,
  unitDisabledList = [],
  defaultUnitValue,
  onFocus,
  tip,
  allowNegative = false,
  showIcon = false,
  type = void 0
}: InputNumberProps) {
  const [unit, setUnit] = useState<string>(getUnit(value || defaultValue, defaultUnitValue, unitOptions))
  const [number, handleNumberChange] = useInputNumber(value || defaultValue)
  const [displayValue, setDisplayValue] = useState((typeof unit !== 'undefined' && typeof (value || defaultValue) !== 'undefined' && unit === (value || defaultValue) ? unit : number))

  const isDisabledUnit = useCallback(() => {
    return (unitDisabledList && unit) ? unitDisabledList.includes(unit) : disabled
  }, [unit, disabled])

  const onKeyDown = useCallback((e: {
    target: any, code: any; preventDefault: () => void 
  }) => {
    const code = e.code
    const newValue = incrementDecrement(e.target.value, code);
    if (['ArrowUp', 'ArrowDown'].includes(code)) {
      e.target.value = newValue;
      e.target.select();// 光标增减时依旧选中
      e.preventDefault(); 
    } else if (code === 'Enter') {
      e.target.value = newValue;
      handleNumberChange(newValue);
    }
  }, [number]);

  const onBlur = useCallback((e: {
    target: any,
  }) => {
    let newValue = e.target.value;
    newValue = Number(newValue) > 0 ? newValue : '0'
    handleNumberChange(newValue);
    e.target.value = newValue;
  }, [number]);

  const suffix = useMemo(() => {
    if (customSuffix) {
      return customSuffix
    } else if (Array.isArray(unitOptions)) {
      return (
        <Select
          style={{padding: 0, fontSize: 10}}
          defaultValue={unit}
          options={unitOptions}
          showIcon={showIcon} // 带Select的数字输入框showIcon 便于提示用户可以切换Select选项 但字体的输入框太小下拉icon会遮挡
          onChange={setUnit}
        />
      )
    }

    return null
  }, [])

  useUpdateEffect(() => {
    if (value) {
      const unit = getUnit(value, defaultUnitValue, unitOptions)
      setUnit(unit)
      handleNumberChange(String(value))
      setDisplayValue((typeof unit !== 'undefined' && typeof value !== 'undefined' && unit === value ? unit : number))
    }
  }, [value])

  useUpdateEffect(() => {
    let changeValue = String(parseFloat(number))
    if (unitDisabledList.includes(unit)) {
      setDisplayValue(unit)
      changeValue = unit
    } else {
      setDisplayValue(number)
      changeValue = changeValue + unit
    }
    onChange && onChange(changeValue)
  }, [unit, number])

  return (
    <Input
      style={style}
      prefix={prefix}
      prefixTip={prefixTip}
      value={displayValue}
      // onChange={handleNumberChange}
      suffix={suffix}
      disabled={isDisabledUnit()}
      onFocus={onFocus}
      onKeyDown={onKeyDown}
      onBlur={onBlur}
      tip={tip}
      numberTip={"光标键可增减"}
      type={type} // TODO 后续调整 现在因为面板宽度不够只给小部分加 type = 'number'
    />
  )
}

function getUnit (value: any, defaultUnitValue: string | undefined = void 0, unitOptions: Array<UnitOption> = []) {
  const [, unit] = splitValueAndUnit(value)
  const unitOption = unitOptions.find((unitOption: UnitOption) => unitOption.value === unit)

  return unitOption ? unitOption.value : (unit || (typeof defaultUnitValue !== 'undefined' ? defaultUnitValue : value))
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

  return Number(updatedNumber) > 0 ? updatedNumber : '0'
}
