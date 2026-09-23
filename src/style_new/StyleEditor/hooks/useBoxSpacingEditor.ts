import { useCallback, useLayoutEffect, useRef, useState } from 'react'
import type { CSSProperties } from 'react'
import { useEffectiveStyleValue, useStyleChange, useStyleClear, useStyleEditorContext } from '../context'
import type { ChangeEvent, StyleChangeItem } from '../type'
import {
  BOX_SPACING_KEYS, getUnifiedSpacingValue, normalizeBoxSpacingChange, readBoxSpacingValue,
} from '../../core/box-spacing'
import type { BoxSpacingProperty } from '../../core/box-spacing'

type Options = {
  property: BoxSpacingProperty
  value: CSSProperties
  onChange: ChangeEvent
}

/** Margin/Padding 共用回显、单边重置、整组清空和最大值统一配置。 */
export function useBoxSpacingEditor({ property, value, onChange: fallbackOnChange }: Options) {
  const context = useStyleEditorContext()
  const effectiveValue = useEffectiveStyleValue()
  const onChange = useStyleChange(fallbackOnChange)
  const keys = BOX_SPACING_KEYS[property]
  const groupClear = useStyleClear(keys)
  const externalValue = context?.effectiveStyle ? effectiveValue : value
  const incoming = readBoxSpacingValue(property, externalValue, context?.effectiveStyle)
  const allEqual = (values: Record<string, any>) => keys.every(key => values[key] === values[keys[0]])
  const [spacingValue, setSpacingValue] = useState(incoming)
  const valueRef = useRef(incoming)
  const [toggle, setToggle] = useState(allEqual(incoming))
  const [previewValues, setPreviewValues] = useState<Record<string, string | undefined>>({})
  const [forceRenderKey, setForceRenderKey] = useState(0)
  // Zone 回显只跟随 effectiveStyle，避免 liveStyle 先更新时回滚本地新值。
  const standaloneSignature = context?.effectiveStyle ? '' : JSON.stringify(incoming)
  useLayoutEffect(() => {
    valueRef.current = incoming
    setSpacingValue(incoming)
    setPreviewValues({})
    setToggle(allEqual(incoming))
  }, [property, context?.targetDom, context?.effectiveStyle, standaloneSignature])

  const commit = useCallback((changes: Record<string, any>, unified = false) => {
    const items: StyleChangeItem[] = unified
      ? [{ key: property, value: changes[keys[0]], target: 'current-rule' }]
      : Object.entries(changes).map(([key, next]) => ({ key, value: next }))
    const result = onChange(items)
    if (result?.clearUnsupported || (result && !result.applied)) return result
    const next = { ...valueRef.current, ...changes }
    valueRef.current = next
    setSpacingValue(next)
    const previews = Object.fromEntries(Object.entries(changes).map(([key, next]) => [
      key, next == null ? context?.getStylePreview?.(key, true) || undefined : undefined,
    ]))
    setPreviewValues(previous => ({ ...previous, ...previews }))
    return result
  }, [onChange, property, keys, context?.getStylePreview])

  const handleChange = useCallback((changes: Record<string, any>) => {
    const normalized: Record<string, any> = {}
    let reset = false
    Object.entries(changes).forEach(([key, next]) => {
      const isReset = next == null || String(next).trim() === 'default'
      normalized[key] = normalizeBoxSpacingChange(key, next, context?.getStyleProperty?.(key), externalValue)
      reset ||= isReset
    })
    const result = commit(normalized)
    // 原来就是 0/未配置时外部值可能不变，重挂载以清掉 InputNumber 的“默认”草稿。
    if (reset && !result?.clearUnsupported) setForceRenderKey(key => key + 1)
    return result
  }, [commit, context?.getStyleProperty, externalValue])

  const refresh = useCallback(() => {
    const result = onChange(keys.map(key => ({ key, value: null })))
    if (result?.clearUnsupported) return result
    valueRef.current = {}
    setSpacingValue({})
    setPreviewValues(Object.fromEntries(keys.map(key => [key, context?.getStylePreview?.(key, true) || undefined])))
    setToggle(true)
    setForceRenderKey(key => key + 1)
    return result
  }, [onChange, keys, context?.getStylePreview])

  const handleUnifiedChange = useCallback((next: string | null) => {
    if (next == null || next === 'default') return refresh()
    return commit(Object.fromEntries(keys.map(key => [key, next])), true)
  }, [commit, keys, refresh])

  const handleSwitchToUnified = useCallback(() => {
    const next = getUnifiedSpacingValue(property, valueRef.current, key =>
      context?.getStylePreview?.(key, true) || context?.effectiveStyle?.[key]?.computedValue
    )
    if (next == null) return
    const result = handleUnifiedChange(next)
    if (result?.clearUnsupported || (result && !result.applied)) return
    setToggle(true)
  }, [property, context?.getStylePreview, context?.effectiveStyle, handleUnifiedChange])

  const canResetSide = (key: string) => {
    if (spacingValue[key] == null) return false
    const plan = context?.getStyleProperty?.(key)?.clearPlan
    // JSX 简写的单边重置为 set(0)，不要求每边有源码范围；独立声明沿用 clearPlan。
    return plan?.action !== 'unsupported' || !!groupClear.clear
  }
  const unifiedCanClear = !!groupClear.clear || (!groupClear.disabledReason && keys.some(key => spacingValue[key] != null))
  return {
    spacingValue, toggle, setToggle, previewValues, forceRenderKey,
    handleChange, handleUnifiedChange, handleSwitchToUnified, refresh,
    canResetSide, unifiedCanClear, canReset: unifiedCanClear,
  }
}
