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
import { allEqual } from '../../utils'
import { useUpdateEffect, useDragNumber, useLengthVarBinding, isCssVarValue } from '../../hooks'

import type { ChangeEvent, PanelBaseProps } from '../../type'
import { useStyleEditorContext } from '../../context'
import type { LengthVarBinding } from '../../hooks/useLengthVarBinding'
import type { InputNumberProps } from '../../components/InputNumber'

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
const MARGIN_KEYS = ['marginTop', 'marginRight', 'marginBottom', 'marginLeft'] as const

type MarginValue = CSSProperties & Record<string, any>

/** 将 margin 简写展开，保留 auto 关键字供编辑器回显。 */
function expandMarginShorthand(value: CSSProperties): MarginValue {
  const next: MarginValue = {...value}
  MARGIN_KEYS.forEach((key) => {
    if (String(next[key] ?? '').trim().toLowerCase() === '0auto') next[key] = 'auto'
  })
  if (typeof next.margin !== 'string' || !next.margin.trim()) return next

  const rawMargin = next.margin.replace(/\s*!important\s*$/i, '').trim()
  const parts: string[] = []
  let token = ''
  let depth = 0
  for (const char of rawMargin) {
    if (char === '(') depth += 1
    if (char === ')') depth -= 1
    if (/\s/.test(char) && depth === 0) {
      if (token) parts.push(token)
      token = ''
    } else {
      token += char
    }
  }
  if (token) parts.push(token)
  if (depth !== 0 || parts.length < 1 || parts.length > 4) return next

  const [top, right = top, bottom = top, left = right] = parts
  const expanded = parts.length === 1
    ? [top, top, top, top]
    : parts.length === 2
      ? [top, right, top, right]
      : parts.length === 3
        ? [top, right, bottom, right]
        : [top, right, bottom, left]

  MARGIN_KEYS.forEach((key, index) => {
    if (next[key] == null || next[key] === '') next[key] = expanded[index]
  })
  return next
}

