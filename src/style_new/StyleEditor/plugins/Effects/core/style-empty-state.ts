import type { EffectsCore, StyleEmptyState, StyleEmptyStrategy } from './type'
import { collectReadonlyCandidates } from './readonly-candidates'
import { calculateSafeSpecificity } from '../../../../core/selector-utils'
import {
  cssPropertyName, getStyleResolution, readInlineStyleProperties,
  readStaticInlineStyleInfo, resolveEffectiveStyleSource,
} from '../../../../core/style-property'
import type { StyleSourceCandidate } from '../../../../core/style-property'
import { createStyleWriteTargetResolver } from '../../../../core/style-write-target'

// 先接入独立长写属性；简写需要保留其他分项，不在这里按一个值清空。
const strategies: Record<string, StyleEmptyStrategy> = {
  textShadow: { initialValue: 'none', inherited: true },
}

function normalizeValue(value: any): string {
  return String(value ?? '').replace(/\s*!important\s*$/i, '').trim().toLowerCase()
}

/**
 * 只判断已解析的有效值。例如 none !important 也为空，但 unset 本身不能直接算空：
 * text-shadow: unset 仍可能继承父级阴影，需先由 getStyleEmptyState 解析父值。
 */
export const isStyleValueEmpty: EffectsCore['isStyleValueEmpty'] = (key, value) => {
  const normalized = normalizeValue(value)
  return !normalized || normalized === 'initial' || normalized === strategies[key].initialValue
}

/**
 * 先判断实际效果，再模拟删掉可写声明后的结果；整个过程不修改 DOM 或源码。
 * 文字阴影的三种清空结果：
 * - 只有 .title 自身声明，删除后没有阴影：删除声明，提交时使用 null。
 * - 同一元素命中 Antd 阴影，父级没有阴影：在可写 class 中写 unset。
 * - 父级有阴影：写 none，避免 unset 继续继承父级效果。
 * 未注册属性返回 undefined，继续使用其他效果原有的处理方式。
 */
