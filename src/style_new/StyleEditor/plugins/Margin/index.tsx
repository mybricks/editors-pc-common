import React, {
  useEffect,
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
import { allEqual } from '../../utils'
import { useUpdateEffect, useDragNumber, useLengthVarBinding, isCssVarValue } from '../../hooks'

import type { ChangeEvent, PanelBaseProps } from '../../type'
import { useStyleEditorContext } from '../../context'

import css from './index.less'

/**
 * 检测当前元素与父容器 flex 对齐的冲突情况。
 * 返回 { isRow, alignItems } 表示父容器是行方向以及其对齐值，
 * 或返回 null（无 flex 父容器 / 元素已设置 align-self）。
 */
function getAlignConflict(targetDom: HTMLElement | null | undefined) {
  const parent = targetDom?.parentElement
  if (!parent) return null

  const ps = window.getComputedStyle(parent)
  if (ps.display !== 'flex' && ps.display !== 'inline-flex') return null

  // 元素自身已有明确的 align-self 时跳过（用户已主动控制对齐）
  const selfAlign = targetDom ? window.getComputedStyle(targetDom).alignSelf : 'auto'
  if (selfAlign !== 'auto' && selfAlign !== 'normal') return null

  const isRow = !ps.flexDirection || ps.flexDirection.startsWith('row')
  return { isRow, alignItems: ps.alignItems }
}

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
  { label: 'px', value: 'px' },
  { label: '%', value: '%' }
]
const MARGIN_KEYS = ['marginTop', 'marginRight', 'marginBottom', 'marginLeft'] as const

/** 绑定变量本身不该改动对齐，只有落成具体数值才参与 flex 冲突修复 */
function isFixedMargin(val: unknown): boolean {
  return val != null && !isCssVarValue(val as string)
}

const DEFAULT_CONFIG = {
  disableMarginTop: false,
  disableMarginRight: false,
  disableMarginBottom: false,
  disableMarginLeft: false
}

