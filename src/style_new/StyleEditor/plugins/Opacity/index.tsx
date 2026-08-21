import React, { CSSProperties, useCallback, useEffect, useMemo, useRef, useState } from 'react'

import { Panel, Slider, SketchPopup, VariableChip, VariableList } from '../../components'
import { FixedWidth } from '../../icons/FixedWidth'
import { isCssVarValue } from '../../hooks/useLengthVarBinding'
import { useCanvasOpacityVariables } from '../../hooks/useCanvasOpacityVariables'
import { resolveCssVarOpacity, formatOpacityDisplay } from '../../../core/resolve-css-var-opacity'
import { useStyleEditorContext } from '../../context'
import type { VariableChipMenuOption } from '../../components/VariableChip'

import type { ChangeEvent, PanelBaseProps } from '../../type'

interface OpacityProps extends PanelBaseProps {
  value: CSSProperties
  onChange: ChangeEvent
}

const DETACH_VARIABLE_ACTION = 'detachVariable'

export function Opacity ({ value, onChange, config, showTitle, collapse }: OpacityProps) {
  const [forceRenderKey, setForceRenderKey] = useState<number>(Math.random())
  const [isReset, setIsReset] = useState(false)

  const context = useStyleEditorContext()
  const targetDom = context?.targetDom ?? null

  const { variableOptions } = useCanvasOpacityVariables()
  const hasVariables = variableOptions.length > 0

  const [pickerOpen, setPickerOpen] = useState(false)
  const [pickerMounted, setPickerMounted] = useState(false)
  const anchorRef = useRef<HTMLDivElement>(null)

  const opacityRawValue = value?.opacity
  const varRef = isCssVarValue(opacityRawValue) ? (opacityRawValue as string) : undefined

  const resolvedValue = useMemo(
    () => (varRef ? resolveCssVarOpacity(varRef, targetDom) : null),
    [varRef, targetDom]
  )

  const chipDisplayText = useMemo(
    () => formatOpacityDisplay(resolvedValue),
    [resolvedValue]
  )

  const defaultValue = useMemo(() => {
    if (isReset) return 1
    if (varRef && resolvedValue) return parseFloat(resolvedValue)
    return isNaN(parseFloat(opacityRawValue as any)) ? 1 : parseFloat(opacityRawValue as any)
  }, [value, isReset, varRef, resolvedValue])

  /** 解绑时落成的 0~1 值，用于菜单提示与实际写值 */
  const fallbackOpacity = resolvedValue != null
    ? parseFloat(resolvedValue)
    : (isNaN(parseFloat(opacityRawValue as any)) ? 1 : parseFloat(opacityRawValue as any))

  useEffect(() => {
    if (isReset && opacityRawValue != null) {
      setIsReset(false)
    }
  }, [value, isReset])

  const refresh = useCallback(() => {
    onChange({ key: 'opacity', value: null })
    setIsReset(true)
    setForceRenderKey(prev => prev + 1)
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
    onChange({ key: 'opacity', value: Math.min(1, Math.max(0, fallbackOpacity)) })
  }, [onChange, fallbackOpacity])

  const chipMenuOptions = useMemo<VariableChipMenuOption[]>(() => [
    {
      label: `固定值 (${Math.round(fallbackOpacity * 100)}%)`,
      value: DETACH_VARIABLE_ACTION,
      type: 'action',
      icon: <FixedWidth />,
    },
  ], [fallbackOpacity])

  const handleChipMenuAction = useCallback((action: string) => {
    if (action === DETACH_VARIABLE_ACTION) detach()
  }, [detach])

  return (
    <Panel title='不透明度' showTitle={showTitle} showReset={true} resetFunction={refresh} collapse={collapse}>
      <Panel.Content>
        <React.Fragment key={forceRenderKey}>
          {/* 锚点始终挂在面板容器上，供 SketchPopup 对齐 */}
          <div ref={anchorRef} style={{ position: 'absolute', pointerEvents: 'none' }} />

          {varRef ? (
            <Panel.Item style={{ padding: '0 8px' }}>
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
                    onChange({ key: 'opacity', value: Math.min(1, Math.max(0, n / 100)) })
                  }
                }}
                onDetach={detach}
              />
            </Panel.Item>
          ) : (
            <Slider
              defaultValue={defaultValue}
              onChange={(sliderValue) => onChange({key: 'opacity', value: sliderValue})}
              hasVariables={hasVariables}
              onApplyVariable={openPicker}
            />
          )}

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
        </React.Fragment>
      </Panel.Content>
    </Panel>
  )
}
