import type { StyleClearPlan, StyleSourceCandidate } from '../style-property'
import type { MarginClearInput } from './type'

/** 统一生成 margin 整组清除计划；返回 null 时沿用公共层的逐属性清除。 */
export function createMarginClearPlans(input: MarginClearInput): StyleClearPlan[] | null {
  const sources = collectMarginClearSources(input)
  if (!sources) return createMarginFallbackClearPlans(input)

  // 全部来源都可删除时，按 selector 清理简写和四边，避免被覆盖的声明重新生效。
  const family = [
    { key: 'margin', candidates: input.shorthand.candidates },
    ...input.properties.map(property => ({ key: property.clearPlan.key, candidates: property.candidates })),
  ]
  const plans: StyleClearPlan[] = []
  for (const source of sources) {
    if (!source.label) return null
    family.forEach(({ key, candidates }) => plans.push({
      key, winner: source, candidates,
      action: 'delete', selector: source.label, value: null,
    }))
  }
  return plans
}

/** 整组清空盘点全部当前 class 声明，被覆盖的来源也需要删除。 */
function collectMarginClearSources({ properties }: MarginClearInput): StyleSourceCandidate[] | null {
  const sources: StyleSourceCandidate[] = []
  for (const property of properties) {
    for (const candidate of property.candidates) {
      // inline、运行时和其他状态不属于本次 class 整组删除范围。
      if (!candidate.currentState || candidate.inline || candidate.source?.isRuntimeStyle) return null
      const existing = sources.find(source => source.label === candidate.label)
      // 写回只按 selector 定位，同名但不同规则仍沿用原处理。
      if (existing && existing.source !== candidate.source) return null
      if (!existing) sources.push(candidate)
    }
  }
  return sources
}

/** 同一 class 的 margin 整组清空时，只给存在后备来源的方向保留 unset。 */
function createMarginFallbackClearPlans({ properties, shorthand }: MarginClearInput): StyleClearPlan[] | null {
  const winner = shorthand.winner
  if (!winner?.currentState || winner.inline || winner.source?.isRuntimeStyle || !winner.label) return null
  const sameSource = properties.every(property =>
    property.winner?.currentState && !property.winner.inline &&
    property.winner.label === winner.label && property.winner.source === winner.source
  )
  if (!sameSource || properties.every(property => property.hasFallback)) return null

  // 先删除简写，再写回仍需屏蔽的方向；四边都需要屏蔽时沿用原计划。
  const plans: StyleClearPlan[] = [{
    key: 'margin', winner, candidates: shorthand.candidates,
    action: 'delete', selector: winner.label, value: null,
  }]
  properties.forEach(property => {
    const needsUnset = property.hasFallback
    plans.push({
      key: property.clearPlan.key, winner: property.winner, candidates: property.candidates,
      action: needsUnset ? 'write-unset' : 'delete', selector: winner.label,
      value: needsUnset ? (property.winner!.important ? 'unset !important' : 'unset') : null,
    })
  })
  return plans
}
