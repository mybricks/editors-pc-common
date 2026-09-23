import { BORDER_KEYS, BORDER_DETAIL_KEYS, expandBorderShorthand, expandFourShorthand, normalizeStyleShorthands } from './shorthand-normalizer'
import { cssPropertyName, readInlineStyleProperties, readStaticInlineStyleInfo, resolveEffectiveStyleSource } from './style-property'
import type { StyleResolution } from './style-property'
import type { StyleChangeItem } from './apply-style-change'
import { stylePropertyKey } from './style-shorthand-groups'

export const isBorderProperty = (key: string) => BORDER_KEYS.includes(key)

export const BORDER_RADIUS_KEYS = [
  'borderTopLeftRadius',
  'borderTopRightRadius',
  'borderBottomRightRadius',
  'borderBottomLeftRadius',
] as const

export const isBorderRadiusProperty = (key: string) => key === 'borderRadius' || BORDER_RADIUS_KEYS.includes(key as typeof BORDER_RADIUS_KEYS[number])

/** 圆角按来源写入，避免通用样式合并把其他 selector 的简写/长写一起删除。 */
export function createBorderRadiusWritePlans(
  changes: StyleChangeItem[],
  resolution: Pick<StyleResolution, 'get'>,
  target: HTMLElement | null,
  resolveSelector: (change: StyleChangeItem) => string | null
) {
  const groups = new Map<string, StyleChangeItem[]>()
  changes.filter(change => isBorderRadiusProperty(change.key)).forEach(change => {
    const winner = resolution.get(change.key).winner
    if (change.value == null && !winner?.currentState) return
    const selector = change.value == null ? winner?.label || '' : resolveSelector(change) || ''
    const group = groups.get(selector) || []
    group.push(change)
    groups.set(selector, group)
  })

  return Array.from(groups, ([selector, groupChanges]) => {
    const clearedKeys = groupChanges.filter(change => change.value == null).map(change => change.key)
    const style: Record<string, any> = {}
    const sourceKeys = new Set<string>()
    ;['borderRadius', ...BORDER_RADIUS_KEYS].forEach(key => {
      const candidate = resolveEffectiveStyleSource(resolution.get(key).candidates.filter(item =>
        item.currentState && item.label === selector
      ))
      if (candidate) {
        style[key] = `${candidate.value}${candidate.important ? ' !important' : ''}`
        sourceKeys.add(key)
        sourceKeys.add(stylePropertyKey(candidate.property))
      }
    })

    const nextChanges = groupChanges.map(change => {
      const important = /!important\s*$/i.test(String(style[change.key] || ''))
      const value = change.value != null && important && !/!important\s*$/i.test(String(change.value))
        ? `${change.value} !important` : change.value
      style[change.key] = value
      return { ...change, value }
    })
    const normalized = normalizeStyleShorthands(style, nextChanges, new Set(clearedKeys), { changedGroupsOnly: true })
    let output = normalized.style
    let deletions = normalized.deletions.filter(key => sourceKeys.has(key) && !(key in output))
    let unsupported = !selector
    const inlineProperties = readInlineStyleProperties(target)
    if (selector === 'inline') {
      output = Object.fromEntries(Object.entries(output).flatMap(([key, value]) => {
        if (readStaticInlineStyleInfo(target, key)) return [[key, value]]
        const expanded = expandFourShorthand(value)
        return Object.entries(expanded || { [key]: value })
      }))
      const requiredDeletions = deletions.filter(key => inlineProperties.has(cssPropertyName(key)) && !(key in output))
      unsupported ||= requiredDeletions.some(key => !readStaticInlineStyleInfo(target, key, true)) ||
        Object.keys(output).some(key => !readStaticInlineStyleInfo(target, key)) ||
        Object.values(output).some(value => /!important\s*$/i.test(String(value)))
      deletions = requiredDeletions
    } else {
      unsupported ||= [...Object.keys(output), ...deletions].some(key => inlineProperties.has(cssPropertyName(key)))
    }
    return { property: 'borderRadius' as const, selector, style: output, deletions, clearedKeys, unsupported }
  })
}

