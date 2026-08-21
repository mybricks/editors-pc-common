/**
 * 将 CSS 变量解析为具体长度值（尺寸/间距/圆角类编辑器使用）。
 * 与颜色变量共用 css-var 的查找与作用域逻辑，只替换值合法性判定。
 */
import {
  collectCssVarOptions,
  lookupCssVar,
  resolveCssVar,
} from './css-var'
import type { CssVarOption } from './css-var'

export type CssVarLengthOption = CssVarOption

const LENGTH_RE =
  /^-?(?:\d+\.?\d*|\.\d+)(?:px|rem|em|%|vw|vh|vmin|vmax|svw|svh|dvw|dvh|lvw|lvh|pt|pc|cm|mm|in|q|ch|ex|cap|lh|rlh)$/i

/**
 * 是否可作为长度使用。
 *
 * 必须带单位：画布上存在大量裸数字变量（层级、字重、透明度等），
 * 放行 `1` / `500` 会让尺寸变量列表被污染。
 */
export function isLengthValue(value: string): boolean {
  if (typeof value !== 'string') return false
  const trimmed = value.trim()
  if (!trimmed) return false
  if (LENGTH_RE.test(trimmed)) return true
  // calc(100% - 16px) 这类表达式交给浏览器判定
  if (/^(?:calc|min|max|clamp)\(/i.test(trimmed)) {
    return typeof CSS !== 'undefined' && !!CSS.supports?.('width', trimmed)
  }
  return false
}

/** 按 AICOM → 主题包 → DOM 查找变量对应长度 */
export function lookupCssVarLength(
  varName: string,
  scopeEl?: Element | null
): string | null {
  return lookupCssVar(varName, scopeEl, isLengthValue)
}

/** 读取画布节点当前生效、且可用于尺寸编辑的 CSS 自定义属性。 */
export function getCssVarLengthOptions(scopeEl?: Element | null): CssVarLengthOption[] {
  return collectCssVarOptions(scopeEl, isLengthValue)
}

/** var(--spacing-lg) → 24px；解析不到时返回 null */
export function resolveCssVarLength(
  value: string,
  scopeEl?: Element | null
): string | null {
  return resolveCssVar(value, scopeEl, isLengthValue)
}