export const getStyleEmptyState: EffectsCore['getStyleEmptyState'] = (
  key, tab, target, resolution = getStyleResolution(tab, target),
) => {
  const strategy = strategies[key]
  if (!strategy) return undefined
  const unchanged: StyleEmptyState['clearPlan'] = { groups: [], canClear: false }
  const blocked = (isEmpty: boolean, disabledReason: string): StyleEmptyState => ({
    isEmpty, clearPlan: { ...unchanged, disabledReason },
  })
  if (!target) return blocked(false, 'target-unavailable')
  // 此处读取的是元素及其父级，不能据此替 ::before/::after 规划清空。
  if (tab.pseudo?.includes('::')) return blocked(false, 'pseudo-element-clear-not-supported')

  // 1. 合并当前来源索引和只读外部规则。
  // 优先使用 resolution 中已 record 的值，让连续删除/新增不依赖源码重编译完成。
  const property = cssPropertyName(key)
  const localCandidates = resolution.get(key).candidates.filter(candidate =>
    !candidate.source || !tab.excludedRules?.includes(candidate.source.rule)
  ).map(candidate => ({
    ...candidate,
    // 新声明尚无 CSSOM rule 时，record 只保存源码 selector；仍需参与特指度比较。
    specificity: candidate.specificity || (!candidate.inline
      ? calculateSafeSpecificity(candidate.source?.selectorPart || candidate.label, target) : undefined),
  }))
  const candidates = [...localCandidates, ...collectReadonlyCandidates(key, tab, target)]

  // 2. 把缺失声明、inherit、unset 转成实际生效值，再判断是否为空。
  // 例如子元素没有声明，但父按钮有 text-shadow，此处仍应得到“有阴影、可尝试清空”。
  const parentValue = strategy.inherited && target.parentElement
    ? (target.ownerDocument.defaultView || window).getComputedStyle(target.parentElement).getPropertyValue(property)
    : strategy.initialValue
  const effectiveValue = (raw: any): string => {
    const normalized = normalizeValue(raw)
    if (!normalized || normalized === 'inherit' || (normalized === 'unset' && strategy.inherited)) {
      return parentValue || strategy.initialValue
    }
    if (normalized === 'initial' || normalized === 'unset') return strategy.initialValue
    return String(raw)
  }
  const winner = resolveEffectiveStyleSource(candidates)
  const isEmpty = isStyleValueEmpty(key, effectiveValue(winner?.value))
  if (isEmpty) return { isEmpty, clearPlan: unchanged }
  // revert/revert-layer 会回退到其他来源或层，当前候选集合不足以模拟该过程。
  if (/^revert(?:-layer)?$/i.test(normalizeValue(winner?.value))) {
    return blocked(false, 'cascade-revert-clear-not-supported')
  }

  // 3. 沿用原写入选址，只模拟删除本次真正能改到的声明。
  // Antd 规则和其他 selector 上的声明必须留在 remaining 中，作为删除后的后备来源。
  const writeTarget = createStyleWriteTargetResolver(tab, target, resolution)(key)
  const selector = writeTarget.selector
  if (!selector) return blocked(false, writeTarget.reason)
  const writable = localCandidates.filter(candidate =>
    candidate.currentState && !candidate.source?.isRuntimeStyle && candidate.label === selector
  )
  if (writable.some(candidate => candidate.property !== property)) {
    return blocked(false, 'shorthand-clear-not-supported')
  }
  const remaining = candidates.filter(candidate => !writable.includes(candidate))
  const fallback = resolveEffectiveStyleSource(remaining)
  if (/^revert(?:-layer)?$/i.test(normalizeValue(fallback?.value))) {
    return blocked(false, 'cascade-revert-clear-not-supported')
  }
  const deleting = writable.length > 0 && isStyleValueEmpty(key, effectiveValue(fallback?.value))

  // 4. 在生成计划前检查源码是否可写。
  // 动态 JSX style 不能原位修改；存在同名内联样式时，也不能假定写入 class 就能覆盖它。
  if (selector === 'inline' && !readStaticInlineStyleInfo(target, key, deleting)) {
    return blocked(false, deleting ? 'inline-delete-range-unavailable' : 'dynamic-or-untracked-inline-style')
  }
  if (selector !== 'inline' && !tab.pseudo && readInlineStyleProperties(target).has(property)) {
    return blocked(false, 'inline-style-changes-write-target')
  }
  // 自身有声明，且移除后没有阴影，才允许直接删除；否则需要下方的覆盖声明。
  if (deleting) return {
    isEmpty: false,
    clearPlan: { groups: [{ selector, style: {}, deletions: [key] }], canClear: true },
  }

  // 5. 选择覆盖值：父级无阴影时 unset 可清空；父级有阴影时必须写 none。
  // 这里判断父值，而不是外部规则的值，因为 unset 对 text-shadow 的含义就是继承。
  const nextValue = isStyleValueEmpty(key, parentValue) ? 'unset' : strategy.initialValue
  const previous = resolveEffectiveStyleSource(writable)
  const selectedRule = writeTarget.candidates.find(candidate => candidate.selector === selector)
  const proposed: StyleSourceCandidate = {
    property, value: nextValue, label: selector,
    important: previous?.important || false,
    specificity: previous?.specificity || selectedRule?.specificity || calculateSafeSpecificity(selector, target),
    sourceOrder: previous?.sourceOrder ?? selectedRule?.sourceOrder ?? Number.MAX_SAFE_INTEGER,
    inline: selector === 'inline', currentState: true,
  }
  // 6. 把计划中的声明作为候选，模拟它能否胜过 remaining，再决定是否加 !important。
  // 同一元素上的 .ant-btn-primary !important 需要参与竞争；父级的 !important 不会传给子元素。
  if (resolveEffectiveStyleSource([...remaining, proposed]) !== proposed) proposed.important = true
  if (resolveEffectiveStyleSource([...remaining, proposed]) !== proposed) {
    return blocked(false, 'write-target-cannot-override-fallback')
  }
  // JSX style 对象不能表达 !important；不能生成一个写入后实际无法生效的覆盖计划。
  if (proposed.inline && proposed.important) {
    return blocked(false, 'inline-important-cannot-be-written-by-jsx-style')
  }
  return {
    isEmpty: false,
    clearPlan: {
      groups: [{ selector, style: { [key]: `${nextValue}${proposed.important ? ' !important' : ''}` }, deletions: [] }],
      canClear: true,
    },
  }
}
