import { getDocument } from '../dom'
import { splitTopLevelSelectors } from '../selector-utils'

import type { CascadeMode, CascadeRuleSource } from './types'

const INTERACTIVE_PSEUDO_RE =
  /:(hover|focus-within|focus-visible|focus|active|visited|checked|disabled|indeterminate|placeholder-shown|target|enabled|read-only|read-write)\b/i
const HOVER_TAIL_RE = /:hover\s*$/i

/** :not(:disabled) 描述的是默认态约束，不能因为参数里出现 disabled 就整条丢弃。 */
function hasPositiveInteractivePseudo(selector: string): boolean {
  let searchable = ''
  for (let index = 0; index < selector.length;) {
    const negation = selector.slice(index).match(/^:not\(/i)
    if (!negation) {
      searchable += selector[index++]
      continue
    }

    let depth = 1
    let quote = ''
    index += negation[0].length
    while (index < selector.length && depth > 0) {
      const char = selector[index++]
      if (char === '\\') {
        index++
      } else if (quote) {
        if (char === quote) quote = ''
      } else if (char === '"' || char === "'") {
        quote = char
      } else if (char === '(') {
        depth++
      } else if (char === ')') {
        depth--
      }
    }
  }
  return INTERACTIVE_PSEUDO_RE.test(searchable)
}

function matchesDefault(element: Element, selector: string): boolean {
  if (hasPositiveInteractivePseudo(selector)) return false
  try {
    return element.matches(selector)
  } catch {
    return false
  }
}

function matchesHover(element: Element, selector: string): boolean {
  if (!hasPositiveInteractivePseudo(selector)) return matchesDefault(element, selector)
  if (!HOVER_TAIL_RE.test(selector)) return false
  const baseSelector = selector.replace(HOVER_TAIL_RE, '').trim()
  if (!baseSelector) return false
  try {
    return element.matches(baseSelector)
  } catch {
    return false
  }
}

function getStyleSheets(root: Document | ShadowRoot): CSSStyleSheet[] {
  const result = new Set<CSSStyleSheet>()
  const nativeSheets = Array.from((root as Document).styleSheets || [])
  nativeSheets.forEach((sheet) => result.add(sheet as CSSStyleSheet))

  Array.from(root.querySelectorAll('style, link[rel="stylesheet"]')).forEach((node) => {
    const sheet = (node as HTMLStyleElement | HTMLLinkElement).sheet
    if (sheet) result.add(sheet as CSSStyleSheet)
  })

  const adopted = Array.from((root as any).adoptedStyleSheets || []) as CSSStyleSheet[]
  adopted.forEach((sheet) => result.add(sheet))
  return Array.from(result)
}

function groupingRuleIsActive(rule: CSSRule): boolean {
  if (rule.type === CSSRule.MEDIA_RULE) {
    try {
      return window.matchMedia((rule as CSSMediaRule).conditionText).matches
    } catch {
      return false
    }
  }
  if (rule.type === CSSRule.SUPPORTS_RULE) {
    try {
      return CSS.supports((rule as CSSSupportsRule).conditionText)
    } catch {
      return false
    }
  }
  return true
}

/**
 * 按样式表源码顺序收集当前元素的匹配规则。规则只扫描一次，属性读取由 session 复用。
 * 默认态排除交互伪类；hover 态包含基础规则以及主体以 :hover 结尾的规则。
 */
export function collectMatchingRuleSources(
  element: HTMLElement,
  mode: CascadeMode,
  root: Document | ShadowRoot = getDocument()
): CascadeRuleSource[] {
  const sources: CascadeRuleSource[] = []
  let sourceOrder = 0

  const visit = (rules: CSSRuleList | CSSRule[]): void => {
    for (const rule of Array.from(rules)) {
      if ((rule as CSSStyleRule).selectorText && (rule as CSSStyleRule).style) {
        const styleRule = rule as CSSStyleRule
        for (const selectorPart of splitTopLevelSelectors(styleRule.selectorText)) {
          const matched = mode === 'hover'
            ? matchesHover(element, selectorPart)
            : matchesDefault(element, selectorPart)
          if (matched) {
            sources.push({
              rule: styleRule,
              selectorPart,
              target: element,
              sourceOrder,
            })
          }
        }
        sourceOrder++
        continue
      }

      const nestedRules = (rule as CSSGroupingRule).cssRules
      if (nestedRules && groupingRuleIsActive(rule)) visit(nestedRules)
    }
  }

  for (const sheet of getStyleSheets(root)) {
    try {
      const mediaText = sheet.media?.mediaText || ''
      if (sheet.disabled || (mediaText && !window.matchMedia(mediaText).matches)) continue
      visit(sheet.cssRules)
    } catch {
      // 跨域样式表的 cssRules 不可读，浏览器自身仍会正常应用。
    }
  }

  return sources
}
