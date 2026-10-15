import { useCallback } from 'react'
import { cssPropertyName, readInlineStyleProperties } from '../../core/style-property'
import type { StyleSourceCandidate } from '../../core/style-property'
import { getShorthandFamily } from '../../core/style-shorthand-groups'
import { useStyleEditorContext } from '../context'
import type { ChangeEvent, StyleChangeResult } from '../type'

type StyleRemovalContext = ReturnType<typeof useStyleEditorContext>

export type StyleRemovalRequest = {
  keys: readonly string[]
  /** 可选：面板证明整个简写都属于本次操作后，允许改为清空原声明。 */
  shorthand?: {
    /** 实际声明名，例如 background 或 borderRadius。 */
    key: string
    /** 本次请求中用于读取生效来源的属性。 */
    sourceKey: string
    /** 证明删除整个声明不会丢失本次操作范围外的配置；公共来源检查仍会独立执行。 */
    canRemove: (input: {
      context: NonNullable<StyleRemovalContext>
      target: HTMLElement
      source: StyleSourceCandidate
    }) => boolean
  }
}

type StyleRemovalState = {
  canClear: boolean
  mode: 'shorthand' | 'declarations'
  disabledReason?: string
  clear?: () => StyleChangeResult | void
}

function canRemoveShorthand(context: StyleRemovalContext, request: StyleRemovalRequest): boolean {
  const policy = request.shorthand
  const target = context?.targetDom
  const getProperty = context?.getStyleProperty
  if (!policy || !target?.isConnected || !getProperty ||
    !context?.getStyleClearPlans || !context.applyStyleMutations) return false

  const shorthand = cssPropertyName(policy.key)
  const family = getShorthandFamily(shorthand)
  if (!request.keys.length || !request.keys.every(key => family.includes(cssPropertyName(key))) ||
    !request.keys.some(key => cssPropertyName(key) === cssPropertyName(policy.sourceKey))) return false
  const source = getProperty(policy.sourceKey).winner
  if (!source?.currentState || source.inline || !source.label || !source.source ||
    source.property !== shorthand) return false

  // 同一属性族不能包含其他声明或后备来源；selector 相同但 rule 不同也不能合并删除。
  const sameSource = (candidate: StyleSourceCandidate | null) => !!candidate &&
    candidate.currentState && !candidate.inline && candidate.property === shorthand &&
    candidate.label === source.label && candidate.source === source.source
  if (family.some(key => !getProperty(key).candidates.every(sameSource))) return false
  const inlineKeys = readInlineStyleProperties(target)
  if (family.some(key => inlineKeys.has(key))) return false
  if (!policy.canRemove({ context, target, source })) return false

  // 面板的证明只是必要条件，最终仍以公共执行器的同来源纯 delete 计划为准。
  const plans = context.getStyleClearPlans([policy.key])
  return plans.some(plan => cssPropertyName(plan.key) === shorthand) && plans.every(plan =>
    plan.action === 'delete' && plan.selector === source.label && plan.value === null &&
    family.includes(cssPropertyName(plan.key)) && sameSource(plan.winner))
}

/** 回显时确定能力和删除回调；同一份结果控制按钮及点击行为。 */
export function resolveStyleRemoval(
  context: StyleRemovalContext,
  request: StyleRemovalRequest,
  fallbackOnChange?: ChangeEvent,
): StyleRemovalState {
  if (canRemoveShorthand(context, request)) return {
    canClear: true,
    mode: 'shorthand',
    clear: () => context!.applyStyleMutations!([{ type: 'clear', key: request.shorthand!.key }]),
  }
  const state = context?.getStyleRemovalState?.(request.keys)
  const canClear = state ? state.canClear : !!fallbackOnChange
  return {
    mode: 'declarations',
    canClear,
    disabledReason: state?.disabledReason,
    clear: canClear ? () => {
      if (context?.removeStyleProperties) return context.removeStyleProperties(request.keys)
      // 没有 Zone 的独立面板沿用原 onChange 删除协议。
      return fallbackOnChange?.(request.keys.map(key => ({ key, value: null })))
    } : undefined,
  }
}

/** 新编辑器显式接入；已有 useStyleClear 的调用方不受影响。 */
export function useStyleRemoval(request: StyleRemovalRequest, fallbackOnChange?: ChangeEvent) {
  const context = useStyleEditorContext()
  // 按交互期间状态稳定处理；点击直接执行回显时生成的回调。
  // getState 仅供写入完成后刷新剩余图层的能力。
  const getState = useCallback(() => resolveStyleRemoval(context, request, fallbackOnChange),
    [context, request, fallbackOnChange])
  return { ...getState(), getState }
}
