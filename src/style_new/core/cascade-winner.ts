// @ts-ignore
import { compare } from 'specificity'

import { getDocument } from './dom'
import { calculateSafeSpecificity } from './selector-utils'

export type CascadeMode = 'default' | 'hover'

const INTERACTIVE_PSEUDO_RE =
  /:(hover|focus-within|focus-visible|focus|active|visited|checked|disabled|indeterminate|placeholder-shown|target|enabled|read-only|read-write)\b/i
const HOVER_TAIL_RE = /:hover\s*$/i

function hyphenToCamel(hyphen: string): string {
  return hyphen.replace(/-([a-z])/g, (_, c: string) => c.toUpperCase())
}

function extractPropValue(rule: CSSStyleRule, hyphen: string): string {
  let propVal = rule.style.getPropertyValue(hyphen)
  // 部分环境下 getPropertyValue 为空，但 CSSStyleDeclaration 驼峰字段仍有指定值
  if (!propVal) {
    propVal = (rule.style as any)[hyphenToCamel(hyphen)] || ''
  }
  if (!propVal && hyphen.startsWith('background-')) {
    const bgShorthand = rule.style.getPropertyValue('background')
    if (bgShorthand) {
      // 含 var() 的 background 简写 longhand 为空；gradient/url 视为 image
      const isImageLike =
        /gradient\s*\(/i.test(bgShorthand) || /url\s*\(/i.test(bgShorthand)
      if (hyphen === 'background-image') {
        // background: color → image 隐式为 none；background: gradient/url → IS image
        propVal = isImageLike ? bgShorthand : 'none'
      } else if (hyphen === 'background-color') {
        // background: color → this IS the color；background: gradient/url → no explicit color
        // Chrome 可能以完整 canonical 形式返回 shorthand（如 'rgb(22,119,255) none 0%...'），
        // 尝试用 rgba?\([^)]+\)|#[0-9a-f]{3,8} 提取首个颜色令牌
        if (!isImageLike) {
          const colorMatch = bgShorthand.match(/^(rgba?\([^)]+\)|#[0-9a-f]{3,8}|hsla?\([^)]+\))/)
          propVal = colorMatch ? colorMatch[1] : bgShorthand
        }
      }
    }
  }
  // 'initial'/'unset'/'revert' 对 background-image 语义等同于 'none'
  // Chrome 对 `background: #1677ff` 的 getPropertyValue('background-image') 返回 'initial'，
  // 需归一化，否则后续 fallback 条件 backgroundImage === 'none' 无法命中。
  if (hyphen === 'background-image' && propVal && /^(initial|unset|revert)$/i.test(propVal.trim())) {
    propVal = 'none'
  }
  return propVal
}

export type CascadeWinnerDetail = {
  value: string
  spec: any
  important: boolean
}

/**
 * 扫描 styleSheets，按 CSS 级联（!important → 特指度 → 源码顺序）找出属性胜出详情。
 * - default：匹配 element，跳过交互伪类规则
 * - hover：仅匹配以 :hover 结尾且 element 匹配基础选择器的规则
 */
export function findCascadeWinnerDetail(
  element: HTMLElement,
  hyphen: string,
  mode: CascadeMode = 'default'
): CascadeWinnerDetail | null {
  let winnerValue: string | null = null
  let winnerSpec: any = null
  let winnerImportant = false
  try {
    const root = getDocument()
    for (const sheet of Array.from(root.styleSheets)) {
      try {
        for (const rule of Array.from(sheet.cssRules || [])) {
          if (!(rule instanceof CSSStyleRule)) continue

          if (mode === 'hover') {
            if (!HOVER_TAIL_RE.test(rule.selectorText)) continue
            const ruleBase = rule.selectorText.replace(HOVER_TAIL_RE, '').trim()
            try {
              if (!ruleBase || !element.matches(ruleBase)) continue
            } catch {
              continue
            }
          } else {
            let matches = false
            try {
              matches = element.matches(rule.selectorText)
            } catch {
              continue
            }
            if (!matches) continue
            // 跳过含交互态伪类的规则（:hover/:focus/:active 等）。
            // 原因：点击元素时 element.matches(':hover') = true，导致 hover 规则以 !important 赢得级联，
            // 默认态面板错误回显 hover 颜色。交互态规则只应在对应 pseudo tab 下生效。
            if (INTERACTIVE_PSEUDO_RE.test(rule.selectorText)) continue
          }

          const propVal = extractPropValue(rule, hyphen)
          if (!propVal) continue

          const isImportant =
            rule.style.getPropertyPriority(hyphen) === 'important' ||
            rule.style.getPropertyPriority('background') === 'important'
          // calculate 不支持逗号合并选择器，需走 calculateSafeSpecificity
          const ruleSpec = calculateSafeSpecificity(rule.selectorText, element)
          if (!ruleSpec) continue

          if (winnerSpec === null) {
            winnerSpec = ruleSpec
            winnerValue = propVal
            winnerImportant = isImportant
          } else if (winnerImportant && !isImportant) {
            // 当前胜者是 !important，新规则不是 → 保持
          } else if (!winnerImportant && isImportant) {
            winnerSpec = ruleSpec
            winnerValue = propVal
            winnerImportant = true
          } else if (compare(ruleSpec, winnerSpec) >= 0) {
            winnerSpec = ruleSpec
            winnerValue = propVal
            winnerImportant = isImportant
          }
        }
      } catch {}
    }
  } catch {}
  return winnerValue && winnerSpec
    ? { value: winnerValue, spec: winnerSpec, important: winnerImportant }
    : null
}

/**
 * 扫描 styleSheets，按 CSS 级联（!important → 特指度 → 源码顺序）找出属性胜出值。
 * - default：匹配 element，跳过交互伪类规则
 * - hover：仅匹配以 :hover 结尾且 element 匹配基础选择器的规则
 */
export function findCascadeWinner(
  element: HTMLElement,
  hyphen: string,
  mode: CascadeMode = 'default'
): string | null {
  return findCascadeWinnerDetail(element, hyphen, mode)?.value ?? null
}

function getOwnDeclaringBest(
  rules: CSSStyleRule[],
  element: HTMLElement | null,
  hyphen: string
): { value: string; spec: any } | null {
  let best: { value: string; spec: any } | null = null
  for (const rule of rules) {
    const propVal = extractPropValue(rule, hyphen)
    if (!propVal) continue
    const spec = calculateSafeSpecificity(rule.selectorText, element)
    if (!spec) continue
    if (!best || compare(spec, best.spec) >= 0) {
      best = { value: propVal, spec }
    }
  }
  return best
}

/** 当前 zone 自身规则里，声明了指定属性的最高特指度（用于避免同特指度兄弟 zone 串色） */
export function getOwnDeclaringMaxSpec(
  rules: CSSStyleRule[],
  element: HTMLElement | null,
  hyphen: string
): any | null {
  return getOwnDeclaringBest(rules, element, hyphen)?.spec ?? null
}

/** 当前 zone 自身规则里，指定属性的声明值（最高特指度；同特指度取后写） */
export function getOwnDeclaringValue(
  rules: CSSStyleRule[],
  element: HTMLElement | null,
  hyphen: string
): string | null {
  return getOwnDeclaringBest(rules, element, hyphen)?.value ?? null
}
