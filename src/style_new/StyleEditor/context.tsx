import React, { useCallback, useContext, createContext, useMemo, CSSProperties } from 'react'
import type { EditorProps } from '../type'
import type { EffectiveStyleValue, ZoneTab } from '../core/zone-tab'
import type { StyleProperty } from '../core/style-property'
import { buildStyleMutationChange } from './helper/style-mutations'
import type { ApplyStyleMutations, ChangeEvent, StyleMutation } from './type'

interface StyleEditorContextValue {
  editConfig: {
    options?: EditorProps['editConfig']['options'] | { comId?: string; zoneTab?: ZoneTab }
    /** 文件上传 */
    upload?: (files: Array<File>) => Array<string>
    /** 外部字体列表（仅支持 label/value） */
    fontfaces?: Array<{
      label?: string;
      value?: string;
    }>
    /** 颜色可选项 */
    colorOptions?: Array<{
      /** 展示 */
      label: string; 
      /** 值 */
      value: string; 
      /** 值（必须为有效色值，优先级高于value） */
      resetValue?: string;
    }>
    /** Monaco Editor CDN 地址 */
    CDN?: string
  },
  /** 自动收起没有生效的 CSS 插件 */
  autoCollapseWhenUnusedProperty: boolean
  /** 当前选中的目标 DOM 元素，用于读取实际渲染尺寸等信息 */
  targetDom?: HTMLElement | null
  /** 当前编辑规则显式写入的样式，不包含继承/计算值 */
  authoredStyle?: Record<string, any>
  /** 当前 Tab 下逐属性解析出的实际生效值及来源 */
  effectiveStyle?: Record<string, EffectiveStyleValue>
  /** 批量执行 set/clear；写入 selector 与 clear 的 null/unset 由公共层解析 */
  applyStyleMutations?: ApplyStyleMutations
  getStyleProperty?: (key: string) => StyleProperty
  getStylePreview?: (key: string) => string
}

const StyleEditorContext = createContext<StyleEditorContextValue | undefined>(undefined)

interface StyleEditorProviderProps {
  value: StyleEditorContextValue
  children: React.ReactNode
}

export function StyleEditorProvider ({children, value}: StyleEditorProviderProps) {
  return (
    <StyleEditorContext.Provider value={value}>
      {children}
    </StyleEditorContext.Provider>
  )
}

export function useStyleEditorContext () {
  const context = useContext(StyleEditorContext)

  return context
}

export function useEffectiveStyleValue(): CSSProperties {
  const effectiveStyle = useStyleEditorContext()?.effectiveStyle

  return useMemo(() => {
    const nextValue: Record<string, any> = {}
    Object.entries(effectiveStyle || {}).forEach(([key, item]) => {
      nextValue[key] = typeof item.value === 'string' && /^unset$/i.test(item.value.trim())
        ? item.computedValue
        : item.value
    })
    return nextValue as CSSProperties
  }, [effectiveStyle])
}

/** 所有属性编辑器共用的修改入口；fallback 仅用于脱离 StyleMount 的独立渲染。 */
export function useApplyStyleMutations(fallbackOnChange?: ChangeEvent): ApplyStyleMutations {
  const context = useStyleEditorContext()
  return useCallback(
    (mutations: StyleMutation[]) => {
      if (context?.applyStyleMutations) {
        return context.applyStyleMutations(mutations)
      }
      return fallbackOnChange?.(
        buildStyleMutationChange(mutations)
      )
    },
    [context?.applyStyleMutations, fallbackOnChange]
  )
}

/** 没有 Zone 上下文时 available=false，独立编辑器继续使用原有行为。 */
export function useStyleField(key: string) {
  const context = useStyleEditorContext()
  const property = context?.getStyleProperty?.(key)
  const winner = property?.winner
  const plan = property?.clearPlan
  const set = useCallback((value: string | number) =>
    context?.applyStyleMutations?.([{ type: 'set', key, value }]),
    [context?.applyStyleMutations, key])
  const clear = useCallback(() =>
    context?.applyStyleMutations?.([{ type: 'clear', key }]),
    [context?.applyStyleMutations, key])
  const neutralized = !!winner && /^unset$/i.test(winner.value.trim())
  return {
    available: !!context?.getStyleProperty,
    source: winner?.label || null,
    value: winner?.currentState && !neutralized ? winner.value : undefined,
    previewValue: context?.getStylePreview?.(key),
    set,
    clear: plan?.action === 'delete' || plan?.action === 'write-unset' ? clear : undefined,
    disabledReason: plan?.action === 'unsupported' ? plan.reason : undefined,
  }
}

/** 仅提供清空执行能力；不向属性编辑器暴露任何样式回显值。 */
export function useStyleClear(key: string) {
  const context = useStyleEditorContext()
  const plan = context?.getStyleProperty?.(key)?.clearPlan
  const clear = useCallback(() =>
    context?.applyStyleMutations?.([{ type: 'clear', key }]),
    [context?.applyStyleMutations, key])
  return {
    clear: plan?.action === 'delete' || plan?.action === 'write-unset' ? clear : undefined,
    disabledReason: plan?.action === 'unsupported' ? plan.reason : undefined,
  }
}
