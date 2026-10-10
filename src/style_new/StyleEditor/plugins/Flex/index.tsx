import React, { CSSProperties, useCallback, useEffect, useMemo, useRef, useState } from 'react'

import { Panel, InputNumber } from '../../components'
import { Setting as SettingIcon } from '../../icons/Setting'
import { MinusOutlined } from '../../components/Icon'
import { useEffectiveStyleValue, useStyleChange, useStyleClear, useStyleEditorContext } from '../../context'

import type { ChangeEvent, PanelBaseProps } from '../../type'

import css from './index.less'
import lang from '../../../index.i18n'

interface FlexProps extends PanelBaseProps {
  value: CSSProperties & Record<string, any>
  onChange: ChangeEvent
}

const FLEX_KEYS = ['flex', 'flexGrow', 'flexShrink', 'flexBasis'] as const

type FlexMode = 'ratio' | 'advanced'

/** 面板与字段文案（面向设计） */
const COPY = {
  panelTitle: lang.flexPanelTitle,
  panelTip: JSON.stringify({
    content: lang.flexAutoFill,
    position: 'left',
  }),
  fieldLabel: lang.flexRatioLabel,
  fieldTip: JSON.stringify({
    content:
      lang.flexRatioTip,
    position: 'left',
  }),
  toAdvancedTip: JSON.stringify({
    content: lang.flexSplitTip,
    position: 'left',
  }),
  toRatioTip: JSON.stringify({
    content: lang.flexUnifiedTip,
    position: 'left',
  }),
  growLabel: lang.flexGrowLabel,
  growTip: JSON.stringify({
    content: lang.flexGrowTip,
    position: 'left',
  }),
  shrinkLabel: lang.flexShrinkLabel,
  shrinkTip: JSON.stringify({
    content: lang.flexShrinkTip,
    position: 'left',
  }),
  basisLabel: lang.flexBasisLabel,
  basisTip: JSON.stringify({
    content:
      lang.flexBasisTip,
    position: 'left',
  }),
}

const BASIS_UNIT_OPTIONS = [
  { label: 'px', value: 'px' },
  { label: '%', value: '%' },
]

function isFlexChildVisible(targetDom: HTMLElement | null | undefined): boolean {
  if (!targetDom) return false
  const selfPos = window.getComputedStyle(targetDom).position
  if (selfPos === 'absolute' || selfPos === 'fixed') return false
  const parent = targetDom.parentElement
  if (!parent) return false
  const display = window.getComputedStyle(parent).display
  return display === 'flex' || display === 'inline-flex'
}

function isNonEmpty(v: unknown): boolean {
  return v != null && String(v).trim() !== ''
}

/** 解析 flex 简写为三元组 */
function parseFlexShorthand(raw: string): { grow: string; shrink: string; basis: string } | null {
  const v = raw.trim()
  if (!v) return null
  if (v === 'none') return { grow: '0', shrink: '0', basis: 'auto' }
  if (v === 'auto') return { grow: '1', shrink: '1', basis: 'auto' }

  const parts = v.split(/\s+/)
  if (parts.length === 1) {
    // 纯数字 → 增长系数（等价 flex:N → N 1 0%）
    if (/^-?[\d.]+$/.test(parts[0])) {
      return { grow: parts[0], shrink: '1', basis: '0%' }
    }
    // 长度 → 基础长度
    return { grow: '1', shrink: '1', basis: parts[0] }
  }
  if (parts.length === 2) {
    // 第二段为无单位数字 → grow + shrink；否则 grow + basis
    if (/^-?[\d.]+$/.test(parts[1])) {
      return { grow: parts[0], shrink: parts[1], basis: '0%' }
    }
    return { grow: parts[0], shrink: '1', basis: parts[1] }
  }
  return { grow: parts[0], shrink: parts[1], basis: parts.slice(2).join(' ') }
}

/**
 * 浏览器会把 flex:1 序列化成 1 1 0%，比例行回显时压回简洁写法。
 * 例：1 1 0% / 1 1 0px → 1；2 1 0% → 2
 */
function normalizeFlexDisplay(raw: string): string {
  const v = raw.trim()
  if (!v) return ''
  if (v === 'none' || v === 'auto' || v === 'initial' || v === 'inherit') return v
  const parsed = parseFlexShorthand(v)
  if (!parsed) return v
  const { grow, shrink, basis } = parsed
  const basisIsZero = basis === '0' || basis === '0%' || basis === '0px'
  if (/^-?[\d.]+$/.test(grow) && shrink === '1' && basisIsZero) {
    return grow
  }
  return v
}

