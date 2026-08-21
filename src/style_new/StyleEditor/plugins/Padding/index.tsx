import React, {
  useLayoutEffect,
  useMemo,
  useState,
  useCallback,
  useRef,
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
import {allEqual} from '../../utils'
import {useUpdateEffect, useDragNumber, useLengthVarBinding} from '../../hooks'

import type {ChangeEvent, PanelBaseProps} from '../../type'

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
  {label: 'px', value: 'px'},
  {label: '%', value: '%'}
]
const PADDING_KEYS = ['paddingTop', 'paddingRight', 'paddingBottom', 'paddingLeft'] as const

export function Padding({value, onChange, config, showTitle, collapse}: PaddingProps) {
  const [toggle, setToggle] = useState(getToggleDefaultValue(value))
  const [paddingValue, setPaddingValue] = useState({...value})
  const [forceRenderKey, setForceRenderKey] = useState<number>(Math.random())
  const [splitPaddingIcon, setSplitPaddingIcon] = useState(<PaddingTopOutlined/>)
  const getDragProps = useDragNumber({ continuous: true })

  /** 由外部值同步引起的模式切换不应回写四边，否则会覆盖真实内边距 */
  const isExternalSyncRef = useRef(false)

  // 面板实例会在切换选中组件时复用，需同步新的内边距值，避免旧值短暂回显。
  useLayoutEffect(() => {
    setPaddingValue((previous) => {
      const next = {...value};
      return PADDING_KEYS.every((key) => previous[key] === next[key]) ? previous : next;
    });
    const nextToggle = getToggleDefaultValue(value);
    if (nextToggle !== toggle) {
      isExternalSyncRef.current = true;
      setToggle(nextToggle);
    }
  }, [value.paddingTop, value.paddingRight, value.paddingBottom, value.paddingLeft]);

  const handleSwitchToUnified = useCallback(() => {
    onChange(PADDING_KEYS.map((key) => ({ key, value: null })))
    setToggle(true)
  }, [onChange])

  const handleChange = useCallback((value: any) => {
    setPaddingValue((val) => {
      return {
        ...val,
        ...value
      }
    })
    onChange(Object.keys(value).map((key) => {
      return {
        key,
        value: value[key]
      }
    }))
  }, [])

  const handleUnifiedChange = useCallback((next: string | null) => {
    handleChange({
      paddingTop: next,
      paddingRight: next,
      paddingBottom: next,
      paddingLeft: next
    })
  }, [handleChange])

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

  const unitOptions = useMemo(
    () => withApplyVariableOption(UNIT_OPTIONS, unifiedVar.hasVariables),
    [unifiedVar.hasVariables]
  )

  useUpdateEffect(() => {
    if (isExternalSyncRef.current) {
      isExternalSyncRef.current = false
      return
    }
    if (toggle) {
      handleChange({
        paddingTop: paddingValue.paddingTop,
        paddingRight: paddingValue.paddingTop,
        paddingBottom: paddingValue.paddingTop,
        paddingLeft: paddingValue.paddingTop
      })
    }
  }, [toggle])

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
                  defaultUnitValue: 'px',
                  unitOptions,
                  showIcon: true,
                  showIconOnHover: true,
                  fallbackValue: 0,
                  onChange: handleUnifiedChange,
                  onAction: (action) => {
                    if (action === APPLY_VARIABLE_ACTION) unifiedVar.openPicker()
                  },
                  tip: `{content:'内边距',position:'top'}`
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
                      defaultUnitValue: 'px',
                      unitOptions,
                      showIcon: true,
                      showIconOnHover: true,
                      fallbackValue: 0,
                      onChange: (value) => handleChange({paddingLeft: value}),
                      onAction: (action) => {
                        if (action === APPLY_VARIABLE_ACTION) leftVar.openPicker()
                      },
                      onFocus: () => setSplitPaddingIcon(<PaddingLeftOutlined/>)
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
                      defaultUnitValue: 'px',
                      unitOptions,
                      showIcon: true,
                      showIconOnHover: true,
                      fallbackValue: 0,
                      onChange: (value) => handleChange({paddingTop: value}),
                      onAction: (action) => {
                        if (action === APPLY_VARIABLE_ACTION) topVar.openPicker()
                      },
                      onFocus: () => setSplitPaddingIcon(<PaddingTopOutlined/>)
                    }}
                  />
                </Panel.Item>
              </Panel.Content>
            </div>
            <div className={css.row} style={{ paddingRight: 0 }}>
              <Panel.Content style={{ padding: 3 }}>
                <Panel.Item className={css.editArea} style={{ padding: "0px 8px" }}>
                  <div 
                    className={`${css.icon} ${css.leftPaddingIcon}`}
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
                      defaultUnitValue: 'px',
                      unitOptions,
                      showIcon: true,
                      showIconOnHover: true,
                      fallbackValue: 0,
                      onChange: (value) => handleChange({paddingRight: value}),
                      onAction: (action) => {
                        if (action === APPLY_VARIABLE_ACTION) rightVar.openPicker()
                      },
                      onFocus: () => setSplitPaddingIcon(<PaddingRightOutlined/>)
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
                      defaultUnitValue: 'px',
                      unitOptions,
                      showIcon: true,
                      showIconOnHover: true,
                      fallbackValue: 0,
                      onChange: (value) => handleChange({paddingBottom: value}),
                      onAction: (action) => {
                        if (action === APPLY_VARIABLE_ACTION) bottomVar.openPicker()
                      },
                      onFocus: () => setSplitPaddingIcon(<PaddingBottomOutlined/>)
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

  const refresh = useCallback(() => {
    const paddingKeys = ['paddingTop', 'paddingRight', 'paddingBottom', 'paddingLeft']
    onChange(paddingKeys.map(key => ({ key, value: null })))
    setPaddingValue({} as any)
    setForceRenderKey(prev => prev + 1)
  }, [onChange])

  return (
    <Panel title='内边距' showTitle={showTitle} showReset={true} resetFunction={refresh} collapse={collapse}>
      <React.Fragment key={forceRenderKey}>
        {paddingConfig}
      </React.Fragment>
    </Panel>
  )
}

function getToggleDefaultValue(value: CSSProperties): boolean {
  return allEqual([value.paddingTop, value.paddingRight, value.paddingBottom, value.paddingLeft])
}
