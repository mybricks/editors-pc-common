import { getDocument } from './dom'
import { splitTopLevelSelectors } from './selector-utils'

export type ZoneSourceRule = {
  rule: CSSStyleRule
  selectorPart: string
  sourceOrder: number
  target: Element
}

export type ZoneTab = {
  selector: string
  baseSelector: string
  pseudo: string | null
  sourceRules: ZoneSourceRule[]
  baseRules: ZoneSourceRule[]
}

const EDITABLE_STATES = new Set([
  'hover', 'focus', 'focus-visible', 'focus-within', 'active', 'disabled',
  'checked', 'indeterminate', 'placeholder-shown', 'visited', 'target',
  'enabled', 'read-only', 'read-write', 'required', 'optional', 'valid', 'invalid',
])

/** 只在括号、属性和引号之外分段，避免 :not(...) / :where(...) 内的空格变成祖先路径。 */
export function selectorSubjectStart(selector: string): number {
  let depth = 0
  let quote = ''
  let start = 0
  for (let i = 0; i < selector.length; i++) {
    const ch = selector[i]
    if (ch === '\\') { i++; continue }
    if (quote) { if (ch === quote) quote = ''; continue }
    if (ch === '"' || ch === "'") { quote = ch; continue }
    if (ch === '(' || ch === '[') depth++
    else if (ch === ')' || ch === ']') depth--
    else if (depth === 0 && /[\s>+~]/.test(ch)) start = i + 1
  }
  return start
}

function balancedEnd(text: string, start: number): number {
  const close = text[start] === '(' ? ')' : ']'
  let depth = 1
  let quote = ''
  for (let i = start + 1; i < text.length; i++) {
    const ch = text[i]
    if (ch === '\\') { i++; continue }
    if (quote) { if (ch === quote) quote = ''; continue }
    if (ch === '"' || ch === "'") { quote = ch; continue }
    if (ch === text[start]) depth++
    else if (ch === close && --depth === 0) return i + 1
  }
  return text.length
}

/** 去掉当前主体的待编辑状态；:not、结构条件、祖先条件和页面作用域仍由 matches 校验。 */
export function splitZoneSelectorState(selector: string) {
  const start = selectorSubjectStart(selector)
  const subject = selector.slice(start)
  let matchSubject = ''
  let pseudo = ''
  for (let i = 0; i < subject.length;) {
    if (subject[i] === '[') {
      const end = balancedEnd(subject, i)
      matchSubject += subject.slice(i, end); i = end; continue
    }
    const token = subject.slice(i).match(/^(:{1,2})([\w-]+)/)
    if (!token) { matchSubject += subject[i++]; continue }
    let end = i + token[0].length
    if (subject[end] === '(') end = balancedEnd(subject, end)
    const name = token[2].toLowerCase()
    const isElement = token[1] === '::' || /^(before|after|first-line|first-letter)$/.test(name)
    if (isElement || EDITABLE_STATES.has(name)) {
      pseudo += isElement ? '::' + subject.slice(i + token[1].length, end) : subject.slice(i, end)
    } else {
      matchSubject += subject.slice(i, end)
    }
    i = end
  }
  return {
    pseudo: pseudo || null,
    matchSelector: selector.slice(0, start) + (matchSubject || '*'),
    subject: matchSubject,
  }
}

