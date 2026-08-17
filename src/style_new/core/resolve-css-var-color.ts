/**
 * 将 CSS 变量色值解析为可展示的具体颜色。
 * 查找顺序：AICOM 主题变量 → 主题包 → DOM computed → var() fallback。
 */
import ColorUtil from 'color'

import {
  collectCssVarOptions,
  lookupCssVar,
  resolveCssVar,
  resolveCssVarsInValue,
} from './css-var'
import type { CssVarOption } from './css-var'

export { parseCssVar } from './css-var'
export type { ParsedCssVar } from './css-var'

export type CssVarColorOption = CssVarOption

function isParseableColor(value: string): boolean {
  try {
    new ColorUtil(value)
    return true
  } catch {
    return false
  }
}

/** 按 AICOM → 主题包 → DOM 查找变量对应色值 */
export function lookupCssVarColor(
  varName: string,
  scopeEl?: Element | null
): string | null {
  return lookupCssVar(varName, scopeEl, isParseableColor)
}

/** 读取画布节点当前生效、且可用于颜色编辑的 CSS 自定义属性。 */
export function getCssVarColorOptions(scopeEl?: Element | null): CssVarColorOption[] {
  return collectCssVarOptions(scopeEl, isParseableColor)
}

/**
 * 将颜色字符串解析为可展示的具体色。
 * - 普通色值：原样返回（可被 ColorUtil 解析时）
 * - var(--x) / var(--x, fallback)：先查变量值，读不到再降级 fallback
 * - 无法解析时返回 null
 */
export function resolveCssVarColor(
  value: string,
  scopeEl?: Element | null
): string | null {
  return resolveCssVar(value, scopeEl, isParseableColor)
}

/**
 * 将 CSS 值中的所有 var(...) 替换为可展示的具体色（用于编辑器色板/渐变预览）。
 * 解析失败的 var() 原样保留。
 */
export function resolveCssVarsInCssValue(
  value: string,
  scopeEl?: Element | null
): string {
  return resolveCssVarsInValue(value, scopeEl, isParseableColor)
}
