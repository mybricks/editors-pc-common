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
import { useDragNumber, useLengthVarBinding, isCssVarValue } from '../../hooks'

import type { ChangeEvent, PanelBaseProps } from '../../type'
import {
  useEffectiveStyleValue,
  useStyleChange,
  useStyleClear,
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
const MARGIN_KEYS = ['marginTop', 'marginRight', 'marginBottom', 'marginLeft'] as const

type MarginValue = CSSProperties & Record<string, any>

function isEffectiveStyleConfigured(item?: EffectiveStyleValue): boolean {
  if (!item || item.type === 'computed') return false
  return !(typeof item.value === 'string' && /^unset$/i.test(item.value.trim()))
}

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
  effectiveStyle?: Record<string, EffectiveStyleValue>
): MarginValue {
  if (!effectiveStyle) return expandMarginShorthand(value)
  const next: MarginValue = {}
  MARGIN_KEYS.forEach((key) => {
    if (!isEffectiveStyleConfigured(effectiveStyle[key])) return
    const current = value[key]
    if (current != null && current !== '') {
      next[key] = String(current).trim().toLowerCase() === '0auto' ? 'auto' : current
    }
  })
  return next
}

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

export function Margin ({value, onChange: fallbackOnChange, config, showTitle, collapse}: MarginProps) {
  const context = useStyleEditorContext()
  const effectiveValue = useEffectiveStyleValue()
  const onChange = useStyleChange(fallbackOnChange)
  const topClear = useStyleClear('marginTop')
  const rightClear = useStyleClear('marginRight')
  const bottomClear = useStyleClear('marginBottom')
  const leftClear = useStyleClear('marginLeft')
  const unifiedClear = useStyleClear(MARGIN_KEYS)
  // Zone 模式只跟随 EffectiveStyleValue。写入后 StyleMount 会先刷新 value，
  // effectiveStyle 稍后才回流；若监听 value，会用旧 effectiveStyle 把本地新值覆盖掉。
  const editorValue = context?.effectiveStyle ? effectiveValue : value
  const initialValue = getMarginEditorValue(
    editorValue,
    context?.effectiveStyle
  )
  const [toggle, setToggle] = useState(getToggleDefaultValue(initialValue))
  const [marginValue, setMarginValue] = useState(initialValue)
  const marginValueRef = useRef(initialValue)
  const [draftConfigured, setDraftConfigured] = useState<Record<string, boolean>>({})
  const [previewValues, setPreviewValues] = useState<Record<string, string | undefined>>({})
  const [forceRenderKey, setForceRenderKey] = useState<number>(Math.random())
  const [splitMarginIcon, setSplitMarginIcon] = useState(<MarginTopOutlined />)
  const getDragProps = useDragNumber({ continuous: true, min: -Infinity })

  const cfg = useMemo(() => ({ ...DEFAULT_CONFIG, ...(config ?? {}) }), [config]);

  // 面板实例会在切换选中组件时复用，需同步新的边距值，避免先显示上一组件的数字。
  useLayoutEffect(() => {
    const next = getMarginEditorValue(
      editorValue,
      context?.effectiveStyle
    );
    marginValueRef.current = next
    setDraftConfigured({})
    setPreviewValues({})
    setMarginValue((previous) => {
      return MARGIN_KEYS.every((key) => previous[key] === next[key]) ? previous : next;
    });
    const nextToggle = getToggleDefaultValue(next);
    if (nextToggle !== toggle) {
      setToggle(nextToggle);
    }
  }, [
    context?.targetDom,
    context?.effectiveStyle,
    effectiveValue.marginTop,
    effectiveValue.marginRight,
    effectiveValue.marginBottom,
    effectiveValue.marginLeft,
    context?.effectiveStyle ? undefined : value.margin,
    context?.effectiveStyle ? undefined : value.marginTop,
    context?.effectiveStyle ? undefined : value.marginRight,
    context?.effectiveStyle ? undefined : value.marginBottom,
    context?.effectiveStyle ? undefined : value.marginLeft,
  ]);

  const handleChange = useCallback((changes: CSSProperties & Record<string, any>) => {
    // 单位下拉选中「默认」时 InputNumber 会回传 'default'，等同于清空该属性
    const normalizedValue: Record<string, any> = {...changes}
    Object.keys(normalizedValue).forEach((key) => {
      if (String(normalizedValue[key] ?? '').includes('default')) normalizedValue[key] = null
    })

    const changeItems = Object.entries(normalizedValue).map(([key, nextValue]) => ({
      key,
      value: nextValue
    }))

    // 检测父容器 flex 对齐冲突，自动追加 align-self 修复
    const conflict = getAlignConflict(context?.targetDom)
    if (conflict) {
      const { isRow, alignItems } = conflict
      const crossStart = isRow ? 'marginTop' : 'marginLeft'
      const crossEnd   = isRow ? 'marginBottom' : 'marginRight'

      if (alignItems === 'flex-end' && isFixedMargin(changes[crossStart])) {
        // 父容器底/右对齐，用户设置 cross-start 方向 margin → 自动顶/左对齐
        changeItems.push({key: 'alignSelf', value: 'flex-start'})
      } else if (alignItems === 'flex-start' && isFixedMargin(changes[crossEnd])) {
        // 父容器顶/左对齐，用户设置 cross-end 方向 margin → 自动底/右对齐
        changeItems.push({key: 'alignSelf', value: 'flex-end'})
      } else if (alignItems === 'center') {
        if (isFixedMargin(changes[crossStart])) {
          changeItems.push({key: 'alignSelf', value: 'flex-start'})
        } else if (isFixedMargin(changes[crossEnd])) {
          changeItems.push({key: 'alignSelf', value: 'flex-end'})
        }
      }
    }

    const result = onChange(changeItems)
    if (result?.clearUnsupported && !result.clearApplied) return result

    const next = {...marginValueRef.current, ...normalizedValue}
    marginValueRef.current = next
    setMarginValue(next)
    setDraftConfigured((current) => {
      const nextDraft = {...current}
      Object.entries(normalizedValue).forEach(([key, nextValue]) => {
        nextDraft[key] = nextValue != null
      })
      return nextDraft
    })
    setPreviewValues((current) => {
      const nextPreview = {...current}
      Object.entries(normalizedValue).forEach(([key, nextValue]) => {
        nextPreview[key] = nextValue == null
          ? context?.getStylePreview?.(key, true) || undefined
          : undefined
      })
      return nextPreview
    })
    return result
  }, [onChange, context?.getStylePreview, context?.targetDom])

  const handleUnifiedChange = useCallback((next: string | null) => {
    const value = next === 'default' ? null : next
    handleChange({
      marginTop: value,
      marginRight: value,
      marginBottom: value,
      marginLeft: value
    })
  }, [handleChange])

  const handleSwitchToUnified = useCallback(() => {
    const result = handleChange({
      marginTop: marginValueRef.current.marginTop ?? null,
      marginRight: marginValueRef.current.marginTop ?? null,
      marginBottom: marginValueRef.current.marginTop ?? null,
      marginLeft: marginValueRef.current.marginTop ?? null
    })
    if (result?.clearUnsupported && !result.clearApplied) return
    setToggle(true)
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

  const standalone = !context?.getStyleProperty
  const topCanClear = !!topClear.clear || (!topClear.disabledReason && (
    draftConfigured.marginTop || (standalone && marginValue.marginTop != null)
  ))
  const rightCanClear = !!rightClear.clear || (!rightClear.disabledReason && (
    draftConfigured.marginRight || (standalone && marginValue.marginRight != null)
  ))
  const bottomCanClear = !!bottomClear.clear || (!bottomClear.disabledReason && (
    draftConfigured.marginBottom || (standalone && marginValue.marginBottom != null)
  ))
  const leftCanClear = !!leftClear.clear || (!leftClear.disabledReason && (
    draftConfigured.marginLeft || (standalone && marginValue.marginLeft != null)
  ))
  const unifiedCanClear = !!unifiedClear.clear || (!unifiedClear.disabledReason &&
    [topCanClear, rightCanClear, bottomCanClear, leftCanClear].some(Boolean))
  const canReset = standalone
    ? [topCanClear, rightCanClear, bottomCanClear, leftCanClear].some(Boolean)
    : unifiedCanClear
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

  const refresh = useCallback(() => {
    const result = onChange(MARGIN_KEYS.map((key) => ({key, value: null})))
    if (result?.clearUnsupported && !result.clearApplied) return
    marginValueRef.current = {}
    setDraftConfigured({})
    setPreviewValues(Object.fromEntries(MARGIN_KEYS.map((key) => [
      key,
      context?.getStylePreview?.(key, true) || undefined
    ])))
    setMarginValue({} as any)
    setToggle(true)
    setForceRenderKey(prev => prev + 1)
  }, [onChange, context?.getStylePreview])

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

function getToggleDefaultValue (value: CSSProperties): boolean {
  return allEqual([value.marginTop, value.marginRight, value.marginBottom, value.marginLeft])
}