/** 同一来源内压缩 border；统一宽度回填可携带已有显式线型/颜色，不补 computed 值。 */
export function createBorderWritePlans(
  changes: StyleChangeItem[],
  resolution: Pick<StyleResolution, 'get'>,
  target: HTMLElement | null,
  resolveSelector: (change: StyleChangeItem) => string | null
) {
  const groups = new Map<string, StyleChangeItem[]>()
  changes.filter(change => isBorderProperty(change.key)).forEach(change => {
    // 整组删除也按每个字段的生效来源分组，保留其他规则中的声明。
    const clears = change.value == null && expandBorderShorthand(change.key, 'initial')
    const items = clears ? Object.keys(clears).map(key => ({ ...change, key })) : [change]
    items.forEach(item => {
      const winner = resolution.get(item.key).winner
      if (item.value == null && !winner?.currentState) return
      const selector = item.value == null ? winner?.label || '' : resolveSelector(item) || ''
      const group = groups.get(selector) || []
      group.push(item)
      groups.set(selector, group)
    })
  })

  return Array.from(groups, ([selector, groupChanges]) => {
    const clearedKeys = groupChanges.filter(change => change.value == null).map(change => change.key)
    if (selector === 'inline' && clearedKeys.length === groupChanges.length && groupChanges.every(change =>
      resolution.get(change.key).winner?.property === cssPropertyName(change.key)
    )) {
      return {
        property: 'border' as const, selector, style: {}, deletions: clearedKeys, clearedKeys,
        unsupported: clearedKeys.some(key => !readStaticInlineStyleInfo(target, key, true)),
      }
    }
    const style: Record<string, any> = {}
    const sourceKeys = new Set<string>()
    BORDER_KEYS.forEach(key => {
      const candidate = resolveEffectiveStyleSource(resolution.get(key).candidates.filter(item =>
        item.currentState && item.label === selector
      ))
      if (candidate) {
        style[key] = `${candidate.value}${candidate.important ? ' !important' : ''}`
        sourceKeys.add(key)
        sourceKeys.add(stylePropertyKey(candidate.property))
      }
    })
    // 统一回填写最高权重规则，并携带当前显式线型/颜色以恢复 border 简写。
    // 原来源声明不搬走、不删除；清空和单边修改仍严格按原来源处理。
    const widthKeys = BORDER_DETAIL_KEYS.filter(key => key.endsWith('Width'))
    const unifiedWidthSet = widthKeys.every(key => groupChanges.some(change =>
      change.key === key && change.value != null && change.borderMode === 'all' && change.target === 'current-rule'
    ))
    const carriedChanges: StyleChangeItem[] = []
    if (unifiedWidthSet) {
      BORDER_DETAIL_KEYS.filter(key => !key.endsWith('Width')).forEach(key => {
        if (groupChanges.some(change => change.key === key)) return
        const winner = resolution.get(key).winner
        if (!winner?.currentState || winner.inline || !winner.label) return
        carriedChanges.push({ key, value: `${winner.value}${winner.important ? ' !important' : ''}`, borderMode: 'all' })
      })
    }
    const nextChanges = [...carriedChanges, ...groupChanges].map(change => {
      const important = /!important\s*$/i.test(String(style[change.key] || ''))
      const value = change.value != null && important && !/!important\s*$/i.test(String(change.value))
        ? `${change.value} !important` : change.value
      style[change.key] = value
      return { ...change, value }
    })
    const normalized = normalizeStyleShorthands(style, nextChanges, new Set(clearedKeys), { changedGroupsOnly: true })
    let output = normalized.style
    let deletions = normalized.deletions.filter(key => sourceKeys.has(key) && !(key in output))
    let unsupported = !selector
    const inlineProperties = readInlineStyleProperties(target)
    if (selector === 'inline') {
      // JSX 保留可写的原始形态，不凭空制造没有源码范围的简写。
      output = Object.fromEntries(Object.entries(output).flatMap(([key, value]) => {
        if (readStaticInlineStyleInfo(target, key)) return [[key, value]]
        const expanded = expandBorderShorthand(key, value)
        return Object.entries(expanded || { [key]: value })
      }))
      const requiredDeletions = deletions.filter(key => inlineProperties.has(cssPropertyName(key)) && !(key in output))
      unsupported ||= requiredDeletions.some(key => !readStaticInlineStyleInfo(target, key, true)) ||
        Object.keys(output).some(key => !readStaticInlineStyleInfo(target, key)) ||
        Object.values(output).some(value => /!important\s*$/i.test(String(value)))
      deletions = requiredDeletions
    } else {
      // 宿主可能优先路由同名 JSX 属性，不能将 class 的合并写入偷换为 inline。
      unsupported ||= [...Object.keys(output), ...deletions].some(key => inlineProperties.has(cssPropertyName(key)))
    }
    return { property: 'border' as const, selector, style: output, deletions, clearedKeys, unsupported }
  })
}

export { BORDER_DETAIL_KEYS }