/** 比例行只回显 value 里的简写 flex（由 Less/value.get 注入）；纯长写时为空 */
function formatFlexEcho(value: CSSProperties & Record<string, any> | undefined): string {
  if (!value) return ''
  if (isNonEmpty(value.flex)) return normalizeFlexDisplay(String(value.flex))
  return ''
}

/** 长写逐项覆盖简写；缺失的字段继续使用简写贡献的值，绝不用 computed 默认值补齐。 */
function resolveFlexParts(
  value: CSSProperties & Record<string, any> | undefined,
  shorthandEcho: string
): { grow: string; shrink: string; basis: string } {
  const parsed = parseFlexShorthand(shorthandEcho)
  return {
    grow: isNonEmpty(value?.flexGrow) ? String(value!.flexGrow) : parsed?.grow ?? '',
    shrink: isNonEmpty(value?.flexShrink) ? String(value!.flexShrink) : parsed?.shrink ?? '',
    basis: isNonEmpty(value?.flexBasis) ? String(value!.flexBasis) : parsed?.basis ?? '',
  }
}

/**
 * 源码有长写 → 单独配置（按钮选中）。
 * 读取链路只返回 CSSOM 合成简写时，非常规多段值也按单独配置回显。
 */
function resolveFlexMode(value: CSSProperties & Record<string, any> | undefined): FlexMode {
  if (
    isNonEmpty(value?.flexGrow) ||
    isNonEmpty(value?.flexShrink) ||
    isNonEmpty(value?.flexBasis)
  ) {
    return 'advanced'
  }

  // Chrome 会把长写 flex-grow/shrink/basis 合成为 flex: 1 11 0%，
  // 导致重新聚焦后无法从 CSSOM 区分源码到底是简写还是长写。
  // 保留常规比例写法 N 1 0% 为统一配置；其余多段值按单独配置回显。
  if (isNonEmpty(value?.flex)) {
    const raw = String(value!.flex).trim()
    const tokens = raw.split(/\s+/)
    const parsed = parseFlexShorthand(raw)
    if (tokens.length >= 2 && parsed) {
      const basisIsZero =
        parsed.basis === '0' ||
        parsed.basis === '0%' ||
        parsed.basis === '0px'
      if (parsed.shrink !== '1' || !basisIsZero) {
        return 'advanced'
      }
    }
  }

  return 'ratio'
}

