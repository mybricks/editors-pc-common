import { expandFourShorthand, normalizeStyleShorthands } from './shorthand-normalizer'
import {
  cssPropertyName, readInlineStyleProperties, readStaticInlineStyleInfo, resolveEffectiveStyleSource,
} from './style-property'
import type { StyleResolution } from './style-property'
import type { StyleChangeItem } from './apply-style-change'
import { splitAncestorState, splitZoneSelectorState } from './zone-tab'
import type { EffectiveStyleValue } from './zone-tab'
import { createDirectionalWritePlans } from './four-side-write'

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

/** 非内联整组清空沿用通用计划；部分方向由间距写入计划原子地拆写简写。 */
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
 * 将 margin/padding 的编辑按属性组和目标 selector 生成写入计划：
 * style 是要写入的声明，deletions 是要删除的声明，unsupported 表示该计划不能安全执行。
 * 本函数只生成计划，实际源码写入由 applyStyleChange 执行。
 * 只在同一个写入来源内压缩间距。不能把 liveStyle 中其他 class 的四边值
 * 拼进当前简写，也不能把归一化产生的 longhand 删除路由到其他 class。
 * 例如 .test { padding-left: 8px !important; } 已覆盖 JSX 的 style={{ paddingLeft: '24px' }}，
 * 把左内边距改为 12px 时，应允许生成 .test 的更新计划；执行后规则变为
 * .test { padding-left: 12px !important; }，JSX 中的 24px 保持不变。
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
    if (!property) return
    const winner = resolution.get(change.key).winner
    // 清空只跟随当前状态的生效来源，不能走 computed 的新增声明路由。
    if (clearing && !winner?.currentState) return
    // 执行器传入统一的属性写入决策，computed 的单边也参与最高权重选择。
    let selector = currentSelector
    if (clearing) {
      selector = winner?.label || ''
    } else if (resolveSelector) {
      selector = resolveSelector(change) || ''
    } else if (change.target !== 'current-rule' && winner?.currentState && winner.label) {
      selector = winner.label
    }
    if (selector !== 'inline' && clearing && !sideClearKeys.has(change.key)) return
    const id = `${property}:${selector}`
    const group = groups.get(id) || { property, selector, changes: [] }
    group.changes.push(change)
    groups.set(id, group)
  })

  const supplementalPlans: SpacingWritePlan[] = []
  const primaryPlans = Array.from(groups.values(), ({ property, selector, changes: groupChanges }) => {
    if (selector === 'inline') {
      return createDirectionalWritePlans(property, groupChanges, resolution, target, () => selector)[0]
    }
    const keys = BOX_SPACING_KEYS[property]
    const family = [property, ...keys]
    const clearedKeys = groupChanges.filter(change => change.value == null).map(change => change.key)
    // 独立长写可直接删除，不重写无关方向。
    const deleteOnly = clearedKeys.length === groupChanges.length && groupChanges.every(change =>
      resolution.get(change.key).winner?.property === cssPropertyName(change.key)
    )
    if (deleteOnly) {
      const unsupported = !selector
      return { property, selector, style: {}, deletions: clearedKeys, clearedKeys, unsupported }
    }
    const style: Record<string, any> = {}
    family.forEach(key => {
      const candidate = resolveEffectiveStyleSource(resolution.get(key).candidates.filter(item =>
        item.currentState && item.label === selector
      ))
      if (candidate) style[key] = `${candidate.value}${candidate.important ? ' !important' : ''}`
    })
    // 子级 inline 已有 padding: 4px，仍允许在父级 Hover 时设置 padding: 8px，不能因此阻止修改。
    // 所以也要认出 .A:hover .B 中父级的 Hover，让后面按状态样式处理。
    const pseudo = (splitAncestorState(selector) || splitZoneSelectorState(selector)).pseudo
    const nextChanges = groupChanges.map(change => {
      if (change.value == null) {
        style[change.key] = null
        return change
      }
      const preserveImportant = /!important\s*$/i.test(String(style[change.key] || '')) ||
        (change.key === property && keys.some(key => resolution.get(key).winner?.important))
      // 伪类规则需要覆盖常规态的 inline 四边值。保留 inline 来源并给
      // 当前状态写入 !important，避免一次展开被拆成“先删 inline、再写状态”
      // 的两次源码更新，动态 JSX 或重编译时会丢掉后一个 0 值。
      const affectedKeys = change.key === property ? [property, ...keys] : [property, change.key]
      const overridesInline = !!pseudo && affectedKeys.some(key =>
        resolution.get(key).candidates.some(candidate => candidate.inline)
      )
      const value = (preserveImportant || overridesInline) && !/!important\s*$/i.test(String(change.value))
        ? `${change.value} !important` : change.value
      style[change.key] = value
      return { ...change, value }
    })
    const normalized = normalizeStyleShorthands(style, nextChanges, new Set(clearedKeys), { changedGroupsOnly: true })
    const output = normalized.style
    const deletions = normalized.deletions.filter(key => !(key in output))
    let unsupported = !selector
    const inlineProperties = readInlineStyleProperties(target)
    // 同时检查写入和删除涉及的 inline 属性，避免 class 计划误改或误删 JSX 声明。
    const inlineConflicts = [...Object.keys(output), ...deletions]
      .filter(key => inlineProperties.has(cssPropertyName(key)))
    const consolidatingSources = groupChanges.some(change => change.target === 'current-rule')
    if (inlineConflicts.length && consolidatingSources && !pseudo) {
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
      // 例如本次准备写 .test 的 paddingLeft，JSX 又有 style={{ paddingLeft: '24px' }}，
      // inlineConflicts 就会包含 paddingLeft。这里只检查普通状态；:hover 等仍走下方状态规则。
      if (inlineConflicts.length && !pseudo) {
        // 放行例子：.test { padding-left: 8px !important; } 已覆盖上述 inline 的 24px。
        // 输入 12px 后，计划把 class 改为 .test { padding-left: 12px !important; }，保留 inline 的 24px。
        // 反例：.test { padding-left: 8px; } 没有 !important，实际生效的是 inline 的 24px，
        // 这种 class 更新不能通过这里放行，应由原有 inline 写入路径处理。margin 的判断相同。
        unsupported ||= inlineConflicts.some(key => {
          const winner = resolution.get(key).winner
          // winner 必须是当前状态下实际生效的目标 class，且这次 output 中的新值仍带 !important。
          const canUpdateWinningClass = winner?.currentState &&
            !winner.inline &&
            winner.label === selector &&
            winner.important &&
            /!important\s*$/i.test(String(output[key]))
          // 例如 paddingLeft 只出现在 deletions 中、output.paddingLeft 为空时，返回 true 阻止计划，
          // 避免把删除同名 inline 声明当成更新 class 放行；获胜的是其他 class 时也继续拦截。
          return !canUpdateWinningClass
        })
      } else {
        unsupported ||= inlineConflicts.length > 0
      }
      // 状态规则通过上面的 !important 覆盖常规态 inline，不删除基础态声明。
      if (pseudo) unsupported = !selector
    }
    return { property, selector, style: output, deletions, clearedKeys, unsupported }
  })
  // 先移除 JSX 同名来源并同步 data-style-info，再写 current-rule；否则宿主会
  // 继续把同名 shorthand（如 inline margin）优先路由回 JSX，而不是目标 class。
  return [...supplementalPlans, ...primaryPlans]
}
