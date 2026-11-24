import { cssPropertyName, resolveEffectiveStyleSource } from './style-property'
import type { StyleResolution } from './style-property'
import { getShorthandFamily } from './style-shorthand-groups'
import type { StyleWriteTarget } from './style-write-target'

// 不从 apply-style-change 复用常量：该模块会 import 本文件，反向引入会形成循环依赖。
const IMPORTANT_SUFFIX = /\s*!important\s*$/i
const INLINE_SELECTOR = 'inline'

/**
 * 该属性当前生效的声明是否带 !important。
 * 口径与写入选址一致：只统计当前状态的候选（常规态 / 伪类 Tab 各自判断）；
 * 简写按成员展开，写 border 时任一 border-color 重要即整条重要。
 * 内联 !important 无法被样式表覆盖，不跟着提升，避免写出无用的优先级。
 */
export function hasEffectiveImportant(
  resolution: Pick<StyleResolution, 'get'>,
  key: string
): boolean {
  const important = (name: string) => {
    const { candidates } = resolution.get(name)
    const winner = resolveEffectiveStyleSource(candidates.filter(candidate => candidate.currentState))
    return !!winner?.important && !winner.inline
  }
  return getShorthandFamily(cssPropertyName(key)).some(important)
}

/**
 * 写入前的最后一道加工：当前生效声明重要时，新值保持同等优先级。
 * 三种情况原样返回：空值、已带 !important、落点无法承载优先级
 * （JSX inline 写不了 !important；host-fallback 可能是 inline，本次不支持）。
 */
export function preserveWriteImportant(
  resolution: Pick<StyleResolution, 'get'>,
  key: string,
  value: unknown,
  target: Pick<StyleWriteTarget, 'selector' | 'source'> | null | undefined
): unknown {
  if (value == null) return value
  // 与 preserveCascadePriority 一致：只处理可拼接的 CSS 值，其余类型原样交给后续链路。
  if (typeof value !== 'string' && typeof value !== 'number') return value
  if (IMPORTANT_SUFFIX.test(String(value))) return value
  if (!target?.selector || target.selector === INLINE_SELECTOR) return value
  if (target.source === 'host-fallback') return value
  return hasEffectiveImportant(resolution, key) ? `${value} !important` : value
}
