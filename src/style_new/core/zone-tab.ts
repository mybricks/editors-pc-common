// @ts-ignore
import { compare } from 'specificity'

import { isPageScopedSelector, resolveCssomSourceSelector } from './build-zone-selectors-from-cssom'
import { toLine } from './css-code-codec'
import { getStyleResolution } from './style-property'
import { createCascadeResolver } from './cascade-winner'
import { getDocument } from './dom'
import { calculateSafeSpecificity, splitTopLevelSelectors } from './selector-utils'

export type ZoneSourceRule = {
  rule: CSSStyleRule
  /** CSSOM 中的运行时 selector，用于 matches 和特指度计算。 */
  selectorPart: string
  /** 剥除平台作用域并还原 CSS Modules 后的 selector，用于 Less 写回。 */
  sourceSelector: string
  sourceOrder: number
  target: Element
  /** 是否来自 data-desn-page 页面源码作用域（AI 页面 Less）。 */
  isPageStyle: boolean
}

export type EffectiveStyleValue = {
  value?: unknown
  computedValue?: string
  type: 'inline' | 'stylesheet' | 'computed'
  sourceSelector?: string
  selectorPart?: string
  sourceOrder?: number
  important?: boolean
}

export type ZoneTab = {
  selector: string
  /** 合并前参与当前状态 Tab 的基础 selector，用于影响区域统计。 */
  affectedSelectors?: string[]
  baseSelector: string
  pseudo: string | null
  sourceRules: ZoneSourceRule[]
  baseRules: ZoneSourceRule[]
  target?: Element
  label?: string
  effectiveStyle?: Record<string, EffectiveStyleValue>
  /** 是否由右侧新增状态按钮临时添加。 */
  isAdded?: boolean
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
    .sort((a, b) => {
      const aImportant = a.rule.style.cssText.includes('!important') ? 1 : 0
      const bImportant = b.rule.style.cssText.includes('!important') ? 1 : 0
      if (aImportant !== bImportant) return aImportant - bImportant

      const aSpec = calculateSafeSpecificity(a.selectorPart, a.target as HTMLElement)
      const bSpec = calculateSafeSpecificity(b.selectorPart, b.target as HTMLElement)
      if (aSpec && bSpec) {
        const bySpec = compare(aSpec, bSpec)
        if (bySpec !== 0) return bySpec
      }
      return a.sourceOrder - b.sourceOrder
    })
}

function readStyleProperty(source: ZoneSourceRule, property: string): string {
  try {
    return source.rule.style.getPropertyValue(property).trim()
  } catch {
    return ''
  }
}

/**
 * 从规则列表中找出某个 CSS 属性真正的「级联赢家」规则。
 *
 * 判断优先级的顺序：!important > 选择器特指度 > 规则在样式表中的出现顺序（越靠后越优先）。
 *
 * 关键：!important 必须按属性维度判断，而不能看整条规则的 cssText。
 *
 * 反例（会出错的写法）：
 *   .ccOtherPropImportant { color: #1570ef; background: #eff8ff !important; }
 *   .ccScope .ccColorSpecificWinner { color: #067647; }  ← 特指度更高
 *
 *   如果用 cssText.includes('!important') 判断，.ccOtherPropImportant 整条规则
 *   会被当成 important 而排在最后，color 的 winner 就会错误指向它。
 *   但实际上只有 background 有 !important，color 没有，
 *   color 的 winner 应该是特指度更高的 .ccScope .ccColorSpecificWinner。
 *
 *   正确做法是用 rule.style.getPropertyPriority('color') 单独判断 color 是否 important。
 */
function findCascadeWinner(
  candidates: ZoneSourceRule[],
  properties: string[]
): ZoneSourceRule | undefined {
  const declaring = candidates.filter((source) =>
    properties.some((prop) => readStyleProperty(source, prop))
  )
  if (!declaring.length) return undefined

  return declaring.reduce((winner, current) => {
    const winImportant = properties.some(
      (prop) => winner.rule.style.getPropertyPriority(prop) === 'important'
    )
    const curImportant = properties.some(
      (prop) => current.rule.style.getPropertyPriority(prop) === 'important'
    )
    if (winImportant !== curImportant) return curImportant ? current : winner

    const winSpec = calculateSafeSpecificity(winner.selectorPart, winner.target as HTMLElement)
    const curSpec = calculateSafeSpecificity(current.selectorPart, current.target as HTMLElement)
    if (winSpec && curSpec) {
      const bySpec = compare(winSpec, curSpec)
      if (bySpec !== 0) return bySpec > 0 ? winner : current
    }
    return current.sourceOrder >= winner.sourceOrder ? current : winner
  })
}

