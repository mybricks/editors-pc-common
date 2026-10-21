import type { CSSProperties } from 'react'
import { appendNthChild, buildSoloSelector } from './build-solo-selector'
import { buildZoneSelectorsFromCssom, collectSubjectClassSelectors, resolveCssomSourceSelector } from './build-zone-selectors-from-cssom'
import { createCascadeResolver } from './cascade-winner'
import { detectContainerCollapse } from './detect-container-collapse'
import { getEffectedCssPropertyAndOptions } from './get-effected-css'
import { getValues } from './get-values'
import { createAbsolutePatch } from './position'
import { collectSourceAntClassNames } from './style-write-target'
import { collectZoneTabs, getOrderedZoneSourceRules, selectorSubjectStart } from './zone-tab'
import type { ZoneSourceRule, ZoneTab } from './zone-tab'

export type FreedomPlanOptions = { selector: string; soloEdit?: boolean; comId: string }
type StylePlanItem = {
  target: HTMLElement
  selector: string
  style: { [K in keyof CSSProperties]?: CSSProperties[K] | null } & {
    '--layout-mode'?: string | null
    '--freeform-width'?: string | null
    '--freeform-position'?: string | null
  }
}

/** freeform 祖先宽度保护使用，普通类优先，补充源码声明的 Ant 类。 */
function collectFreedomClassSelectors(element: Element): string[] {
  return [
    ...collectSubjectClassSelectors(element),
    ...collectSourceAntClassNames(element).map(name => `.${name}`),
  ]
}

/** 仅供 freeform 使用；普通 class 只读取尺寸，状态选择器仍沿用原读取链路。 */
function readFreedomSize(child: HTMLElement, selectors: string[], tab: ZoneTab, comId: string): CSSProperties {
  if (!tab.sourceRules.length || selectors.some(selector => !/^\.[a-zA-Z_][a-zA-Z0-9_-]*$/.test(selector)) || child.matches(':focus, :focus-visible')) {
    return getEffectedCssPropertyAndOptions(child, selectors, comId, tab)[0] as CSSProperties
  }
  const computed = window.getComputedStyle(child)
  const rules = getOrderedZoneSourceRules(tab).map(source => source.rule)
    .filter(rule => rule.style.width || rule.style.height)
  const values = getValues(rules, computed, undefined, child) as CSSProperties
  const resolveCascade = createCascadeResolver(child)
  for (const key of ['width', 'height'] as const) {
    const inline = child.style.getPropertyValue(key)
    if (!inline) continue
    const overridden = child.style.getPropertyPriority(key) !== 'important' && resolveCascade(key)?.important
    values[key] = overridden ? computed.getPropertyValue(key) : inline
  }
  return { width: values.width, height: values.height }
}

// 与 collectZoneTabs 相同的 class 归属规则；用于把一次收集的来源分配给各个子元素。
const selectorClasses = (selector: string) =>
  (selector.match(/\.([a-zA-Z_][a-zA-Z0-9_-]*)/g) || []).map(token => token.slice(1))

