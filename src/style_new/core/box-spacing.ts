import { expandFourShorthand, normalizeStyleShorthands } from './shorthand-normalizer'
import {
  cssPropertyName, readInlineStyleProperties, readStaticInlineStyleInfo, resolveEffectiveStyleSource,
} from './style-property'
import type { StyleProperty, StyleResolution } from './style-property'
import type { StyleChangeItem } from './apply-style-change'
import type { EffectiveStyleValue } from './zone-tab'

export const BOX_SPACING_KEYS = {
  margin: ['marginTop', 'marginRight', 'marginBottom', 'marginLeft'],
  padding: ['paddingTop', 'paddingRight', 'paddingBottom', 'paddingLeft'],
} as const
export type BoxSpacingProperty = keyof typeof BOX_SPACING_KEYS

export function getBoxSpacingProperty(key: string): BoxSpacingProperty | undefined {
  return (Object.keys(BOX_SPACING_KEYS) as BoxSpacingProperty[]).find(property =>
    key === property || (BOX_SPACING_KEYS[property] as readonly string[]).includes(key)
  )
}

/** 独立单边走清空；只有简写贡献的单边才补零，保留其他方向并重新压缩。 */
export function normalizeBoxSpacingChange(
  key: string,
  next: any,
  source?: StyleProperty,
  standaloneValue?: Record<string, any>
): any {
  if (next != null && String(next).trim() !== 'default') return next
  const property = getBoxSpacingProperty(key)
  if (!property || key === property) return null
  if (source) {
    if (source.clearPlan.action === 'delete' || source.clearPlan.action === 'noop') return null
    return source.winner?.currentState && source.winner.property === property ? '0px' : null
  }
  // 无属性来源解析的独立面板，仅在确有简写时补零，不能将未配置值写成 0。
  return expandFourShorthand(standaloneValue?.[property]) ? '0px' : null
}

/** 未配置保持空值；0 是显式配置。独立面板也支持简写回显。 */
export function readBoxSpacingValue(
  property: BoxSpacingProperty,
  value: Record<string, any>,
  effectiveStyle?: Record<string, EffectiveStyleValue>
): Record<string, any> {
  const expanded = expandFourShorthand(value[property])
  const result: Record<string, any> = {}
  BOX_SPACING_KEYS[property].forEach((key, index) => {
    const item = effectiveStyle?.[key]
    if (effectiveStyle && (!item || item.type === 'computed' || /^unset$/i.test(String(item.value).trim()))) return
    const current = value[key] ?? expanded?.[index]
    if (current != null && current !== '') {
      result[key] = String(current).trim().toLowerCase() === '0auto' ? 'auto' : current
    }
  })
  return result
}

/** 统一时按实际像素比较；不能用 parseFloat 将 50% 当作 50px。 */
export function getUnifiedSpacingValue(
  property: BoxSpacingProperty,
  values: Record<string, any>,
  getComputedValue: (key: string) => string | undefined
): string | null {
  const pixels = BOX_SPACING_KEYS[property].map(key => {
    const raw = String(values[key] ?? '').replace(/\s*!important\s*$/i, '').trim()
    const px = /^[-+]?(?:\d+\.?\d*|\.\d+)(?:px)?$/i
    if (px.test(raw)) return Number.parseFloat(raw)
    const computed = getComputedValue(key)?.trim() || ''
    if (px.test(computed)) return Number.parseFloat(computed)
    // 完全未配置且没有 DOM 的独立编辑器按初始值处理。
    return !raw && !computed ? 0 : NaN
  })
  if (!pixels.every(Number.isFinite)) return null
  return `${Number(Math.max(...pixels).toFixed(4))}px`
}

export type SpacingWritePlan = {
  property: BoxSpacingProperty
  selector: string
  style: Record<string, any>
  deletions: string[]
  unsupported: boolean
}

/**
 * 只在同一个写入来源内压缩间距。不能把 liveStyle 中其他 class 的四边值
 * 拼进当前简写，也不能把归一化产生的 longhand 删除路由到其他 class。
 */
export function createSpacingWritePlans(
  changes: StyleChangeItem[],
  resolution: StyleResolution,
  currentSelector: string,
  target: HTMLElement | null
): SpacingWritePlan[] {
  const groups = new Map<string, { property: BoxSpacingProperty; selector: string; changes: StyleChangeItem[] }>()
  changes.forEach(change => {
    const property = getBoxSpacingProperty(change.key)
    if (!property || change.value == null) return
    const winner = resolution.get(change.key).winner
    const selector = change.target === 'current-rule'
      ? currentSelector
      : winner?.currentState && winner.label || currentSelector
    const id = `${property}:${selector}`
    const group = groups.get(id) || { property, selector, changes: [] }
    group.changes.push(change)
    groups.set(id, group)
  })

  return Array.from(groups.values(), ({ property, selector, changes: groupChanges }) => {
    const keys = BOX_SPACING_KEYS[property]
    const family = [property, ...keys]
    const style: Record<string, any> = {}
    family.forEach(key => {
      const candidate = resolveEffectiveStyleSource(resolution.get(key).candidates.filter(item =>
        item.currentState && item.label === selector
      ))
      if (candidate) style[key] = `${candidate.value}${candidate.important ? ' !important' : ''}`
    })
    const nextChanges = groupChanges.map(change => {
      const preserveImportant = /!important\s*$/i.test(String(style[change.key] || '')) ||
        (change.key === property && keys.some(key => resolution.get(key).winner?.important))
      const value = preserveImportant && !/!important\s*$/i.test(String(change.value))
        ? `${change.value} !important` : change.value
      style[change.key] = value
      return { ...change, value }
    })
    const normalized = normalizeStyleShorthands(style, nextChanges, new Set(), { changedGroupsOnly: true })
    let output = normalized.style
    let deletions = normalized.deletions.filter(key => !(key in output))
    let unsupported = !selector
    const inlineProperties = readInlineStyleProperties(target)
    if (selector === 'inline') {
      // JSX 四条长写不能凭空变成没有源码范围的简写；保留原可写结构。
      if (output[property] != null && !readStaticInlineStyleInfo(target, property)) {
        const expanded = expandFourShorthand(output[property])
        if (expanded) output = Object.fromEntries(keys.map((key, index) => [key, expanded[index]]))
      }
      deletions = deletions.filter(key => !(key in output) && readStaticInlineStyleInfo(target, key, true))
      unsupported = Object.keys(output).some(key => !readStaticInlineStyleInfo(target, key)) ||
        Object.values(output).some(value => /!important\s*$/i.test(String(value))) ||
        family.some(key => inlineProperties.has(cssPropertyName(key)) && !readStaticInlineStyleInfo(target, key, true))
    } else {
      // 宿主的常规写入优先路由同名 JSX 属性；不能把“当前 class”写入偷换成 inline。
      unsupported ||= [...Object.keys(output), ...deletions].some(key => inlineProperties.has(cssPropertyName(key)))
    }
    return { property, selector, style: output, deletions, unsupported }
  })
}
