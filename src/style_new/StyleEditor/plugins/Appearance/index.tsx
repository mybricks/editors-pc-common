import React, { CSSProperties, useCallback, useMemo, useRef, useState } from 'react'

import { Panel, SketchPopup, VariableChip, VariableList } from '../../components'
import { Opacity as OpacityIcon } from '../../icons/Opacity'
import { Variable } from '../../icons/Variable'
import { FixedWidth } from '../../icons/FixedWidth'
import { useDragNumber } from '../../hooks/useDragNumber'
import { isCssVarValue } from '../../hooks/useLengthVarBinding'
import { useCanvasOpacityVariables } from '../../hooks/useCanvasOpacityVariables'
import { resolveCssVarOpacity, formatOpacityDisplay } from '../../../core/resolve-css-var-opacity'
import { useStyleEditorContext } from '../../context'
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

export function Appearance({ value, onChange, showTitle, collapse }: AppearanceProps) {
  const [opacityForceKey, setOpacityForceKey] = useState(0)

  const context = useStyleEditorContext()
  const targetDom = context?.targetDom ?? null

  const { variableOptions } = useCanvasOpacityVariables()
  const hasVariables = variableOptions.length > 0

  const [pickerOpen, setPickerOpen] = useState(false)
  const [pickerMounted, setPickerMounted] = useState(false)
  const anchorRef = useRef<HTMLDivElement>(null)

  const opacityRawValue = value?.opacity

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

  const handleOpacityChange = useCallback(
    (val: string) => {
      const trimmed = val.trim()
      if (!trimmed) {
        onChange({ key: 'opacity', value: 0 })
        return
      }
      const num = parseFloat(trimmed)
      if (!isNaN(num)) {
        onChange({ key: 'opacity', value: percentToOpacity(num) })
      }
    },
    [onChange]
  )

  const getDragPropsOpacity = useDragNumber({
    min: 0,
    max: 100,
    // 不 return → useCustomEnd=false → mouseup 时 hook 触发 blur → onBlur 里补回 %
    onDragChange: value => {
      handleOpacityChange(String(value))
    },
  })

  const handleReset = useCallback(() => {
    onChange([{ key: 'opacity', value: null }])
    setOpacityForceKey(k => k + 1)
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

  // 未设置不透明度（默认 100%）时强制折叠，与效果面板空状态一致
  const effectiveCollapse = (!varRef && opacityPercent === 100) ? true : collapse

  return (
    <Panel
      title='不透明度'
      showTitle={showTitle}
      showReset={true}
      showDelete={true}
      resetFunction={handleReset}
      collapse={effectiveCollapse}
    >
      <Panel.Content style={{ paddingTop: 0 }}>
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
            <>
              <VariableChip
                value={varRef}
                resolvedValue={resolvedValue}
                display={chipDisplayText ? `${chipDisplayText}%` : undefined}
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
                style={{ flex: '1 1 0', minWidth: 0, width: 0, marginLeft: 4 }}
              />
              <SketchPopup
                open={pickerOpen}
                mounted={pickerMounted}
                anchorRef={anchorRef}
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
            </>
          ) : (
            <>
              <input
                key={opacityForceKey}
                type='text'
                className={css.opacityInput}
                defaultValue={`${opacityPercent}%`}
                onFocus={e => e.target.select()}
                onBlur={e => {
                  const raw = e.target.value.trim().replace(/%$/, '')
                  if (!raw || isNaN(parseFloat(raw))) {
                    handleOpacityChange('0')
                    e.target.value = '0%'
                  } else {
                    const num = Math.round(Math.min(100, Math.max(0, parseFloat(raw))))
                    handleOpacityChange(String(num))
                    e.target.value = `${num}%`
                  }
                }}
                onKeyDown={e => {
                  if (e.key === 'Enter') {
                    e.currentTarget.blur()
                  }
                }}
              />
              {hasVariables && (
                <span
                  className={css.varBtn}
                  data-mybricks-tip='应用变量...'
                  onClick={openPicker}
                >
                  <Variable />
                </span>
              )}
              {pickerMounted && (
                <SketchPopup
                  open={pickerOpen}
                  mounted={pickerMounted}
                  anchorRef={anchorRef}
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
            </>
          )}
        </Panel.Item>
      </Panel.Content>
    </Panel>
  )
}
