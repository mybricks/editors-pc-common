// @ts-ignore
import { compare } from 'specificity'

import type { CascadePriority, CssSpecificity } from './types'

export const ZERO_SPECIFICITY: CssSpecificity = { A: 0, B: 0, C: 0 }

/**
 * 比较两个 author 声明的级联优先级。
 *
 * 返回值大于 0 表示 left 胜出。保持结构化字段而不是把特指度压成十进制，
 * 避免出现 10 个 class 与 1 个 id 之类的进位错误。
 */
export function compareCascadePriority(
  left: CascadePriority,
  right: CascadePriority
): number {
  if (left.important !== right.important) return left.important ? 1 : -1
  if (left.inline !== right.inline) return left.inline ? 1 : -1

  const bySpecificity = compare(left.specificity, right.specificity)
  if (bySpecificity !== 0) return bySpecificity
  return left.sourceOrder - right.sourceOrder
}
