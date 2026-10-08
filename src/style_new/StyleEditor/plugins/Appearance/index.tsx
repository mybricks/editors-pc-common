import React, { CSSProperties, useCallback, useMemo, useRef, useState } from 'react'

import {
  Panel,
  SketchPopup,
  InputNumber,
  VariableChip,
  VariableList,
  withApplyVariableOption,
  APPLY_VARIABLE_ACTION,
} from '../../components'
import { Opacity as OpacityIcon } from '../../icons/Opacity'
import { FixedWidth } from '../../icons/FixedWidth'
import { useDragNumber } from '../../hooks/useDragNumber'
import { isCssVarValue } from '../../hooks/useLengthVarBinding'
import { useCanvasOpacityVariables } from '../../hooks/useCanvasOpacityVariables'
import { resolveCssVarOpacity, formatOpacityDisplay } from '../../../core/resolve-css-var-opacity'
import { useStyleEditorContext, useStyleChange } from '../../context'
import type { VariableChipMenuOption } from '../../components/VariableChip'

import type { ChangeEvent, PanelBaseProps } from '../../type'

import css from './index.less'

interface AppearanceProps extends PanelBaseProps {
  value: CSSProperties
  onChange: ChangeEvent
}

/** 将 CSS opacity (0~1) 转换为百分比整数 (0~100) */
function opacityToPercent(opacity: any): number {
  const n = parseFloat(opacity)
  if (isNaN(n)) return 100
  return Math.round(n * 100)
}

/** 将百分比整数 (0~100) 转换为 CSS opacity */
function percentToOpacity(percent: number): number {
  return Math.min(1, Math.max(0, percent / 100))
}

const DETACH_VARIABLE_ACTION = 'detachVariable'
const OPACITY_UNIT_OPTIONS = [{ label: '%', value: '%' }]
const CHIP_STYLE = { flex: '1 1 0', minWidth: 0, width: 0, marginLeft: 4 }
const INPUT_STYLE = { flex: '1 1 0', minWidth: 0, width: 0, marginLeft: 4, padding: 0 }

