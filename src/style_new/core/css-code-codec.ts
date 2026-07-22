// @ts-ignore
import { toJSON } from 'cssjson'

export interface StyleData {
  styleKey: string
  value: string | number | boolean
}

/** 序列化到代码编辑器时跳过的无意义值（避免 UA 默认值淹没编辑区） */
const CSS_CODE_TRIVIAL_VALUES = new Set([
  'none',
  'normal',
  'auto',
  'initial',
  'unset',
  'revert',
  'default',
  'transparent',
  'rgba(0, 0, 0, 0)',
  'rgba(0,0,0,0)',
  // 常见 UA 默认关键字
  'static',
  'visible',
  'repeat',
  'inherit',
  'left top',
  '0% 0%',
  'start',
])

/** 值为零（含各种单位）时视为无意义 */
const ZERO_VALUE_RE = /^0(px|em|rem|%|vh|vw|vmin|vmax|pt|cm|mm|in|ex|ch|fr|deg|rad|turn|s|ms)?$/

/** opacity 为 1 也是默认值 */
const TRIVIAL_NUMERIC_MAP: Record<string, string | number> = {
  opacity: 1,
}

/**
 * 按属性名定义的 UA/CSS 默认值。
 * 这些值本身不是全局 trivial（例如 "block" 在其他属性上有意义），
 * 但对于特定属性而言等同于默认值，不应回显到 CSS 编辑器。
 */
const CSS_CODE_TRIVIAL_VALUE_BY_PROP: Record<string, Set<string>> = {
  display: new Set(['block', 'inline']),
  flexDirection: new Set(['row']),
  flexWrap: new Set(['nowrap']),
  boxSizing: new Set(['content-box']),
  textAlign: new Set(['start', 'left']),
  verticalAlign: new Set(['baseline']),
  wordBreak: new Set(['normal']),
  overflowWrap: new Set(['normal']),
  whiteSpace: new Set(['normal']),
  float: new Set(['none']),
  clear: new Set(['none']),
  cursor: new Set(['auto']),
  pointerEvents: new Set(['auto']),
  tableLayout: new Set(['auto']),
  unicodeBidi: new Set(['normal']),
  direction: new Set(['ltr']),
  writingMode: new Set(['horizontal-tb']),
}

/**
 * 将驼峰写法改成xx-xx的css命名写法
 * @param styleKey
 */
export function toLine(styleKey: string) {
  return styleKey.replace(/([A-Z])/g, '-$1').toLowerCase()
}

export function toHump(name: String) {
  return name.replace(/\-(\w)/g, (all, letter) => {
    return letter.toUpperCase()
  })
}

function isTrivialCssValue(value: unknown, key?: string): boolean {
  if (value === undefined || value === null || value === '') return true
  const strVal = typeof value === 'string' ? value.trim() : String(value)
  if (CSS_CODE_TRIVIAL_VALUES.has(strVal)) return true
  // 零值（0px / 0em / 0 等）
  if (ZERO_VALUE_RE.test(strVal)) return true
  // 属性级别的默认数值（如 opacity: 1）
  if (key && key in TRIVIAL_NUMERIC_MAP && String(TRIVIAL_NUMERIC_MAP[key]) === strVal) return true
  // 属性特定的 UA 默认值（如 display: block、flex-direction: row）
  if (key && CSS_CODE_TRIVIAL_VALUE_BY_PROP[key]?.has(strVal)) return true
  return false
}

/** 过滤掉空值 / trivial 值，供代码编辑回显使用 */
export function filterStyleForCssCode(styleData: Record<string, any> | null | undefined): Record<string, any> {
  const result: Record<string, any> = {}
  if (!styleData || typeof styleData !== 'object') return result
  for (const key of Object.keys(styleData)) {
    const value = styleData[key]
    if (isTrivialCssValue(value, key)) continue
    // 跳过非字符串/数字的复杂结构（对象、函数等）
    if (typeof value === 'object') continue
    result[key] = value
  }

  // border-*-color 后置过滤：
  // 当某边没有可见边框（无宽度 / 宽度为 0 / style 为 none/hidden）时，
  // CSSOM 会将 currentColor 计算值填入对应的 border-*-color，这属于噪音。
  const BORDER_SIDES = ['Top', 'Bottom', 'Left', 'Right'] as const
  for (const side of BORDER_SIDES) {
    const colorKey = `border${side}Color`
    if (!(colorKey in result)) continue
    const widthVal = String(styleData[`border${side}Width`] ?? '').trim()
    const styleVal = String(styleData[`border${side}Style`] ?? '').trim()
    const hasVisibleWidth = widthVal && !ZERO_VALUE_RE.test(widthVal)
    const hasVisibleStyle =
      styleVal &&
      styleVal !== 'none' &&
      styleVal !== 'hidden' &&
      styleVal !== 'initial' &&
      styleVal !== 'unset' &&
      styleVal !== 'auto'
    if (!hasVisibleWidth || !hasVisibleStyle) {
      delete result[colorKey]
    }
  }

  return result
}

