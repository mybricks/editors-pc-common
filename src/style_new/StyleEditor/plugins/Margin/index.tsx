import React, {
  useMemo,
  useState,
  useCallback,
  CSSProperties
} from 'react'

import {
  Panel,
  PaddingAllOutlined,
  MarginTopOutlined,
  MarginLeftOutlined,
  MarginRightOutlined,
  MarginBottomOutlined,
  Dropdown,
  DownOutlined,
  ClearButton,
  VariableNumberInput,
  withApplyVariableOption,
  APPLY_VARIABLE_ACTION
} from '../../components'
import { useDragNumber, useLengthVarBinding, useBoxSpacingEditor } from '../../hooks'

import type { ChangeEvent, PanelBaseProps } from '../../type'
import type { LengthVarBinding } from '../../hooks/useLengthVarBinding'
import type { InputNumberProps } from '../../components/InputNumber'

import css from './index.less'
import lang from '../../../index.i18n'

interface MarginProps extends PanelBaseProps {
  value: CSSProperties
  onChange: ChangeEvent
}

const DEFAULT_STYLE = {
  padding: 0,
  fontSize: 10,
  // minWidth: 41,
  // maxWidth: 41,
  marginLeft: 4
}
/** 绑定态胶囊与输入框同宽，且不把相邻字段挤出面板 */
const CHIP_STYLE = {flex: '1 1 0', minWidth: 0, width: 0, marginLeft: 4}
const UNIT_OPTIONS = [
  { label: lang.defaultLabel, value: 'default' },
  {label: '', value: '—divider_', type: 'divider'},
  { label: 'px', value: 'px' },
  { label: 'auto', value: 'auto' },
  { label: '%', value: '%' }
]
function getUnitOptions(clearable: boolean) {
  return clearable ? UNIT_OPTIONS : UNIT_OPTIONS.slice(2)
}

interface MarginValueInputProps {
  binding: LengthVarBinding
  value: string | number | null | undefined
  label: string
  inputProps: InputNumberProps
}

function AutoMarginBadge({inputProps}: {inputProps: InputNumberProps}) {
  const options = inputProps.unitOptions ?? UNIT_OPTIONS
  return (
    <Dropdown
      value="auto"
      options={options}
      onAction={inputProps.onAction}
      onClick={(unit) => {
        if (unit === 'default') {
          inputProps.onClear?.()
        } else if (unit === 'auto') {
          inputProps.onChange?.('auto')
        } else if (unit === 'px' || unit === '%') {
          inputProps.onChange?.(`0${unit}`)
        }
      }}
    >
      <>
        {inputProps.clearable ? <ClearButton onClick={() => inputProps.onClear?.()} /> : null}
        <span className={css.autoBadgeArrow} data-mybricks-tip={lang.unitTip}>
          <DownOutlined />
        </span>
      </>
    </Dropdown>
  )
}

function MarginValueInput({binding, value, label, inputProps}: MarginValueInputProps) {
  const normalizedInputProps = {
    placeholder: '',
    ...inputProps,
    // InputNumber 对禁用单位会直接回写关键字，避免把数字和 auto/default 拼成 0auto。
    unitDisabledList: Array.from(new Set([...(inputProps.unitDisabledList ?? []), 'auto', 'default']))
  }

  if (!binding.varRef && value === 'auto') {
    return (
      <VariableNumberInput
        binding={binding}
        chipStyle={CHIP_STYLE}
        inputKey="auto"
        inputProps={{
          ...normalizedInputProps,
          value: null,
          defaultValue: undefined,
          placeholder: lang.marginAutoPlaceholder,
          clearable: normalizedInputProps.clearable,
          tip: label,
          badge: <AutoMarginBadge inputProps={normalizedInputProps} />
        }}
      />
    )
  }

  return <VariableNumberInput binding={binding} inputProps={normalizedInputProps} chipStyle={CHIP_STYLE} />
}

