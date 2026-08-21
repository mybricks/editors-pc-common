import { CSSProperties, useCallback, useMemo, useRef, useState } from 'react'

import { useStyleEditorContext } from '../context'
import { useCanvasLengthVariables } from './useCanvasLengthVariables'
import { useDragNumber } from './useDragNumber'
import { resolveCssVarLength } from '../../core/resolve-css-var-length'
import { formatLengthDisplay, splitValueAndUnit } from '../utils'
import type { CssVarLengthOption } from '../../core/resolve-css-var-length'

/** 值是否为 CSS 变量引用，如 var(--spacing-lg) */
export function isCssVarValue(val?: string | number | null): val is string {
  return typeof val === 'string' && val.trim().toLowerCase().startsWith('var(')
}

export interface LengthVarBindingOptions {
  /** 字段当前值，可能是 var(--x) */
  value: string | number | null | undefined
  /** 绑定、解绑、胶囊内输入、拖拽都经由这里落值 */
  onChange: (next: string) => void
  /** 变量解析不到时的兜底值，一般传 DOM 计算值，如 `14px` */
  fallback?: string
  /** 未传 fallback 时，按此 CSS 属性读画布节点的计算值兜底，如 paddingTop */
  computedProp?: string
  /** 绑定态拖拽的下限，负值域字段（如阴影偏移）需传 -Infinity */
  min?: number
}

export interface LengthVarBinding {
  /** 当前绑定的变量引用，未绑定为 undefined */
  varRef?: string
  /** 变量解析出的具体长度，如 24px */
  resolvedValue: string | null
  /**
   * 变量解析出的数值，供联动换算使用（如行高按字号倍数换算）。
   * 未绑定或解析不出数字时为 null，调用方据此决定跳过还是用兜底值。
   */
  resolvedNumber: number | null
  /** 胶囊内展示的文案，px 省略单位 */
  displayText?: string
  /** 解绑与拖拽的起点：变量解析值，解析不到时用 fallback */
  fallbackValue: string
  /** 补全裸数字输入用的单位，取自当前解析值 */
  defaultUnit: string
  /** 画布上可用的尺寸变量 */
  variables: CssVarLengthOption[]
  hasVariables: boolean
  /** 挂到拖拽手柄上，弹层以它为锚点定位到当前字段 */
  anchorRef: React.RefObject<HTMLDivElement>
  pickerOpen: boolean
  pickerMounted: boolean
  openPicker: () => void
  closePicker: () => void
  selectVariable: (name: string) => void
  /** 解绑：落成变量当前值，解析不到时退回兜底值 */
  detach: () => void
  /** 绑定态拖拽手柄的 props：一动就落成数值，即自动解绑 */
  dragProps: (tip?: string) => {
    style: CSSProperties
    'data-mybricks-tip'?: string
    onMouseDown: (e: React.MouseEvent) => void
  }
}

/**
 * 长度类字段的 CSS 变量绑定编排：变量列表、弹层开合、解析回显、解绑与拖拽解绑。
 *
 * 各插件只需提供当前值、写值函数与兜底值，绑定态/未绑定态的渲染交给
 * VariableNumberInput。颜色等其他值域可照此另写一个 hook，共用底层的
 * core/css-var 解析与 VariableList / VariableChip 展示件。
 */
export function useLengthVarBinding({
  value,
  onChange,
  fallback,
  computedProp,
  min,
}: LengthVarBindingOptions): LengthVarBinding {
  const context = useStyleEditorContext()
  const targetDom = context?.targetDom ?? null
  const { variableOptions } = useCanvasLengthVariables()

  const [pickerOpen, setPickerOpen] = useState(false)
  // 首次打开后再挂载弹层，避免每个字段都常驻一份变量列表
  const [pickerMounted, setPickerMounted] = useState(false)
  const anchorRef = useRef<HTMLDivElement>(null)

  const varRef = isCssVarValue(value) ? value : undefined
  const resolvedValue = useMemo(
    () => (varRef ? resolveCssVarLength(varRef, targetDom) : null),
    [varRef, targetDom]
  )

  // 解绑要落成用户当前看到的值，未显式给兜底时读画布节点的计算值
  const computedFallback = useMemo(() => {
    if (!computedProp || !targetDom) return ''
    const raw = (window.getComputedStyle(targetDom) as any)[computedProp]
    const parsed = parseFloat(String(raw))
    return isNaN(parsed) ? '' : `${Math.round(parsed)}px`
  }, [computedProp, targetDom, value])

  // calc() 等表达式 parseFloat 拿不到数字，解绑/拖拽改用计算后的 px，避免胶囊里塞整段公式
  const resolvedNumericPart = resolvedValue
    ? splitValueAndUnit(resolvedValue)[0]
    : null
  const fallbackValue = (
    resolvedNumericPart != null
      ? resolvedValue
      : (computedFallback || fallback || resolvedValue)
  ) || '0px'
  const resolvedNumber = useMemo(() => {
    if (resolvedNumericPart != null) {
      const parsed = parseFloat(String(resolvedNumericPart))
      if (!isNaN(parsed)) return parsed
    }
    const fromComputed = parseFloat(String(computedFallback || fallback || ''))
    return isNaN(fromComputed) ? null : fromComputed
  }, [resolvedNumericPart, computedFallback, fallback])

  const defaultUnit = useMemo(() => {
    const [, unit] = splitValueAndUnit(fallbackValue)
    return unit || 'px'
  }, [fallbackValue])

  const hasVariables = variableOptions.length > 0

  const openPicker = useCallback(() => {
    if (!variableOptions.length) return
    setPickerMounted(true)
    setPickerOpen(true)
  }, [variableOptions.length])

  const closePicker = useCallback(() => setPickerOpen(false), [])

  const selectVariable = useCallback((name: string) => {
    onChange(`var(${name})`)
    setPickerOpen(false)
  }, [onChange])

  const detach = useCallback(() => onChange(fallbackValue), [onChange, fallbackValue])

  // 只点击不拖动时值没变，保持绑定不动
  const dragStartRef = useRef(0)
  const unitRef = useRef(defaultUnit)
  unitRef.current = defaultUnit
  const getDragProps = useDragNumber({
    min,
    onDragStart: (currentValue) => {
      const parsed = parseFloat(currentValue)
      const startValue = isNaN(parsed) ? 0 : Math.round(parsed)
      dragStartRef.current = startValue
      return startValue
    },
    onDragChange: (val) => {
      if (val !== dragStartRef.current) onChange(`${val}${unitRef.current}`)
    },
    onDragEnd: (finalValue) => {
      if (finalValue !== dragStartRef.current) onChange(`${finalValue}${unitRef.current}`)
    },
  })

  const dragProps = useCallback(
    (tip?: string) => getDragProps(fallbackValue, tip),
    [getDragProps, fallbackValue]
  )

  return {
    varRef,
    resolvedValue,
    resolvedNumber,
    displayText: formatLengthDisplay(resolvedValue, computedFallback || fallback),
    fallbackValue,
    defaultUnit,
    variables: variableOptions,
    hasVariables,
    anchorRef,
    pickerOpen,
    pickerMounted,
    openPicker,
    closePicker,
    selectVariable,
    detach,
    dragProps,
  }
}
