import {
  declarationAffectsProperty,
  normalizeCssProperty,
} from './property-registry'

export type StyleDeclarationCandidate = {
  authoredProperty: string
  value: string
  important: boolean
  declarationOrder: number
}

const CSS_WIDE_BACKGROUND_IMAGE_RE = /^(initial|unset|revert)$/i
const BACKGROUND_IMAGE_RE = /(?:gradient|url|image-set|cross-fade|element)\s*\(/i
const COLOR_TOKEN_RE = /^(rgba?\([^)]+\)|hsla?\([^)]+\)|#[0-9a-f]{3,8}\b|[a-z-]+\b)/i

function createProbeStyle(): CSSStyleDeclaration | null {
  try {
    return document.createElement('div').style
  } catch {
    return null
  }
}

function readExpandedValue(
  authoredProperty: string,
  authoredValue: string,
  property: string,
  important: boolean
): string {
  if (authoredProperty === property) return authoredValue

  const probe = createProbeStyle()
  if (probe) {
    try {
      probe.setProperty(authoredProperty, authoredValue, important ? 'important' : '')
      const expanded = probe.getPropertyValue(property).trim()
      if (expanded) {
        if (property === 'background-image' && CSS_WIDE_BACKGROUND_IMAGE_RE.test(expanded)) {
          return 'none'
        }
        return expanded
      }
    } catch {}
  }

  // 含 var() 的 background 在部分浏览器中无法通过 CSSOM 展开，保留旧回显语义。
  if (authoredProperty === 'background') {
    if (property === 'background-image') {
      return BACKGROUND_IMAGE_RE.test(authoredValue) ? authoredValue : 'none'
    }
    if (property === 'background-color' && !BACKGROUND_IMAGE_RE.test(authoredValue)) {
      const color = authoredValue.match(COLOR_TOKEN_RE)
      return color ? color[1] : authoredValue
    }
  }

  // 对无法展开的变量简写，保留变量引用，优于静默丢失声明。
  return /var\s*\(/i.test(authoredValue) ? authoredValue : ''
}

/** 读取一条 CSSStyleDeclaration 中会影响目标 longhand 的原始声明。 */
export function readStyleDeclarationCandidates(
  style: CSSStyleDeclaration,
  property: string
): StyleDeclarationCandidate[] {
  const target = normalizeCssProperty(property)
  const result: StyleDeclarationCandidate[] = []
  const seen = new Set<string>()

  for (let index = 0; index < style.length; index++) {
    const authoredProperty = normalizeCssProperty(style[index] || style.item(index))
    if (!authoredProperty || seen.has(authoredProperty)) continue
    seen.add(authoredProperty)
    if (!declarationAffectsProperty(authoredProperty, target)) continue

    const authoredValue = style.getPropertyValue(authoredProperty).trim()
    if (!authoredValue) continue
    const important = style.getPropertyPriority(authoredProperty) === 'important'
    const value = readExpandedValue(authoredProperty, authoredValue, target, important)
    if (!value) continue
    result.push({ authoredProperty, value, important, declarationOrder: index })
  }

  // 兼容精简 CSSStyleDeclaration mock：没有 length，但能直接读取属性。
  if (result.length === 0 && !seen.has(target)) {
    const value = style.getPropertyValue(target).trim()
    if (value) {
      result.push({
        authoredProperty: target,
        value,
        important: style.getPropertyPriority(target) === 'important',
        declarationOrder: 0,
      })
    }
  }

  return result
}
