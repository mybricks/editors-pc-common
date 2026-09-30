import React, { CSSProperties, useCallback, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { useStyleChange, useStyleClear, useStyleEditorContext } from '../../context'

import {
  Panel,
  BorderRadiusSplitOutlined,
  BorderTopLeftRadiusOutlined,
  BorderTopRightRadiusOutlined,
  BorderBottomLeftRadiusOutlined,
  BorderBottomRightRadiusOutlined,
  VariableNumberInput,
  withApplyVariableOption,
  APPLY_VARIABLE_ACTION,
} from '../../components'
import { allEqual } from '../../utils'
import { useDragNumber, useLengthInputDrag, useLengthVarBinding } from '../../hooks'
import { useStyleDisplayValue } from '../../hooks/useStyleDisplayValue'
import { expandFourShorthand } from '../../../core/shorthand-normalizer'
import type { ChangeEvent, PanelBaseProps } from '../../type'
import css from './index.less'

interface BorderRadiusProps extends PanelBaseProps {
  value: CSSProperties
  onChange: ChangeEvent
}

const UNIT_OPTIONS = [
  { label: 'px', value: 'px' },
  { label: '%', value: '%' },
]
const DEFAULT_UNIT_OPTION = { label: '默认', value: 'default' }
const DEFAULT_UNIT_DIVIDER = { label: '', value: '__borderRadiusDefaultDivider__', type: 'divider' as const }
const UNIT_DISABLED_LIST = ['default']
const DEFAULT_STYLE = { padding: 0, fontSize: 10, minWidth: 71, marginLeft: 4 }
const DEFAULT_STYLE_NEW = { padding: 0, fontSize: 10, marginLeft: 0 }
const CHIP_STYLE = { flex: '1 1 0', minWidth: 0, width: 0, marginLeft: 4 }
const RADIUS_KEYS = [
  'borderTopLeftRadius',
  'borderTopRightRadius',
  'borderBottomRightRadius',
  'borderBottomLeftRadius',
] as const

function withDefaultUnitOption(options: typeof UNIT_OPTIONS, clearable: boolean) {
  return clearable ? [DEFAULT_UNIT_OPTION, DEFAULT_UNIT_DIVIDER, ...options] : options
}

function stripImportant(value: CSSProperties): CSSProperties & Record<string, any> {
  const next: Record<string, any> = { ...value }
  Object.entries(next).forEach(([key, item]) => {
    if (typeof item === 'string') next[key] = item.replace(/!.*$/, '')
  })
  return next
}

function expandBorderRadiusShorthand(value: CSSProperties): CSSProperties & Record<string, any> {
  const next = stripImportant(value)
  const shorthand = next.borderRadius
  if (shorthand == null) return next

  const expanded = expandFourShorthand(shorthand)
  if (!expanded) return next
  RADIUS_KEYS.forEach((key, index) => {
    if (next[key] == null || next[key] === '') next[key] = expanded[index]
  })
  return next
}

function getUnifiedRadiusValue(value: Record<string, any>): string | null {
  const cssWide = /^(initial|inherit|unset|revert|revert-layer)$/i
  const values = RADIUS_KEYS
    .map(key => value[key])
    .filter(item => item != null && String(item).trim() !== '' && !cssWide.test(String(item).trim()))
  if (values.length === 0) return null
  return String(values[0])
}

export function BorderRadius({ value, onChange: fallbackOnChange, config }: BorderRadiusProps) {
  const context = useStyleEditorContext()
  const onChange = useStyleChange(fallbackOnChange)
  const topLeftDisplay = useStyleDisplayValue('borderTopLeftRadius')
  const topRightDisplay = useStyleDisplayValue('borderTopRightRadius')
  const bottomRightDisplay = useStyleDisplayValue('borderBottomRightRadius')
  const bottomLeftDisplay = useStyleDisplayValue('borderBottomLeftRadius')
  const radiusPreview: Record<typeof RADIUS_KEYS[number], string | undefined> = {
    borderTopLeftRadius: topLeftDisplay.displaySource === 'normal-computed' ? topLeftDisplay.computedPreview : undefined,
    borderTopRightRadius: topRightDisplay.displaySource === 'normal-computed' ? topRightDisplay.computedPreview : undefined,
    borderBottomRightRadius: bottomRightDisplay.displaySource === 'normal-computed' ? bottomRightDisplay.computedPreview : undefined,
    borderBottomLeftRadius: bottomLeftDisplay.displaySource === 'normal-computed' ? bottomLeftDisplay.computedPreview : undefined,
  }
  const previewCorners = RADIUS_KEYS.map(key => radiusPreview[key])
  const allCornersAvailable = previewCorners.every(item => item !== undefined)
  const unifiedPreview = allCornersAvailable && allEqual(previewCorners) ? previewCorners[0] : undefined
  const mixedPreview = allCornersAvailable && !unifiedPreview
  // 圆角的计算值通常是 0px，但不能把它当成用户已配置的零圆角。
  const configuredValue: Record<string, any> = {}
  for (const key of ['borderRadius', ...RADIUS_KEYS]) {
    const source = context?.effectiveStyle?.[key]
    const winner = context?.getStyleProperty?.(key).winner
    const raw = source && source.type !== 'computed'
      ? source.value
      : context?.getStyleProperty
        ? (winner?.currentState ? winner.value : undefined)
        : context?.effectiveStyle
        ? (source?.type !== 'computed' ? source?.value : undefined)
        : context?.authoredStyle ? context.authoredStyle[key] : value?.[key]
    if (raw != null && String(raw).trim() !== '' && !/^unset(?:\s*!important)?$/i.test(String(raw).trim())) {
      configuredValue[key] = raw
    }
  }
  const editorValue = expandBorderRadiusShorthand(configuredValue)
  for (const key of RADIUS_KEYS) {
    // 单角的 unset/未配置优先于简写展开，不能被 borderRadius 再填回旧值。
    if (context?.getStyleProperty || context?.effectiveStyle?.[key]) editorValue[key] = configuredValue[key]
  }
  delete editorValue.borderRadius
  const modeValue = Object.keys(configuredValue).length === 0 && allCornersAvailable
    ? radiusPreview
    : editorValue
  const [{ useImportant, disableBorderRadius }] = useState({ useImportant: false, disableBorderRadius: false, ...config })
  const [{ radiusToggleValue }, setToggleValue] = useState(getToggleDefaultValue(modeValue))
  const [radiusValue, setRadiusValue] = useState(() => expandBorderRadiusShorthand(editorValue))
  const radiusValueRef = useRef(radiusValue)
  const getConfiguredDragProps = useDragNumber({ continuous: true })
  const allRadiusClear = useStyleClear(RADIUS_KEYS)
  const canReset = !disableBorderRadius && !!allRadiusClear.clear
  const topLeftClear = useStyleClear('borderTopLeftRadius')
  const topRightClear = useStyleClear('borderTopRightRadius')
  const bottomRightClear = useStyleClear('borderBottomRightRadius')
  const bottomLeftClear = useStyleClear('borderBottomLeftRadius')
  const fieldClear = {
    borderTopLeftRadius: topLeftClear,
    borderTopRightRadius: topRightClear,
    borderBottomRightRadius: bottomRightClear,
    borderBottomLeftRadius: bottomLeftClear,
  }

  useLayoutEffect(() => {
    const next = expandBorderRadiusShorthand(editorValue)
    radiusValueRef.current = next
    setRadiusValue(previous => RADIUS_KEYS.every(key => previous[key] === next[key]) ? previous : next)
    const nextToggle = getToggleDefaultValue(modeValue).radiusToggleValue
    if (nextToggle !== radiusToggleValue) {
      setToggleValue({ radiusToggleValue: nextToggle })
    }
  }, [context?.targetDom, context?.effectiveStyle, editorValue.borderRadius, editorValue.borderTopLeftRadius, editorValue.borderTopRightRadius, editorValue.borderBottomRightRadius, editorValue.borderBottomLeftRadius, ...previewCorners])

  const handleChange = useCallback((changes: CSSProperties & Record<string, any>, borderMode: 'all' | 'split' = radiusToggleValue) => {
    const current: Record<string, any> = { ...radiusValueRef.current }
    const next = { ...current, ...changes }
    const hasClear = Object.values(changes).some(item => item == null || item === 'default')
    const complete = RADIUS_KEYS.every(key => next[key] !== null && next[key] !== undefined && next[key] !== '')
    let keys: readonly string[] = Object.keys(changes)
    if (!hasClear && complete) {
      keys = RADIUS_KEYS
    }
    const result = onChange(keys.map(key => ({
      key,
      value: next[key] == null ? null : `${next[key]}${useImportant ? '!important' : ''}`,
      borderMode,
    })))
    if (result?.clearUnsupported || (result && !result.applied)) return
    radiusValueRef.current = next
    setRadiusValue(next)
  }, [onChange, radiusToggleValue, useImportant])

  const commitUnifiedDrag = (next: string) => handleChange(Object.fromEntries(
    RADIUS_KEYS.map(key => [key, next])
  ), 'all')
  const getUnifiedDragProps = useLengthInputDrag(radiusValue.borderTopLeftRadius ?? unifiedPreview, commitUnifiedDrag)
  const getTopLeftDragProps = useLengthInputDrag(radiusValue.borderTopLeftRadius ?? radiusPreview.borderTopLeftRadius, next => handleChange({ borderTopLeftRadius: next }, 'split'))
  const getTopRightDragProps = useLengthInputDrag(radiusValue.borderTopRightRadius ?? radiusPreview.borderTopRightRadius, next => handleChange({ borderTopRightRadius: next }, 'split'))
  const getBottomRightDragProps = useLengthInputDrag(radiusValue.borderBottomRightRadius ?? radiusPreview.borderBottomRightRadius, next => handleChange({ borderBottomRightRadius: next }, 'split'))
  const getBottomLeftDragProps = useLengthInputDrag(radiusValue.borderBottomLeftRadius ?? radiusPreview.borderBottomLeftRadius, next => handleChange({ borderBottomLeftRadius: next }, 'split'))
  const splitDragProps = {
    borderTopLeftRadius: getTopLeftDragProps,
    borderTopRightRadius: getTopRightDragProps,
    borderBottomRightRadius: getBottomRightDragProps,
    borderBottomLeftRadius: getBottomLeftDragProps,
  }

  const radiusAllVar = useLengthVarBinding({
    value: radiusValue.borderTopLeftRadius,
    onChange: next => handleChange({ borderTopLeftRadius: next, borderTopRightRadius: next, borderBottomRightRadius: next, borderBottomLeftRadius: next }, 'all'),
    computedProp: 'borderTopLeftRadius',
  })
  const topLeftVar = useLengthVarBinding({ value: radiusValue.borderTopLeftRadius, onChange: next => handleChange({ borderTopLeftRadius: next }, 'split'), computedProp: 'borderTopLeftRadius' })
  const topRightVar = useLengthVarBinding({ value: radiusValue.borderTopRightRadius, onChange: next => handleChange({ borderTopRightRadius: next }, 'split'), computedProp: 'borderTopRightRadius' })
  const bottomRightVar = useLengthVarBinding({ value: radiusValue.borderBottomRightRadius, onChange: next => handleChange({ borderBottomRightRadius: next }, 'split'), computedProp: 'borderBottomRightRadius' })
  const bottomLeftVar = useLengthVarBinding({ value: radiusValue.borderBottomLeftRadius, onChange: next => handleChange({ borderBottomLeftRadius: next }, 'split'), computedProp: 'borderBottomLeftRadius' })
  const unitOptions = useMemo(() => withApplyVariableOption(UNIT_OPTIONS, radiusAllVar.hasVariables), [radiusAllVar.hasVariables])

  const handleReset = useCallback(() => {
    const result = allRadiusClear.clear?.()
    if (result && (result.clearUnsupported || !result.applied)) return
    radiusValueRef.current = {}
    setRadiusValue({})
    setToggleValue({ radiusToggleValue: 'all' })
  }, [allRadiusClear.clear])

  const handleSwitchToUnified = useCallback(() => {
    let configuredValue = radiusValueRef.current
    let target: 'current-rule' | undefined = 'current-rule'
    if (context?.getStyleProperty) {
      const winners = RADIUS_KEYS.map(key => context.getStyleProperty!(key).winner)
      configuredValue = Object.fromEntries(RADIUS_KEYS.map((key, index) => {
        const winner = winners[index]
        return [key, winner?.currentState ? winner.value : undefined]
      }))
      const localWinners = winners.filter(winner => winner?.currentState)
      if (localWinners.length && localWinners.every(winner => winner!.inline)) target = undefined
    }
    const next = getUnifiedRadiusValue(configuredValue)
    if (next == null) {
      setToggleValue({ radiusToggleValue: 'all' })
      return
    }
    const valueWithImportant = `${next}${useImportant ? '!important' : ''}`
    const result = onChange({ key: 'borderRadius', value: valueWithImportant, target, borderMode: 'all' })
    if (result?.clearUnsupported || (result && !result.applied)) return
    const unified = {
      borderTopLeftRadius: next,
      borderTopRightRadius: next,
      borderBottomRightRadius: next,
      borderBottomLeftRadius: next,
    }
    radiusValueRef.current = unified
    setRadiusValue(unified)
    setToggleValue({ radiusToggleValue: 'all' })
  }, [onChange, useImportant, context?.getStyleProperty])

  const renderInput = (binding: ReturnType<typeof useLengthVarBinding>, icon: React.ReactNode, key: typeof RADIUS_KEYS[number], tip: string, rawValue: unknown, style: CSSProperties) => (
    <>
      <div className={css.icon} ref={binding.anchorRef} {...(binding.varRef
        ? binding.dragProps(`拖拽调整${tip}（将解除变量绑定）`)
        : (rawValue == null || rawValue === '') && radiusPreview[key]
          ? splitDragProps[key](radiusPreview[key], `拖拽调整${tip}`)
          : getConfiguredDragProps(rawValue, `拖拽调整${tip}`))}>{icon}</div>
      <VariableNumberInput
        binding={binding}
        chipStyle={CHIP_STYLE}
        inputProps={{
          tip,
          style,
          defaultValue: rawValue,
          value: rawValue,
          previewValue: radiusPreview[key],
          placeholder: '',
          defaultUnitValue: 'px',
          hideUnitWhenEmpty: true,
          unitOptions: withDefaultUnitOption(unitOptions, !!fieldClear[key].clear),
          unitDisabledList: UNIT_DISABLED_LIST,
          clearable: !!fieldClear[key].clear,
          onClear: () => fieldClear[key].clear?.(),
          showIcon: true,
          showIconOnHover: true,
          onChange: next => handleChange({ [key]: next === 'default' ? null : next }, 'split'),
          onAction: action => { if (action === APPLY_VARIABLE_ACTION) binding.openPicker() },
        }}
      />
    </>
  )

  let content: React.ReactNode = null
  if (!disableBorderRadius && radiusToggleValue === 'all') {
    content = (
    <div className={css.row}>
      <Panel.Content style={{ padding: 3 }}>
        <Panel.Item className={css.editArea} style={{ padding: '0 8px' }}>
          <div className={css.icon} ref={radiusAllVar.anchorRef} {...(radiusAllVar.varRef
            ? radiusAllVar.dragProps('拖拽调整圆角（将解除变量绑定）')
            : (radiusValue.borderTopLeftRadius == null || radiusValue.borderTopLeftRadius === '') && unifiedPreview
              ? getUnifiedDragProps(unifiedPreview, '拖拽调整圆角半径')
              : getConfiguredDragProps(radiusValue.borderTopLeftRadius, '拖拽调整圆角半径'))}><BorderRadiusSplitOutlined /></div>
          <VariableNumberInput
            binding={radiusAllVar}
            chipStyle={CHIP_STYLE}
            inputProps={{
              tip: '圆角半径', style: DEFAULT_STYLE, defaultValue: radiusValue.borderTopLeftRadius,
              value: radiusValue.borderTopLeftRadius,
              previewValue: unifiedPreview,
              placeholder: mixedPreview ? '混合' : '', defaultUnitValue: 'px', hideUnitWhenEmpty: true,
              unitOptions: withDefaultUnitOption(unitOptions, !!allRadiusClear.clear),
              unitDisabledList: UNIT_DISABLED_LIST,
              clearable: !!allRadiusClear.clear,
              onClear: () => allRadiusClear.clear?.(),
              showIcon: true, showIconOnHover: true,
              onChange: next => {
                if (next === 'default') {
                  allRadiusClear.clear?.()
                  return
                }
                handleChange({ borderTopLeftRadius: next, borderTopRightRadius: next, borderBottomRightRadius: next, borderBottomLeftRadius: next }, 'all')
              },
              onAction: action => { if (action === APPLY_VARIABLE_ACTION) radiusAllVar.openPicker() },
            }}
          />
        </Panel.Item>
      </Panel.Content>
    </div>
    )
  } else if (!disableBorderRadius) {
    content = (
    <div className={css.independentBox}>
      <div style={{ minWidth: 120, flex: 1 }}>
        <div className={css.row} style={{ paddingRight: 0 }}><Panel.Content style={{ padding: 3 }}><Panel.Item className={css.editArea} style={{ padding: '0 8px' }}>{renderInput(topLeftVar, <BorderTopLeftRadiusOutlined />, 'borderTopLeftRadius', '左上圆角', radiusValue.borderTopLeftRadius, DEFAULT_STYLE_NEW)}</Panel.Item></Panel.Content><Panel.Content style={{ padding: 3 }}><Panel.Item className={css.editArea} style={{ padding: '0 8px' }}>{renderInput(topRightVar, <BorderTopRightRadiusOutlined />, 'borderTopRightRadius', '右上圆角', radiusValue.borderTopRightRadius, DEFAULT_STYLE_NEW)}</Panel.Item></Panel.Content></div>
        <div className={css.row} style={{ paddingRight: 0 }}><Panel.Content style={{ padding: 3 }}><Panel.Item className={css.editArea} style={{ padding: '0 8px' }}>{renderInput(bottomLeftVar, <BorderBottomLeftRadiusOutlined />, 'borderBottomLeftRadius', '左下圆角', radiusValue.borderBottomLeftRadius, DEFAULT_STYLE_NEW)}</Panel.Item></Panel.Content><Panel.Content style={{ padding: 3 }}><Panel.Item className={css.editArea} style={{ padding: '0 8px' }}>{renderInput(bottomRightVar, <BorderBottomRightRadiusOutlined />, 'borderBottomRightRadius', '右下圆角', radiusValue.borderBottomRightRadius, DEFAULT_STYLE_NEW)}</Panel.Item></Panel.Content></div>
      </div>
    </div>
    )
  }

  const toggleTo = radiusToggleValue === 'all' ? 'split' : 'all'
  const handleToggle = () => {
    if (toggleTo === 'all') {
      handleSwitchToUnified()
      return
    }
    setToggleValue({ radiusToggleValue: 'split' })
  }
  return (
    <Panel
      title='圆角'
      showTitle={true}
      collapse={false}
      showReset={canReset}
      showDelete={canReset}
      resetFunction={handleReset}
    >
      <div className={css.content}>
        <div className={css.values}>{content}</div>
        <div className={css.rightColumn}>
          <div
            className={`${css.rightColumnBtn} ${radiusToggleValue === 'split' ? css.independentActionIcon : ''}`}
            data-mybricks-tip={toggleTo === 'split'
              ? "{content:'切换为单独配置',position:'left'}"
              : "{content:'切换为统一配置',position:'left'}"}
            onClick={handleToggle}
          >
            <BorderRadiusSplitOutlined />
          </div>
        </div>
      </div>
    </Panel>
  )
}

function getToggleDefaultValue(value: CSSProperties) {
  const expanded = expandBorderRadiusShorthand(value)
  return {
    radiusToggleValue: allEqual(RADIUS_KEYS.map(key => expanded[key])) ? 'all' : 'split',
  }
}
