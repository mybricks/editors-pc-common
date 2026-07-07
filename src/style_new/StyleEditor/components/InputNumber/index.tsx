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
  unitIconClassName?: string;
  unitSelectStyle?: React.CSSProperties;
  /** 在单位选择器前渲染的额外徽标内容，如 "Hug" */
  badge?: React.ReactNode;
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
  unitIconClassName,
  unitSelectStyle,
  badge,
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
    const isUnitDisabled = (unitDisabledList && unit) ? unitDisabledList.includes(unit) : false;
    return disabled || isUnitDisabled;
  }, [unit, disabled, unitDisabledList])

  const onKeyDown = useCallback((e: {
    target: any, code: any; preventDefault: () => void
  }) => {
    const code = e.code
    const newValue = incrementDecrement(e.target.value, code, allowNegative);
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

    // 捕获当前 number，用于判断 handleNumberChange 后是否发生了变化
    const prevNumber = number;
    // 用户明确输入了数字，如果当前是 disabled 单位（默认/Hug）则自动切到 px
    const unitWillChange = unitDisabledList.includes(unit);
    if (unitWillChange) {
      setUnit('px');
    }

    const finalVal = handleNumberChange(newValue);
    e.target.value = finalVal;
    setDisplayValue(finalVal);

    // useUpdateEffect([unit, number]) 只在 unit 或 number 发生变化时才触发 onChange。
    // 当两者均未变化时（例如 HUG/FILL 模式下用户输入了与预填像素值相同的数字），
    // 需要在此处直接调用 onChange，确保失焦操作始终能提交值。
    if (!unitWillChange && finalVal === prevNumber) {
      const changeValue = String(parseFloat(finalVal)) + unit;
      onChange?.(changeValue);
    }
  }, [number, allowNegative, unit, unitDisabledList, onChange]);

  const isDefaultUnit = unitDisabledList.includes(unit)

  const suffix = useMemo(() => {
    if (customSuffix) {
      return customSuffix
    } else if (Array.isArray(unitOptions)) {
      // Hug badge 时直接替代单位选择器，不再显示下拉
      if (badge) {
        return <>{badge}</>
      }
      return (
        <Select
          tip='单位'
          style={{ padding: 0, fontSize: 10, ...unitSelectStyle }}
          defaultValue={unit}
          options={unitOptions}
          showIcon={showIcon}
          hideLabel={isDefaultUnit}
          iconClassName={unitIconClassName}
          onChange={setUnit}
          onAction={onAction}
          disabled={isDisabledUnit()}
        />
      )
    }

    return null
  }, [unit, isDefaultUnit, badge, unitOptions, onAction])

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

function incrementDecrement(inputNumber: string, keyEvent: 'ArrowUp' | 'ArrowDown', allowNegative = false) {
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

  if (allowNegative) return updatedNumber
  return Number(updatedNumber) > 0 ? updatedNumber : '0'
}