const DEFAULT_CONFIG = {
  disableMarginTop: false,
  disableMarginRight: false,
  disableMarginBottom: false,
  disableMarginLeft: false
}

export function Margin ({value, onChange: fallbackOnChange, config, showTitle, collapse}: MarginProps) {
  const {
    spacingValue: marginValue, toggle, setToggle, forceRenderKey,
    handleChange, handleUnifiedChange, handleSwitchToUnified, refresh,
    canResetSide, unifiedCanClear, canReset,
  } = useBoxSpacingEditor({ property: 'margin', value, onChange: fallbackOnChange })
  const [splitMarginIcon, setSplitMarginIcon] = useState(<MarginTopOutlined />)
  const getDragProps = useDragNumber({ continuous: true, min: -Infinity })
  const cfg = useMemo(() => ({ ...DEFAULT_CONFIG, ...(config ?? {}) }), [config]);

  // 点击 + 是新增外边距配置，不只是展开 UI；通过统一入口写入 margin: 0px。
  const handleExpand = useCallback(() => {
    const result = handleUnifiedChange('0px')
    if (result?.clearUnsupported || (result && !result.applied)) return
    setToggle(true)
  }, [handleUnifiedChange, setToggle])

  // 统一模式与四边各自持有绑定态：统一模式绑一个变量即写四边同值（对齐 Figma）
  const unifiedVar = useLengthVarBinding({
    value: marginValue.marginTop,
    onChange: handleUnifiedChange,
    computedProp: 'marginTop'
  })
  const topVar = useLengthVarBinding({
    value: marginValue.marginTop,
    onChange: (next) => handleChange({marginTop: next}),
    computedProp: 'marginTop'
  })
  const rightVar = useLengthVarBinding({
    value: marginValue.marginRight,
    onChange: (next) => handleChange({marginRight: next}),
    computedProp: 'marginRight'
  })
  const bottomVar = useLengthVarBinding({
    value: marginValue.marginBottom,
    onChange: (next) => handleChange({marginBottom: next}),
    computedProp: 'marginBottom'
  })
  const leftVar = useLengthVarBinding({
    value: marginValue.marginLeft,
    onChange: (next) => handleChange({marginLeft: next}),
    computedProp: 'marginLeft'
  })

  const topCanClear = canResetSide('marginTop')
  const rightCanClear = canResetSide('marginRight')
  const bottomCanClear = canResetSide('marginBottom')
  const leftCanClear = canResetSide('marginLeft')
  const unifiedUnitOptions = useMemo(
    () => withApplyVariableOption(getUnitOptions(unifiedCanClear), unifiedVar.hasVariables),
    [unifiedCanClear, unifiedVar.hasVariables]
  )
  const topUnitOptions = useMemo(
    () => withApplyVariableOption(getUnitOptions(topCanClear), topVar.hasVariables),
    [topCanClear, topVar.hasVariables]
  )
  const rightUnitOptions = useMemo(
    () => withApplyVariableOption(getUnitOptions(rightCanClear), rightVar.hasVariables),
    [rightCanClear, rightVar.hasVariables]
  )
  const bottomUnitOptions = useMemo(
    () => withApplyVariableOption(getUnitOptions(bottomCanClear), bottomVar.hasVariables),
    [bottomCanClear, bottomVar.hasVariables]
  )
  const leftUnitOptions = useMemo(
    () => withApplyVariableOption(getUnitOptions(leftCanClear), leftVar.hasVariables),
    [leftCanClear, leftVar.hasVariables]
  )

  const marginConfig = (() => {
    if (toggle) {
      return (
        <div className={css.row}
        >
          <Panel.Content style={{padding: 2}}>
            <Panel.Item className={css.editArea} style={{padding: '0px 6px 0 8px'}}>
              <div 
                className={css.icon}
                ref={unifiedVar.anchorRef}
                {...(unifiedVar.varRef
                  ? unifiedVar.dragProps(`{content:lang.dragMarginUnifiedUnbind,position:'top'}`)
                  : getDragProps(marginValue.marginTop, `{content:lang.dragMarginUnified,position:'top'}`))}
              >
                <PaddingAllOutlined />
              </div>
              <MarginValueInput
                binding={unifiedVar}
                value={marginValue.marginTop}
                label={lang.marginUnifiedLabel}
                inputProps={{
                  style: DEFAULT_STYLE,
                  defaultValue: marginValue.marginTop,
                  defaultUnitValue: 'default',
                  unitOptions: unifiedUnitOptions,
                  showIcon: true,
                  showIconOnHover: true,
                  allowNegative: true,
                  fallbackValue: 0,
                  clearable: unifiedCanClear,
                  onChange: handleUnifiedChange,
                  onClear: () => handleUnifiedChange(null),
                  onAction: (action) => {
                    if (action === APPLY_VARIABLE_ACTION) unifiedVar.openPicker()
                  },
                  tip: lang.marginUnifiedTip
                }}
              />
            </Panel.Item>
          </Panel.Content>
          <div
            data-mybricks-tip={`{content:'${lang.toggleSplitTip}',position:'left'}`}
            className={css.actionIcon}
            onClick={() => setToggle(false)}
          >
            <PaddingAllOutlined />
          </div>
        </div>
      )
    } else {
      return (
        <div className={css.independentBox}>
          <div style={{ minWidth: "120px", flex: 1 }}>
            <div className={css.row} style={{ paddingRight: 0 }}>
              <Panel.Content style={{ padding: 2 }}>
                <Panel.Item className={css.editArea} style={{ padding: "0px 6px 0 8px" }}>
                  <div 
                    className={`${css.icon} ${css.leftMarginIcon}`} 
                    ref={leftVar.anchorRef}
                    {...(leftVar.varRef
                      ? leftVar.dragProps(lang.dragMarginLeftUnbind)
                      : getDragProps(marginValue.marginLeft, lang.dragMarginLeft))}
                  >
                    <MarginLeftOutlined/>
                  </div>
                  <MarginValueInput
                    binding={leftVar}
                    value={marginValue.marginLeft}
                    label={lang.marginLeftLabel}
                    inputProps={{
                      style: DEFAULT_STYLE,
                      defaultValue: marginValue.marginLeft,
                      defaultUnitValue: 'default',
                      unitOptions: leftUnitOptions,
                      showIcon: true,
                      showIconOnHover: true,
                      allowNegative: true,
                      fallbackValue: 0,
                      clearable: leftCanClear,
                      onChange: (value) => handleChange({marginLeft: value}),
                      onClear: () => handleChange({marginLeft: null}),
                      onAction: (action) => {
                        if (action === APPLY_VARIABLE_ACTION) leftVar.openPicker()
                      },
                      onFocus: () => setSplitMarginIcon(<MarginLeftOutlined/>),
                      tip: lang.marginLeftLabel
                    }}
                  />
                </Panel.Item>
              </Panel.Content>
              <Panel.Content style={{ padding: 2 }}>
                <Panel.Item className={css.editArea} style={{ padding: "0px 6px 0 8px" }}>
                  <div 
                    className={css.icon} 
                    ref={topVar.anchorRef}
                    {...(topVar.varRef
                      ? topVar.dragProps(lang.dragMarginTopUnbind)
                      : getDragProps(marginValue.marginTop, lang.dragMarginTop))}
                  >
                    <MarginTopOutlined/>
                  </div>
                  <MarginValueInput
                    binding={topVar}
                    value={marginValue.marginTop}
                    label={lang.marginTopLabel}
                    inputProps={{
                      style: DEFAULT_STYLE,
                      defaultValue: marginValue.marginTop,
                      defaultUnitValue: 'default',
                      unitOptions: topUnitOptions,
                      showIcon: true,
                      showIconOnHover: true,
                      allowNegative: true,
                      fallbackValue: 0,
                      clearable: topCanClear,
                      onChange: (value) => handleChange({marginTop: value}),
                      onClear: () => handleChange({marginTop: null}),
                      onAction: (action) => {
                        if (action === APPLY_VARIABLE_ACTION) topVar.openPicker()
                      },
                      onFocus: () => setSplitMarginIcon(<MarginTopOutlined/>),
                      tip: lang.marginTopLabel
                    }}
                  />
                </Panel.Item>
              </Panel.Content>
            </div>
            <div className={css.row} style={{ paddingRight: 0 }}>
              <Panel.Content style={{ padding: 2 }}>
                <Panel.Item className={css.editArea} style={{ padding: "0px 6px 0 8px" }}>
                  <div 
                    className={css.icon}
                    ref={rightVar.anchorRef}
                    {...(rightVar.varRef
                      ? rightVar.dragProps(lang.dragMarginRightUnbind)
                      : getDragProps(marginValue.marginRight, lang.dragMarginRight))}
                  >
                    <MarginRightOutlined/>
                  </div>
                  <MarginValueInput
                    binding={rightVar}
                    value={marginValue.marginRight}
                    label={lang.marginRightLabel}
                    inputProps={{
                      style: DEFAULT_STYLE,
                      defaultValue: marginValue.marginRight,
                      defaultUnitValue: 'default',
                      unitOptions: rightUnitOptions,
                      showIcon: true,
                      showIconOnHover: true,
                      allowNegative: true,
                      fallbackValue: 0,
                      clearable: rightCanClear,
                      onChange: (value) => handleChange({marginRight: value}),
                      onClear: () => handleChange({marginRight: null}),
                      onAction: (action) => {
                        if (action === APPLY_VARIABLE_ACTION) rightVar.openPicker()
                      },
                      onFocus: () => setSplitMarginIcon(<MarginRightOutlined/>),
                      tip: lang.marginRightLabel
                    }}
                  />
                </Panel.Item>
              </Panel.Content>
              <Panel.Content style={{ padding: 2 }}>
                <Panel.Item className={css.editArea} style={{ padding: "0px 6px 0 8px" }}>
                  <div 
                    className={css.icon} 
                    ref={bottomVar.anchorRef}
                    {...(bottomVar.varRef
                      ? bottomVar.dragProps(lang.dragMarginBottomUnbind)
                      : getDragProps(marginValue.marginBottom, lang.dragMarginBottom))}
                  >
                    <MarginBottomOutlined/>
                  </div>
                  <MarginValueInput
                    binding={bottomVar}
                    value={marginValue.marginBottom}
                    label={lang.marginBottomLabel}
                    inputProps={{
                      style: DEFAULT_STYLE,
                      defaultValue: marginValue.marginBottom,
                      defaultUnitValue: 'default',
                      unitOptions: bottomUnitOptions,
                      showIcon: true,
                      showIconOnHover: true,
                      allowNegative: true,
                      fallbackValue: 0,
                      clearable: bottomCanClear,
                      onChange: (value) => handleChange({marginBottom: value}),
                      onClear: () => handleChange({marginBottom: null}),
                      onAction: (action) => {
                        if (action === APPLY_VARIABLE_ACTION) bottomVar.openPicker()
                      },
                      onFocus: () => setSplitMarginIcon(<MarginBottomOutlined/>),
                      tip: lang.marginBottomLabel
                    }}
                  />
                </Panel.Item>
              </Panel.Content>
            </div>
          </div>

          <div
            data-mybricks-tip={`{content:'${lang.toggleUnifiedTip}',position:'left'}`}
            className={css.independentActionIcon}
            onClick={handleSwitchToUnified}
          >
            <PaddingAllOutlined/>
          </div>
        </div>
      )
    }
  })()

  return (
    <Panel
      title={lang.marginPanelTitle}
      showTitle={showTitle}
      showReset={canReset}
      showDelete={canReset}
      resetFunction={refresh}
      collapse={collapse}
      onExpand={handleExpand}
    >
      <React.Fragment key={forceRenderKey}>
        {marginConfig}
      </React.Fragment>
    </Panel>
  )
}
