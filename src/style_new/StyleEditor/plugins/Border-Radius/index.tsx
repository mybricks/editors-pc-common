import React, { CSSProperties, useCallback, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { useEffectiveStyleValue, useStyleChange, useStyleClear, useStyleEditorContext } from '../../context'

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
import { useDragNumber, useLengthVarBinding, useUpdateEffect } from '../../hooks'
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

export function BorderRadius({ value, onChange: fallbackOnChange, config }: BorderRadiusProps) {
  const context = useStyleEditorContext()
  const effectiveValue = useEffectiveStyleValue()
  const onChange = useStyleChange(fallbackOnChange)
  const editorValue = context?.effectiveStyle ? effectiveValue : value
  const [{ useImportant, disableBorderRadius }] = useState({ useImportant: false, disableBorderRadius: false, ...config })
  const [{ radiusToggleValue }, setToggleValue] = useState(getToggleDefaultValue(editorValue))
  const [radiusValue, setRadiusValue] = useState(() => expandBorderRadiusShorthand(editorValue))
  const radiusValueRef = useRef(radiusValue)
  const externalSyncRef = useRef(false)
  const getDragProps = useDragNumber({ continuous: true })
  const allRadiusClear = useStyleClear(RADIUS_KEYS)
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
    const nextToggle = getToggleDefaultValue(editorValue).radiusToggleValue
    if (nextToggle !== radiusToggleValue) {
      externalSyncRef.current = true
      setToggleValue({ radiusToggleValue: nextToggle })
    }
  }, [context?.targetDom, context?.effectiveStyle, editorValue.borderRadius, editorValue.borderTopLeftRadius, editorValue.borderTopRightRadius, editorValue.borderBottomRightRadius, editorValue.borderBottomLeftRadius])

  const handleChange = useCallback((changes: CSSProperties & Record<string, any>, borderMode: 'all' | 'split' = radiusToggleValue) => {
    const current: Record<string, any> = { ...radiusValueRef.current }
    RADIUS_KEYS.forEach(key => {
      if (current[key] == null || current[key] === '') current[key] = '0px'
    })
    const next = { ...current, ...changes }
    radiusValueRef.current = next
    setRadiusValue(next)
    const hasClear = Object.values(changes).some(item => item == null || item === 'default')
    const complete = RADIUS_KEYS.every(key => next[key] !== null && next[key] !== undefined && next[key] !== '')
    let keys: readonly string[] = Object.keys(changes)
    if (!hasClear && complete) {
      keys = RADIUS_KEYS
    }
    onChange(keys.map(key => ({
      key,
      value: next[key] == null ? null : `${next[key]}${useImportant ? '!important' : ''}`,
      borderMode,
    })))
  }, [onChange, radiusToggleValue, useImportant])

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

  useUpdateEffect(() => {
    if (externalSyncRef.current) {
      externalSyncRef.current = false
      return
    }
    handleChange({
      borderTopLeftRadius: radiusValue.borderTopLeftRadius,
      borderTopRightRadius: radiusValue.borderTopLeftRadius,
      borderBottomRightRadius: radiusValue.borderTopLeftRadius,
      borderBottomLeftRadius: radiusValue.borderTopLeftRadius,
    }, radiusToggleValue)
  }, [radiusToggleValue])

  const renderInput = (binding: ReturnType<typeof useLengthVarBinding>, icon: React.ReactNode, key: typeof RADIUS_KEYS[number], tip: string, rawValue: unknown, style: CSSProperties) => (
    <>
      <div className={css.icon} ref={binding.anchorRef} {...(binding.varRef ? binding.dragProps(`拖拽调整${tip}（将解除变量绑定）`) : getDragProps(rawValue, `拖拽调整${tip}`))}>{icon}</div>
      <VariableNumberInput
        binding={binding}
        chipStyle={CHIP_STYLE}
        inputProps={{
          tip,
          style,
          defaultValue: rawValue,
          value: rawValue,
          unitOptions: withDefaultUnitOption(unitOptions, !!fieldClear[key].clear),
          unitDisabledList: UNIT_DISABLED_LIST,
          clearable: !!fieldClear[key].clear,
          onClear: () => fieldClear[key].clear?.(),
          showIcon: true,
          showIconOnHover: true,
          fallbackValue: 0,
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
          <div className={css.icon} ref={radiusAllVar.anchorRef} {...(radiusAllVar.varRef ? radiusAllVar.dragProps('拖拽调整圆角（将解除变量绑定）') : getDragProps(radiusValue.borderTopLeftRadius, '拖拽调整圆角半径'))}><BorderRadiusSplitOutlined /></div>
          <VariableNumberInput
            binding={radiusAllVar}
            chipStyle={CHIP_STYLE}
            inputProps={{
              tip: '圆角半径', style: DEFAULT_STYLE, defaultValue: radiusValue.borderTopLeftRadius,
              value: radiusValue.borderTopLeftRadius,
              unitOptions: withDefaultUnitOption(unitOptions, !!allRadiusClear.clear),
              unitDisabledList: UNIT_DISABLED_LIST,
              clearable: !!allRadiusClear.clear,
              onClear: () => allRadiusClear.clear?.(),
              showIcon: true, showIconOnHover: true, fallbackValue: 0,
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
  return (
    <Panel
      title='圆角'
      showTitle={true}
      collapse={false}
      showDelete={false}
      rightColumn={(
        <div className={css.rightColumn}>
          <div
            className={css.rightColumnBtn}
            data-mybricks-tip={toggleTo === 'split'
              ? "{content:'切换为单独配置',position:'left'}"
              : "{content:'切换为统一配置',position:'left'}"}
            onClick={() => setToggleValue({ radiusToggleValue: toggleTo })}
          >
            <BorderRadiusSplitOutlined />
          </div>
        </div>
      )}
    >
      {content}
    </Panel>
  )
}

function getToggleDefaultValue(value: CSSProperties) {
  return {
    radiusToggleValue: allEqual(RADIUS_KEYS.map(key => value[key])) ? 'all' : 'split',
  }
}
