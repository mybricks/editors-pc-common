import { compare } from 'specificity'
import { buildSoloSelector } from './build-solo-selector'
import { resolveCssomSourceSelector } from './build-zone-selectors-from-cssom'
import { classMatchesShortName } from './css-modules-match'
import { calculateSafeSpecificity } from './selector-utils'
import type { StylePlanItem } from './freedom-plan'
import type { ZoneSourceRule } from './zone-tab'

const cssProperty = (key: string) => key.replace(/[A-Z]/g, char => `-${char.toLowerCase()}`)
const readDeclaration = (style: CSSStyleDeclaration, key: string) => {
  const property = cssProperty(key)
  const value = style.getPropertyValue(property)
  return value ? value + (style.getPropertyPriority(property) ? ' !important' : '') : null
}

/** 测量仍按实例进行；这里只合并同一作用域、同序号且最终声明相同的子元素。 */
export function shareFreedomRules(changes: StylePlanItem[], sources: ZoneSourceRule[], scope: Element, runtimeClasses: Map<string, string>) {
  const groups = new Map<string, StylePlanItem[]>()
  for (const change of changes) {
    if (change.style['--freeform-position'] !== 'absolute') continue
    const match = change.selector.match(/^(.*):nth-child\(\d+\)( > .+)$/)
    if (!match) continue
    const key = JSON.stringify([change.lessFile, match[1], match[2]])
    if (!groups.has(key)) groups.set(key, [])
    groups.get(key)!.push(change)
  }

  const replacements = new Map<StylePlanItem, StylePlanItem>()
  const merged = new Set<StylePlanItem>()
  groups.forEach(group => {
    const byStyle = new Map<string, StylePlanItem[]>()
    for (const change of group) {
      // 精确规则有原尺寸时仍作为差异项保留，不能把它的恢复位置搬到共享规则。
      if (Object.entries(change.style).some(([key, value]) => key.startsWith('--freeform-original-') && value !== 'null')) continue
      const key = JSON.stringify(Object.entries(change.style).sort(([a], [b]) => a.localeCompare(b)))
      if (!byStyle.has(key)) byStyle.set(key, [])
      byStyle.get(key)!.push(change)
    }
    const shared = Array.from(byStyle.values()).sort((a, b) => b.length - a.length)[0]
    if (!shared || shared.length < 2) return
    const first = shared[0]
    const [, parentSelector, childSelector] = first.selector.match(/^(.*):nth-child\(\d+\)( > .+)$/)!
    const runtimeParent = parentSelector.replace(/\.[a-zA-Z_][a-zA-Z0-9_-]*/g, name => runtimeClasses.get(name) || name)
    const runtimeChild = childSelector.replace(/\.([a-zA-Z_][a-zA-Z0-9_-]*)/g, (_, name) =>
      `.${CSS.escape(Array.from(first.target.classList).find(runtime => classMatchesShortName(runtime, name))!)}`)
    const targets = new Set(group.map(change => change.target))
    // 公共规则必须只命中本次转换的子项；原本 absolute 或未参与切换的项仍保留原路径。
    if (Array.from(scope.querySelectorAll(runtimeParent + runtimeChild)).some(target => !targets.has(target as HTMLElement))) return
    const selector = parentSelector + childSelector
    const style: Record<string, any> = { ...first.style }
    // 差异项必须完整覆盖公共声明，否则“不需要 min-width”的项也会被公共补值撑宽。
    // 优先级不同也保留独立规则，不在合并阶段改变已算好的 !important。
    if (group.some(change => {
      const candidate: Record<string, any> = change.style
      return Object.keys(style).some(key => candidate[key] === undefined
        || String(candidate[key]).includes('!important') !== String(style[key]).includes('!important'))
    })) return
    const specificity = calculateSafeSpecificity(selector)!
    const stronger = sources.filter(source => compare(calculateSafeSpecificity(source.selectorPart)!, specificity) > 0
      && shared.some(change => change.target.matches(source.selectorPart)))
    // 去掉父级 nth 会降低优先级；存在竞争声明时继续用原精确规则。
    const properties = Object.keys(style).filter(key => !key.startsWith('--'))
    if (stronger.some(source => properties.some(key => source.rule.style.getPropertyValue(cssProperty(key))))) return
    // 若共享 selector 原来已有尺寸声明，备份它；退出时仍在这个 selector 上恢复。
    const original = sources.find(source => source.sourceSelector === selector)?.rule.style
    if (original) {
      for (const key of Object.keys(style).filter(key => key.startsWith('--freeform-original-'))) {
        style[key] = JSON.stringify(readDeclaration(original, key.slice('--freeform-original-'.length)))
      }
    }
    replacements.set(first, { ...first, selector, style })
    shared.slice(1).forEach(change => merged.add(change))
  })
  return changes.filter(change => !merged.has(change)).map(change => replacements.get(change) || change)
}

/** 退出一行前先拆开它命中的共享规则，其余行保留原布局，再复用现有 null 删除和原值恢复。 */
export function splitFreedomRulesForExit(changes: StylePlanItem[], sources: ZoneSourceRule[], parentPlans: StylePlanItem[], componentRoot: Element) {
  const exiting = new Set(changes.filter(change => change.style['--freeform-position'] === null).map(change => change.target))
  const handled = new Set<string>()
  const result: StylePlanItem[] = []
  for (const change of changes) {
    if (change.style['--freeform-position'] !== null || !change.selector.includes(' > ')) {
      result.push(change)
      continue
    }
    const source = sources.find(source => source.sourceSelector === change.selector)!
    const childSelector = change.selector.slice(change.selector.lastIndexOf(' > '))
    const parentPlan = parentPlans.find(plan => plan.target === change.target.parentElement)!
    const key = JSON.stringify([change.lessFile, change.selector])
    if (handled.has(key)) continue
    handled.add(key)
    const peers = Array.from(componentRoot.querySelectorAll<HTMLElement>(source.selectorPart)).filter(target => !exiting.has(target))
    if (peers.length) {
      // 这里只读同文件规则，保留其它行已有的精确差异。
      const styles = new Map(Array.from(source.rule.parentStyleSheet!.cssRules)
        .filter((rule): rule is CSSStyleRule => rule instanceof CSSStyleRule)
        .map(rule => [resolveCssomSourceSelector(rule.selectorText, change.target, componentRoot.id), rule.style]))
      for (const target of peers) {
        const parentSelector = buildSoloSelector(target.parentElement!, parentPlan.selector.split(' ').pop()!.replace(/:nth-child\(\d+\)/g, ''),
          componentRoot, { keepTopLevelFirstChild: true })
        const selector = parentSelector + childSelector
        const original = styles.get(selector)
        if (original?.getPropertyValue('--freeform-position')) continue
        const style: Record<string, any> = {}
        for (const key of Object.keys(change.style)) {
          // 共享原值会在原规则上恢复，新建的精确补值退出时只需删除。
          style[key] = key.startsWith('--freeform-original-') ? 'null'
            : (original && readDeclaration(original, key)) || readDeclaration(source.rule.style, key)
        }
        result.push({ ...change, target, selector, style })
      }
    }
    result.push(change)
  }
  return result
}
