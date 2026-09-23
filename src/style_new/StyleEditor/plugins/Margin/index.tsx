import React, {
  useMemo,
  useState,
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
import {
  useStyleEditorContext
} from '../../context'
import type { LengthVarBinding } from '../../hooks/useLengthVarBinding'
import type { InputNumberProps } from '../../components/InputNumber'
import type { EffectiveStyleValue } from '../../../core/zone-tab'

import css from './index.less'

interface MarginProps extends PanelBaseProps {
  value: CSSProperties
  onChange: ChangeEvent
}

const DEFAULT_STYLE = {
  padding: 0,
  fontSize: 10,
  // minWidth: 41,
  // maxWidth: 41,
  // marginLeft: 4
}
/** 绑定态胶囊与输入框同宽，且不把相邻字段挤出面板 */
const CHIP_STYLE = {flex: '1 1 0', minWidth: 0, width: 0}
const UNIT_OPTIONS = [
  { label: '默认', value: 'default' },
  {label: '', value: '—divider_', type: 'divider'},
  { label: 'px', value: 'px' },
  { label: 'auto', value: 'auto' },
  { label: '%', value: '%' }
]
function getUnitOptions(clearable: boolean) {
  return clearable ? UNIT_OPTIONS : UNIT_OPTIONS.slice(2)
}

function buildComputedTip(
  label: string,
  item?: EffectiveStyleValue,
  previewValue?: string
): string {
  const computedValue = previewValue ?? item?.computedValue
  return computedValue
    ? `当前未配置${label}值，${computedValue}为计算值`
    : label
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
        <span className={css.autoBadgeArrow} data-mybricks-tip="单位">
          <DownOutlined />
        </span>
      </>
    </Dropdown>
  )
}