/** 沿用组件库 simpleSpecificity 的比较口径，只供 freeform 计划使用。 */
function freedomSpecificity(selector: string): number {
  const s = selector.replace(/:where\([^)]*\)/g, '')
  const ids = (s.match(/#[\w-]+/g) ?? []).length * 100
  const classes = (s.match(/\.[\w-]+|\[[\w\s=^$*|~"']+\]/g) ?? []).length * 10
  const tags = (s.match(/(?:^|[\s>+~,])([a-z][a-z0-9-]*)(?=[.#:[\s>+~,{]|$)/g) ?? [])
    .map(tag => tag.trim())
    .filter(tag => !['not', 'is', 'has', 'where', 'matches', 'nth', 'child', 'type', 'last', 'first', 'only', 'root', 'any'].includes(tag))
  return ids + classes + tags.length
}

/** 复用整批来源生成最终声明；组件库收到后直接写入，不再推导优先级。 */
function resolveFreedomDeclarations(changes: StylePlanItem[], tabs: ZoneTab[], comId: string) {
  const properties = Array.from(new Set(changes.flatMap(({ style }) =>
    Object.entries(style).filter(([key, value]) => value !== null && !key.startsWith('--')).map(([key]) => key)
  )))
  const seen = new Map<CSSStyleRule, Set<string>>()
  const rules: { source: ZoneSourceRule; specificity: number; properties: Record<string, boolean> }[] = []
  for (const tab of tabs) {
    for (const source of tab.sourceRules) {
      if (!seen.has(source.rule)) seen.set(source.rule, new Set())
      const selectors = seen.get(source.rule)!
      if (selectors.has(source.selectorPart)) continue
      selectors.add(source.selectorPart)
      const declarations: Record<string, boolean> = {}
      for (const key of properties) {
        const property = key.replace(/[A-Z]/g, char => `-${char.toLowerCase()}`)
        if (source.rule.style.getPropertyValue(property)) {
          declarations[key] = source.rule.style.getPropertyPriority(property) === 'important'
        }
      }
      if (Object.keys(declarations).length) {
        rules.push({ source, specificity: freedomSpecificity(source.selectorPart), properties: declarations })
      }
    }
  }

  return changes.map(change => {
    const style: Record<string, any> = { ...change.style }
    const entries = Object.entries(style).filter(([key, value]) => value !== null && !key.startsWith('--'))
    if (!entries.length) return { ...change, style }
    const specificity = freedomSpecificity(change.selector)
    const selector = resolveCssomSourceSelector(change.selector, change.target, comId).replace(/\s+/g, ' ').trim()
    const matches = rules.filter(({ source }) => change.target.matches(source.selectorPart))
    for (const [key, value] of entries) {
      const important = matches.some(rule => key in rule.properties && (
        rule.specificity > specificity ||
        (rule.source.sourceSelector.replace(/\s+/g, ' ').trim() === selector && rule.properties[key])
      ))
      if (important && !String(value).includes('!important')) style[key] = `${value} !important`
    }
    return { ...change, style }
  })
}

export function buildFreedomPlan(parent: HTMLElement, parentStyle: CSSProperties, options: FreedomPlanOptions, mode: 'freedom' | 'flex' = 'freedom') {
  const { selector, soloEdit, comId } = options
  const changes: StylePlanItem[] = [{
    target: parent,
    selector,
    style: mode === 'freedom' ? {
      '--layout-mode': 'freedom',
      position: !parentStyle.position || parentStyle.position === 'static' ? 'relative' : parentStyle.position,
    } : { ...parentStyle, '--layout-mode': null },
  }]

  const children = Array.from(parent.children) as HTMLElement[]
  const root = parent.getRootNode() as Document | ShadowRoot
  const scope = parent.closest('[data-desn-page]') || root.getElementById(comId)!
  const parentLess = JSON.parse(parent.dataset.loc!).files.less
  const runtimeClasses = new Map<string, string>()
  for (let element: Element | null = parent; element; element = element.parentElement) {
    for (const name of Array.from(element.classList)) {
      runtimeClasses.set(resolveCssomSourceSelector(`.${name}`, element, comId), `.${CSS.escape(name)}`)
    }
  }
  const widthAncestors: HTMLElement[] = []
  if (mode === 'freedom') {
    for (let element = parent.parentElement; element && element !== scope; element = element.parentElement) {
      if (element.hasAttribute('data-loc')) widthAncestors.push(element)
    }
  }
  // 尺寸读取使用常规态；最终声明复用整批父子元素的全部来源。
  const tabs = collectZoneTabs([parent, ...children, ...widthAncestors], ['*'], comId)
  const sources = mode === 'freedom'
    ? tabs[0].sourceRules.map(source => ({ source,
      classes: selectorClasses(source.selectorPart.slice(selectorSubjectStart(source.selectorPart))) }))
    : []
  const generatedWidths = new Set((mode === 'flex' ? tabs[0].sourceRules : [])
    .filter(source => source.rule.style.getPropertyValue('--freeform-width'))
    .map(source => source.sourceSelector))
  const generatedPositions = new Set((mode === 'flex' ? tabs[0].sourceRules : [])
    .filter(source => source.rule.style.getPropertyValue('--freeform-position'))
    .map(source => source.target))
  for (let index = 0; index < children.length; index++) {
    const child = children[index]
    const childSelector = collectSubjectClassSelectors(child)[0] ?? ''
    const childNthSelector = appendNthChild(childSelector, index + 1)
    // 跨文件只写子组件自身的 nth-child 规则，复用已有拖动写回链路。
    const targetSelector = JSON.parse(child.dataset.loc!).files.less === parentLess
      ? `${selector} > ${childNthSelector}`
      : childNthSelector
    let style: StylePlanItem['style']
    if (mode === 'freedom') {
      // 原本就是绝对定位的子元素不参与转换，保留其位置和尺寸。
      if (window.getComputedStyle(child).position === 'absolute') continue
      const selectors = buildZoneSelectorsFromCssom(child, comId)
      const bases = selectors.map(selectorClasses)
      const sourceRules = sources.filter(({ source, classes }) =>
        bases.some(base => !base.length || base.some(name => classes.some(runtime =>
          runtime === name || runtime.endsWith(`-${name}`) || runtime.endsWith(`_${name}`)
        ))) && child.matches(source.selectorPart)
      ).map(({ source }) => ({ ...source, target: child,
        sourceSelector: resolveCssomSourceSelector(source.selectorPart, child, comId) }))
      const tab: ZoneTab = { selector: selectors[0], baseSelector: selectors[0], pseudo: null,
        affectedSelectors: selectors, sourceRules, baseRules: sourceRules, target: child }
      const currentStyle = readFreedomSize(child, selectors, tab, comId)
      style = createAbsolutePatch(child, currentStyle as CSSProperties, parent)
      style['--freeform-position'] = 'absolute'
      if ('width' in style) style['--freeform-width'] = String(style.width)
    } else {
      style = generatedPositions.has(child)
        ? { position: null, left: null, top: null, '--freeform-position': null }
        : {}
      if (generatedWidths.has(targetSelector)) {
        style.width = null
        style['--freeform-width'] = null
      }
      if (!Object.keys(style).length) continue
    }

    changes.push({
      target: child,
      selector: targetSelector,
      style,
    })
  }

  if (mode === 'freedom') {
    const parentPatch = changes[0].style
    const runtimeSelector = selector.replace(/\.[a-zA-Z_][a-zA-Z0-9_-]*/g, name => runtimeClasses.get(name) || name)
    const parents = soloEdit ? [parent] : Array.from(new Set([
      parent, ...Array.from(scope.querySelectorAll<HTMLElement>(runtimeSelector)),
    ]))
    const result = detectContainerCollapse(parent, parentPatch.position!, parents, widthAncestors)
    if (result.collapseWidth) {
      if (result.widthTarget === parent) parentPatch.minWidth = result.minWidth
      else {
        const widthSelector = collectFreedomClassSelectors(result.widthTarget)[0]
        changes.push({
          target: result.widthTarget,
          selector: soloEdit ? buildSoloSelector(result.widthTarget, widthSelector, root.getElementById(comId)) : widthSelector,
          style: { minWidth: result.minWidth },
        })
      }
    }
    if (result.collapseHeight) parentPatch.minHeight = result.before.height
  }

  const resolvedChanges = resolveFreedomDeclarations(changes, tabs, comId)
  return { scope: soloEdit ? 'single' : 'all', changes: resolvedChanges }
}
