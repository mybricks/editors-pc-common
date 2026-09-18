import { resolveCssomSourceSelector } from './build-zone-selectors-from-cssom'
import {
  normalizeCssProperty,
  resolveCascadeRuleSources,
} from './css-cascade'
import type { CascadeCandidate, CascadeRuleSource } from './css-cascade'
import { toHump } from './css-code-codec'
import { getDocument } from './dom'
import { splitTopLevelSelectors } from './selector-utils'

export type ZoneSourceRule = {
  rule: CSSStyleRule
  /** CSSOM 中的运行时 selector，用于 matches 和特指度计算。 */
  selectorPart: string
  /** 剥除平台作用域并还原 CSS Modules 后的 selector，用于 Less 写回。 */
  sourceSelector: string
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

export type ZoneDeletionTarget = {
  selector: string
  /** 传给删除 side-channel 的样式 key；gap 简写时为 gap。 */
  property: string
}

/**
 * 返回与 ZoneTab 回显一致的来源规则顺序。
 *
 * 伪类 tab 需要把基础态和状态态规则合在一起；普通 tab 只使用自己的
 * sourceRules。这里保留 selectorPart 而不是只返回 CSSStyleRule，供回显侧
 * 按运行时完整 selector 计算特指度；Less 写回使用单独的 sourceSelector。
 */
export function getOrderedZoneSourceRules(tab: ZoneTab): ZoneSourceRule[] {
  const candidates = tab.pseudo
    ? [...tab.baseRules, ...tab.sourceRules]
    : tab.sourceRules

  return candidates
    .filter((item, index, all) => all.findIndex((candidate) =>
      candidate.rule === item.rule && candidate.selectorPart === item.selectorPart
    ) === index)
    .sort((a, b) => a.sourceOrder - b.sourceOrder)
}

function toCascadeRuleSources(sources: ZoneSourceRule[]): CascadeRuleSource[] {
  return sources.map((source) => ({
    rule: source.rule,
    selectorPart: source.selectorPart,
    target: source.target,
    sourceOrder: source.sourceOrder,
  }))
}

function resolveZoneWinner(
  sources: ZoneSourceRule[],
  styleKey: string
): CascadeCandidate | null {
  return resolveCascadeRuleSources(
    toCascadeRuleSources(sources),
    normalizeCssProperty(styleKey)
  )
}

function findWinnerSource(
  sources: ZoneSourceRule[],
  winner: CascadeCandidate
): ZoneSourceRule | undefined {
  if (winner.source.kind !== 'rule') return undefined
  return sources.find((source) =>
    source.rule === winner.source.rule &&
    source.selectorPart === winner.source.selector &&
    source.sourceOrder === winner.source.sourceOrder
  ) || sources.find((source) => source.rule === winner.source.rule)
}

/**
 * 找到当前 ZoneTab 中最终声明某个样式属性的 Less 源码 selector。
 * 直接属性优先；只有没有直接声明时才使用少量简写兜底映射。
 */
export function resolveZonePropertySelector(
  tab: ZoneTab,
  styleKey: string
): string | undefined {
  const orderedRules = getOrderedZoneSourceRules(tab)
  const winner = resolveZoneWinner(orderedRules, styleKey)
  if (!winner) return undefined
  const source = findWinnerSource(orderedRules, winner)
  return source ? (source.sourceSelector || tab.selector) : undefined
}

/**
 * 找到删除某个样式时真正需要操作的源码 selector 和属性。
 * 删除不能使用新增样式的 fallback selector；Gap 还需要识别 gap 简写来源。
 */
export function resolveZoneDeletionTarget(
  tab: ZoneTab,
  styleKey: string
): ZoneDeletionTarget | undefined {
  const orderedRules = getOrderedZoneSourceRules(tab)
  const winner = resolveZoneWinner(orderedRules, styleKey)
  if (!winner) return undefined
  const source = findWinnerSource(orderedRules, winner)
  if (!source) return undefined
  const directProperty = normalizeCssProperty(styleKey)
  return {
    selector: source.sourceSelector || tab.selector,
    property: winner.authoredProperty === directProperty
      ? styleKey
      : toHump(winner.authoredProperty),
  }
}

/**
 * 属性没有现有声明时，返回当前 tab 最适合新增样式的 Less 源码 selector。
 * 没有现有属性声明时无法按属性选赢家，退回源码顺序最后一条来源。
 */
export function resolveZoneFallbackSelector(tab: ZoneTab): string {
  const orderedRules = getOrderedZoneSourceRules(tab)
  return orderedRules[orderedRules.length - 1]?.sourceSelector || tab.selector
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
  const styleNodes = Array.from(root.querySelectorAll('style, link[rel="stylesheet"]'))
  styleNodes.forEach((node) => {
    const sheet = (node as HTMLStyleElement).sheet
    if (sheet) sheets.add(sheet as CSSStyleSheet)
  })
  const adoptedStyleSheets = Array.from((root as any).adoptedStyleSheets || []) as CSSStyleSheet[]
  adoptedStyleSheets.forEach(sheet => sheets.add(sheet))
  const sheetsToScan = Array.from(sheets)
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
  for (const sheet of sheetsToScan) {
    try {
      const mediaText = sheet.media?.mediaText || ''
      const mediaMatches = !mediaText || window.matchMedia(mediaText).matches
      if (sheet.disabled || !mediaMatches) {
        continue
      }
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

  const cssomRules = collectZoneStyleRules()

  for (const { rule, sourceOrder } of cssomRules) {
    // 不能要求 selectorText 必须包含 comId：组件样式编译后可能只保留
    // CSS Modules class（如 .siderContent___hash .ant-menu-item:hover）。
    // 后面的 Element.matches(state.matchSelector) 已经用当前目标 DOM 做了
    // 完整祖先路径校验，可以同时避免把不适用于当前元素的规则收进来。
    for (const part of splitTopLevelSelectors(rule.selectorText)) {
      const state = splitZoneSelectorState(part)
      const targetIndex = elements.findIndex((el) => {
        try { return el.matches(state.matchSelector) } catch { return false }
      })
      const tab = baseSelectors.find((base) => belongsToBase(part, base))
      if (targetIndex < 0 || !tab) continue
      const target = elements[targetIndex]
      const entry = tabs.get(tab)
      if (!entry) continue
      const source = {
        rule,
        selectorPart: part,
        sourceSelector: resolveCssomSourceSelector(part, target, comId || ''),
        sourceOrder,
        target,
      }
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