/** 主体的正向 class，不把祖先、:not(.selected)、:has(.child) 当作自身 class。 */
export function subjectClassNames(subject: string, el: Element): string[] {
  const result = new Set<string>()
  for (let i = 0; i < subject.length;) {
    if (subject[i] === '[') { i = balancedEnd(subject, i); continue }
    const fn = subject.slice(i).match(/^:([\w-]+)\(/)
    if (fn) {
      const open = i + fn[0].length - 1
      const end = balancedEnd(subject, open)
      if (fn[1] === 'is' || fn[1] === 'where') {
        for (const part of splitTopLevelSelectors(subject.slice(open + 1, end - 1))) {
          try {
            if (el.matches(part)) {
              subjectClassNames(part.slice(selectorSubjectStart(part)), el).forEach(c => result.add(c))
            }
          } catch {}
        }
      }
      i = end; continue
    }
    const cls = subject.slice(i).match(/^\.([a-zA-Z_][a-zA-Z0-9_-]*)/)
    if (cls) { result.add(cls[1]); i += cls[0].length } else { i++ }
  }
  return Array.from(result)
}

/** 一次扫描共用于 tab 和回显；只递归可在当前环境验证的条件规则。 */
export function collectZoneStyleRules(): Array<{ rule: CSSStyleRule; sourceOrder: number }> {
  const root = getDocument()
  const result: Array<{ rule: CSSStyleRule; sourceOrder: number }> = []
  const sheets = new Set<CSSStyleSheet>()
  root.querySelectorAll('style, link[rel="stylesheet"]').forEach(node => {
    const sheet = (node as HTMLStyleElement).sheet
    if (sheet) sheets.add(sheet as CSSStyleSheet)
  })
  Array.from(root.adoptedStyleSheets || []).forEach(sheet => sheets.add(sheet))
  const visit = (rules: CSSRuleList) => {
    for (const rule of Array.from(rules)) {
      if ((rule as CSSStyleRule).selectorText) {
        result.push({ rule: rule as CSSStyleRule, sourceOrder: result.length })
      } else if (rule.type === CSSRule.MEDIA_RULE) {
        const media = rule as CSSMediaRule
        if (window.matchMedia(media.conditionText).matches) visit(media.cssRules)
      } else if (rule.type === CSSRule.SUPPORTS_RULE) {
        const supports = rule as CSSSupportsRule
        if (CSS.supports(supports.conditionText)) visit(supports.cssRules)
      }
    }
  }
  for (const sheet of sheets) {
    try {
      if (sheet.disabled || (sheet.media?.mediaText && !window.matchMedia(sheet.media.mediaText).matches)) continue
      visit(sheet.cssRules)
    } catch { /* 跨域样式表不可读取。 */ }
  }
  return result
}

function classTokens(selector: string): string[] {
  return (selector.match(/\.([a-zA-Z_][a-zA-Z0-9_-]*)/g) || []).map((token) => token.slice(1))
}

function belongsToBase(sourcePart: string, baseSelector: string): boolean {
  const sourceClasses = classTokens(sourcePart.slice(selectorSubjectStart(sourcePart)))
  const baseClasses = classTokens(baseSelector)
  if (!sourceClasses.length || !baseClasses.length) return !baseClasses.length
  return baseClasses.some((base) => sourceClasses.some((source) =>
    source === base || source.endsWith(`-${base}`) || source.endsWith(`_${base}`)
  ))
}

/**
 * 将 CSSOM 中真正命中的规则挂到已经筛选出的 tab 上。
 * tab 仍使用简化 selector 展示，但 sourceRules 保留原始分支，供回显和写回使用。
 */
export function collectZoneTabs(
  elements: Element[],
  baseSelectors: string[],
  comId?: string
): ZoneTab[] {
  const tabs = new Map<string, ZoneTab>()
  for (const baseSelector of baseSelectors) {
    tabs.set(baseSelector, {
      selector: baseSelector,
      baseSelector,
      pseudo: null,
      sourceRules: [],
      baseRules: [],
    })
  }
  if (!elements.length || !baseSelectors.length) return Array.from(tabs.values())

  for (const { rule, sourceOrder } of collectZoneStyleRules()) {
    if (comId && !rule.selectorText.includes(comId)) continue
    for (const part of splitTopLevelSelectors(rule.selectorText)) {
      const state = splitZoneSelectorState(part)
      const target = elements.find((el) => {
        try { return el.matches(state.matchSelector) } catch { return false }
      })
      if (!target) continue
      const tab = baseSelectors.find((base) => belongsToBase(part, base))
      if (!tab) continue
      const entry = tabs.get(tab)
      if (!entry) continue
      const source = { rule, selectorPart: part, sourceOrder, target }
      if (state.pseudo) {
        const pseudoSelector = `${tab}${state.pseudo}`
        const pseudoKey = `${tab}\u0000${state.pseudo}`
        let pseudoTab = tabs.get(pseudoKey)
        if (!pseudoTab) {
          pseudoTab = {
            selector: pseudoSelector,
            baseSelector: tab,
            pseudo: state.pseudo,
            sourceRules: [],
            baseRules: [],
          }
          tabs.set(pseudoKey, pseudoTab)
        }
        if (!pseudoTab.sourceRules.some((item) => item.rule === rule && item.selectorPart === part)) {
          pseudoTab.sourceRules.push(source)
        }
      } else if (!entry.baseRules.some((item) => item.rule === rule && item.selectorPart === part)) {
        entry.baseRules.push(source)
        entry.sourceRules.push(source)
      }
    }
  }

  // 伪类 tab 需要同时包含基础规则，才能读取完整的 base + state 覆盖结果。
  for (const tab of tabs.values()) {
    if (!tab.pseudo) continue
    const base = tabs.get(tab.baseSelector)
    if (base) tab.baseRules = base.baseRules.slice()
  }
  return Array.from(tabs.values()).filter((tab) => !tab.pseudo || tab.sourceRules.length > 0)
}
