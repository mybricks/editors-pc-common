/**
 * CSS 变量的通用解析层。
 *
 * 颜色、长度等各类变量的差异只有「什么样的值算合法」，因此查找顺序
 * （AICOM 主题变量 → 主题包 → DOM computed）、作用域向上遍历、var() 递归降级
 * 这些逻辑统一放在这里，由调用方传入 isValid 谓词。
 */

import { findCssClosingParenthesis, findCssFunctionCalls } from './css-functions'

export interface ParsedCssVar {
  varName: string
  fallback: string | null
}

export interface CssVarOption {
  name: string
  value: string
}

export interface CssVarReference extends ParsedCssVar {
  expression: string
  start: number
  end: number
}

/** 值合法性校验，如「能解析成颜色」「是带单位的长度」 */
export type CssVarValueValidator = (value: string) => boolean

/** 括号深度感知拆出 var(--name) / var(--name, fallback) */
export function parseCssVar(value: string): ParsedCssVar | null {
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  if (!/^var\(\s*--/i.test(trimmed)) return null

  const openIndex = trimmed.indexOf('(')
  const closeIndex = findCssClosingParenthesis(trimmed, openIndex)
  if (closeIndex === -1) return null
  // 允许尾部空白，但不接受 var() 后再拼其它内容（整段必须是单个 var）
  if (trimmed.slice(closeIndex + 1).trim() !== '') return null

  const content = trimmed.slice(openIndex + 1, closeIndex)
  let commaIndex = -1
  let contentDepth = 0
  for (let i = 0; i < content.length; i++) {
    if (content[i] === '(') contentDepth++
    else if (content[i] === ')') contentDepth--
    else if (content[i] === ',' && contentDepth === 0) {
      commaIndex = i
      break
    }
  }

  const varName = (commaIndex === -1 ? content : content.slice(0, commaIndex)).trim()
  if (!varName.startsWith('--')) return null
  const fallback =
    commaIndex === -1 ? null : content.slice(commaIndex + 1).trim() || null

  return { varName, fallback }
}

/** 提取复合 CSS 值中的完整 var(...) 引用，支持嵌套 fallback。 */
export function findCssVarReferences(value: string): CssVarReference[] {
  return findCssFunctionCalls(value, ['var']).reduce<CssVarReference[]>((result, call) => {
    const parsed = parseCssVar(call.value)
    if (parsed) {
      result.push({
        ...parsed,
        expression: call.value,
        start: call.start,
        end: call.end,
      })
    }
    return result
  }, [])
}

/** 判断纯变量或渐变、阴影等复合值中是否包含合法 CSS 变量引用。 */
export function hasCssVarReference(value: unknown): value is string {
  return typeof value === 'string' && findCssVarReferences(value).length > 0
}

function lookupAicomVar(varName: string, isValid: CssVarValueValidator): string | null {
  const list = (typeof window !== 'undefined' &&
    (window as any).MYBRICKS_AICOM_THEME_VARIABLES) as any[] | undefined
  if (!Array.isArray(list)) return null
  const item = list.find((v) => v?.propertyName === varName)
  const value = typeof item?.value === 'string' ? item.value.trim() : ''
  return value && isValid(value) ? value : null
}

function lookupThemePackageVar(varName: string, isValid: CssVarValueValidator): string | null {
  const themeVars = (typeof window !== 'undefined' &&
    (window as any).MYBRICKS_THEME_PACKAGE_VARIABLES?.variables) as any[] | undefined
  if (!Array.isArray(themeVars)) return null
  for (const variable of themeVars) {
    for (const config of variable?.configs || []) {
      if (config?.key === varName) {
        const value = typeof config?.value === 'string' ? config.value.trim() : ''
        if (value && isValid(value)) return value
      }
    }
  }
  return null
}

function lookupDomCssVar(
  varName: string,
  scopeEl: Element | null | undefined,
  isValid: CssVarValueValidator
): string | null {
  try {
    if (typeof document === 'undefined' || typeof getComputedStyle !== 'function') {
      return null
    }
    const ownerDocument = scopeEl?.ownerDocument || document
    const getStyle = ownerDocument.defaultView?.getComputedStyle || getComputedStyle
    const candidates: Element[] = []
    const seen = new Set<Element>()
    const push = (el?: Element | null) => {
      if (!el || seen.has(el)) return
      seen.add(el)
      candidates.push(el)
    }

    // 从画布节点向上走（含 Shadow host）；自定义属性默认继承
    let el: Element | null = scopeEl || null
    while (el) {
      push(el)
      const parent = el.parentElement
      if (parent) {
        el = parent
        continue
      }
      const root = el.getRootNode?.() as ShadowRoot | Document | null
      el = root && 'host' in root ? root.host : null
    }
    push(ownerDocument.documentElement)
    push(ownerDocument.body)
    push(ownerDocument.querySelector('#root > div'))

    for (const candidate of candidates) {
      const val = getStyle(candidate).getPropertyValue(varName).trim()
      if (val && isValid(val)) return val
    }
  } catch {
    // ignore
  }
  return null
}

/** 按 AICOM → 主题包 → DOM 查找变量对应值 */
export function lookupCssVar(
  varName: string,
  scopeEl: Element | null | undefined,
  isValid: CssVarValueValidator
): string | null {
  const name = (varName || '').trim()
  if (!name.startsWith('--')) return null
  return (
    lookupAicomVar(name, isValid) ||
    lookupThemePackageVar(name, isValid) ||
    lookupDomCssVar(name, scopeEl, isValid)
  )
}

/** 读取画布节点上当前生效、且值通过 isValid 的 CSS 自定义属性。 */
export function collectCssVarOptions(
  scopeEl: Element | null | undefined,
  isValid: CssVarValueValidator
): CssVarOption[] {
  if (typeof document === 'undefined' || typeof getComputedStyle !== 'function' || !scopeEl) {
    return []
  }

  const ownerDocument = scopeEl.ownerDocument || document
  const getStyle = ownerDocument.defaultView?.getComputedStyle || getComputedStyle
  const collectOptions = (element: Element): CssVarOption[] => {
    const computed = getStyle(element)
    const options = new Map<string, CssVarOption>()

    for (let index = 0; index < computed.length; index++) {
      const name = computed[index]
      if (!name?.startsWith('--') || options.has(name)) continue

      const value = computed.getPropertyValue(name).trim()
      if (isValid(value)) {
        options.set(name, { name, value })
      }
    }

    return Array.from(options.values())
  }

  try {
    const scopeOptions = collectOptions(scopeEl)
    if (scopeOptions.length) return scopeOptions

    const pageElement = scopeEl.closest('[data-zone-type="page"]')
    return pageElement && pageElement !== scopeEl ? collectOptions(pageElement) : []
  } catch {
    // ignore unavailable canvas styles
    return []
  }
}

/**
 * 将值解析为具体值。
 * - 普通值：通过 isValid 时原样返回
 * - var(--x) / var(--x, fallback)：先查变量值，读不到再降级 fallback
 * - 无法解析时返回 null
 */
export function resolveCssVar(
  value: string,
  scopeEl: Element | null | undefined,
  isValid: CssVarValueValidator
): string | null {
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  if (!trimmed) return null

  if (!trimmed.toLowerCase().startsWith('var(')) {
    return isValid(trimmed) ? trimmed : null
  }

  const parsed = parseCssVar(trimmed)
  if (!parsed) return null

  const lookedUp = lookupCssVar(parsed.varName, scopeEl, isValid)
  if (lookedUp) return lookedUp

  if (parsed.fallback) {
    return resolveCssVar(parsed.fallback, scopeEl, isValid)
  }

  return null
}

/**
 * 将 CSS 值中的所有 var(...) 替换为解析后的具体值（用于编辑器预览）。
 * 解析失败的 var() 原样保留。
 */
export function resolveCssVarsInValue(
  value: string,
  scopeEl: Element | null | undefined,
  isValid: CssVarValueValidator
): string {
  if (typeof value !== 'string' || !value.includes('var(')) return value

  const references = findCssVarReferences(value)
  if (references.length === 0) return value

  let result = ''
  let cursor = 0
  for (const reference of references) {
    result += value.slice(cursor, reference.start)
    result += resolveCssVar(reference.expression, scopeEl, isValid) ?? reference.expression
    cursor = reference.end
  }
  result += value.slice(cursor)
  return result
}
