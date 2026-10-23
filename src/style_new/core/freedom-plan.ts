import type { CSSProperties } from 'react'
import { appendNthChild, buildSoloSelector } from './build-solo-selector'
import { buildZoneSelectorsFromCssom, collectSubjectClassSelectors, resolveCssomSourceSelector } from './build-zone-selectors-from-cssom'
import { createCascadeResolver } from './cascade-winner'
import { detectContainerCollapse } from './detect-container-collapse'
import { getEffectedCssPropertyAndOptions } from './get-effected-css'
import { getValues } from './get-values'
import { createAbsolutePatch } from './position'
import { getSharedFreedomSelector, shareFreedomRules, splitFreedomRulesForExit } from './share-freedom-rules'
import { collectSourceAntClassNames } from './style-write-target'
import { collectZoneTabs, getOrderedZoneSourceRules, selectorSubjectStart } from './zone-tab'
import type { ZoneSourceRule, ZoneTab } from './zone-tab'

export type FreedomPlanOptions = { selector: string; soloEdit?: boolean; comId: string }
export type StylePlanItem = {
  target: HTMLElement
  selector: string
  lessFile: string
  style: { [K in keyof CSSProperties]?: CSSProperties[K] | null } & {
    '--layout-mode'?: string | null
    '--freeform-width'?: string | null
    '--freeform-original-min-width'?: string | null
    '--freeform-original-min-height'?: string | null
    '--freeform-original-width'?: string | null
    '--freeform-original-height'?: string | null
    '--freeform-original-position'?: string | null
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
function resolveFreedomDeclarations(changes: StylePlanItem[], tabs: ZoneTab[]) {
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
    const matches = rules.filter(({ source }) => change.target.matches(source.selectorPart))
    for (const [key, value] of entries) {
      const important = matches.some(rule => key in rule.properties && (
        rule.properties[key] || rule.specificity > specificity
      ))
      if (important && !String(value).includes('!important')) style[key] = `${value} !important`
    }
    return { ...change, style }
  })
}

