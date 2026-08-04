import React, {
  useMemo,
  useState,
  useCallback,
  useRef,
  useLayoutEffect,
} from 'react'

import { Input, Select } from '..'
import { splitValueAndUnit } from '../../utils'
import { useInputNumber, useUpdateEffect } from '../../hooks'

import type { InputProps } from '..'

interface UnitOption {
  label: string;
  value: string;
}
interface InputNumberProps extends Omit<InputProps, 'onChange' | 'value'> {
  defaultUnitValue?: string
  unitDisabledList?: Array<string>
  unitOptions?: Array<UnitOption>
  /** 覆盖输入框回显文字，key 为 unit value，value 为展示文字；不影响下拉 label */
  unitDisplayLabelMap?: Record<string, string>
  /** 允许负数 */
  allowNegative?: boolean,
  showIcon?: boolean
  /** hover 时隐藏单位文案、仅显示下拉箭头（需配合 showIcon） */
  showIconOnHover?: boolean
  prefixTip?: string
  type?: string
  align?: 'left' | 'right'
  onFocus?: () => void;
  onAction?: (value: any) => void;
  unitIconClassName?: string;
  unitSelectStyle?: React.CSSProperties;
  /** 在单位选择器前渲染的额外徽标内容，如 "Hug" */
  badge?: React.ReactNode;
  /** 输入框占位文案，默认“默认” */
  placeholder?: string;
  /** 失焦时输入为空的兜底值，设置后会自动补填并提交，而非显示 placeholder */
  fallbackValue?: number | string;
  /** 无值时隐藏单位文案（仍保留下拉箭头，便于操作如「移除」） */
  hideUnitWhenEmpty?: boolean;
  /** 这些单位不显示文案（仍保留下拉箭头），如 ['px'] */
  unitHideLabelList?: Array<string>;
  value?: string | number | null;
  /** 空值回车/失焦且无 fallbackValue 时传 null，供上层删除对应 CSS 属性 */
  onChange?: (value: string | null) => void;
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
  showIconOnHover = false,
  type = void 0,
  onAction,
  unitIconClassName,
  unitSelectStyle,
  badge,
  placeholder = '默认',
  fallbackValue,
  hideUnitWhenEmpty = false,
  unitHideLabelList = ['px'],
}: InputNumberProps) {
  // `defaultValue` 是各样式面板的外部回显值；未传受控 value 时也要随选中目标同步。
  const externalValue = value !== undefined ? value : defaultValue
  const [unit, setUnit] = useState<string>(getUnit(externalValue, defaultUnitValue, unitOptions))
  const [number, handleNumberChange] = useInputNumber<string | number | undefined>(externalValue)
  /** 外部清空同步时跳过 [unit,number] 的 onChange，避免回写 'default' 字符串污染上层 */
  const skipUnitNumberOnChangeRef = useRef(false)
  const isValueSyncInitializedRef = useRef(false)
  const [displayValue, setDisplayValue] = useState(() => {
    const initVal = externalValue
    if (!initVal) return ''
    // default / fit-content 等关键字：输入框留空，用 placeholder 展示（如「默认（xx）」）
    if (typeof unit !== 'undefined' && typeof initVal !== 'undefined' && unit === initVal) {
      return ''
    }
    if (unitDisabledList.includes(String(initVal))) {
      return ''
    }
    return number
  })

  const isEmptyValue = !displayValue && !externalValue

  const isDisabledUnit = useCallback(() => {
    // default 表示未配置：输入框与下拉仍可用，便于继续输入或切换单位
    if (unit === 'default') return !!disabled;
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
        // 空值或非法值：有兜底则补填，否则清空并通知上层删除属性
        if (typeof fallbackValue !== 'undefined') {
          const fallbackStr = String(fallbackValue);
          e.target.value = fallbackStr;
          handleNumberChange(fallbackStr);
          setDisplayValue(fallbackStr);
          const changeValue = String(parseFloat(fallbackStr)) + unit;
          onChange?.(changeValue);
        } else {
          setDisplayValue('');
          e.target.value = '';
          onChange?.(null);
        }
        return;
      }
      // 与 onBlur 对齐：合法数字回车时规范化并提交
      let submitNumber = trimmed;
      if (!allowNegative) {
        submitNumber = Number(submitNumber) > 0 ? submitNumber : '0';
      }
      const prevNumber = number;
      const unitWillChange = unitDisabledList.includes(unit);
      const submitUnit = unitWillChange ? 'px' : unit;
      if (unitWillChange) {
        setUnit('px');
      }
      const finalVal = handleNumberChange(submitNumber);
      e.target.value = finalVal;
      setDisplayValue(finalVal);
      // useUpdateEffect([unit, number]) 只在 unit/number 变化时触发；
      // 两者均未变时需直接提交，确保回车始终生效
      if (!unitWillChange && finalVal === prevNumber) {
        onChange?.(String(parseFloat(finalVal)) + submitUnit);
      }
    }
  }, [number, unit, unitDisabledList, fallbackValue, onChange, handleNumberChange, allowNegative]);

  const onBlur = useCallback((e: {
    target: any,
  }) => {
    const trimmed = e.target.value.trim();

    // 空值或非法值：若有兜底值则补填并提交，否则回到默认状态并删除属性
    if (!trimmed || isNaN(parseFloat(trimmed))) {
      if (typeof fallbackValue !== 'undefined') {
        const fallbackStr = String(fallbackValue);
        e.target.value = fallbackStr;
        handleNumberChange(fallbackStr);
        setDisplayValue(fallbackStr);
        const changeValue = String(parseFloat(fallbackStr)) + unit;
        onChange?.(changeValue);
      } else {
        setDisplayValue('');
        e.target.value = '';
        onChange?.(null);
      }
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
    const submitUnit = unitWillChange ? 'px' : unit;
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
      onChange?.(String(parseFloat(finalVal)) + submitUnit);
    }
  }, [number, allowNegative, unit, unitDisabledList, onChange, fallbackValue, handleNumberChange]);

  const isDefaultUnit = unitDisabledList.includes(unit)

  const suffix = useMemo(() => {
    if (customSuffix) {
      return customSuffix
    } else if (Array.isArray(unitOptions)) {
      // Hug badge 时直接替代单位选择器，不再显示下拉
      if (badge) {
        return <>{badge}</>
      }
      // 仅一个单位选项时无切换必要，不展示下拉（如只有 px）
      if (unitOptions.length <= 1) {
        return null
      }
      // 无值 / 指定单位（如 px）隐藏文案，仍保留下拉箭头与布局
      const hideUnitLabel =
        isDefaultUnit ||
        (hideUnitWhenEmpty && isEmptyValue) ||
        unitHideLabelList.includes(unit)
      return (
        <Select
          tip='单位'
          style={{ padding: 0, fontSize: 10, ...unitSelectStyle }}
          value={unit}
          options={unitOptions}
          showIcon={showIcon}
          showIconOnHover={showIconOnHover}
          hideLabel={hideUnitLabel}
          iconClassName={unitIconClassName}
          onChange={setUnit}
          onAction={onAction}
          disabled={isDisabledUnit()}
        />
      )
    }

    return null
  }, [unit, isDefaultUnit, badge, unitOptions, onAction, hideUnitWhenEmpty, isEmptyValue, unitHideLabelList, showIcon, showIconOnHover])

  // 新选中组件的值在首帧绘制前同步到内部 state，避免旧值短暂闪现。
  useLayoutEffect(() => {
    if (!isValueSyncInitializedRef.current) {
      isValueSyncInitializedRef.current = true
      return
    }

    // 外部清空（删除属性）时同步清空回显，单位回到 default（若有）以便下拉勾选「默认」
    if (externalValue == null || externalValue === '') {
      setDisplayValue('')
      // 重置内部数字，避免清值后残留旧数字，切单位时拼出 200% 等
      skipUnitNumberOnChangeRef.current = true
      handleNumberChange('0')
      const hasDefaultUnit = unitOptions?.some((o) => o.value === 'default')
      if (hasDefaultUnit) {
        setUnit('default')
      } else {
        setUnit(getUnit(undefined, defaultUnitValue, unitOptions))
      }
      return
    }

    const nextUnit = getUnit(externalValue, defaultUnitValue, unitOptions)
    setUnit(nextUnit)
    const nextNumber = handleNumberChange(String(externalValue))
    if (typeof nextUnit !== 'undefined' && nextUnit === externalValue) {
      // default 等「未配置」单位：留空以展示 placeholder，不要把「默认」写进输入框
      if (externalValue === 'default' || unitDisabledList.includes(String(externalValue))) {
        setDisplayValue('')
      } else {
        const unitLabel = unitDisplayLabelMap[nextUnit] ?? unitOptions?.find(o => o.value === nextUnit)?.label ?? nextUnit
        setDisplayValue(unitLabel)
      }
    } else {
      // 使用 handleNumberChange 的返回值，避免闭包中的旧 number
      setDisplayValue(nextNumber)
    }
  }, [externalValue])

  useUpdateEffect(() => {
    if (skipUnitNumberOnChangeRef.current) {
      skipUnitNumberOnChangeRef.current = false
      if (unitDisabledList.includes(unit)) {
        setDisplayValue('')
      }
      return
    }

    if (unitDisabledList.includes(unit)) {
      setDisplayValue('')
      // 用户从下拉选「默认」时需通知上层清空；外部清空同步走 skipRef，不会进到这里
      onChange?.(unit)
      return
    }

    const parsed = parseFloat(String(number))
    // 切单位时若当前无有效数字，用 fallbackValue 填充，避免产出 NaNpx / 空值
    if (number === '' || number == null || isNaN(parsed)) {
      if (typeof fallbackValue !== 'undefined') {
        const fallbackStr = String(fallbackValue)
        const fallbackNum = String(parseFloat(fallbackStr))
        handleNumberChange(fallbackStr)
        setDisplayValue(fallbackNum)
        onChange?.(fallbackNum + unit)
      }
      // 无 fallback 且无有效数字：不伪造 0+unit，由上层在拿到真实提交值后再处理
      return
    }

    const changeValue = String(parsed) + unit
    setDisplayValue(number)
    // 外部 value 同步进来的变更不再回写，避免受控回显触发二次 onChange
    if (externalValue != null && externalValue !== '' && String(externalValue) === changeValue) {
      return
    }
    // 默认态也会提交真实 number+unit（清值后内部为 0）；上层按需用实测值替换
    onChange?.(changeValue)
  }, [unit, number])

  return (
    <Input
      style={style}
      prefix={prefix}
      prefixTip={prefixTip}
      value={displayValue}
      placeholder={placeholder}
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
  // 解析出的单位在选项中（如 12px → px）
  if (unitOptions.some((unitOption: UnitOption) => unitOption.value === unit)) {
    return unit as string
  }
  // 整值本身就是合法单位关键字（如 auto / fit-content），且在选项中
  if (unitOptions.some((unitOption: UnitOption) => unitOption.value === value)) {
    return value
  }
  // 未识别单位（如 letter-spacing 的 normal）时，回退到默认单位，避免把关键字裸露成「单位」
  if (typeof defaultUnitValue !== 'undefined') {
    return defaultUnitValue
  }
  return unit || unitOptions[0]?.value || ''
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