function MarginValueInput({binding, value, label, inputProps}: MarginValueInputProps) {
  const normalizedInputProps = {
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
          placeholder: '自动',
          clearable: normalizedInputProps.clearable,
          tip: `当前${label}为 auto，自动占用剩余空间；${binding.fallbackValue}为计算值`,
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
  const context = useStyleEditorContext()
  const {
    spacingValue: marginValue, toggle, setToggle, previewValues, forceRenderKey,
    handleChange, handleUnifiedChange, handleSwitchToUnified, refresh,
    canResetSide, unifiedCanClear, canReset,
  } = useBoxSpacingEditor({ property: 'margin', value, onChange: fallbackOnChange })
  const [splitMarginIcon, setSplitMarginIcon] = useState(<MarginTopOutlined />)
  const getDragProps = useDragNumber({ continuous: true, min: -Infinity })
  const cfg = useMemo(() => ({ ...DEFAULT_CONFIG, ...(config ?? {}) }), [config]);

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
            <Panel.Item className={css.editArea} style={{padding: '0px 8px'}}>
              <div 
                className={css.icon}
                ref={unifiedVar.anchorRef}
                {...(unifiedVar.varRef
                  ? unifiedVar.dragProps(`{content:'拖拽调整外边距（将解除变量绑定）',position:'top'}`)
                  : getDragProps(marginValue.marginTop, `{content:'拖拽调整外边距',position:'top'}`))}
              >
                <PaddingAllOutlined />
              </div>
              <MarginValueInput
                binding={unifiedVar}
                value={marginValue.marginTop}
                label="外边距"
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
                  tip: marginValue.marginTop == null
                    ? buildComputedTip(
                      '外边距',
                      context?.effectiveStyle?.marginTop,
                      previewValues.marginTop
                    )
                    : '外边距'
                }}
              />
            </Panel.Item>
          </Panel.Content>
          <div
            data-mybricks-tip={`{content:'切换为单独配置',position:'left'}`}
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
                <Panel.Item className={css.editArea} style={{ padding: "0px 8px" }}>
                  <div 
                    className={`${css.icon} ${css.leftMarginIcon}`} 
                    ref={leftVar.anchorRef}
                    {...(leftVar.varRef
                      ? leftVar.dragProps('拖拽调整左外边距（将解除变量绑定）')
                      : getDragProps(marginValue.marginLeft, '拖拽调整左外边距'))}
                  >
                    <MarginLeftOutlined/>
                  </div>
                  <MarginValueInput
                    binding={leftVar}
                    value={marginValue.marginLeft}
                    label="左外边距"
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
                      tip: marginValue.marginLeft == null
                        ? buildComputedTip(
                          '左外边距',
                          context?.effectiveStyle?.marginLeft,
                          previewValues.marginLeft
                        )
                        : '左外边距'
                    }}
                  />
                </Panel.Item>
              </Panel.Content>
              <Panel.Content style={{ padding: 2 }}>
                <Panel.Item className={css.editArea} style={{ padding: "0px 8px" }}>
                  <div 
                    className={css.icon} 
                    ref={topVar.anchorRef}
                    {...(topVar.varRef
                      ? topVar.dragProps('拖拽调整上外边距（将解除变量绑定）')
                      : getDragProps(marginValue.marginTop, '拖拽调整上外边距'))}
                  >
                    <MarginTopOutlined/>
                  </div>
                  <MarginValueInput
                    binding={topVar}
                    value={marginValue.marginTop}
                    label="上外边距"
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
                      tip: marginValue.marginTop == null
                        ? buildComputedTip(
                          '上外边距',
                          context?.effectiveStyle?.marginTop,
                          previewValues.marginTop
                        )
                        : '上外边距'
                    }}
                  />
                </Panel.Item>
              </Panel.Content>
            </div>
            <div className={css.row} style={{ paddingRight: 0 }}>
              <Panel.Content style={{ padding: 2 }}>
                <Panel.Item className={css.editArea} style={{ padding: "0px 8px" }}>
                  <div 
                    className={css.icon}
                    ref={rightVar.anchorRef}
                    {...(rightVar.varRef
                      ? rightVar.dragProps('拖拽调整右外边距（将解除变量绑定）')
                      : getDragProps(marginValue.marginRight, '拖拽调整右外边距'))}
                  >
                    <MarginRightOutlined/>
                  </div>
                  <MarginValueInput
                    binding={rightVar}
                    value={marginValue.marginRight}
                    label="右外边距"
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
                      tip: marginValue.marginRight == null
                        ? buildComputedTip(
                          '右外边距',
                          context?.effectiveStyle?.marginRight,
                          previewValues.marginRight
                        )
                        : '右外边距'
                    }}
                  />
                </Panel.Item>
              </Panel.Content>
              <Panel.Content style={{ padding: 2 }}>
                <Panel.Item className={css.editArea} style={{ padding: "0px 8px" }}>
                  <div 
                    className={css.icon} 
                    ref={bottomVar.anchorRef}
                    {...(bottomVar.varRef
                      ? bottomVar.dragProps('拖拽调整下外边距（将解除变量绑定）')
                      : getDragProps(marginValue.marginBottom, '拖拽调整下外边距'))}
                  >
                    <MarginBottomOutlined/>
                  </div>
                  <MarginValueInput
                    binding={bottomVar}
                    value={marginValue.marginBottom}
                    label="下外边距"
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
                      tip: marginValue.marginBottom == null
                        ? buildComputedTip(
                          '下外边距',
                          context?.effectiveStyle?.marginBottom,
                          previewValues.marginBottom
                        )
                        : '下外边距'
                    }}
                  />
                </Panel.Item>
              </Panel.Content>
            </div>
          </div>

          <div
            data-mybricks-tip={`{content:'切换为统一配置',position:'left'}`}
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
      title='外边距'
      showTitle={showTitle}
      showReset={canReset}
      showDelete={canReset}
      resetFunction={refresh}
      collapse={collapse}
    >
      <React.Fragment key={forceRenderKey}>
        {marginConfig}
      </React.Fragment>
    </Panel>
  )
}
