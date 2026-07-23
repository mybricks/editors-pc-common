/**
 * 粘贴样式时处理 CSS 变量：
 * - 灵创已有该变量 → 保留 `var(--xxx, fallback)`
 * - 不存在 → 去掉 var，只留 fallback（如 `#326BFB`）
 * - 不存在且无 fallback → 返回 null（跳过该声明）
 */

function hasThemePackageVariable(varName: string): boolean {
  const themeVars = (window as any).MYBRICKS_THEME_PACKAGE_VARIABLES?.variables
  if (!Array.isArray(themeVars)) return false
  for (const variable of themeVars) {
    for (const config of variable?.configs || []) {
      if (config?.key === varName) return true
    }
  }
  return false
}

function hasAicomVariable(varName: string): boolean {
  const list = (window as any).MYBRICKS_AICOM_THEME_VARIABLES
  if (!Array.isArray(list)) return false
  return list.some((item: any) => item?.propertyName === varName)
}

function hasDomCssVariable(varName: string, scopeEl?: Element | null): boolean {
  try {
    const candidates: Element[] = []
    if (scopeEl) candidates.push(scopeEl)
    if (typeof document !== 'undefined') {
      if (document.documentElement) candidates.push(document.documentElement)
      if (document.body) candidates.push(document.body)
      const rootDiv = document.querySelector('#root > div')
      if (rootDiv) candidates.push(rootDiv)
    }
    for (const el of candidates) {
      const val = getComputedStyle(el).getPropertyValue(varName).trim()
      if (val) return true
    }
  } catch {}
  return false
}

/** 判断灵创侧是否已有该 CSS 变量（主题包 / AI 页面变量 / DOM 计算样式） */
export function hasCssVariable(varName: string, scopeEl?: Element | null): boolean {
  const name = (varName || '').trim()
  if (!name.startsWith('--')) return false
  return (
    hasAicomVariable(name) ||
    hasThemePackageVariable(name) ||
    hasDomCssVariable(name, scopeEl)
  )
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

  let result = ''
  let cursor = 0

  while (cursor < value.length) {
    const varStart = value.slice(cursor).search(/\bvar\(\s*--/i)
    if (varStart === -1) {
      result += value.slice(cursor)
      break
    }

    const start = cursor + varStart
    const contentStart = value.indexOf('(', start) + 1
    let depth = 1
    let end = contentStart
    for (; end < value.length && depth > 0; end++) {
      if (value[end] === '(') depth++
      else if (value[end] === ')') depth--
    }
    if (depth !== 0) return null

    const content = value.slice(contentStart, end - 1)
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

    // 已有变量：整段 var(...) 原样保留
    if (hasCssVariable(varName, scopeEl)) {
      result += value.slice(cursor, end)
      cursor = end
      continue
    }

    // 不存在且无兜底：跳过整条声明
    if (commaIndex === -1) return null

    const fallback = resolvePasteCssVarValue(content.slice(commaIndex + 1).trim(), scopeEl)
    if (!fallback) return null
    result += value.slice(cursor, start) + fallback
    cursor = end
  }

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