/**
 * 从可能是 zone 引擎格式的 selector 中提取适合展示的 CSS 选择器。
 * 例：[data-zone-selector='[".a",".b"]'] → .b
 */
export function resolveDisplaySelector(selector: string | undefined | null): string {
  if (!selector || typeof selector !== 'string') return 'div'
  const zoneArrayMatch = selector.match(/\[data-zone-selector=['"]?(\[[^\]]*\])['"]?\]/)
  if (zoneArrayMatch) {
    try {
      const selectors: string[] = JSON.parse(zoneArrayMatch[1])
      if (Array.isArray(selectors) && selectors.length > 0) {
        return selectors[selectors.length - 1] || 'div'
      }
    } catch {}
  }
  return selector
}

/**
 * 将样式对象序列化为标准 CSS 规则块（含选择器/花括号），
 * 便于直接使用 Monaco 内置 CSS 语言服务（校验/补全/hover）。
 */
export function parseToCssCode(styleData: Record<string, any> | StyleData, selector?: string) {
  const filtered = filterStyleForCssCode(styleData as Record<string, any>)
  const lines: string[] = []
  for (const styleKey in filtered) {
    lines.push(`  ${toLine(styleKey)}: ${filtered[styleKey]};`)
  }
  const displaySel = selector ? resolveDisplaySelector(selector) : 'element'
  return `${displaySel} {\n${lines.join('\n')}\n}`
}

function pickAttributesFromCssJson(cssJson: any, selector: string): Record<string, any> | undefined {
  const children = cssJson?.children
  if (!children || typeof children !== 'object') return undefined

  const displaySelector = resolveDisplaySelector(selector)
  if (children[displaySelector]?.attributes) {
    return children[displaySelector].attributes
  }
  if (selector && children[selector]?.attributes) {
    return children[selector].attributes
  }

  // 兜底：只有一个规则块时直接取它的 attributes（避免 selector 格式细微差异导致空回显）
  const keys = Object.keys(children)
  if (keys.length === 1 && children[keys[0]]?.attributes) {
    return children[keys[0]].attributes
  }

  // 再兜底：找 attributes 非空的第一个规则
  for (const key of keys) {
    const attrs = children[key]?.attributes
    if (attrs && typeof attrs === 'object' && Object.keys(attrs).length > 0) {
      return attrs
    }
  }

  return undefined
}

export function parseToStyleData(cssCode: string, selector: string) {
  const styleData: Record<string, any> = {}
  try {
    const trimmed = (cssCode || '').trim()
    if (!trimmed) return styleData

    // 纯属性声明（无花括号）时包一层选择器再交给 cssjson；完整规则块则兼容旧格式
    let codeForParse = trimmed
    if (!trimmed.includes('{')) {
      const displaySelector = resolveDisplaySelector(selector)
      codeForParse = `${displaySelector} {\n${trimmed}\n}`
    } else if (!trimmed.endsWith('}')) {
      codeForParse = trimmed + '}' // 包bug
    }

    const cssJson = toJSON(codeForParse)
    const cssJsonData = pickAttributesFromCssJson(cssJson, selector)
    for (const key in cssJsonData || {}) {
      styleData[toHump(key)] = cssJsonData![key]
    }
  } catch (e: any) {
    console.error(e.message)
  }

  return styleData
}

/** 对比 baseline 与下一份样式，生成 applyStyleChange 所需的变更列表 */
export function diffStyleData(
  baseline: Record<string, any>,
  next: Record<string, any>
): Array<{ key: string; value: any }> {
  const changes: Array<{ key: string; value: any }> = []
  const baselineKeys = new Set(Object.keys(baseline || {}))
  const nextKeys = new Set(Object.keys(next || {}))

  nextKeys.forEach((key) => {
    const nextVal = next[key]
    const prevVal = baseline[key]
    if (String(prevVal ?? '') !== String(nextVal ?? '')) {
      changes.push({ key, value: nextVal })
    }
  })

  baselineKeys.forEach((key) => {
    if (!nextKeys.has(key)) {
      changes.push({ key, value: null })
    }
  })

  return changes
}
