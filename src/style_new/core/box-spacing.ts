import { expandFourShorthand, normalizeStyleShorthands } from './shorthand-normalizer'
import {
  cssPropertyName, readInlineStyleProperties, readStaticInlineStyleInfo, resolveEffectiveStyleSource,
} from './style-property'
import type { StyleResolution } from './style-property'
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

/** 默认始终表示取消配置，显式输入的 0 仍是 set。 */
export function normalizeBoxSpacingChange(next: any): any {
  return next == null || String(next).trim() === 'default' ? null : next
}

/** 整组清空沿用原计划；部分方向的清空由间距写入计划原子地拆写简写。 */
export function getBoxSpacingSideClearKeys(changes: StyleChangeItem[]): Set<string> {
  const cleared = new Set(changes.filter(change => change.value == null).map(change => change.key))
  return new Set((Object.keys(BOX_SPACING_KEYS) as BoxSpacingProperty[]).flatMap(property => {
    const keys: readonly string[] = BOX_SPACING_KEYS[property]
    return cleared.has(property) || keys.every(key => cleared.has(key))
      ? [] : keys.filter(key => cleared.has(key))
  }))
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
  clearedKeys: string[]
  unsupported: boolean
}

/**
 * 只在同一个写入来源内压缩间距。不能把 liveStyle 中其他 class 的四边值
 * 拼进当前简写，也不能把归一化产生的 longhand 删除路由到其他 class。
 */
export function createSpacingWritePlans(
  changes: StyleChangeItem[],
  resolution: Pick<StyleResolution, 'get'>,
  currentSelector: string,
  target: HTMLElement | null,
  resolveSelector?: (change: StyleChangeItem) => string | null
): SpacingWritePlan[] {
  const sideClearKeys = getBoxSpacingSideClearKeys(changes)
  const groups = new Map<string, { property: BoxSpacingProperty; selector: string; changes: StyleChangeItem[] }>()
  changes.forEach(change => {
    const property = getBoxSpacingProperty(change.key)
    const clearing = change.value == null
    if (!property || (clearing && !sideClearKeys.has(change.key))) return
    const winner = resolution.get(change.key).winner
    // 清空只跟随当前状态的生效来源，不能走 computed 的新增声明路由。
    if (clearing && !winner?.currentState) return
    // 执行器传入统一的属性写入决策，computed 的单边也参与最高权重选择。
    const selector = clearing ? winner?.label || '' : resolveSelector
      ? resolveSelector(change) || ''
      : change.target === 'current-rule'
        ? currentSelector
        : winner?.currentState && winner.label || currentSelector
    const id = `${property}:${selector}`
    const group = groups.get(id) || { property, selector, changes: [] }
    group.changes.push(change)
    groups.set(id, group)
  })

  const supplementalPlans: SpacingWritePlan[] = []
  const primaryPlans = Array.from(groups.values(), ({ property, selector, changes: groupChanges }) => {
    const keys = BOX_SPACING_KEYS[property]
    const family = [property, ...keys]
    const clearedKeys = groupChanges.filter(change => change.value == null).map(change => change.key)
    // 独立长写可直接删除，不重写无关方向（尤其是带动态 JSX 的相邻方向）。
    const deleteOnly = clearedKeys.length === groupChanges.length && groupChanges.every(change =>
      resolution.get(change.key).winner?.property === cssPropertyName(change.key)
    )
    if (deleteOnly) {
      const unsupported = !selector || (selector === 'inline' && clearedKeys.some(key =>
        !readStaticInlineStyleInfo(target, key, true)
      ))
      return { property, selector, style: {}, deletions: clearedKeys, clearedKeys, unsupported }
    }
    const style: Record<string, any> = {}
    family.forEach(key => {
      const candidate = resolveEffectiveStyleSource(resolution.get(key).candidates.filter(item =>
        item.currentState && item.label === selector
      ))
      if (candidate) style[key] = `${candidate.value}${candidate.important ? ' !important' : ''}`
    })
    const nextChanges = groupChanges.map(change => {
      if (change.value == null) {
        style[change.key] = null
        return change
      }
      const preserveImportant = /!important\s*$/i.test(String(style[change.key] || '')) ||
        (change.key === property && keys.some(key => resolution.get(key).winner?.important))
      const value = preserveImportant && !/!important\s*$/i.test(String(change.value))
        ? `${change.value} !important` : change.value
      style[change.key] = value
      return { ...change, value }
    })
    const normalized = normalizeStyleShorthands(style, nextChanges, new Set(clearedKeys), { changedGroupsOnly: true })
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
      // 简写拆成缺一边的长写需要真实源码范围；不能以补零/unset 冒充清空。
      const requiredDeletions = deletions.filter(key => inlineProperties.has(cssPropertyName(key)))
      const cannotDelete = requiredDeletions.some(key => !readStaticInlineStyleInfo(target, key, true))
      deletions = deletions.filter(key => !(key in output) && readStaticInlineStyleInfo(target, key, true))
      unsupported = Object.keys(output).some(key => !readStaticInlineStyleInfo(target, key)) ||
        cannotDelete ||
        Object.values(output).some(value => /!important\s*$/i.test(String(value))) ||
        family.some(key => inlineProperties.has(cssPropertyName(key)) && !readStaticInlineStyleInfo(target, key, true))
    } else {
      // 宿主的常规写入优先路由同名 JSX 属性；不能把“当前 class”写入偷换成 inline。
      const inlineConflicts = [...Object.keys(output), ...deletions]
        .filter(key => inlineProperties.has(cssPropertyName(key)))
      const consolidatingSources = groupChanges.some(change => change.target === 'current-rule')
      if (inlineConflicts.length && consolidatingSources) {
        // “切换为统一配置”本身就是把分散来源归并到 current-rule。静态 JSX
        // 属性可作为同一动作的补充删除计划移除；动态/spread 仍整体阻止。
        const inlineDeletions = family.filter(key => inlineProperties.has(cssPropertyName(key)))
        const inlineUnsupported = inlineDeletions.some(key => !readStaticInlineStyleInfo(target, key, true))
        supplementalPlans.push({
          property,
          selector: 'inline',
          style: {},
          deletions: inlineDeletions,
          clearedKeys: [],
          unsupported: inlineUnsupported,
        })
        unsupported ||= inlineUnsupported
      } else {
        unsupported ||= inlineConflicts.length > 0
      }
    }
    return { property, selector, style: output, deletions, clearedKeys, unsupported }
  })
  // 先移除 JSX 同名来源并同步 data-style-info，再写 current-rule；否则宿主会
  // 继续把同名 shorthand（如 inline margin）优先路由回 JSX，而不是目标 class。
  return [...supplementalPlans, ...primaryPlans]
}