export function buildFreedomPlan(parent: HTMLElement, parentStyle: CSSProperties, options: FreedomPlanOptions, mode: 'freedom' | 'flex' = 'freedom') {
  let { selector, soloEdit } = options
  const { comId } = options
  const root = parent.getRootNode() as Document | ShadowRoot
  const componentRoot = root.getElementById(comId)!
  const scope = parent.closest('[data-desn-page]') || componentRoot
  if (mode === 'flex') {
    const sharedSelector = getSharedFreedomSelector(parent, scope, comId)
    if (sharedSelector) {
      // 共用父容器规则就一起退出，下面按共享范围清理所有子项的定位。
      selector = sharedSelector
      soloEdit = false
    }
  }
  const runtimeClasses = new Map<string, string>()
  for (let element: Element | null = parent; element; element = element.parentElement) {
    for (const name of Array.from(element.classList)) {
      runtimeClasses.set(resolveCssomSourceSelector(`.${name}`, element, comId), `.${CSS.escape(name)}`)
    }
  }
  // 1. 勾选只决定处理哪些实例；所有位置和尺寸均从各实例自身读取。
  const runtimeSelector = selector.replace(/\.[a-zA-Z_][a-zA-Z0-9_-]*/g, name => runtimeClasses.get(name) || name)
  const parents = soloEdit ? [parent] : Array.from(new Set([
    parent, ...Array.from(scope.querySelectorAll<HTMLElement>(runtimeSelector)),
  ]))
  //判断去掉nth后，父容器是否还能被唯一定位
  const parentBaseSelector = selector.replace(/:nth-child\(\d+\)/g, '')
  const uniqueParent = scope.querySelectorAll(runtimeSelector.replace(/:nth-child\(\d+\)/g, '')).length === 1
  const children = parents.flatMap(element => Array.from(element.children) as HTMLElement[])
  const widthAncestors = new Set<HTMLElement>()
  if (mode === 'freedom') {
    for (const currentParent of parents) {
      for (let element = currentParent.parentElement; element && element !== scope; element = element.parentElement) {
        if (element.hasAttribute('data-loc')) widthAncestors.add(element)
      }
    }
  }
  const tabs = collectZoneTabs([...parents, ...children, ...Array.from(widthAncestors)], ['*'], comId)
  const sources = mode === 'freedom'
    ? tabs[0].sourceRules.map(source => ({ source,
      classes: selectorClasses(source.selectorPart.slice(selectorSubjectStart(source.selectorPart))) }))
    : []
  const positionSources = tabs[0].sourceRules.filter(source => source.rule.style.getPropertyValue('--freeform-position'))
  const changes: StylePlanItem[] = mode === 'freedom' ? [] : [{
    target: parent, selector, lessFile: JSON.parse(parent.dataset.loc!).files.less,
    style: { ...parentStyle, '--layout-mode': null },
  }]
  const parentPlans: StylePlanItem[] = []
  const childPlans: StylePlanItem[] = []
  // 2. 每个实例独立测量；等位置、尺寸和优先级都确定后，再合并相同的父子元素规则。
  for (const currentParent of parents) {
    // 唯一父容器直接用基础 selector；重复父容器先判断能否使用短路径。
    let parentSelector = parentBaseSelector
    let needsSoloSelector = !uniqueParent
    if (mode === 'freedom' && !soloEdit && !uniqueParent) {
      // 从当前编辑范围加行号，后续合并同值规则时即可回到原 selector，不额外绑定祖先位置。
      const rowIndex = Array.from(currentParent.parentElement!.children).indexOf(currentParent) + 1
      const shortSelector = appendNthChild(selector, rowIndex)
      const shortRuntimeSelector = appendNthChild(runtimeSelector, rowIndex)
      // 不同区块若有同序号行，仍需原路径区分，避免位置和尺寸互相覆盖。
      if (scope.querySelectorAll(shortRuntimeSelector).length === 1) {
        parentSelector = shortSelector
        needsSoloSelector = false
      }
    }
    if (needsSoloSelector) {
      parentSelector = buildSoloSelector(currentParent, parentBaseSelector, componentRoot, { keepTopLevelFirstChild: true })
    }
    const lessFile = JSON.parse(currentParent.dataset.loc!).files.less
    const parentComputed = window.getComputedStyle(currentParent)
    const position = parentComputed.position as CSSProperties['position']
    // 父容器只测量一次；用未取整的 CSS 边框盒尺寸还原画布缩放，供所有子元素定位复用。
    const parentRect = currentParent.getBoundingClientRect()
    const contentBox = parentComputed.boxSizing === 'content-box'
    const parentWidth = parseFloat(parentComputed.width) + (contentBox
      ? parseFloat(parentComputed.paddingLeft) + parseFloat(parentComputed.paddingRight) + parseFloat(parentComputed.borderLeftWidth) + parseFloat(parentComputed.borderRightWidth) : 0)
    const parentHeight = parseFloat(parentComputed.height) + (contentBox
      ? parseFloat(parentComputed.paddingTop) + parseFloat(parentComputed.paddingBottom) + parseFloat(parentComputed.borderTopWidth) + parseFloat(parentComputed.borderBottomWidth) : 0)
    const scaleX = parentRect.width / parentWidth
    const scaleY = parentRect.height / parentHeight
    // 标记与容器样式一起参与合并，退出时按它实际落在的规则确定范围。
    parentPlans.push({ target: currentParent, selector: parentSelector, lessFile,
      style: mode === 'freedom'
        ? { '--layout-mode': 'freedom', position: position === 'static' ? 'relative' : position }
        : { '--layout-mode': null } })
    const currentChildren = Array.from(currentParent.children) as HTMLElement[]
    // 一次统计直接子元素的所有 class；同一 class 在兄弟节点中重复时才需要序号。
    const childClassSelectors = currentChildren.map(child => collectSubjectClassSelectors(child))
    const childClassCounts = new Map<string, number>()
    for (const selectors of childClassSelectors) {
      for (const selector of selectors) childClassCounts.set(selector, (childClassCounts.get(selector) || 0) + 1)
    }
    for (let index = 0; index < currentChildren.length; index++) {
      const child = currentChildren[index]
      // 布局规则归父容器文件所有；跨文件子组件用直接子节点序号，避免丢失父实例作用域。
      const childSelector = JSON.parse(child.dataset.loc!).files.less === lessFile
        ? childClassSelectors[index][0] ?? '' : ''
      let targetSelector = `${parentSelector} > ${childClassCounts.get(childSelector) === 1
        ? childSelector : appendNthChild(childSelector, index + 1)}`
      let style: StylePlanItem['style']
      if (mode === 'freedom') {
        const computed = window.getComputedStyle(child)
        if (computed.position === 'absolute') continue
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
        style = createAbsolutePatch(child, currentStyle, currentParent)
        // 位置用小数矩形换算，扣除父边框和保留的 margin；最后统一取两位，避免 offsetTop/Left 丢失精度。
        const childRect = child.getBoundingClientRect()
        const left = (childRect.left - parentRect.left) / scaleX + currentParent.scrollLeft - parseFloat(parentComputed.borderLeftWidth) - parseFloat(computed.marginLeft)
        const top = (childRect.top - parentRect.top) / scaleY + currentParent.scrollTop - parseFloat(parentComputed.borderTopWidth) - parseFloat(computed.marginTop)
        style.left = `${left.toFixed(2)}px`
        style.top = `${top.toFixed(2)}px`
        style['--freeform-position'] = 'absolute'
      } else {
        // 子项可能同时命中公共定位和精确差异；退出时两者都要清理。
        for (const source of positionSources.filter(source => child.matches(source.selectorPart))) {
          style = { position: null, left: null, top: null, '--freeform-position': null }
          if (source.rule.style.getPropertyValue('--freeform-width')) {
            style.width = null
            style['--freeform-width'] = null
          }
          childPlans.push({ target: child, selector: source.sourceSelector, lessFile, style })
        }
        continue
      }
      childPlans.push({ target: child, selector: targetSelector, lessFile, style })
    }
  }
  changes.push(...parentPlans, ...childPlans)

  const sizeFields = [
    { styleKey: 'minWidth', originalMarker: '--freeform-original-min-width' },
    { styleKey: 'minHeight', originalMarker: '--freeform-original-min-height' },
    { styleKey: 'width', originalMarker: '--freeform-original-width' },
    { styleKey: 'height', originalMarker: '--freeform-original-height' },
  ] as const
  const restoreFields = [...sizeFields,
    { styleKey: 'position', originalMarker: '--freeform-original-position' },
  ] as const
  if (mode === 'freedom') {
    // 3. 一次模拟整批脱流；父容器、共享祖先和子元素的补值均按 DOM 实例返回。
    const result = detectContainerCollapse(parentPlans, Array.from(widthAncestors), childPlans)
    // 宿主按 ES5 转译，Map 使用 forEach，避免 for...of 被转换成数组下标循环后跳过。
    result.parentPatches.forEach((style, target) => {
      const parentPlan = parentPlans.find(change => change.target === target)
      if (parentPlan) Object.assign(parentPlan.style, style)
      else {
        const baseSelector = collectFreedomClassSelectors(target)[0]
        changes.push({ target, selector: buildSoloSelector(target, baseSelector, componentRoot, { keepTopLevelFirstChild: true }),
          lessFile: JSON.parse(target.dataset.loc!).files.less, style })
      }
    })

    // 4. 父容器先记录本次写入属性的原声明；没有原声明记为 null，退出时删除补值。
    const stylesBySelector = new Map(tabs[0].sourceRules.map(source => [source.sourceSelector, source.rule.style]))
    for (const change of parentPlans) {
      const original = stylesBySelector.get(change.selector)
      for (const { styleKey, originalMarker } of restoreFields) {
        if (change.style[styleKey] === undefined) continue
        const property = styleKey.replace(/[A-Z]/g, char => `-${char.toLowerCase()}`)
        const previous = original?.getPropertyValue(property)
          ? original.getPropertyValue(property) + (original.getPropertyPriority(property) ? ' !important' : '') : null
        change.style[originalMarker] = JSON.stringify(previous)
      }
    }
    // 子元素沿用自己的实测补值和原值记录；父子退出时共用下面的恢复循环。
    for (const change of childPlans) {
      // 即使子元素无需补尺寸，margin 也可能变化；先合并位置修正，再处理下面可能提前跳过的尺寸补偿。
      Object.assign(change.style, result.childPositionPatches.get(change.target))
      delete change.style.width
      delete change.style.height
      const sizePatch = result.childSizePatches.get(change.target)
      if (!sizePatch) continue
      const original = stylesBySelector.get(change.selector)
      for (const { styleKey, originalMarker } of sizeFields) {
        if (!sizePatch[styleKey]) continue
        const property = styleKey.replace(/[A-Z]/g, char => `-${char.toLowerCase()}`)
        const previous = original?.getPropertyValue(property)
          ? original.getPropertyValue(property) + (original.getPropertyPriority(property) ? ' !important' : '') : null
        change.style[styleKey] = sizePatch[styleKey]
        change.style[originalMarker] = JSON.stringify(previous)
      }
    }

    // 5. 父子元素的新增尺寸约束统一向上保留一位小数，原值标记不取整。
    for (const { style } of changes) {
      for (const { styleKey } of sizeFields) {
        if (style[styleKey] !== undefined) style[styleKey] = `${Math.ceil(parseFloat(String(style[styleKey])) * 10) / 10}px`
      }
    }
  }

  let resolvedChanges = resolveFreedomDeclarations(changes, tabs)
  if (mode === 'flex') {
    // 退出恢复：父容器定位和父子尺寸共用原值标记；原来没有声明则通过 null 删除。
    for (const { styleKey, originalMarker } of restoreFields) {
      const originalValues = new Map(tabs[0].sourceRules
        .filter(source => source.rule.style.getPropertyValue(originalMarker))
        .map(source => [source.sourceSelector, source.rule.style.getPropertyValue(originalMarker)]))
      for (const change of resolvedChanges) {
        if (!originalValues.has(change.selector)) continue
        change.style[styleKey] = JSON.parse(originalValues.get(change.selector)!)
        change.style[originalMarker] = null
      }
    }
  }
  if (mode === 'freedom' && !soloEdit) {
    resolvedChanges = shareFreedomRules(resolvedChanges, tabs[0].sourceRules, scope, runtimeClasses)
  } else if (mode === 'flex') {
    resolvedChanges = splitFreedomRulesForExit(resolvedChanges, tabs[0].sourceRules, parentPlans, componentRoot)
  }
  return { scope: soloEdit ? 'single' : 'all', changes: resolvedChanges }
}
