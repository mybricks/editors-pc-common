import React, {
  useMemo,
  useState,
  CSSProperties
} from 'react'

import {
  Panel,
  PaddingAllOutlined,
  PaddingTopOutlined,
  PaddingLeftOutlined,
  PaddingRightOutlined,
  PaddingBottomOutlined,
  VariableNumberInput,
  withApplyVariableOption,
  APPLY_VARIABLE_ACTION
} from '../../components'
import {useDragNumber, useLengthVarBinding, useBoxSpacingEditor} from '../../hooks'

import type {ChangeEvent, PanelBaseProps} from '../../type'
import {
  useStyleEditorContext
} from '../../context'
import type {EffectiveStyleValue} from '../../../core/zone-tab'

import css from './index.less'

interface PaddingProps extends PanelBaseProps {
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
  {label: '默认', value: 'default'},
  {label: '', value: '—divider_', type: 'divider'},
  {label: 'px', value: 'px'},
  {label: '%', value: '%'}
]
/** default 是菜单动作，由共用 Hook 按单边重置/整组清空处理。 */
const UNIT_DISABLED_LIST = ['default']
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

export function Padding({value, onChange: fallbackOnChange, config, showTitle, collapse}: PaddingProps) {
  const context = useStyleEditorContext()
  const {
    spacingValue: paddingValue, toggle, setToggle, previewValues, forceRenderKey,
    handleChange, handleUnifiedChange, handleSwitchToUnified, refresh,
    canResetSide, unifiedCanClear, canReset,
  } = useBoxSpacingEditor({ property: 'padding', value, onChange: fallbackOnChange })
  const [splitPaddingIcon, setSplitPaddingIcon] = useState(<PaddingTopOutlined/>)
  const getDragProps = useDragNumber({ continuous: true })

  // 统一模式与四边各自持有绑定态：统一模式绑一个变量即写四边同值（对齐 Figma）
  const unifiedVar = useLengthVarBinding({
    value: paddingValue.paddingTop,
    onChange: handleUnifiedChange,
    computedProp: 'paddingTop'
  })
  const topVar = useLengthVarBinding({
    value: paddingValue.paddingTop,
    onChange: (next) => handleChange({paddingTop: next}),
    computedProp: 'paddingTop'
  })
  const rightVar = useLengthVarBinding({
    value: paddingValue.paddingRight,
    onChange: (next) => handleChange({paddingRight: next}),
    computedProp: 'paddingRight'
  })
  const bottomVar = useLengthVarBinding({
    value: paddingValue.paddingBottom,
    onChange: (next) => handleChange({paddingBottom: next}),
    computedProp: 'paddingBottom'
  })
  const leftVar = useLengthVarBinding({
    value: paddingValue.paddingLeft,
    onChange: (next) => handleChange({paddingLeft: next}),
    computedProp: 'paddingLeft'
  })

  const topCanClear = canResetSide('paddingTop')
  const rightCanClear = canResetSide('paddingRight')
  const bottomCanClear = canResetSide('paddingBottom')
  const leftCanClear = canResetSide('paddingLeft')
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

  const paddingConfig = (() => {
    if (toggle) {
      return (
        <div className={css.row}
        >
          <Panel.Content style={{padding: 3}}>
            <Panel.Item className={css.editArea} style={{padding: '0px 8px'}}>
              <div 
                className={css.icon}
                ref={unifiedVar.anchorRef}
                {...(unifiedVar.varRef
                  ? unifiedVar.dragProps(`{content:'拖拽调整内边距（将解除变量绑定）',position:'top'}`)
                  : getDragProps(paddingValue.paddingTop, `{content:'拖拽调整内边距',position:'top'}`))}
              >
                <PaddingAllOutlined/>
              </div>
              <VariableNumberInput
                binding={unifiedVar}
                chipStyle={CHIP_STYLE}
                inputProps={{
                  style: DEFAULT_STYLE,
                  defaultValue: paddingValue.paddingTop,
                  defaultUnitValue: 'default',
                  unitOptions: unifiedUnitOptions,
                  unitDisabledList: UNIT_DISABLED_LIST,
                  showIcon: true,
                  showIconOnHover: true,
                  fallbackValue: 0,
                  clearable: unifiedCanClear,
                  onChange: handleUnifiedChange,
                  onClear: () => handleUnifiedChange(null),
                  onAction: (action) => {
                    if (action === APPLY_VARIABLE_ACTION) unifiedVar.openPicker()
                  },
                  tip: paddingValue.paddingTop == null
                    ? buildComputedTip(
                      '内边距',
                      context?.effectiveStyle?.paddingTop,
                      previewValues.paddingTop
                    )
                    : '内边距'
                }}
              />
            </Panel.Item>
          </Panel.Content>
          <div
            data-mybricks-tip={`{content:'切换为单独配置',position:'left'}`}
            className={css.actionIcon}
            onClick={() => setToggle(false)}
          >
            <PaddingAllOutlined/>
          </div>
        </div>
      )
    } else {
      return (
        <div className={css.independentBox}>
          <div style={{ minWidth: "120px", flex: 1 }}>
            <div className={css.row} style={{ paddingRight: 0 }}>
              <Panel.Content style={{ padding: 3 }}>
                <Panel.Item className={css.editArea} style={{ padding: "0px 8px" }}>
                  <div 
                    className={css.icon} 
                    ref={leftVar.anchorRef}
                    {...(leftVar.varRef
                      ? leftVar.dragProps('拖拽调整左内边距（将解除变量绑定）')
                      : getDragProps(paddingValue.paddingLeft, '拖拽调整左内边距'))}
                  >
                    <PaddingLeftOutlined/>
                  </div>
                  <VariableNumberInput
                    binding={leftVar}
                    chipStyle={CHIP_STYLE}
                    inputProps={{
                      style: DEFAULT_STYLE,
                      defaultValue: paddingValue.paddingLeft,
                      defaultUnitValue: 'default',
                      unitOptions: leftUnitOptions,
                      unitDisabledList: UNIT_DISABLED_LIST,
                      showIcon: true,
                      showIconOnHover: true,
                      fallbackValue: 0,
                      clearable: leftCanClear,
                      onChange: (value) => handleChange({paddingLeft: value}),
                      onClear: () => handleChange({paddingLeft: null}),
                      onAction: (action) => {
                        if (action === APPLY_VARIABLE_ACTION) leftVar.openPicker()
                      },
                      onFocus: () => setSplitPaddingIcon(<PaddingLeftOutlined/>),
                      tip: paddingValue.paddingLeft == null
                        ? buildComputedTip(
                          '左内边距',
                          context?.effectiveStyle?.paddingLeft,
                          previewValues.paddingLeft
                        )
                        : '左内边距'
                    }}
                  />
                </Panel.Item>
              </Panel.Content>
              <Panel.Content style={{ padding: 3 }}>
                <Panel.Item className={css.editArea} style={{ padding: "0px 8px" }}>
                  <div 
                    className={css.icon} 
                    ref={topVar.anchorRef}
                    {...(topVar.varRef
                      ? topVar.dragProps('拖拽调整上内边距（将解除变量绑定）')
                      : getDragProps(paddingValue.paddingTop, '拖拽调整上内边距'))}
                  >
                    <PaddingTopOutlined/>
                  </div>
                  <VariableNumberInput
                    binding={topVar}
                    chipStyle={CHIP_STYLE}
                    inputProps={{
                      style: DEFAULT_STYLE,
                      defaultValue: paddingValue.paddingTop,
                      defaultUnitValue: 'default',
                      unitOptions: topUnitOptions,
                      unitDisabledList: UNIT_DISABLED_LIST,
                      showIcon: true,
                      showIconOnHover: true,
                      fallbackValue: 0,
                      clearable: topCanClear,
                      onChange: (value) => handleChange({paddingTop: value}),
                      onClear: () => handleChange({paddingTop: null}),
                      onAction: (action) => {
                        if (action === APPLY_VARIABLE_ACTION) topVar.openPicker()
                      },
                      onFocus: () => setSplitPaddingIcon(<PaddingTopOutlined/>),
                      tip: paddingValue.paddingTop == null
                        ? buildComputedTip(
                          '上内边距',
                          context?.effectiveStyle?.paddingTop,
                          previewValues.paddingTop
                        )
                        : '上内边距'
                    }}
                  />
                </Panel.Item>
              </Panel.Content>
            </div>
            <div className={css.row} style={{ paddingRight: 0 }}>
              <Panel.Content style={{ padding: 3 }}>
                <Panel.Item className={css.editArea} style={{ padding: "0px 8px" }}>
                  <div 
                    className={`${css.icon}`}
                    ref={rightVar.anchorRef}
                    {...(rightVar.varRef
                      ? rightVar.dragProps('拖拽调整右内边距（将解除变量绑定）')
                      : getDragProps(paddingValue.paddingRight, '拖拽调整右内边距'))}
                  >
                    <PaddingRightOutlined/>
                  </div>
                  <VariableNumberInput
                    binding={rightVar}
                    chipStyle={CHIP_STYLE}
                    inputProps={{
                      style: DEFAULT_STYLE,
                      defaultValue: paddingValue.paddingRight,
                      defaultUnitValue: 'default',
                      unitOptions: rightUnitOptions,
                      unitDisabledList: UNIT_DISABLED_LIST,
                      showIcon: true,
                      showIconOnHover: true,
                      fallbackValue: 0,
                      clearable: rightCanClear,
                      onChange: (value) => handleChange({paddingRight: value}),
                      onClear: () => handleChange({paddingRight: null}),
                      onAction: (action) => {
                        if (action === APPLY_VARIABLE_ACTION) rightVar.openPicker()
                      },
                      onFocus: () => setSplitPaddingIcon(<PaddingRightOutlined/>),
                      tip: paddingValue.paddingRight == null
                        ? buildComputedTip(
                          '右内边距',
                          context?.effectiveStyle?.paddingRight,
                          previewValues.paddingRight
                        )
                        : '右内边距'
                    }}
                  />
                </Panel.Item>
              </Panel.Content>
              <Panel.Content style={{ padding: 3 }}>
                <Panel.Item className={css.editArea} style={{ padding: "0px 8px" }}>
                  <div 
                    className={css.icon} 
                    ref={bottomVar.anchorRef}
                    {...(bottomVar.varRef
                      ? bottomVar.dragProps('拖拽调整下内边距（将解除变量绑定）')
                      : getDragProps(paddingValue.paddingBottom, '拖拽调整下内边距'))}
                  >
                    <PaddingBottomOutlined/>
                  </div>
                  <VariableNumberInput
                    binding={bottomVar}
                    chipStyle={CHIP_STYLE}
                    inputProps={{
                      style: DEFAULT_STYLE,
                      defaultValue: paddingValue.paddingBottom,
                      defaultUnitValue: 'default',
                      unitOptions: bottomUnitOptions,
                      unitDisabledList: UNIT_DISABLED_LIST,
                      showIcon: true,
                      showIconOnHover: true,
                      fallbackValue: 0,
                      clearable: bottomCanClear,
                      onChange: (value) => handleChange({paddingBottom: value}),
                      onClear: () => handleChange({paddingBottom: null}),
                      onAction: (action) => {
                        if (action === APPLY_VARIABLE_ACTION) bottomVar.openPicker()
                      },
                      onFocus: () => setSplitPaddingIcon(<PaddingBottomOutlined/>),
                      tip: paddingValue.paddingBottom == null
                        ? buildComputedTip(
                          '下内边距',
                          context?.effectiveStyle?.paddingBottom,
                          previewValues.paddingBottom
                        )
                        : '下内边距'
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
      title='内边距'
      showTitle={showTitle}
      showReset={canReset}
      showDelete={canReset}
      resetFunction={refresh}
      collapse={collapse}
    >
      <React.Fragment key={forceRenderKey}>
        {paddingConfig}
      </React.Fragment>
    </Panel>
  )
}
