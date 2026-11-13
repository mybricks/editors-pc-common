import type { StyleChangeItem, StyleRemovalPlan } from './apply-style-change'
import { cssPropertyName, resolveEffectiveStyleSource } from './style-property'
import type { StyleResolution } from './style-property'
import { getShorthandFamily } from './style-shorthand-groups'
import { parseTransitionLonghands, serializeTransitionRules, TRANSITION_KEYS } from '../StyleEditor/components/Transition/value'

/** 清空属性时同步清理当前态动效；背景图层继续由原有适配层管理。 */
export function createTransitionRemovalPlan(
  changes: StyleChangeItem[], resolution: StyleResolution, target: HTMLElement | null
): StyleRemovalPlan | null {
  const removed = new Set(changes.filter(item => item.value === null)
    .flatMap(item => getShorthandFamily(cssPropertyName(item.key)))
    .filter(property => !property.startsWith('background') && !property.startsWith('--')))
  // 简写/长写替换也会传 null；同批仍有新值的属性不算删除。
  changes.filter(item => item.value != null).forEach(item =>
    getShorthandFamily(cssPropertyName(item.key)).forEach(property => removed.delete(property)))
  if (!removed.size || changes.some(item => TRANSITION_KEYS.includes(item.key as typeof TRANSITION_KEYS[number]))) return null

  const selectors = new Set(TRANSITION_KEYS.flatMap(key => resolution.get(key).candidates
    .filter(candidate => candidate.currentState).map(candidate => candidate.label)))
  const groups: StyleRemovalPlan['groups'] = []
  selectors.forEach(selector => {
    const sources = TRANSITION_KEYS.map(key => resolveEffectiveStyleSource(
      resolution.get(key).candidates.filter(candidate => candidate.currentState && candidate.label === selector)))
    const declaration = target!.ownerDocument.createElement('div').style
    if (sources[0]) declaration.transition = sources[0].value
    else TRANSITION_KEYS.slice(1).forEach((key, index) => { declaration[key] = sources[index + 1]?.value || '' })
    const rules = parseTransitionLonghands({
      property: declaration.transitionProperty, duration: declaration.transitionDuration,
      timing: declaration.transitionTimingFunction, delay: declaration.transitionDelay,
    })
    const deleting = Object.keys(rules).filter(property => removed.has(property))
    if (!deleting.length) return
    deleting.forEach(property => { delete rules[property] })
    const style: Record<string, string> = {}
    if (Object.keys(rules).length) {
      style.transition = serializeTransitionRules(rules) + (sources.some(source => source?.important) ? ' !important' : '')
    }
    groups.push({ selector, style, deletions: TRANSITION_KEYS.filter(key => !(key in style)) })
  })
  return groups.length ? { groups, canClear: true } : null
}
