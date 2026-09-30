import { splitTopLevelSelectors } from './selector-utils'
import { splitZoneSelectorState } from './zone-tab'

/** 这些真实交互态可能污染 DOM 上读到的常规态计算样式。 */
const INTERACTIVE_STATES = [':hover', ':focus', ':focus-within', ':focus-visible', ':active', ':disabled']

const opaqueSheetIds = new WeakMap<CSSStyleSheet, number>()
let nextOpaqueSheetId = 0

/**
 * 比较常规态来源是否真的变化，供交互态期间复用上一次可信快照。
 * 仅忽略明确要求当前目标处于交互态的规则；混合选择器中的常规分支仍参与比较。
 * 这只是失效依据，不解析级联、不生成计算值，也不改变现有写入路径。
 */
export function readNormalStyleSignature(target: HTMLElement | null): string | undefined {
  if (!target?.isConnected) return undefined
  try {
    const stateOnlySelector = (selector: string) => {
      // 转义 class 等复杂情况保守保留，避免把字面量 :hover 当成伪类。
      if (selector.includes('\\')) return false
      const { pseudo, matchSelector } = splitZoneSelectorState(selector)
      try {
        return !!pseudo && INTERACTIVE_STATES.includes(pseudo) && target.matches(matchSelector)
      } catch { return false }
    }
    const describeRules = (rules: CSSRuleList): unknown[] => Array.from(rules).flatMap(rule => {
      const children = (rule as CSSRule & { cssRules?: CSSRuleList }).cssRules
      const styleRule = rule as CSSStyleRule
      if (styleRule.selectorText) {
        // 嵌套选择器依赖外层上下文，保留整条规则，包含外层自身的声明。
        if (children?.length) return [[rule.cssText]]
        const selectors = splitTopLevelSelectors(styleRule.selectorText).filter(selector => !stateOnlySelector(selector))
        return selectors.length ? [[selectors, styleRule.style.cssText]] : []
      }
      if (children) {
        // 保留 media/supports/layer 等条件与顺序，递归比较其中的规则。
        return [[rule.cssText.slice(0, rule.cssText.indexOf('{')), describeRules(children)]]
      }
      const imported = (rule as CSSImportRule).styleSheet
      return [[rule.cssText, imported ? describeSheet(imported) : null]]
    })
    const describeSheet = (sheet: CSSStyleSheet): unknown[] => {
      if (sheet.disabled) return []
      const media = sheet.media?.mediaText || ''
      const mediaMatches = !media || target.ownerDocument.defaultView?.matchMedia(media).matches
      let sheetRules: CSSRuleList
      try { sheetRules = sheet.cssRules } catch {
        // 跨域表不能由页面修改 CSSOM；替换表对象或 media/disabled 改变仍会失效。
        if (!opaqueSheetIds.has(sheet)) opaqueSheetIds.set(sheet, ++nextOpaqueSheetId)
        return [[opaqueSheetIds.get(sheet), sheet.href, media, mediaMatches]]
      }
      const rules = describeRules(sheetRules)
      // 新增/删除仅含目标伪类的样式表，不改变常规态来源。
      return rules.length ? [[media, mediaMatches, rules]] : []
    }
    const roots = new Set<Document | ShadowRoot>()
    const sources: unknown[] = []
    for (let element: Element | null = target; element;) {
      const root = element.getRootNode() as Document | ShadowRoot
      roots.add(root)
      sources.push([
        element.tagName,
        Array.from(element.attributes, attribute => [attribute.name, attribute.value]),
        element.clientWidth, element.clientHeight,
      ])
      element = element.parentElement || ('host' in root ? root.host : null)
    }
    for (const root of roots) {
      const sheets = new Set<CSSStyleSheet>()
      root.querySelectorAll('style, link[rel="stylesheet"]').forEach(node => {
        const sheet = (node as HTMLStyleElement | HTMLLinkElement).sheet
        if (sheet) sheets.add(sheet as CSSStyleSheet)
      })
      for (const sheet of (root as any).adoptedStyleSheets || []) sheets.add(sheet)
      sources.push(Array.from(sheets).flatMap(describeSheet))
    }
    const view = target.ownerDocument.defaultView
    sources.push([view?.innerWidth, view?.innerHeight, view?.devicePixelRatio])
    return JSON.stringify(sources)
  } catch {
    // 无法证明来源一致时，保留原有版本失效规则。
    return undefined
  }
}

/** 返回当前目标可信的常规态计算样式；不改变元素的真实状态。 */
export function readNormalComputedStyle(target: HTMLElement | null): CSSStyleDeclaration | undefined {
  if (!target?.isConnected) return undefined
  try {
    for (let element: Element | null = target; element; element = element.parentElement) {
      if (INTERACTIVE_STATES.some(state => {
        try { return element!.matches(state) } catch { return false }
      })) return undefined
    }
    return target.ownerDocument.defaultView?.getComputedStyle(target) || undefined
  } catch {
    return undefined
  }
}