export function Appearance({ value, onChange: fallbackOnChange, showTitle }: AppearanceProps) {
  const context = useStyleEditorContext()
  const targetDom = context?.targetDom ?? null
  const onChange = useStyleChange(fallbackOnChange)

  const { variableOptions } = useCanvasOpacityVariables()
  const hasVariables = variableOptions.length > 0

  const [pickerOpen, setPickerOpen] = useState(false)
  const [pickerMounted, setPickerMounted] = useState(false)
  const anchorRef = useRef<HTMLSpanElement>(null)

  const opacitySource = context?.effectiveStyle?.opacity
  // 数值 1 既可能来自声明，也可能只是默认/计算值，必须按来源区分。
  const declaredOpacity = context?.effectiveStyle
    ? (opacitySource?.type !== 'computed' ? opacitySource?.value : undefined)
    : context?.authoredStyle
      ? context.authoredStyle.opacity
      : value?.opacity
  const hasConfiguredOpacity = declaredOpacity != null && String(declaredOpacity).trim() !== '' &&
    !/^unset$/i.test(String(declaredOpacity).trim())
  const opacityRawValue = hasConfiguredOpacity ? declaredOpacity : undefined

  const varRef = isCssVarValue(opacityRawValue) ? (opacityRawValue as string) : undefined

  /** 变量解析出的具体 opacity 值（0~1 字符串） */
  const resolvedValue = useMemo(
    () => (varRef ? resolveCssVarOpacity(varRef, targetDom) : null),
    [varRef, targetDom]
  )

  /** 胶囊内展示文案：解析出的百分比整数 */
  const chipDisplayText = useMemo(
    () => formatOpacityDisplay(resolvedValue),
    [resolvedValue]
  )

  /** 解绑时落成的百分比整数文案（用于菜单提示） */
  const fallbackPercent = resolvedValue != null
    ? Math.round(parseFloat(resolvedValue) * 100)
    : opacityToPercent(opacityRawValue)

  const opacityPercent = useMemo(() => {
    if (varRef) return fallbackPercent
    return opacityToPercent(opacityRawValue)
  }, [varRef, fallbackPercent, opacityRawValue])
  const unitOptions = useMemo(
    () => withApplyVariableOption(OPACITY_UNIT_OPTIONS, hasVariables),
    [hasVariables]
  )

  const handleOpacityChange = useCallback(
    (percent: number) => {
      const nextValue = percentToOpacity(percent)
      // 未配置时输入 100% 也需要创建声明；比较原值，避免舍入损失。
      if (hasConfiguredOpacity && !varRef && nextValue === Number(opacityRawValue)) return
      onChange({ key: 'opacity', value: nextValue })
    },
    [onChange, hasConfiguredOpacity, opacityRawValue, varRef]
  )

  const handleReset = useCallback(() => {
    if (!hasConfiguredOpacity) return
    onChange({ key: 'opacity', value: null })
  }, [onChange, hasConfiguredOpacity])

  const handleInputChange = useCallback((inputValue: string | null) => {
    if (inputValue == null) {
      handleReset()
      return
    }
    const percent = parseFloat(inputValue)
    if (isNaN(percent)) return
    handleOpacityChange(Math.min(100, Math.max(0, Math.round(percent))))
  }, [handleOpacityChange, handleReset])

  const getDragPropsOpacity = useDragNumber({
    min: 0,
    max: 100,
    onDragStart: currentValue => {
      if (!varRef) return
      return Number(currentValue)
    },
    onDragChange: value => {
      if (varRef) handleOpacityChange(value)
    },
    onDragEnd: value => {
      handleOpacityChange(value)
    },
  })

  // 点击 + 是新增配置，显式写入完全不透明，而不是仅展开空输入框。
  const handleExpand = useCallback(() => {
    const result = onChange({ key: 'opacity', value: 1 })
    if (result && !result.applied) return
  }, [onChange])

  const openPicker = useCallback(() => {
    if (!hasVariables) return
    setPickerMounted(true)
    setPickerOpen(true)
  }, [hasVariables])

  const closePicker = useCallback(() => setPickerOpen(false), [])

  const selectVariable = useCallback((name: string) => {
    onChange({ key: 'opacity', value: `var(${name})` })
    setPickerOpen(false)
  }, [onChange])

  const detach = useCallback(() => {
    // 解绑：落成变量解析出的值（0~1），解析不到时退回当前百分比换算值
    const opacityVal = resolvedValue != null
      ? parseFloat(resolvedValue)
      : percentToOpacity(fallbackPercent)
    onChange({ key: 'opacity', value: Math.min(1, Math.max(0, opacityVal)) })
  }, [onChange, resolvedValue, fallbackPercent])

  const chipMenuOptions = useMemo<VariableChipMenuOption[]>(() => [
    {
      label: `固定值 (${fallbackPercent}%)`,
      value: DETACH_VARIABLE_ACTION,
      type: 'action',
      icon: <FixedWidth />,
    },
  ], [fallbackPercent])

  const handleChipMenuAction = useCallback((action: string) => {
    if (action === DETACH_VARIABLE_ACTION) detach()
  }, [detach])

  // 显式 100% 也是有效配置，不能把它当成未配置自动折叠。
  const effectiveCollapse = !hasConfiguredOpacity

  return (
    <Panel
      title='不透明度'
      showTitle={showTitle}
      showReset={true}
      showDelete={true}
      resetFunction={handleReset}
      onExpand={handleExpand}
      collapse={effectiveCollapse}
    >
      <Panel.Content>
        <Panel.Item className={css.inputItem}>
          <span
            className={`${css.inputIcon} ${css.opacityIcon}`}
            ref={anchorRef}
            {...(varRef
              ? getDragPropsOpacity(fallbackPercent, "{content:'拖拽调整不透明度（将解除变量绑定）',position:'left'}")
              : getDragPropsOpacity(opacityPercent, "{content:'拖拽调整不透明度',position:'left'}")
            )}
          >
            <OpacityIcon />
          </span>

          {varRef ? (
            <VariableChip
              value={varRef}
              resolvedValue={resolvedValue}
              display={chipDisplayText}
              unitLabel='%'
              defaultUnit=''
              onRequestPicker={openPicker}
              menuOptions={chipMenuOptions}
              onMenuAction={handleChipMenuAction}
              onInputValue={(inputVal) => {
                const n = parseFloat(inputVal)
                if (!isNaN(n)) {
                  onChange({ key: 'opacity', value: percentToOpacity(n) })
                }
              }}
              onDetach={detach}
              style={CHIP_STYLE}
            />
          ) : (
            <InputNumber
              style={INPUT_STYLE}
              value={hasConfiguredOpacity ? opacityPercent : undefined}
              defaultUnitValue='%'
              unitOptions={unitOptions}
              clearable={hasConfiguredOpacity}
              onClear={handleReset}
              placeholder=''
              showIcon={true}
              showIconOnHover={true}
              onChange={handleInputChange}
              onAction={action => {
                if (action === APPLY_VARIABLE_ACTION) openPicker()
              }}
            />
          )}

          {pickerMounted && (
            <SketchPopup
              open={pickerOpen}
              mounted={pickerMounted}
              anchorRef={anchorRef}
              className={css.variablePopup}
              onClose={closePicker}
            >
              <VariableList
                list={variableOptions}
                open={pickerOpen}
                selectedName={varRef}
                onClose={closePicker}
                onSelect={(item) => selectVariable(item.name)}
                renderValue={(item) => `${Math.round(parseFloat(item.value) * 100)}%`}
                emptyText='当前画布没有可用的不透明度变量'
              />
            </SketchPopup>
          )}
        </Panel.Item>
      </Panel.Content>
    </Panel>
  )
}