function findStyleSource(tab: ZoneTab, styleKey: string): ZoneSourceRule | undefined {
  const property = toLine(styleKey)
  const fallbackProperties = PROPERTY_FALLBACKS[styleKey] || []
  // getOrderedZoneSourceRules 负责去重；cascade 排序由 findCascadeWinner 按属性级重算
  const deduped = getOrderedZoneSourceRules(tab)
  return findCascadeWinner(deduped, [property]) ?? findCascadeWinner(deduped, fallbackProperties)
}

/**
 * 当属性值为 unset 时，浏览器会将其 computedValue 还原为 initial，
 * 对于 flex 等不可继承属性会得到 "0 1 auto" 这样的初始值，容易产生误导。
 * 白名单中的属性若值为 unset，跳过 computedValue 的计算。
 */
const SKIP_COMPUTED_VALUE_WHEN_UNSET = new Set(['flex'])

/** 使用现有面板计算出的 styleValues 生成来源信息，避免重复实现 CSS 级联。 */
export function buildZoneEffectiveStyle(
  tab: ZoneTab,
  styleValues: Record<string, unknown>,
  target?: Element | null,
): Record<string, EffectiveStyleValue> {
  const result: Record<string, EffectiveStyleValue> = {}
  const computedStyle = target instanceof HTMLElement ? window.getComputedStyle(target) : null
  const cascadeResolver = target instanceof HTMLElement && !tab.pseudo
    ? createCascadeResolver(target)
    : null
  Object.entries(styleValues).forEach(([styleKey, value]) => {
    if (value == null || String(value).trim() === '') return
    let effectiveValue: unknown = value
    let hasEffectiveValue = true
    const source = findStyleSource(tab, styleKey)
    const cssProperty = toLine(styleKey)
    const inlineStyle = target instanceof HTMLElement ? target.style : null
    const inlineValue = inlineStyle?.getPropertyValue(cssProperty).trim()
    const stylesheetImportant = !!source && source.rule.style.getPropertyPriority(cssProperty) === 'important'
    const inlineWins = !!inlineValue && !stylesheetImportant
    const skipComputedValue = SKIP_COMPUTED_VALUE_WHEN_UNSET.has(cssProperty) && String(value).trim() === 'unset'
    let computedValue = skipComputedValue
      ? undefined
      : (computedStyle?.getPropertyValue(cssProperty).trim() || undefined)
    if (!skipComputedValue && cascadeResolver && !inlineValue) {
      const defaultWinner = cascadeResolver(cssProperty, 'default')
      const hoverWinner = cascadeResolver(cssProperty, 'hover')
      if (hoverWinner) {
        // 点击元素时 getComputedStyle 可能仍混入 :hover；默认态只使用常规级联结果。
        if (!defaultWinner && !source) {
          hasEffectiveValue = false
          computedValue = cssProperty === 'color' && target.parentElement
            ? window.getComputedStyle(target.parentElement).getPropertyValue(cssProperty).trim() || undefined
            : undefined
        } else {
          computedValue = defaultWinner?.value
        }
      }
    }
    result[styleKey] = {
      ...(hasEffectiveValue ? { value: effectiveValue } : {}),
      computedValue,
      type: source ? (inlineWins ? 'inline' : 'stylesheet') : (inlineValue ? 'inline' : 'computed'),
      sourceSelector: inlineWins ? undefined : source?.sourceSelector,
      selectorPart: inlineWins ? 'inline' : source?.selectorPart,
      sourceOrder: inlineWins ? undefined : source?.sourceOrder,
      important: inlineWins
        ? inlineStyle?.getPropertyPriority(cssProperty) === 'important'
        : stylesheetImportant || undefined,
    }
  })
  return result
}

const PSEUDO_TAIL_RE = /(:{1,2}[a-zA-Z\-]+(?:\([^)]*\))?)$/

function shortenClassLabel(rawLabel: string): string {
  const classes = rawLabel.split('.')
  const hashedClasses = classes.filter((cls) => cls.includes('--'))
  return hashedClasses.length > 0
    ? hashedClasses.map((cls) => cls.slice(cls.lastIndexOf('--') + 2)).join('.')
    : rawLabel
}

function getPseudoLabel(pseudo: string): string {
  const pseudoLabels: Record<string, string> = {
    ':hover': '悬浮态',
    ':active': '按下态',
    ':focus': '聚焦态',
    ':focus-visible': '键盘聚焦态',
    ':focus-within': '后代聚焦态',
    ':disabled': '禁用态',
    '::before': '前缀元素',
    '::after': '后缀元素',
    '::placeholder': '占位符元素',
  }
  const pseudoLabel = pseudoLabels[pseudo] || pseudo
  return pseudoLabel
}

