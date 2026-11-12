import { BORDER_KEYS, BORDER_DETAIL_KEYS, expandBorderShorthand, normalizeStyleShorthands } from './shorthand-normalizer'
import { cssPropertyName, hasFallbackStyleCandidate, isSourceInline, readInlineStyleProperties, readStaticInlineStyleInfo, resolveEffectiveStyleSource } from './style-property'
import type { StyleResolution } from './style-property'
import type { StyleChangeItem } from './apply-style-change'
import { createDirectionalWritePlans } from './four-side-write'
import { stylePropertyKey } from './style-shorthand-groups'
import { splitAncestorState, splitZoneSelectorState } from './zone-tab'

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
  return createDirectionalWritePlans('borderRadius', changes, resolution, target, resolveSelector)
}

/** 同一来源内压缩 border；统一宽度回填可携带已有显式线型/颜色，不补 computed 值。 */
export function createBorderWritePlans(
  changes: StyleChangeItem[],
  resolution: Pick<StyleResolution, 'get'>,
  target: HTMLElement | null,
  resolveSelector: (change: StyleChangeItem) => string | null
) {
  const groups = new Map<string, StyleChangeItem[]>()
  const inlineProperties = readInlineStyleProperties(target)
  const inlineSideClears = new Set<string>()
  ;['Top', 'Right', 'Bottom', 'Left'].forEach(side => {
    const keys = ['Width', 'Style', 'Color'].map(part => `border${side}${part}`)
    // 同一条边的宽度、线型、颜色都要清除，且至少一项在当前状态来自 JSX style 时，三项一起按 inline 处理。
    // 预览不算 JSX style，继续使用记录的选择器，避免被缺少源码位置的检查拦住。
    if (keys.every(key => changes.some(change => change.key === key && change.value == null)) &&
      keys.some(key => {
        const winner = resolution.get(key).winner
        return winner?.currentState && isSourceInline(winner)
      })) keys.forEach(key => inlineSideClears.add(key))
  })
  changes.filter(change => isBorderProperty(change.key)).forEach(change => {
    // 整组删除也按每个字段的生效来源分组，保留其他规则中的声明。
    const clears = change.value == null && expandBorderShorthand(change.key, 'initial')
    const items = clears ? Object.keys(clears).map(key => ({ ...change, key })) : [change]
    items.forEach(item => {
      const winner = resolution.get(item.key).winner
      if (item.value == null && !winner?.currentState && !inlineSideClears.has(item.key)) return
      let selector = item.value == null ? winner?.label || '' : resolveSelector(item) || ''
      if (item.value == null && inlineSideClears.has(item.key)) selector = 'inline'
      const group = groups.get(selector) || []
      group.push(item)
      groups.set(selector, group)
    })
  })

  return Array.from(groups, ([selector, groupChanges]) => {
    const clearedKeys = groupChanges.filter(change => change.value == null).map(change => change.key)
    const resetKeys = new Set(clearedKeys.filter(key => {
      if (hasFallbackStyleCandidate(resolution.get(key))) return true
      // 不透明的 class 简写也会接管被删除的 inline 字段。
      return selector === 'inline' && BORDER_KEYS.some(name =>
        expandBorderShorthand(name, 'initial')?.[key] &&
        resolution.get(name).candidates.some(candidate => !candidate.inline)
      )
    }))
    ;['Top', 'Right', 'Bottom', 'Left'].forEach(side => {
      const keys = ['Width', 'Style', 'Color'].map(part => `border${side}${part}`)
      // 宽度清空表示删除整条边。任一字段存在后备样式时，整边 unset 才能消除占位。
      if (keys.every(key => clearedKeys.includes(key)) && keys.some(key => resetKeys.has(key))) {
        keys.forEach(key => resetKeys.add(key))
      }
    })
    if (selector === 'inline' && !resetKeys.size && clearedKeys.length === groupChanges.length && groupChanges.every(change =>
      (!resolution.get(change.key).winner || resolution.get(change.key).winner?.property === cssPropertyName(change.key)) &&
      !BORDER_KEYS.some(key => key !== change.key && inlineProperties.has(cssPropertyName(key)) &&
        expandBorderShorthand(key, 'initial')?.[change.key])
    )) {
      const deletions = clearedKeys.filter(key => inlineProperties.has(cssPropertyName(key)))
      return {
        property: 'border' as const, selector, style: {}, deletions, clearedKeys,
        unsupported: deletions.some(key => !readStaticInlineStyleInfo(target, key, true)),
      }
    }
    const style: Record<string, any> = {}
    const sourceKeys = new Set<string>()
    BORDER_KEYS.forEach(key => {
      // CSSOM 合成的简写不能当作 JSX 中真实存在的声明。
      if (selector === 'inline' && !BORDER_DETAIL_KEYS.includes(key) && !inlineProperties.has(cssPropertyName(key))) return
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
      let value = resetKeys.has(change.key) ? 'unset' : change.value
      if (value != null && important && !/!important\s*$/i.test(String(value))) value = `${value} !important`
      style[change.key] = value
      return { ...change, value }
    })
    const normalized = normalizeStyleShorthands(style, nextChanges, new Set(clearedKeys), { changedGroupsOnly: true })
    let output = normalized.style
    let deletions = normalized.deletions.filter(key => sourceKeys.has(key) && !(key in output))
    let unsupported = !selector
    if (selector === 'inline') {
      // 拆分/合并整组静态声明时，由宿主在旧属性位置原位写入新声明并更新源码范围。
      const requiredDeletions = deletions.filter(key => inlineProperties.has(cssPropertyName(key)) && !(key in output))
      const newKeys = Object.keys(output).filter(key => !inlineProperties.has(cssPropertyName(key)))
      if (newKeys.length && !requiredDeletions.length) {
        const anchor = BORDER_KEYS.find(key => inlineProperties.has(cssPropertyName(key)))
        if (anchor) requiredDeletions.push(anchor)
      }
      const rewritingInline = requiredDeletions.length > 0
      unsupported ||= requiredDeletions.some(key => !readStaticInlineStyleInfo(target, key, true)) ||
        Object.keys(output).some(key => inlineProperties.has(cssPropertyName(key))
          ? !readStaticInlineStyleInfo(target, key, rewritingInline)
          : !rewritingInline) ||
        Object.values(output).some(value => /!important\s*$/i.test(String(value)))
      deletions = requiredDeletions
    } else if (!(splitAncestorState(selector) || splitZoneSelectorState(selector)).pseudo) {
      // 普通边框修改如果涉及 inline 已有的属性，先阻止修改，避免最后改到 inline。
      // 父级 Hover 时的边框要单独写 CSS；子级 inline 已有边框，不代表这次 Hover 修改不能执行。
      unsupported ||= [...Object.keys(output), ...deletions].some(key => inlineProperties.has(cssPropertyName(key)))
    }
    return { property: 'border' as const, selector, style: output, deletions, clearedKeys, unsupported }
  })
}

export { BORDER_DETAIL_KEYS }
