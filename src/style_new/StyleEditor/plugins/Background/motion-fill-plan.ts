import { findCssVarReferences } from '../../../core/css-var'
import { splitTopLevelSelectors } from '../../../core/selector-utils'
import { stylePropertyKey } from '../../../core/style-shorthand-groups'
import type { StyleResolution } from '../../../core/style-property'
import type { StyleRemovalPlan } from '../../../core/apply-style-change'
import { isMotionFillProperty, MOTION_FILL_PREFIX } from './transition-adapter'

type MotionWriteGroup = StyleRemovalPlan['groups'][number]
export type MotionStyleSheet = { file: string; rules: Record<string, any> }
export type MotionStylePlan = {
  type: 'animation-styles'
  changes: Array<{
    target: HTMLElement
    selector: string
    lessFile: string
    style: Record<string, string | null>
  }>
}

/** 只接管内部变量和受管背景表达式的修改；同元素的尺寸等编辑仍走旧链路。 */
export function hasMotionFillChanges(group: MotionWriteGroup, resolution: StyleResolution): boolean {
  const keys = [...Object.keys(group.style), ...group.deletions].map(stylePropertyKey)
  if (keys.some(isMotionFillProperty)) return true
  if (!keys.includes('backgroundImage') && !keys.includes('background')) return false
  if (String(group.style.backgroundImage || group.style.background || '').includes(MOTION_FILL_PREFIX)) return true
  return resolution.get('backgroundImage').candidates.some(candidate =>
    candidate.label === group.selector && candidate.value.includes(MOTION_FILL_PREFIX))
}

type SourceRule = {
  selector: string
  before: Record<string, string>
  style: Record<string, string>
}

/** 保留完整源码声明参与引用判断；逗号分支分别推演，实际拆分仍由旧写入器执行。 */
function collectSourceRules(tree: Record<string, any>, parents = ['']): SourceRule[] {
  const result: SourceRule[] = []
  Object.entries(tree).forEach(([key, value]) => {
    if (!value || typeof value !== 'object' || key.startsWith('@property ')) return
    if (key.startsWith('@')) {
      result.push(...collectSourceRules(value, parents))
      return
    }
    const selectors = parents.flatMap(parent => splitTopLevelSelectors(key).map(branch =>
      !parent ? branch : branch.includes('&') ? branch.replace(/&/g, parent) : `${parent} ${branch}`))
    const declarations = Object.fromEntries(Object.entries(value)
      .filter(([, declaration]) => typeof declaration === 'string')) as Record<string, string>
    selectors.forEach(selector => result.push({ selector, before: { ...declarations }, style: { ...declarations } }))
    result.push(...collectSourceRules(value, selectors))
  })
  return result
}

const motionNames = (value: string) => value.match(/--mybricks-motion-fill-[\w-]+/g) || []

/** 规划文件内的注册与回收；不写文件、不缓存图层身份，也不使用 computed 值。 */
export function createMotionFillStylePlan(
  source: MotionStyleSheet, groups: MotionWriteGroup[], target: HTMLElement
): MotionStylePlan {
  const rules = collectSourceRules(source.rules)
  const patches = new Map<string, Record<string, string | null>>()
  const affected = new Set<string>()
  const patch = (selector: string, style: Record<string, string | null>) => {
    // 清理其他状态时也沿用相同的地址限制，不能把条件规则误写到顶层。
    if (rules.filter(rule => rule.selector === selector).length > 1) {
      throw new Error(`动画计划无法唯一定位规则：${selector}`)
    }
    patches.set(selector, { ...patches.get(selector), ...style })
  }
  groups.forEach(group => {
    const matches = rules.filter(rule => rule.selector === group.selector)
    const rule = matches[0] || { selector: group.selector, before: {}, style: {} }
    if (!matches.length) rules.push(rule)
    const style = Object.fromEntries([
      ...group.deletions.map(key => [stylePropertyKey(key), null]),
      ...Object.entries(group.style).map(([key, value]) => [stylePropertyKey(key), value]),
    ]) as Record<string, string | null>
    Object.entries(style).forEach(([key, value]) => {
      if (isMotionFillProperty(key)) affected.add(key)
      // 只收集本次属性修改前后的引用，不清理同规则内未触及的变量。
      ;[rule.before[key], value].forEach(raw => {
        if (typeof raw === 'string') motionNames(raw).forEach(name => affected.add(name))
      })
    })
    Object.entries(style).forEach(([key, value]) => {
      if (value === null) delete rule.style[key]
      else rule.style[key] = value
    })
    patch(group.selector, style)
  })

  // 必须先叠加本次修改，再判断其他状态是否继续使用，避免关闭最后一态时残留注册。
  const active = new Set(rules.flatMap(rule => motionNames(
    `${rule.style.transition || ''}, ${rule.style.transitionProperty || ''}`)))
  affected.forEach(name => {
    const registration = `@property ${name}`
    if (active.has(name)) {
      if (!source.rules[registration]) patch(registration, {
        syntax: '"<color>"', inherits: 'false', initialValue: 'transparent',
      })
      return
    }
    rules.forEach(rule => {
      const rawColor = rule.style[name] ?? rule.before[name]
      if (rawColor === undefined) return
      const color = rawColor.replace(/\s*!important\s*$/i, '')
      const restored: Record<string, string | null> = { [name]: null }
      Object.entries(rule.style).forEach(([key, value]) => {
        const references = findCssVarReferences(value).filter(reference => reference.varName === name)
        if (!references.length) return
        let next = value
        references.slice().reverse().forEach(reference => {
          next = next.slice(0, reference.start) + color + next.slice(reference.end)
        })
        restored[key] = next
        rule.style[key] = next
      })
      delete rule.style[name]
      patch(rule.selector, restored)
    })
    if (source.rules[registration]) patch(registration, { syntax: null, inherits: null, initialValue: null })
  })
  return {
    type: 'animation-styles',
    changes: Array.from(patches, ([selector, style]) => ({ target, selector, lessFile: source.file, style })),
  }
}

/** 读取和写入均使用约定的 window 通道；缺少接线时直接暴露依赖错误，不静默降级。 */
export function applyMotionFillStylePlan(groups: MotionWriteGroup[], target: HTMLElement): MotionStylePlan {
  const source: MotionStyleSheet = (window as any).__mybricks_readStyleSheet({ target, selector: groups[0].selector })
  const plan = createMotionFillStylePlan(source, groups, target)
  ;(window as any).__mybricks_applyStylePlan(plan)
  return plan
}
