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

/** 从元素及祖先收集源码短 class 名（data-zone-classnames / data-loc.cn） */
export function collectKnownShortNames(el: Element): Set<string> {
  const names = new Set<string>()
  let cur: Element | null = el
  while (cur) {
    const zone = cur.getAttribute('data-zone-classnames')
    if (zone) {
      zone.split(/[,\s]+/).filter(Boolean).forEach((n) => names.add(n))
    }
    try {
      const loc = JSON.parse(cur.getAttribute('data-loc') || '{}')
      if (Array.isArray(loc?.cn)) {
        loc.cn.forEach((n: string) => names.add(n))
      }
    } catch {
      /* ignore */
    }
    cur = cur.parentElement
  }
  return names
}

function demangleClassName(runtimeClass: string, knownShortNames: Set<string>): string {
  for (const sn of knownShortNames) {
    if (classMatchesShortName(runtimeClass, sn)) return sn
    // css-loader 常见 shortName_hash（如 rich-input_u9Ux8 → rich-input）
    if (
      runtimeClass.startsWith(sn + '_') &&
      /^[a-zA-Z0-9]+$/.test(runtimeClass.slice(sn.length + 1))
    ) {
      return sn
    }
  }
  // pages_Foo_less-shortName（前缀须含 _，避免 .aiChat-inputArea → inputArea）
  const dashIdx = runtimeClass.lastIndexOf('-')
  if (dashIdx > 0 && runtimeClass.slice(0, dashIdx).includes('_')) {
    return runtimeClass.slice(dashIdx + 1)
  }
  const ddIdx = runtimeClass.lastIndexOf('--')
  if (ddIdx > 0) {
    return runtimeClass.slice(ddIdx + 2)
  }
  return runtimeClass
}

function demangleSelector(runtimeSel: string, knownShortNames: Set<string>): string {
  return runtimeSel.replace(/\.([a-zA-Z_][a-zA-Z0-9_-]*)/g, (_, name: string) => {
    return '.' + demangleClassName(name, knownShortNames)
  })
}

/**
 * CSSOM 算不出时的兜底：用 data-zone-classnames / data-loc.cn，
 * 纯标签节点则用祖先 class + tagName（如 .textTitle span）。
 * 不读取 data-zone-selector。
 */
export function fallbackZoneSelectorsFromClassnames(el: Element): string[] {
  const selfZone = (el.getAttribute('data-zone-classnames') || '')
    .split(/[,\s]+/)
    .filter(Boolean)
  if (selfZone.length) {
    return [selfZone.map((c) => `.${c}`).join('')]
  }
  try {
    const cn = JSON.parse(el.getAttribute('data-loc') || '{}')?.cn
    if (Array.isArray(cn) && cn.length) {
      return [cn.map((c: string) => `.${c}`).join('')]
    }
  } catch {
    /* ignore */
  }

  const tag = el.tagName?.toLowerCase?.()
  if (!tag || tag === 'div') return []

  let cur = el.parentElement
  while (cur) {
    const zone = (cur.getAttribute('data-zone-classnames') || '')
      .split(/[,\s]+/)
      .filter(Boolean)
    if (zone.length) {
      return [`${zone.map((c) => `.${c}`).join('')} ${tag}`]
    }
    try {
      const cn = JSON.parse(cur.getAttribute('data-loc') || '{}')?.cn
      if (Array.isArray(cn) && cn.length) {
        return [`${cn.map((c: string) => `.${c}`).join('')} ${tag}`]
      }
    } catch {
      /* ignore */
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
        if (seen.has(demangled)) return
        seen.add(demangled)
        result.push(demangled)
      })
    }
  }

  return result
}