function getZoneTabLabel(selector: string): string {
  const parts = selector.trim().split(/\s+/)
  const lastPart = parts[parts.length - 1] || ''
  const pseudoMatch = lastPart.match(PSEUDO_TAIL_RE)
  if (pseudoMatch) return getPseudoLabel(pseudoMatch[1])
  return '常规'
}

function getDisambiguatedBaseLabel(selector: string): string {
  const parts = selector.trim().split(/\s+/)
  const lastPart = parts[parts.length - 1] || ''
  const self = getZoneTabLabel(lastPart)
  if (parts.length < 2) return self
  const parent = shortenClassLabel(parts[parts.length - 2].replace(/^\./, ''))
  return parent ? `${parent} ${self}` : self
}

function isPseudoSelector(selector: string): boolean {
  const lastPart = selector.trim().split(/\s+/).pop() || ''
  return PSEUDO_TAIL_RE.test(lastPart)
}

/** 生成与 zoneTabs 顺序一致的展示名称。 */
export function getZoneTabLabels(selectors: string[]): string[] {
  const labels = selectors.map(getZoneTabLabel)
  const counts = new Map<string, number>()
  labels.forEach((label) => counts.set(label, (counts.get(label) ?? 0) + 1))

  return selectors.map((selector, index) => {
    if (isPseudoSelector(selector)) return labels[index]
    if (!isPseudoSelector(selector) && (counts.get(labels[index]) ?? 0) > 1) {
      return getDisambiguatedBaseLabel(selector)
    }
    return labels[index]
  })
}

export function mergeZoneTabsByState(tabs: ZoneTab[]): ZoneTab[] {
  const merged = new Map<string, ZoneTab>()
  const mergeRules = (target: ZoneSourceRule[], incoming: ZoneSourceRule[]) => {
    incoming.forEach((rule) => {
      if (!target.some((item) => item.rule === rule.rule && item.selectorPart === rule.selectorPart)) {
        target.push(rule)
      }
    })
  }

  tabs.forEach((tab) => {
    const stateKey = tab.pseudo || '__base__'
    const existing = merged.get(stateKey)
    if (!existing) {
      merged.set(stateKey, {
        ...tab,
        affectedSelectors: Array.from(new Set(tab.affectedSelectors ?? [tab.selector])),
        sourceRules: tab.sourceRules.slice(),
        baseRules: tab.baseRules.slice(),
        effectiveStyle: {},
      })
      return
    }

    mergeRules(existing.sourceRules, tab.sourceRules)
    mergeRules(existing.baseRules, tab.baseRules)
    existing.affectedSelectors = Array.from(new Set([
      ...(existing.affectedSelectors ?? [existing.selector]),
      ...(tab.affectedSelectors ?? [tab.selector]),
    ]))
  })

  return Array.from(merged.values())
}

const PROPERTY_FALLBACKS: Record<string, string[]> = {
  backgroundColor: ['background'],
  backgroundImage: ['background'],
  fontSize: ['font'],
  borderRadius: [
    'border-top-left-radius',
    'border-top-right-radius',
    'border-bottom-right-radius',
    'border-bottom-left-radius',
  ],
}

/** 兼容旧调用点，实际来源只由公共解析器决定。 */
export function resolveZonePropertySource(tab: ZoneTab, key: string): ZoneSourceRule | undefined {
  return getStyleResolution(tab).get(key).winner?.source
}

export function resolveZonePropertySelector(tab: ZoneTab, key: string): string | undefined {
  const winner = getStyleResolution(tab).get(key).winner
  return winner?.currentState ? winner.label || undefined : undefined
}

export function resolveZoneDeletionTarget(tab: ZoneTab, key: string): ZoneDeletionTarget | undefined {
  const winner = getStyleResolution(tab).get(key).winner
  if (!winner?.currentState || !winner.label) return undefined
  return { selector: winner.label, property: winner.property === 'gap' ? 'gap' : key }
}

export function resolveZoneFallbackSelector(tab: ZoneTab): string {
  // 新增伪类 Tab 尚无状态规则时，沿用基础规则的完整源码选择器和作用域。
  if (tab.pseudo && tab.baseRules.length) {
    const lastBase = tab.baseRules[tab.baseRules.length - 1]
    if (lastBase?.sourceSelector) return `${lastBase.sourceSelector}${tab.pseudo}`
  }
  return tab.selector
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
      target: elements[0],
      effectiveStyle: {},
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
        isPageStyle: isPageScopedSelector(part),
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
            target,
            effectiveStyle: {},
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

  return Array.from(tabs.values())
    .filter((tab) => !tab.pseudo || tab.sourceRules.length > 0)
}
