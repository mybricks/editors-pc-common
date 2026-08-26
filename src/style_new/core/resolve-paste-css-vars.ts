/**
 * 粘贴样式时处理 CSS 变量：
 * - 灵创已有该变量 → 保留 `var(--xxx, fallback)`
 * - 不存在 → 去掉 var，只留 fallback（如 `#326BFB`）
 * - 不存在且无 fallback → 返回 null（跳过该声明）
 */

import { findCssVarReferences, lookupCssVar } from './css-var'

/** 判断灵创侧是否已有该 CSS 变量（主题包 / AI 页面变量 / DOM 计算样式） */
export function hasCssVariable(varName: string, scopeEl?: Element | null): boolean {
  const name = (varName || '').trim()
  if (!name.startsWith('--')) return false
  return lookupCssVar(name, scopeEl, () => true) != null
}

/**
 * 解析单个样式值中的 var()。
 * @returns 处理后的值；无法处理（缺失变量且无 fallback）时返回 null
 */
export function resolvePasteCssVarValue(
  value: string,
  scopeEl?: Element | null
): string | null {
  if (typeof value !== 'string' || !/\bvar\(\s*--/i.test(value)) return value

  const references = findCssVarReferences(value)
  if (references.length === 0) return null

  let result = ''
  let cursor = 0
  for (const reference of references) {
    result += value.slice(cursor, reference.start)
    // 已有变量：整段 var(...) 原样保留
    if (hasCssVariable(reference.varName, scopeEl)) {
      result += reference.expression
      cursor = reference.end
      continue
    }

    // 不存在且无兜底：跳过整条声明
    if (!reference.fallback) return null

    const fallback = resolvePasteCssVarValue(reference.fallback, scopeEl)
    if (!fallback) return null
    result += fallback
    cursor = reference.end
  }
  result += value.slice(cursor)

  return result.trim()
}

/** 对粘贴得到的样式对象做变量归一化；无法解析的属性丢弃 */
export function normalizePastedStyleVars(
  style: Record<string, any>,
  scopeEl?: Element | null
): Record<string, any> {
  const out: Record<string, any> = {}
  for (const [key, raw] of Object.entries(style || {})) {
    if (typeof raw !== 'string') {
      out[key] = raw
      continue
    }
    const resolved = resolvePasteCssVarValue(raw, scopeEl)
    if (resolved === null) continue
    out[key] = resolved
  }
  return out
}
