// @ts-ignore
import { calculate, compare } from 'specificity'

/**
 * 按顶层逗号拆分 selectorText（忽略 :not(a, b) 等括号内的逗号）。
 * CSSOM 对多选择器规则返回逗号拼接的单一 selectorText，手写解析前必须先拆分。
 *
 * 业务侧请优先用 forEachSelectorPart / someSelectorPart，避免自行拆分+循环。
 */
export function splitTopLevelSelectors(selectorText: string): string[] {
  const parts: string[] = []
  let depth = 0
  let start = 0
  for (let i = 0; i < selectorText.length; i++) {
    const ch = selectorText[i]
    if (ch === '(') depth++
    else if (ch === ')') depth--
    else if (ch === ',' && depth === 0) {
      parts.push(selectorText.slice(start, i).trim())
      start = i + 1
    }
  }
  parts.push(selectorText.slice(start).trim())
  return parts.filter(Boolean)
}

/** 遍历逗号合并选择器的每个顶层分支 */
export function forEachSelectorPart(
  selectorText: string,
  fn: (part: string) => void
): void {
  for (const part of splitTopLevelSelectors(selectorText)) {
    fn(part)
  }
}

/** 逗号合并选择器任一顶层分支满足谓词即为 true */
export function someSelectorPart(
  selectorText: string,
  pred: (part: string) => boolean
): boolean {
  return splitTopLevelSelectors(selectorText).some(pred)
}

/** 过滤逗号合并选择器的顶层分支 */
export function filterSelectorParts(
  selectorText: string,
  pred: (part: string) => boolean
): string[] {
  return splitTopLevelSelectors(selectorText).filter(pred)
}

/** 单分支：精确等于 target，或带祖先作用域后缀（"… target"） */
export function partEqualsOrEndsWith(part: string, target: string): boolean {
  return part === target || part.endsWith(' ' + target)
}

/** 逗号列表中是否存在精确/作用域命中 target 的分支 */
export function somePartEqualsOrEndsWith(selectorText: string, target: string): boolean {
  return someSelectorPart(selectorText, (part) => partEqualsOrEndsWith(part, target))
}

/**
 * 安全计算选择器特指度。
 * specificity.calculate 不支持逗号合并选择器（会抛 SyntaxError），
 * 这里先按顶层逗号拆分再计算。
 *
 * - 有 element 时：取命中该元素的分支中特指度最高者（级联语义）
 * - 无 element 时：取所有分支中特指度最高者（排序用）
 */
export function calculateSafeSpecificity(
  selectorText: string,
  element?: HTMLElement | null
): ReturnType<typeof calculate> | null {
  const parts = splitTopLevelSelectors(selectorText)
  if (parts.length === 0) return null

  let best: ReturnType<typeof calculate> | null = null
  for (const part of parts) {
    if (element) {
      try {
        if (!element.matches(part)) continue
      } catch {
        continue
      }
    }
    let spec: ReturnType<typeof calculate>
    try {
      spec = calculate(part)
    } catch {
      continue
    }
    if (!best || compare(spec, best) > 0) {
      best = spec
    }
  }

  // element 存在但没有任何分支 matches（极少见）时，退回「无 element」策略
  if (!best && element) {
    return calculateSafeSpecificity(selectorText, null)
  }
  return best
}