function getMarginEditorValue(
  value: CSSProperties,
  authoredStyle?: Record<string, any>
): MarginValue {
  // defaultValue 来自 computedStyle，未声明方向也会被浏览器补成 0px。只要能拿到
  // 当前规则的原始声明，就以它作为面板回显来源，避免把浏览器默认值误判成用户配置。
  if (!authoredStyle) return expandMarginShorthand(value)

  const authored = expandMarginShorthand(authoredStyle as CSSProperties)
  const hasAuthoredMargin =
    Object.prototype.hasOwnProperty.call(authoredStyle, 'margin') ||
    MARGIN_KEYS.some((key) => Object.prototype.hasOwnProperty.call(authoredStyle, key))
  if (!hasAuthoredMargin) {
    // 与 Padding 面板保持一致：getDefaultConfiguration 已经从 CSSRule 中保留了
    // var(...)，即使 authoredStyle 没拿到 shorthand，也应使用明确的变量值回显。
    // 普通 computed 的 0px/auto 仍然返回空对象，继续显示「默认」。
    const hasVariableMargin = MARGIN_KEYS.some((key) => isCssVarValue((value as any)[key]))
    return hasVariableMargin ? expandMarginShorthand(value) : {}
  }

  const next: MarginValue = {}
  MARGIN_KEYS.forEach((key) => {
    if (authored[key] != null && authored[key] !== '') next[key] = authored[key]
  })
  return next
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
        <ClearButton onClick={() => inputProps.onClear?.()} />
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
          clearable: true,
          tip: `当前${label}为 auto，自动占用剩余空间；${binding.fallbackValue}为计算值`,
          badge: <AutoMarginBadge inputProps={normalizedInputProps} />
        }}
      />
    )
  }

  return <VariableNumberInput binding={binding} inputProps={normalizedInputProps} chipStyle={CHIP_STYLE} />
}

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
  const context = useStyleEditorContext()
  const initialValue = getMarginEditorValue(value, context?.authoredStyle)
  const [toggle, setToggle] = useState(getToggleDefaultValue(initialValue))
  const [marginValue, setMarginValue] = useState(initialValue)
  const marginValueRef = useRef(initialValue)
  const [forceRenderKey, setForceRenderKey] = useState<number>(Math.random())
  const [splitMarginIcon, setSplitMarginIcon] = useState(<MarginTopOutlined />)
  const getDragProps = useDragNumber({ continuous: true, min: -Infinity })
  const handleSwitchToUnified = useCallback(() => {
    onChange(MARGIN_KEYS.map((key) => ({ key, value: null })))
    setToggle(true)
  }, [onChange])

  const cfg = useMemo(() => ({ ...DEFAULT_CONFIG, ...(config ?? {}) }), [config]);

  /** 由外部值同步引起的模式切换不应回写四边，否则会覆盖真实外边距 */
  const isExternalSyncRef = useRef(false)

  // 面板实例会在切换选中组件时复用，需同步新的边距值，避免先显示上一组件的数字。
  useLayoutEffect(() => {
    const next = getMarginEditorValue(value, context?.authoredStyle);
    marginValueRef.current = next
    setMarginValue((previous) => {
      return MARGIN_KEYS.every((key) => previous[key] === next[key]) ? previous : next;
    });
    const nextToggle = getToggleDefaultValue(next);
    if (nextToggle !== toggle) {
      isExternalSyncRef.current = true;
      setToggle(nextToggle);
    }
  }, [
    value.margin,
    value.marginTop,
    value.marginRight,
    value.marginBottom,
    value.marginLeft,
    context?.authoredStyle,
  ]);

  const handleChange = useCallback((value: CSSProperties & Record<string, any>) => {
    // 单位下拉选中「默认」时 InputNumber 会回传 'default'，等同于清空该属性
    const normalizedValue: Record<string, any> = {...value}
    Object.keys(normalizedValue).forEach((key) => {
      if (String(normalizedValue[key] ?? '').includes('default')) normalizedValue[key] = null
    })

    const current: Record<string, any> = {...marginValueRef.current}
    const next = {...current, ...normalizedValue}
    marginValueRef.current = next
    setMarginValue(next)

    // 清空某一边时，必须把其余方向的原始值一起传给下游。
    // liveStyle 可能仍是 margin shorthand；只传一个 null 会让 shorthand-normalizer
    // 误以为整组属性都要删除。这里沿用 Padding 的做法：本次修改传 null，其余方向
    // 传当前快照中的值，让下游先拆成四边，再只删除目标方向。
    const changedKeys = new Set(Object.keys(normalizedValue))
    const changeList: Array<{key: string; value: any}> = []
    MARGIN_KEYS.forEach((key) => {
      if (changedKeys.has(key)) {
        changeList.push({key, value: normalizedValue[key]})
      } else {
        const rawValue = next[key]
        if (rawValue != null && rawValue !== '') {
          changeList.push({key, value: rawValue})
        }
      }
    })

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
    const value = next === 'default' ? null : next
    handleChange({
      marginTop: value,
      marginRight: value,
      marginBottom: value,
      marginLeft: value
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
              <MarginValueInput
                binding={unifiedVar}
                value={marginValue.marginTop}
                label="外边距"
                inputProps={{
                  style: DEFAULT_STYLE,
                  defaultValue: marginValue.marginTop,
                  defaultUnitValue: 'default',
                  unitOptions,
                  showIcon: true,
                  showIconOnHover: true,
                  allowNegative: true,
                  fallbackValue: 0,
                  onChange: handleUnifiedChange,
                  onClear: () => handleUnifiedChange(null),
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
                      unitOptions,
                      showIcon: true,
                      showIconOnHover: true,
                      allowNegative: true,
                      fallbackValue: 0,
                      onChange: (value) => handleChange({marginLeft: value}),
                      onClear: () => handleChange({marginLeft: null}),
                      onAction: (action) => {
                        if (action === APPLY_VARIABLE_ACTION) leftVar.openPicker()
                      },
                      onFocus: () => setSplitMarginIcon(<MarginLeftOutlined/>)
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
                      unitOptions,
                      showIcon: true,
                      showIconOnHover: true,
                      allowNegative: true,
                      fallbackValue: 0,
                      onChange: (value) => handleChange({marginTop: value}),
                      onClear: () => handleChange({marginTop: null}),
                      onAction: (action) => {
                        if (action === APPLY_VARIABLE_ACTION) topVar.openPicker()
                      },
                      onFocus: () => setSplitMarginIcon(<MarginTopOutlined/>)
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
                      unitOptions,
                      showIcon: true,
                      showIconOnHover: true,
                      allowNegative: true,
                      fallbackValue: 0,
                      onChange: (value) => handleChange({marginRight: value}),
                      onClear: () => handleChange({marginRight: null}),
                      onAction: (action) => {
                        if (action === APPLY_VARIABLE_ACTION) rightVar.openPicker()
                      },
                      onFocus: () => setSplitMarginIcon(<MarginRightOutlined/>)
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
                      unitOptions,
                      showIcon: true,
                      showIconOnHover: true,
                      allowNegative: true,
                      fallbackValue: 0,
                      onChange: (value) => handleChange({marginBottom: value}),
                      onClear: () => handleChange({marginBottom: null}),
                      onAction: (action) => {
                        if (action === APPLY_VARIABLE_ACTION) bottomVar.openPicker()
                      },
                      onFocus: () => setSplitMarginIcon(<MarginBottomOutlined/>)
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
    onChange([
      {key: 'margin', value: null},
      ...MARGIN_KEYS.map((key) => ({key, value: null}))
    ])
    marginValueRef.current = {}
    setMarginValue({} as any)
    setForceRenderKey(prev => prev + 1)
  }, [onChange])

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
