/**
 * 将 CSS 变量解析为具体的不透明度值（opacity 编辑器使用）。
 * opacity 的 CSS 值为 0~1 的无单位小数，与长度/颜色变量共用底层解析逻辑，
 * 仅替换值合法性判定。
 */
import {
  collectCssVarOptions,
  lookupCssVar,
  resolveCssVar,
} from './css-var'
import type { CssVarOption } from './css-var'

export type CssVarOpacityOption = CssVarOption

/** 是否是合法的 opacity 值：0~1 之间的无单位小数 */
export function isOpacityValue(value: string): boolean {
  if (typeof value !== 'string') return false
  const trimmed = value.trim()
  if (!trimmed) return false
  // 必须是纯数字（无单位），拒绝 "0.5px"、"50%" 等
  if (!/^(?:\d+\.?\d*|\.\d+)$/.test(trimmed)) return false
  const n = parseFloat(trimmed)
  return !isNaN(n) && n >= 0 && n <= 1
}

/** 按 AICOM → 主题包 → DOM 查找变量对应的 opacity 值 */
export function lookupCssVarOpacity(
  varName: string,
  scopeEl?: Element | null
): string | null {
  return lookupCssVar(varName, scopeEl, isOpacityValue)
}

/** 读取画布节点当前生效、且可用于 opacity 编辑的 CSS 自定义属性 */
export function getCssVarOpacityOptions(scopeEl?: Element | null): CssVarOpacityOption[] {
  return collectCssVarOptions(scopeEl, isOpacityValue)
}

/** var(--opacity-dim) → 0.5；解析不到时返回 null */
export function resolveCssVarOpacity(
  value: string,
  scopeEl?: Element | null
): string | null {
  return resolveCssVar(value, scopeEl, isOpacityValue)
}

/** 将 0~1 的 opacity 值格式化为整数百分比文案（如 "50"） */
export function formatOpacityDisplay(resolvedValue: string | null): string | undefined {
  if (!resolvedValue) return undefined
  const n = parseFloat(resolvedValue)
  if (isNaN(n)) return undefined
  return String(Math.round(n * 100))
}
