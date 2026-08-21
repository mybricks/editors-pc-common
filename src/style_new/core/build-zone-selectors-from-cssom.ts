import { getDocument, escapeRegExp } from './dom'
import { classMatchesShortName } from './css-modules-match'
import { forEachSelectorPart } from './selector-utils'

/**
 * 剥平台作用域：
 * - :where(.comId) / :is(.comId)
 * - :where(.comId [data-desn-page="..."]) 等复合内容（括号平衡扫描）
 * - 前导裸 .comId
 */
function stripComIdScope(part: string, comId: string): string {
  let s = part.trim()
  const head = s.match(/^:(where|is)\(/i)
  if (head) {
    const innerStart = head[0].length
    let depth = 1
    let i = innerStart
    for (; i < s.length; i++) {
      const ch = s[i]
      if (ch === '(') depth++
      else if (ch === ')') {
        depth--
        if (depth === 0) break
      }
    }
    if (depth === 0) {
      const inner = s.slice(innerStart, i).trim()
      // 作用域主体以 .comId 开头（后面可跟空格、属性、伪类等）
      const scopedByComId = new RegExp(
        `^\\.${escapeRegExp(comId)}(?:$|[\\s:.[#])`
      ).test(inner)
      if (scopedByComId) {
        s = s.slice(i + 1).trim()
      }
    }
  }
  const bareRe = new RegExp(`^\\.${escapeRegExp(comId)}\\s+`)
  s = s.replace(bareRe, '')
  return s.trim()
}

/** 剥末尾交互/结构伪类，供 matches 使用（保留中间的 :not 等由浏览器处理） */
function stripTrailingPseudos(sel: string): string {
  return sel.replace(/(:{1,2}[a-zA-Z\-]+(?:\([^)]*\))?)+$/, '').trim()
}

export function isZoneTabNoiseClass(name: string): boolean {
  if (!name) return true
  // 平台实例 id、antd / emotion 运行时 class，不应成为 Zone Tab
  if (/^u_[A-Za-z0-9]+$/.test(name)) return true
  if (name.startsWith('ant-')) return true
  if (name.startsWith('css-')) return true
  return false
}

/**
 * CSS Module 运行时名 → 短名（不依赖 Babel 打标）。
 * 前缀须含 `_`（编码后的文件路径），避免把手写的 `block--modifier` / `.aiChat-inputArea` 截断。
 */
function heuristicShortName(runtimeClass: string): string {
  // `--` 优先：pages_Foo__module__less--foo-bar 的源码类名是 foo-bar 而非 bar
  const ddIdx = runtimeClass.lastIndexOf('--')
  if (ddIdx > 0 && runtimeClass.slice(0, ddIdx).includes('_')) {
    return runtimeClass.slice(ddIdx + 2)
  }
  const dashIdx = runtimeClass.lastIndexOf('-')
  if (dashIdx > 0 && runtimeClass.slice(0, dashIdx).includes('_')) {
    return runtimeClass.slice(dashIdx + 1)
  }
  return runtimeClass
}

/** 从元素及祖先的 classList 收集短 class 名，用于 CSS Module 还原 */
export function collectKnownShortNames(el: Element): Set<string> {
  const names = new Set<string>()
  let cur: Element | null = el
  while (cur) {
    for (const runtime of Array.from(cur.classList || [])) {
      if (isZoneTabNoiseClass(runtime)) continue
      // 只收短名：把运行时哈希名也放进来会让 demangleClassName 自匹配，还原不掉哈希
      names.add(heuristicShortName(runtime))
    }
    cur = cur.parentElement
  }
  return names
}

/** 当前元素自身 class（过滤噪音、还原短名），用于过滤祖先 CSS Module 路径 */
function collectElementSubjectClasses(el: Element, knownShortNames: Set<string>): Set<string> {
  const names = new Set<string>()
  for (const runtime of Array.from(el.classList || [])) {
    if (isZoneTabNoiseClass(runtime)) continue
    const short = demangleClassName(runtime, knownShortNames)
    if (isZoneTabNoiseClass(short)) continue
    names.add(short)
  }
  return names
}

