/**
 * 将 CSS 变量色值解析为可展示的具体颜色。
 * 查找顺序：AICOM 主题变量 → 主题包 → DOM computed → var() fallback。
 */
import ColorUtil from 'color'

export interface ParsedCssVar {
  varName: string
  fallback: string | null
}

/** 括号深度感知拆出 var(--name) / var(--name, fallback) */
export function parseCssVar(value: string): ParsedCssVar | null {
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  if (!/^var\(\s*--/i.test(trimmed)) return null

  const contentStart = trimmed.indexOf('(') + 1
  let depth = 1
  let end = contentStart
  for (; end < trimmed.length && depth > 0; end++) {
    if (trimmed[end] === '(') depth++
    else if (trimmed[end] === ')') depth--
  }
  if (depth !== 0) return null
  // 允许尾部空白，但不接受 var() 后再拼其它内容（整段必须是单个 var）
  if (trimmed.slice(end).trim() !== '') return null

  const content = trimmed.slice(contentStart, end - 1)
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

function isParseableColor(value: string): boolean {
  try {
    new ColorUtil(value)
    return true
  } catch {
    return false
  }
}

function lookupAicomColor(varName: string): string | null {
  const list = (typeof window !== 'undefined' &&
    (window as any).MYBRICKS_AICOM_THEME_VARIABLES) as any[] | undefined
  if (!Array.isArray(list)) return null
  const item = list.find((v) => v?.propertyName === varName)
  const color = typeof item?.value === 'string' ? item.value.trim() : ''
  return color && isParseableColor(color) ? color : null
}

function lookupThemePackageColor(varName: string): string | null {
  const themeVars = (typeof window !== 'undefined' &&
    (window as any).MYBRICKS_THEME_PACKAGE_VARIABLES?.variables) as any[] | undefined
  if (!Array.isArray(themeVars)) return null
  for (const variable of themeVars) {
    for (const config of variable?.configs || []) {
      if (config?.key === varName) {
        const color = typeof config?.value === 'string' ? config.value.trim() : ''
        if (color && isParseableColor(color)) return color
      }
    }
  }
  return null
}

function lookupDomCssVarColor(
  varName: string,
  scopeEl?: Element | null
): string | null {
  try {
    if (typeof document === 'undefined' || typeof getComputedStyle !== 'function') {
      return null
    }
    const candidates: Element[] = []
    if (scopeEl) candidates.push(scopeEl)
    if (document.documentElement) candidates.push(document.documentElement)
    if (document.body) candidates.push(document.body)
    const rootDiv = document.querySelector('#root > div')
    if (rootDiv) candidates.push(rootDiv)

    for (const el of candidates) {
      const val = getComputedStyle(el).getPropertyValue(varName).trim()
      if (val && isParseableColor(val)) return val
    }
  } catch {
    // ignore
  }
  return null
}

/** 按 AICOM → 主题包 → DOM 查找变量对应色值 */
export function lookupCssVarColor(
  varName: string,
  scopeEl?: Element | null
): string | null {
  const name = (varName || '').trim()
  if (!name.startsWith('--')) return null
  return (
    lookupAicomColor(name) ||
    lookupThemePackageColor(name) ||
    lookupDomCssVarColor(name, scopeEl)
  )
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
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  if (!trimmed) return null

  if (!trimmed.toLowerCase().startsWith('var(')) {
    return isParseableColor(trimmed) ? trimmed : null
  }

  const parsed = parseCssVar(trimmed)
  if (!parsed) return null

  const lookedUp = lookupCssVarColor(parsed.varName, scopeEl)
  if (lookedUp) return lookedUp

  if (parsed.fallback) {
    return resolveCssVarColor(parsed.fallback, scopeEl)
  }

  return null
}