export function Margin ({value, onChange, config, showTitle, collapse}: MarginProps) {
  const [toggle, setToggle] = useState(getToggleDefaultValue(value))
  const [marginValue, setMarginValue] = useState({...value})
  const [forceRenderKey, setForceRenderKey] = useState<number>(Math.random())
  const [splitMarginIcon, setSplitMarginIcon] = useState(<PaddingTopOutlined />)
  const getDragProps = useDragNumber({ continuous: true, min: -Infinity })
  const [isReset, setIsReset] = useState(false)
  const context = useStyleEditorContext()
  const handleSwitchToUnified = useCallback(() => {
    onChange(MARGIN_KEYS.map((key) => ({ key, value: null })))
    setToggle(true)
  }, [onChange])

  const cfg = useMemo(() => ({ ...DEFAULT_CONFIG, ...(config ?? {}) }), [config]);

  /** 由外部值同步引起的模式切换不应回写四边，否则会覆盖真实外边距 */
  const isExternalSyncRef = useRef(false)

  // 面板实例会在切换选中组件时复用，需同步新的边距值，避免先显示上一组件的数字。
  useLayoutEffect(() => {
    setMarginValue((previous) => {
      const next = {...value};
      return MARGIN_KEYS.every((key) => previous[key] === next[key]) ? previous : next;
    });
    const nextToggle = getToggleDefaultValue(value);
    if (nextToggle !== toggle) {
      isExternalSyncRef.current = true;
      setToggle(nextToggle);
    }
  }, [value.marginTop, value.marginRight, value.marginBottom, value.marginLeft]);

  const handleChange = useCallback((value: CSSProperties & Record<string, any>) => {
    setMarginValue((val) => {
      return {
        ...val,
        ...value
      }
    })

    const changeList = Object.keys(value).map((key) => ({ key, value: value[key] }))

    // 检测父容器 flex 对齐冲突，自动追加 align-self 修复
    const conflict = getAlignConflict(context?.targetDom)
    if (conflict) {
      const { isRow, alignItems } = conflict
      const crossStart = isRow ? 'marginTop' : 'marginLeft'
      const crossEnd   = isRow ? 'marginBottom' : 'marginRight'

      if (alignItems === 'flex-end' && isFixedMargin(value[crossStart])) {
        // 父容器底/右对齐，用户设置 cross-start 方向 margin → 自动顶/左对齐
        onChange([...changeList, { key: 'alignSelf', value: 'flex-start' }])
        return
      }
      if (alignItems === 'flex-start' && isFixedMargin(value[crossEnd])) {
        // 父容器顶/左对齐，用户设置 cross-end 方向 margin → 自动底/右对齐
        onChange([...changeList, { key: 'alignSelf', value: 'flex-end' }])
        return
      }
      if (alignItems === 'center') {
        if (isFixedMargin(value[crossStart])) {
          onChange([...changeList, { key: 'alignSelf', value: 'flex-start' }])
          return
        }
        if (isFixedMargin(value[crossEnd])) {
          onChange([...changeList, { key: 'alignSelf', value: 'flex-end' }])
          return
        }
      }
    }

    onChange(changeList)
  }, [context?.targetDom, onChange])

  const handleUnifiedChange = useCallback((next: string | null) => {
    handleChange({
      marginTop: next,
      marginRight: next,
      marginBottom: next,
      marginLeft: next
    })
  }, [handleChange])

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
        marginTop: marginValue.marginTop,
        marginRight: marginValue.marginTop,
        marginBottom: marginValue.marginTop,
        marginLeft: marginValue.marginTop
      })
    }
  }, [toggle])

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
              <VariableNumberInput
                binding={unifiedVar}
                chipStyle={CHIP_STYLE}
                inputProps={{
                  style: DEFAULT_STYLE,
                  defaultValue: marginValue.marginTop,
                  defaultUnitValue: 'px',
                  unitOptions,
                  showIcon: true,
                  showIconOnHover: true,
                  allowNegative: true,
                  fallbackValue: 0,
                  onChange: handleUnifiedChange,
                  onAction: (action) => {
                    if (action === APPLY_VARIABLE_ACTION) unifiedVar.openPicker()
                  },
                  tip: `{content:'外边距',position:'top'}`
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
                    <PaddingRightOutlined/>
                  </div>
                  <VariableNumberInput
                    binding={leftVar}
                    chipStyle={CHIP_STYLE}
                    inputProps={{
                      style: DEFAULT_STYLE,
                      defaultValue: marginValue.marginLeft,
                      defaultUnitValue: 'px',
                      unitOptions,
                      showIcon: true,
                      showIconOnHover: true,
                      allowNegative: true,
                      fallbackValue: 0,
                      onChange: (value) => handleChange({marginLeft: value}),
                      onAction: (action) => {
                        if (action === APPLY_VARIABLE_ACTION) leftVar.openPicker()
                      },
                      onFocus: () => setSplitMarginIcon(<PaddingRightOutlined/>)
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
                    <PaddingBottomOutlined/>
                  </div>
                  <VariableNumberInput
                    binding={topVar}
                    chipStyle={CHIP_STYLE}
                    inputProps={{
                      style: DEFAULT_STYLE,
                      defaultValue: marginValue.marginTop,
                      defaultUnitValue: 'px',
                      unitOptions,
                      showIcon: true,
                      showIconOnHover: true,
                      allowNegative: true,
                      fallbackValue: 0,
                      onChange: (value) => handleChange({marginTop: value}),
                      onAction: (action) => {
                        if (action === APPLY_VARIABLE_ACTION) topVar.openPicker()
                      },
                      onFocus: () => setSplitMarginIcon(<PaddingBottomOutlined/>)
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
                    <PaddingLeftOutlined/>
                  </div>
                  <VariableNumberInput
                    binding={rightVar}
                    chipStyle={CHIP_STYLE}
                    inputProps={{
                      style: DEFAULT_STYLE,
                      defaultValue: marginValue.marginRight,
                      defaultUnitValue: 'px',
                      unitOptions,
                      showIcon: true,
                      showIconOnHover: true,
                      allowNegative: true,
                      fallbackValue: 0,
                      onChange: (value) => handleChange({marginRight: value}),
                      onAction: (action) => {
                        if (action === APPLY_VARIABLE_ACTION) rightVar.openPicker()
                      },
                      onFocus: () => setSplitMarginIcon(<PaddingLeftOutlined/>)
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
                    <PaddingTopOutlined/>
                  </div>
                  <VariableNumberInput
                    binding={bottomVar}
                    chipStyle={CHIP_STYLE}
                    inputProps={{
                      style: DEFAULT_STYLE,
                      defaultValue: marginValue.marginBottom,
                      defaultUnitValue: 'px',
                      unitOptions,
                      showIcon: true,
                      showIconOnHover: true,
                      allowNegative: true,
                      fallbackValue: 0,
                      onChange: (value) => handleChange({marginBottom: value}),
                      onAction: (action) => {
                        if (action === APPLY_VARIABLE_ACTION) bottomVar.openPicker()
                      },
                      onFocus: () => setSplitMarginIcon(<PaddingTopOutlined/>)
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

  const marginKeySet = new Set(MARGIN_KEYS)

  const refresh = useCallback(() => {
    const keys = Object.keys(value ?? {}).filter(key => marginKeySet.has(key as any))
    console.log("margin refresh", keys);
    onChange(keys.map(key => ({ key, value: null })))
    setIsReset(true)
    setMarginValue({} as any)
    setForceRenderKey(prev => prev + 1)
  }, [value, onChange])

  useEffect(() => {
    const currentValue = value as Record<string, any> | undefined
    if (isReset && currentValue && Object.keys(currentValue).some(k => currentValue[k] != null)) {
      setIsReset(false)
    }
  }, [value, isReset])

  return (
    <Panel title='外边距' showTitle={showTitle} showReset={true} resetFunction={refresh} collapse={collapse}>
      <React.Fragment key={forceRenderKey}>
        {marginConfig}
      </React.Fragment>
    </Panel>
  )
}

function getToggleDefaultValue (value: CSSProperties): boolean {
  return allEqual([value.marginTop, value.marginRight, value.marginBottom, value.marginLeft])
}
