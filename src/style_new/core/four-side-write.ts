import { expandFourShorthand, normalizeStyleShorthands } from './shorthand-normalizer'
import { cssPropertyName, hasFallbackStyleCandidate, readInlineStyleProperties, readStaticInlineStyleInfo, resolveEffectiveStyleSource } from './style-property'
import type { StyleResolution } from './style-property'
import type { StyleChangeItem } from './apply-style-change'
import { STYLE_SHORTHANDS, stylePropertyKey } from './style-shorthand-groups'
import { splitZoneSelectorState } from './zone-tab'

/** 四方向属性在同一来源内拆写，保留未编辑方向及后备来源。 */
export function createFourSideWritePlans<Property extends 'borderRadius' | 'margin' | 'padding'>(
  property: Property,
  changes: StyleChangeItem[],
  resolution: Pick<StyleResolution, 'get'>,
  target: HTMLElement | null,
  resolveSelector: (change: StyleChangeItem) => string | null
) {
  const keys = STYLE_SHORTHANDS[cssPropertyName(property)].map(stylePropertyKey)
  const groups = new Map<string, StyleChangeItem[]>()
  changes.filter(change => change.key === property || keys.includes(change.key)).forEach(change => {
    const winner = resolution.get(change.key).winner
    if (change.value == null && !winner?.currentState) return
    const selector = change.value == null ? winner?.label || '' : resolveSelector(change) || ''
    const group = groups.get(selector) || []
    group.push(change)
    groups.set(selector, group)
  })

  return Array.from(groups, ([selector, groupChanges]) => {
    const clearedKeys = groupChanges.filter(change => change.value == null).map(change => change.key)
    const resetKeys = new Set(clearedKeys.filter(key => {
      const resolved = resolution.get(key)
      if (hasFallbackStyleCandidate(resolved)) return true
      // class 简写（如含 var()）可能没有 CSSOM 单方向值，
      // 但仍会在删除 inline 后接管该方向，清空时必须用 unset 屏蔽。
      return resolved.winner?.inline && resolution.get(property).candidates.some(candidate => !candidate.inline)
    }))
    if (selector === 'inline' && !resetKeys.size && clearedKeys.length === groupChanges.length && groupChanges.every(change =>
      resolution.get(change.key).winner?.property === cssPropertyName(change.key)
    )) {
      return {
        property, selector, style: {}, deletions: clearedKeys, clearedKeys,
        unsupported: clearedKeys.some(key => !readStaticInlineStyleInfo(target, key, true)),
      }
    }
    const style: Record<string, any> = {}
    const sourceKeys = new Set<string>()
    ;[property, ...keys].forEach(key => {
      const candidate = resolveEffectiveStyleSource(resolution.get(key).candidates.filter(item =>
        item.currentState && item.label === selector
      ))
      if (candidate) {
        style[key] = `${candidate.value}${candidate.important ? ' !important' : ''}`
        sourceKeys.add(key)
        sourceKeys.add(stylePropertyKey(candidate.property))
      }
    })

    const pseudo = splitZoneSelectorState(selector).pseudo
    const nextChanges = groupChanges.map(change => {
      let value = resetKeys.has(change.key) ? 'unset' : change.value
      // 状态声明保留在伪类规则中；用 important 覆盖默认态的内联值。
      const affectedKeys = change.key === property ? [property, ...keys] : [property, change.key]
      const overridesInline = !!pseudo && affectedKeys.some(key =>
        resolution.get(key).candidates.some(candidate => candidate.inline)
      )
      const important = overridesInline || /!important\s*$/i.test(String(style[change.key] || ''))
      if (value != null && important && !/!important\s*$/i.test(String(value))) {
        value = `${value} !important`
      }
      style[change.key] = value
      return { ...change, value }
    })
    const normalized = normalizeStyleShorthands(style, nextChanges, new Set(clearedKeys), { changedGroupsOnly: true })
    let output = normalized.style
    let deletions = normalized.deletions.filter(key => sourceKeys.has(key) && !(key in output))
    let unsupported = !selector
    const inlineProperties = readInlineStyleProperties(target)
    if (selector === 'inline') {
      // 整组清空后四个方向均需 unset 时，可把已有长写合成一条简写。
      const clearingGroup = output[property] === 'unset' &&
        keys.every(key => clearedKeys.includes(key))
      const unifyingInlineSides = (clearingGroup ||
        groupChanges.some(change => change.key === property && change.value != null)) &&
        !inlineProperties.has(cssPropertyName(property)) &&
        keys.some(key => inlineProperties.has(cssPropertyName(key)))
      // JSX 只有静态简写时，单独配置会先被展开成四条长写。
      // 长写没有独立源码范围，重新压回原简写才能安全更新这条 inline style。
      if (readStaticInlineStyleInfo(target, property) &&
        keys.every(key => Object.prototype.hasOwnProperty.call(output, key))) {
        const inlineNormalized = normalizeStyleShorthands(
          output,
          groupChanges.map(change => ({ ...change, borderMode: 'all' as const })),
          new Set(clearedKeys),
          { changedGroupsOnly: true }
        )
        output = inlineNormalized.style
        deletions = Array.from(new Set([...deletions, ...inlineNormalized.deletions]))
      }
      output = Object.fromEntries(Object.entries(output).flatMap(([key, value]) => {
        if (key !== property || readStaticInlineStyleInfo(target, key) || unifyingInlineSides) return [[key, value]]
        const expanded = expandFourShorthand(value)
        return expanded ? keys.map((name, index) => [name, expanded[index]]) : [[key, value]]
      }))
      const requiredDeletions = deletions.filter(key => inlineProperties.has(cssPropertyName(key)) && !(key in output))
      // 静态简写可由宿主在原属性位置替换为剩余方向；新长写无需已有源码范围。
      const splittingInlineShorthand = requiredDeletions.includes(property) &&
        readStaticInlineStyleInfo(target, property, true)
      unsupported ||= requiredDeletions.some(key => !readStaticInlineStyleInfo(target, key, true)) ||
        Object.keys(output).some(key => !readStaticInlineStyleInfo(target, key) &&
          !(unifyingInlineSides && key === property) &&
          !(splittingInlineShorthand && !inlineProperties.has(cssPropertyName(key)))) ||
        Object.values(output).some(value => /!important\s*$/i.test(String(value)))
      deletions = requiredDeletions
    } else if (!pseudo) {
      unsupported ||= [...Object.keys(output), ...deletions].some(key => inlineProperties.has(cssPropertyName(key)))
    }
    return { property, selector, style: output, deletions, clearedKeys, unsupported }
  })
}