export function Flex({ value: fallbackValue, onChange: fallbackOnChange, showTitle, collapse }: FlexProps) {
  const editorContext = useStyleEditorContext();
  const effectiveValue = useEffectiveStyleValue();
  const hasFallbackFlexValue = FLEX_KEYS.some(key => isNonEmpty(fallbackValue?.[key]));
  const value = hasFallbackFlexValue ? fallbackValue : effectiveValue;
  const onChange = useStyleChange(fallbackOnChange);
  const { clear, disabledReason } = useStyleClear(FLEX_KEYS, { mode: 'remove-declaration', fallbackOnChange });
  const targetDom = editorContext?.targetDom ?? null

  const echo = useMemo(
    () => formatFlexEcho(value),
    [value?.flex, value?.flexGrow, value?.flexShrink, value?.flexBasis]
  )

  const parts = useMemo(
    () => resolveFlexParts(value, echo),
    [value?.flex, value?.flexGrow, value?.flexShrink, value?.flexBasis, echo]
  )

  const [localValue, setLocalValue] = useState(echo)
  const [localGrow, setLocalGrow] = useState(parts.grow)
  const [localShrink, setLocalShrink] = useState(parts.shrink)
  const [localBasis, setLocalBasis] = useState(parts.basis)
  const [mode, setMode] = useState<FlexMode>(() => resolveFlexMode(value))
  // 展开后保持面板打开，避免单独编辑写入时样式快照短暂为空导致自动收起。
  const [expandedByUser, setExpandedByUser] = useState(collapse !== true)
  const isEditingRef = useRef(false)
  const isEditingGrowRef = useRef(false)
  const isEditingShrinkRef = useRef(false)
  const isEditingBasisRef = useRef(false)
  const focusGrowValueRef = useRef('')
  const focusShrinkValueRef = useRef('')
  // 切回比例时 advanced 输入会卸载并触发 blur；抑制这次 blur 落盘，避免盖掉简写写入
  const suppressLonghandBlurRef = useRef(false)
  // CSSOM 可能把长写重新序列化成 `flex: 1 1 0%`；用户已进入单独配置后，
  // 不能因此把编辑器模式误切回比例配置。
  const modeOverrideRef = useRef<FlexMode | null>(null)

  useEffect(() => {
    if (!isEditingRef.current) setLocalValue(echo)
  }, [echo])

  useEffect(() => {
    if (!isEditingGrowRef.current) setLocalGrow(parts.grow)
  }, [parts.grow])

  useEffect(() => {
    if (!isEditingShrinkRef.current) setLocalShrink(parts.shrink)
  }, [parts.shrink])

  useEffect(() => {
    if (!isEditingBasisRef.current) setLocalBasis(parts.basis)
  }, [parts.basis])

  // 按长写或非常规多段 flex 同步模式，重新聚焦后保持单独配置按钮选中
  useEffect(() => {
    if (suppressLonghandBlurRef.current) return
    const modeOverride = modeOverrideRef.current
    modeOverrideRef.current = null
    setMode(modeOverride || resolveFlexMode(value))
  }, [targetDom, value?.flexGrow, value?.flexShrink, value?.flexBasis, value?.flex])

  const hasFlexValue =
    echo !== '' ||
    isNonEmpty(value?.flex) ||
    isNonEmpty(value?.flexGrow) ||
    isNonEmpty(value?.flexShrink) ||
    isNonEmpty(value?.flexBasis)
  const hasVisibleFlexValue = hasFlexValue ||
    isNonEmpty(localValue) ||
    [localGrow, localShrink, localBasis].some(isNonEmpty)
  const visible = isFlexChildVisible(targetDom) ||
    (!!targetDom && !targetDom.isConnected && hasVisibleFlexValue)

  const switchToAdvanced = useCallback(() => {
    // 进入单独配置后允许长写 blur 落盘
    suppressLonghandBlurRef.current = false
    // 从比例切到单独：把当前简写解析进三字段，便于对照编辑（写入仍等用户改长写）
    if (localValue.trim()) {
      const parsed = parseFlexShorthand(localValue.trim())
      if (parsed) {
        setLocalGrow(parsed.grow)
        setLocalShrink(parsed.shrink)
        setLocalBasis(parsed.basis)
      }
    }
    setMode('advanced')
  }, [localValue])

  const refresh = useCallback(() => {
    if (!clear) return
    modeOverrideRef.current = null
    setExpandedByUser(false)
    const result = clear()
    if (result?.clearUnsupported || (result && !result.applied)) return
    const remaining = Object.fromEntries(FLEX_KEYS.map(key => [key, editorContext?.getStyleProperty?.(key).winner?.value]))
    const nextEcho = formatFlexEcho(remaining)
    const nextParts = resolveFlexParts(remaining, nextEcho)
    setLocalValue(nextEcho)
    setLocalGrow(nextParts.grow)
    setLocalShrink(nextParts.shrink)
    setLocalBasis(nextParts.basis)
    setMode(resolveFlexMode(remaining))
  }, [clear, editorContext?.getStyleProperty])

  const handleExpand = useCallback(() => {
    setExpandedByUser(true)
  }, [])

  const commitShorthand = useCallback(
    (raw: string) => {
      const trimmed = raw.trim()
      if (!trimmed) {
        if (!hasFlexValue) return
        refresh()
        return
      }
      // 走简写：清空长写，回到统一比例；写入前压成简洁写法（1 1 0% → 1）
      const normalized = normalizeFlexDisplay(trimmed)
      // 仅失焦不代表值发生变化，避免把当前回显值再次写回上层。
      if (
        normalized === echo &&
        !isNonEmpty(value?.flexGrow) &&
        !isNonEmpty(value?.flexShrink) &&
        !isNonEmpty(value?.flexBasis)
      ) {
        setLocalValue(normalized)
        return
      }
      const result = onChange([
        { key: 'flex', value: normalized },
        { key: 'flexGrow', value: null },
        { key: 'flexShrink', value: null },
        { key: 'flexBasis', value: null },
      ])
      if (result?.clearUnsupported || (result && !result.applied)) return
      modeOverrideRef.current = 'ratio'
      setLocalValue(normalized)
      setLocalGrow('')
      setLocalShrink('')
      setLocalBasis('')
      setMode('ratio')
    },
    [onChange, refresh, echo, hasFlexValue, value?.flexGrow, value?.flexShrink, value?.flexBasis]
  )

  /** 点 + 展开时立刻写入 flex:1，避免空输入框看起来像“点了没反应” */
  const handleAdd = useCallback(() => {
    commitShorthand('1')
  }, [commitShorthand])

  const switchToRatio = useCallback(() => {
    // 单独配置切回统一配置时，以增长系数作为比例值。
    // 例：grow:5 / shrink:12 / basis:12% → flex:5，并清空三项长写。
    const ratio = localGrow.trim()
    // 先抑制：随后 advanced 输入卸载触发的 blur 不得再 commitLonghands
    suppressLonghandBlurRef.current = true
    if (ratio) {
      commitShorthand(ratio)
      return
    }
    setMode('ratio')
  }, [commitShorthand, localGrow])

  /** 写长写三件套，清简写，避免打架 */
  const commitLonghands = useCallback(
    (next: { grow?: string; shrink?: string; basis?: string }) => {
      if (suppressLonghandBlurRef.current) {
        return
      }

      const grow = next.grow !== undefined ? next.grow.trim() : localGrow.trim()
      const shrink = next.shrink !== undefined ? next.shrink.trim() : localShrink.trim()
      const basisRaw = next.basis !== undefined ? next.basis : localBasis
      const basis = basisRaw != null ? String(basisRaw).trim() : ''

      if (!grow && !shrink && !basis) {
        if (!hasFlexValue) return
        refresh()
        return
      }

      // 高级字段失焦时，只有三项实际变化才需要把简写切成长写并通知上层。
      if (grow === parts.grow && shrink === parts.shrink && basis === parts.basis) {
        setLocalBasis(basis)
        return
      }

      const changes: Array<{ key: string; value: any }> = [{ key: 'flex', value: null }]
      changes.push({ key: 'flexGrow', value: grow !== '' ? grow : null })
      changes.push({ key: 'flexShrink', value: shrink !== '' ? shrink : null })
      // 0 / 0% 等合法值不能用 || 落到 null
      changes.push({ key: 'flexBasis', value: basis !== '' ? basis : null })
      const result = onChange(changes)
      if (result?.clearUnsupported || (result && !result.applied)) return
      setLocalBasis(basis)
      modeOverrideRef.current = 'advanced'
      // 走长写后比例清空，并保持单独配置模式
      setLocalValue('')
      setMode('advanced')
    },
    [onChange, refresh, localGrow, localShrink, localBasis, hasFlexValue, parts]
  )

  const handleFocus = useCallback(() => {
    isEditingRef.current = true
  }, [])

  const handleChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setLocalValue(e.target.value)
  }, [])

  const handleBlur = useCallback(
    (e: React.FocusEvent<HTMLInputElement>) => {
      isEditingRef.current = false
      commitShorthand(e.target.value)
    },
    [commitShorthand]
  )

  const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') (e.target as HTMLInputElement).blur()
  }, [])

  const handleGrowBlur = useCallback(
    (e: React.FocusEvent<HTMLInputElement>) => {
      isEditingGrowRef.current = false
      const v = e.target.value.trim()
      setLocalGrow(v)
      if (v === focusGrowValueRef.current) return
      commitLonghands({ grow: v })
    },
    [commitLonghands]
  )

  const handleShrinkBlur = useCallback(
    (e: React.FocusEvent<HTMLInputElement>) => {
      isEditingShrinkRef.current = false
      const v = e.target.value.trim()
      setLocalShrink(v)
      if (v === focusShrinkValueRef.current) return
      commitLonghands({ shrink: v })
    },
    [commitLonghands]
  )

  const handleBasisChange = useCallback(
    (val: string | null) => {
      isEditingBasisRef.current = false
      // InputNumber 在关键字单位下会直接回传 auto；清空为 null
      const next = val == null ? '' : String(val).trim()
      // 拦截非法拼接（历史：单位 auto 时输入数字变成 50auto）
      if (next && !/^(auto|0|[+-]?[\d.]+(px|%|em|rem|vw|vh)?)$/i.test(next)) {
        return
      }
      setLocalBasis(next)
      commitLonghands({ basis: next })
    },
    [commitLonghands]
  )

  if (!visible) return null

  const effectiveCollapse = hasVisibleFlexValue || expandedByUser ? false : collapse
  const isAdvanced = mode === 'advanced'

  return (
    <Panel
      title={COPY.panelTitle}
      titleTip={COPY.panelTip}
      showTitle={showTitle}
      showReset={true}
      showDelete={!!clear}
      deleteNode={hasVisibleFlexValue || clear ? (
        <span aria-disabled={!clear} title={!clear ? disabledReason || lang.styleSourceNotReady : undefined}
          style={{ opacity: clear ? 1 : 0.4 }}><MinusOutlined /></span>
      ) : undefined}
      onDelete={clear ? refresh : undefined}
      resetFunction={refresh}
      collapse={effectiveCollapse}
      onExpand={handleExpand}
      onAdd={!hasVisibleFlexValue ? handleAdd : undefined}
      hideTopBorder
    >
      {/* 切换按钮槽位固定，避免比例/单独两套结构导致绝对位置抖动 */}
      <div className={css.body} title={disabledReason}>
        <div className={css.fields}>
          {!isAdvanced ? (
            <Panel.Content>
              <Panel.Item style={{ display: 'flex', alignItems: 'center', paddingLeft: 4 }}>
                <span className={css.tip} data-mybricks-tip={COPY.fieldTip}>
                  {COPY.fieldLabel}
                </span>
                <input
                  type="text"
                  value={localValue}
                  onChange={handleChange}
                  onFocus={handleFocus}
                  onBlur={handleBlur}
                  onKeyDown={handleKeyDown}
                  className={`${css.input} ${css.darkPlaceholder}`}
                  spellCheck={false}
                />
              </Panel.Item>
            </Panel.Content>
          ) : (
            <>
              <Panel.Content>
                <Panel.Item style={{ display: 'flex', alignItems: 'center', paddingLeft: 4 }}>
                  <span className={css.detailTip} data-mybricks-tip={COPY.growTip}>
                    {COPY.growLabel}
                  </span>
                  <input
                    type="text"
                    value={localGrow}
                    onChange={(e) => setLocalGrow(e.target.value)}
                    onFocus={() => {
                      isEditingGrowRef.current = true
                      focusGrowValueRef.current = localGrow.trim()
                    }}
                    onBlur={handleGrowBlur}
                    onKeyDown={handleKeyDown}
                    className={`${css.input} ${css.darkPlaceholder}`}
                    spellCheck={false}
                  />
                </Panel.Item>
              </Panel.Content>
              <Panel.Content>
                <Panel.Item style={{ display: 'flex', alignItems: 'center', paddingLeft: 4 }}>
                  <span className={css.detailTip} data-mybricks-tip={COPY.shrinkTip}>
                    {COPY.shrinkLabel}
                  </span>
                  <input
                    type="text"
                    value={localShrink}
                    onChange={(e) => setLocalShrink(e.target.value)}
                    onFocus={() => {
                      isEditingShrinkRef.current = true
                      focusShrinkValueRef.current = localShrink.trim()
                    }}
                    onBlur={handleShrinkBlur}
                    onKeyDown={handleKeyDown}
                    className={`${css.input} ${css.darkPlaceholder}`}
                    spellCheck={false}
                  />
                </Panel.Item>
              </Panel.Content>
              <Panel.Content>
                <Panel.Item style={{ display: 'flex', alignItems: 'center', paddingLeft: 4 }}>
                  <span className={css.detailTip} data-mybricks-tip={COPY.basisTip}>
                    {COPY.basisLabel}
                  </span>
                  <InputNumber
                    style={{ flex: 1, minWidth: 0, marginLeft: 0, padding: '0 6px 0 0' }}
                    defaultValue={localBasis === 'auto' ? undefined : localBasis || undefined}
                    defaultUnitValue="%"
                    unitOptions={BASIS_UNIT_OPTIONS}
                    unitHideLabelList={[]}
                    placeholder=""
                    onFocus={() => {
                      isEditingBasisRef.current = true
                    }}
                    onChange={handleBasisChange}
                  />
                </Panel.Item>
              </Panel.Content>
            </>
          )}
        </div>
        <div
          className={`${css.actionIcon}${isAdvanced ? ` ${css.active}` : ''}`}
          data-mybricks-tip={isAdvanced ? COPY.toRatioTip : COPY.toAdvancedTip}
          onMouseDown={(e) => e.preventDefault()}
          onClick={isAdvanced ? switchToRatio : switchToAdvanced}
        >
          <SettingIcon size={22} />
        </div>
      </div>
    </Panel>
  )
}
