import { useCallback } from 'react'
import { cssPropertyName, hasFallbackStyleCandidate, readInlineStyleProperties } from '../../core/style-property'
import type { StyleSourceCandidate } from '../../core/style-property'
import { getShorthandFamily } from '../../core/style-shorthand-groups'
import { useStyleClear, useStyleEditorContext } from '../context'
import type { ChangeEvent } from '../type'

type BackgroundRemovalContext = ReturnType<typeof useStyleEditorContext>

export type BackgroundRemovalRequest = {
  keys: readonly string[]
  /** 可选：面板证明整个简写都属于本次操作后，允许改为清空原声明。 */
  shorthand?: {
    /** 实际背景声明名，例如 background。 */
    key: string
    /** 本次请求中用于读取生效来源的属性。 */
    sourceKey: string
    /** 证明删除整个声明不会丢失本次操作范围外的配置；公共来源检查仍会独立执行。 */
    canRemove: (input: {
      context: NonNullable<BackgroundRemovalContext>
      target: HTMLElement
      source: StyleSourceCandidate
    }) => boolean
  }
}

type BackgroundRemovalState = {
  canClear: boolean
  mode: 'shorthand' | 'cascade' | 'declarations'
  keys: readonly string[]
  disabledReason?: string
}

function canRemoveShorthand(context: BackgroundRemovalContext, request: BackgroundRemovalRequest): boolean {
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

  // 允许同一规则中的配套长写一起清空；其他来源仍不能合并删除。
  const sameSource = (candidate: StyleSourceCandidate | null) => !!candidate &&
    candidate.currentState && !candidate.inline && family.includes(candidate.property) &&
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

/** 回显时确定清空范围；后备来源优先交给已有的级联清空计划。 */
export function resolveBackgroundRemoval(
  context: BackgroundRemovalContext,
  request: BackgroundRemovalRequest,
  fallbackOnChange?: ChangeEvent,
): BackgroundRemovalState {
  const sourceKey = request.shorthand?.sourceKey
  const property = sourceKey && context?.getStyleProperty?.(sourceKey)
  if (property && hasFallbackStyleCandidate(property) && context?.getStyleClearPlans) {
    // 其他 class 会接管颜色时，沿用 useStyleClear 的默认路径写 unset。
    // 不要求不透明简写的所有 longhand 都可读，因此整体重置也可以执行。
    const plans = context.getStyleClearPlans(request.keys)
    const unsupported = plans.find(plan => plan.action === 'unsupported')
    return {
      mode: 'cascade',
      keys: request.keys,
      canClear: !unsupported && plans.some(plan => plan.action === 'delete' || plan.action === 'write-unset'),
      disabledReason: unsupported?.action === 'unsupported' ? unsupported.reason : undefined,
    }
  }
  if (canRemoveShorthand(context, request)) return {
    canClear: true,
    mode: 'shorthand',
    keys: [request.shorthand!.key],
  }
  const state = context?.getStyleRemovalState?.(request.keys)
  const canClear = state ? state.canClear : !!fallbackOnChange
  return {
    mode: 'declarations',
    keys: request.keys,
    canClear,
    disabledReason: state?.disabledReason,
  }
}

/** 背景面板专用：提供删除能力回显与清空操作，执行复用 useStyleClear。 */
export function useBackgroundRemoval(request: BackgroundRemovalRequest, fallbackOnChange?: ChangeEvent) {
  const context = useStyleEditorContext()
  // 按交互期间状态稳定处理；点击直接执行回显时生成的回调。
  // getState 仅供写入完成后刷新剩余图层的能力。
  const getState = useCallback(() => resolveBackgroundRemoval(context, request, fallbackOnChange),
    [context, request, fallbackOnChange])
  const state = getState()
  const { clear } = useStyleClear(state.keys, {
    mode: state.mode === 'declarations' ? 'remove-declaration' : undefined,
    fallbackOnChange,
  })
  return { ...state, clear: state.canClear ? clear : undefined, getState }
}
