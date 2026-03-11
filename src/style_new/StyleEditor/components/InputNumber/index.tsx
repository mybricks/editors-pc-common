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
  /** 覆盖输入框回显文字，key 为 unit value，value 为展示文字；不影响下拉 label */
  unitDisplayLabelMap?: Record<string, string>
  /** 允许负数 */
  allowNegative?: boolean,
  showIcon?: boolean
  prefixTip?: string
  type?: string
  align?: 'left' | 'right'
  onFocus?: () => void;
  onAction?: (value: any) => void;
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
  align = 'left',
  unitOptions,
  unitDisabledList = [],
  unitDisplayLabelMap = {},
  defaultUnitValue,
  onFocus,
  tip,
  allowNegative = false,
  showIcon = false,
  type = void 0,
  onAction,
}: InputNumberProps) {
  const [unit, setUnit] = useState<string>(getUnit(value || defaultValue, defaultUnitValue, unitOptions))
  const [number, handleNumberChange] = useInputNumber<string | number | undefined>(value || defaultValue)
  const [displayValue, setDisplayValue] = useState(() => {
    const initVal = value || defaultValue
    if (!initVal) return ''
    if (typeof unit !== 'undefined' && typeof initVal !== 'undefined' && unit === initVal) {
      return ''
    }
    return number
  })

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
      const trimmed = e.target.value.trim();
      if (!trimmed || isNaN(parseFloat(trimmed))) {
        // 空值或非法值，回到默认状态
        setDisplayValue('');
        e.target.value = '';
        return;
      }
      if (unitDisabledList.includes(unit)) {
        setUnit('px');
      }
      e.target.value = newValue;
      handleNumberChange(newValue);
    }
  }, [number, unit, unitDisabledList]);

  const onBlur = useCallback((e: {
    target: any,
  }) => {
    const trimmed = e.target.value.trim();

    // 空值或非法值：回到默认状态，不提交
    if (!trimmed || isNaN(parseFloat(trimmed))) {
      setDisplayValue('');
      e.target.value = '';
      return;
    }

    let newValue = trimmed;
    if (!allowNegative) {
      newValue = Number(newValue) > 0 ? newValue : '0'
    }

    // 用户明确输入了数字，如果当前是 disabled 单位（默认/Hug）则自动切到 px
    if (unitDisabledList.includes(unit)) {
      setUnit('px');
    }

    const finalVal = handleNumberChange(newValue);
    e.target.value = finalVal;
    setDisplayValue(finalVal)
  }, [number, allowNegative, unit, unitDisabledList]);

  const isDefaultUnit = unitDisabledList.includes(unit)

  const suffix = useMemo(() => {
    if (customSuffix) {
      return customSuffix
    } else if (Array.isArray(unitOptions)) {
      return (
        <Select
          tip='单位'
          style={{ padding: 0, fontSize: 10 }}
          defaultValue={unit}
          options={unitOptions}
          showIcon={showIcon}
          hideLabel={isDefaultUnit}
          onChange={setUnit}
          onAction={onAction}
        />
      )
    }

    return null
  }, [unit, isDefaultUnit])

  useUpdateEffect(() => {
    if (value) {

      const unit = getUnit(value, defaultUnitValue, unitOptions)
      setUnit(unit)
      handleNumberChange(String(value))
      if (typeof unit !== 'undefined' && typeof value !== 'undefined' && unit === value) {
        const unitLabel = unitDisplayLabelMap[unit] ?? unitOptions?.find(o => o.value === unit)?.label ?? unit
        setDisplayValue(unitLabel)
      } else {
        setDisplayValue(number)
      }
    }
  }, [value])

  useUpdateEffect(() => {
    let changeValue = String(parseFloat(number))
    if (unitDisabledList.includes(unit)) {
      setDisplayValue('')
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
      placeholder="默认"
      // onChange={handleNumberChange}
      suffix={suffix}
      disabled={isDisabledUnit()}
      onFocus={onFocus}
      onKeyDown={onKeyDown}
      onBlur={onBlur}
      align={align}
      tip={tip}
      // numberTip={"光标键可增减"}
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