function extractClassTokens(selectorPart: string): string[] {
  return (selectorPart.match(/\.([a-zA-Z_][a-zA-Z0-9_-]*)/g) || []).map((s) => s.slice(1))
}

/**
 * 是否保留为 Zone Tab：
 * 选择器中至少有一个 class 属于当前元素自身 classList。
 * 这样会丢掉 `.rich-input_xxx textarea` 这类只命中祖先模块类的路径。
 */
function isSubjectZoneSelector(demangled: string, subjectOnEl: Set<string>): boolean {
  if (!subjectOnEl.size) return true
  const classes = extractClassTokens(demangled)
  if (!classes.length) return false
  return classes.some(
    (c) =>
      subjectOnEl.has(c) ||
      [...subjectOnEl].some(
        (a) => classMatchesShortName(c, a) || c === a || c.startsWith(a + '_')
      )
  )
}

/**
 * 末段 class 都属于当前元素自身时，收成主体选择器。
 * `.rich-input_xxx .aiChat-inputArea` → `.aiChat-inputArea`
 */
function collapseToSubjectIfOwn(demangled: string, subjectOnEl: Set<string>): string {
  const parts = demangled.trim().split(/\s+/)
  if (parts.length < 2) return demangled
  const last = parts[parts.length - 1]
  const lastClasses = extractClassTokens(last)
  if (!lastClasses.length) return demangled
  const allOwn = lastClasses.every(
    (c) =>
      subjectOnEl.has(c) ||
      [...subjectOnEl].some((a) => classMatchesShortName(c, a) || c === a)
  )
  return allOwn ? last : demangled
}

/**
 * `.agent-dropdown-trigger.dataset-selector` → [`.agent-dropdown-trigger`, `.dataset-selector`]
 * 同一节点上的多个 class 必须各自成为 Zone Tab，不能收成一个复合选择器。
 */
function splitCompoundLastSegment(sel: string): string[] {
  const parts = sel.trim().split(/\s+/).filter(Boolean)
  const last = parts[parts.length - 1] || ''
  if (/:{1,2}[a-zA-Z\-]+(?:\([^)]*\))?$/.test(last)) return [sel]
  const classes = extractClassTokens(last)
  if (classes.length <= 1) return [sel]
  const prefix = parts.slice(0, -1).join(' ')
  return classes.map((c) => (prefix ? `${prefix} .${c}` : `.${c}`))
}

function lastSingleClassName(sel: string): string {
  const last = sel.trim().split(/\s+/).pop() || ''
  const base = last.replace(/:{1,2}[a-zA-Z\-]+(?:\([^)]*\))?$/g, '')
  const tokens = extractClassTokens(base.startsWith('.') ? base : `.${base}`)
  return tokens.length === 1 ? tokens[0] : ''
}

function pushUniqueSelector(result: string[], seen: Set<string>, sel: string) {
  for (const item of splitCompoundLastSegment(sel)) {
    if (seen.has(item)) continue
    seen.add(item)
    result.push(item)
  }
}

function supplementClassListSelectors(
  result: string[],
  seen: Set<string>,
  el: Element,
  knownShortNames: Set<string>
) {
  for (const runtime of Array.from(el.classList || [])) {
    if (isZoneTabNoiseClass(runtime)) continue
    const short = demangleClassName(runtime, knownShortNames)
    if (isZoneTabNoiseClass(short)) continue
    const already = result.some(
      (s) => lastSingleClassName(s) === short || lastSingleClassName(s) === runtime
    )
    if (already) continue
    pushUniqueSelector(result, seen, `.${short}`)
  }
}

/**
 * 当前节点上应各自成为 Zone Tab 的 class 选择器。
 * 同一 span 写 `className="agent-dropdown-trigger dataset-selector"` 必须得到两条，
 * 不能依赖 CSSOM 是否命中、也不能拼成复合选择器。
 */
export function collectSubjectClassSelectors(el: Element): string[] {
  if (!el) return []
  const result: string[] = []
  const seen = new Set<string>()
  supplementClassListSelectors(result, seen, el, collectKnownShortNames(el))
  return result
}

