// @ts-ignore
import { calculate, compare } from 'specificity'

import { getDocument } from './dom'

export type CascadeMode = 'default' | 'hover'

const INTERACTIVE_PSEUDO_RE =
  /:(hover|focus-within|focus-visible|focus|active|visited|checked|disabled|indeterminate|placeholder-shown|target|enabled|read-only|read-write)\b/i
const HOVER_TAIL_RE = /:hover\s*$/i

function extractPropValue(rule: CSSStyleRule, hyphen: string): string {
  let propVal = rule.style.getPropertyValue(hyphen)
  if (!propVal && hyphen.startsWith('background-')) {
    const bgShorthand = rule.style.getPropertyValue('background')
    if (bgShorthand) {
      const hasGradient = bgShorthand.includes('gradient')
      if (hyphen === 'background-image') {
        // background: color → image 隐式为 none；background: gradient → gradient IS image
        propVal = hasGradient ? bgShorthand : 'none'
      } else if (hyphen === 'background-color') {
        // background: color → this IS the color；background: gradient → no explicit color
        // Chrome 可能以完整 canonical 形式返回 shorthand（如 'rgb(22,119,255) none 0%...'），
        // 尝试用 rgba?\([^)]+\)|#[0-9a-f]{3,8} 提取首个颜色令牌
        if (!hasGradient) {
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
          let ruleSpec: any
          try {
            ruleSpec = calculate(rule.selectorText)
          } catch {
            continue
          }

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
  return winnerValue
}