function demangleClassName(runtimeClass: string, knownShortNames: Set<string>): string {
  for (const sn of knownShortNames) {
    // 短名集合可能仍含运行时名自身（如 rich-input_u9Ux8 这类还原不掉的形态），
    // 自匹配会让哈希名原样返回，最终写进 Less 变成永远匹配不到元素的脏规则
    if (sn === runtimeClass) continue
    if (classMatchesShortName(runtimeClass, sn)) return sn
    // css-loader 常见 shortName_hash（如 rich-input_u9Ux8 → rich-input）
    if (
      runtimeClass.startsWith(sn + '_') &&
      /^[a-zA-Z0-9]+$/.test(runtimeClass.slice(sn.length + 1))
    ) {
      return sn
    }
  }
  // pages_Foo_less-shortName / foo--bar（前缀须含 _，避免 .aiChat-inputArea → inputArea）
  return heuristicShortName(runtimeClass)
}

function demangleSelector(runtimeSel: string, knownShortNames: Set<string>): string {
  return runtimeSel.replace(/\.([a-zA-Z_][a-zA-Z0-9_-]*)/g, (_, name: string) => {
    return '.' + demangleClassName(name, knownShortNames)
  })
}

/**
 * CSSOM 算不出时的兜底：当前节点 classList；
 * 纯标签节点则用祖先 classList + tagName（如 .textTitle span）。
 */
export function fallbackZoneSelectorsFromClassnames(el: Element): string[] {
  const self = collectSubjectClassSelectors(el)
  if (self.length) return self

  const tag = el.tagName?.toLowerCase?.()
  if (!tag || tag === 'div') return []

  let cur = el.parentElement
  while (cur) {
    const parentSels = collectSubjectClassSelectors(cur)
    if (parentSels.length) {
      return [`${parentSels.join('')} ${tag}`]
    }
    cur = cur.parentElement
  }
  return []
}

/**
 * 从组件样式表 + Element.matches 反推当前元素的基础选择器（无伪类、无 comId 前缀）。
 * 例：运行时 `:where(.u_xxx) .pages_Foo_less-statIcon` → `.statIcon`
 */
export function buildZoneSelectorsFromCssom(el: Element, comId: string): string[] {
  if (!el || !comId) return []

  const knownShortNames = collectKnownShortNames(el)
  const subjectOnEl = collectElementSubjectClasses(el, knownShortNames)
  const result: string[] = []
  const seen = new Set<string>()

  const root = getDocument()
  const styleEls = Array.from((root as any).querySelectorAll?.('style') || []) as HTMLStyleElement[]

  for (const styleEl of styleEls) {
    let rules: CSSRuleList | null = null
    try {
      rules = styleEl.sheet?.cssRules ?? null
    } catch {
      continue
    }
    if (!rules) continue

    for (const rule of Array.from(rules)) {
      const selectorText = (rule as CSSStyleRule).selectorText
      if (!selectorText || !selectorText.includes(comId)) continue

      forEachSelectorPart(selectorText, (part) => {
        const withoutScope = stripComIdScope(part, comId)
        if (!withoutScope) return

        const baseRuntime = stripTrailingPseudos(withoutScope)
        if (!baseRuntime) return

        try {
          if (!el.matches(baseRuntime)) return
        } catch {
          return
        }

        const demangled = demangleSelector(baseRuntime, knownShortNames).trim()
        // 过滤裸标签 / 通配等噪音，保留带 class 或后代路径的选择器
        if (!demangled || (!demangled.includes('.') && !/\s/.test(demangled))) return

        // 丢掉仅命中祖先 CSS Module（如 .rich-input_xxx textarea）的路径
        if (!isSubjectZoneSelector(demangled, subjectOnEl)) return

        const finalSel = collapseToSubjectIfOwn(demangled, subjectOnEl)
        pushUniqueSelector(result, seen, finalSel)
      })
    }
  }

  supplementClassListSelectors(result, seen, el, knownShortNames)

  return result
}
