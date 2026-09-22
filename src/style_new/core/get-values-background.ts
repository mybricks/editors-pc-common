/**
 * 处理 background 规则的源码回读。
 *
 * Chromium 在解析包含 var() 的 background 简写时，CSSStyleRule.style
 * 可能把 shorthand 和相关 longhand 序列化为空字符串。这里从拥有该规则的
 * style 标签中读取原始 CSS，再将 background 拆成 getValues 使用的字段，
 * 同时保留 background-image 中的 var() 表达式。
 */

import { parseToStyleData } from './css-code-codec'

/** 需要回填到样式结果中的 background longhand 属性。 */
const BACKGROUND_EXPORT_PROPS = [
  'background-image',
  'background-position',
  'background-position-x',
  'background-position-y',
  'background-size',
  'background-repeat',
  'background-attachment',
  'background-origin',
  'background-color',
] as const

/** getValues 使用的可变样式结果对象。 */
type ValuesAccumulator = Record<string, any>

/**
 * 获取 CSSRule 所属 style 标签的原始文本。
 *
 * 普通规则可以直接从 parentStyleSheet.ownerNode 取得 style 标签；
 * 如果规则位于 @media 等嵌套容器中，则沿 ownerRule 向上查找样式表。
 */
function getSourceStyleText(rule: CSSStyleRule): string {
  let sheet = (rule.parentStyleSheet as any) || null
  while (sheet && !sheet.ownerNode && sheet.ownerRule) {
    sheet = sheet.ownerRule.parentStyleSheet || sheet.ownerRule
  }

  const ownerNode = sheet?.ownerNode
  if (!ownerNode || String(ownerNode.nodeName || '').toLowerCase() !== 'style') {
    return ''
  }
  return String(ownerNode.textContent || '')
}

/**
 * 去掉 CSSOM 为标识符补充的转义。
 *
 * 例如 CSS 源码里的 `.foo_bar` 可能通过 rule.selectorText 读成
 * `.foo\_bar`，两者在 CSS 语义上相同，但不能直接做字符串匹配。
 */
function unescapeSelectorIdentifiers(selector: string): string {
  return selector.replace(/\\([_a-zA-Z0-9-])/g, '$1')
}

/**
 * 将属性选择器中的值统一成指定引号形式。
 *
 * CSSOM 和 style 标签可能分别使用单引号、双引号，例如：
 * `[data-desn-page="/"]` 与 `[data-desn-page='/']`。
 */
function normalizeSelectorAttributeQuotes(selector: string, quote: '"' | "'"): string {
  return selector.replace(
    /\[\s*([^\]=\s]+)\s*=\s*(['"])([^'"\\]*(?:\\.[^'"\\]*)*)\2\s*\]/g,
    (_match, attribute, _sourceQuote, value) => `[${attribute}=${quote}${value}${quote}]`
  )
}

/**
 * 构造 selector 的兼容变体。
 *
 * 只要 CSSOM 转义形式或属性引号形式存在一种差异，就使用对应变体匹配
 * style 标签文本；Set 用于避免同一个变体被重复扫描。
 */
function getSelectorCandidates(selector: string): string[] {
  const identifierVariants = Array.from(new Set([
    selector,
    unescapeSelectorIdentifiers(selector),
  ]))

  return Array.from(new Set(
    identifierVariants.flatMap((variant) => [
      variant,
      normalizeSelectorAttributeQuotes(variant, "'"),
      normalizeSelectorAttributeQuotes(variant, '"'),
    ])
  ))
}

/**
 * 从 style 标签文本中找到当前规则的 background 声明。
 *
 * selector 会先转义成正则字面量，空白则放宽为任意连续空白，以兼容压缩
 * CSS、格式化 CSS 以及 CSSOM 与源码之间的细微格式差异。
 */
function getRawBackgroundDeclarations(rule: CSSStyleRule): Record<string, string>[] {
  const sourceText = getSourceStyleText(rule)
  if (!sourceText) return []

  const selector = (rule.selectorText || '').trim()
  if (!selector) return []

  const declarations: Record<string, string>[] = []
  const selectorCandidates = getSelectorCandidates(selector)

  selectorCandidates.forEach((candidate) => {
    const escapedSelector = candidate
      .replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
      .replace(/\s+/g, '\\s+')
    const blockPattern = new RegExp(`${escapedSelector}\\s*\\{([\\s\\S]*?)\\}`, 'g')
    let match: RegExpExecArray | null

    while ((match = blockPattern.exec(sourceText))) {
      // parseToStyleData 只处理声明体，因此把匹配到的规则 body 传入解析器。
      // 末尾没有分号时补一个，兼容压缩 CSS 中最后一条声明省略分号的写法。
      const declarationBody = match[1].trim()
      const parsed = parseToStyleData(
        declarationBody && !/;\s*$/.test(declarationBody)
          ? `${declarationBody};`
          : declarationBody,
        selector
      )
      const background = Object.keys(parsed).reduce<Record<string, string>>((result, key) => {
        const kebab = key.replace(/[A-Z]/g, (char) => `-${char.toLowerCase()}`)
        if (
          BACKGROUND_EXPORT_PROPS.includes(kebab as typeof BACKGROUND_EXPORT_PROPS[number]) ||
          key === 'background'
        ) {
          // 源码值需要保留 var()，只去除 CSS 声明末尾的 !important。
          result[kebab] = String(parsed[key]).replace(/\s*!important\s*$/i, '').trim()
        }
        return result
      }, {})

      if (Object.keys(background).length > 0) declarations.push(background)
    }
  })

  return declarations
}

/**
 * 读取 CSSStyleDeclaration 的属性值。
 *
 * 优先使用 CSSOM 标准 API，属性 API 作为部分浏览器的兼容兜底。
 */
function readStyleValue(style: CSSStyleDeclaration | undefined, property: string): string {
  if (!style) return ''
  try {
    return String(style.getPropertyValue(property) || (style as any)[property] || '').trim()
  } catch {
    return ''
  }
}

/** 判断元素是否有 background 相关的内联声明。 */
function hasInlineBackgroundDeclaration(element?: HTMLElement | null): boolean {
  if (!element) return false
  const inlineText = element.getAttribute('style') || element.style.cssText || ''
  return /(?:^|;)\s*background(?:-(?:image|color|position|position-x|position-y|size|repeat|attachment|origin))?\s*:/i.test(inlineText)
}

/**
 * 判断 computed style 中是否存在实际生效的背景。
 *
 * 没有实际背景时不触发源码回读，避免把无效规则或默认值误认为用户声明。
 */
function hasMeaningfulComputedBackground(computedValues?: CSSStyleDeclaration): boolean {
  if (!computedValues) return false
  const image = readStyleValue(computedValues, 'background-image')
  const color = readStyleValue(computedValues, 'background-color')
  return (
    (!!image && !/^(none|initial|unset|revert)$/i.test(image)) ||
    (!!color && !/^(transparent|rgba?\(\s*0\s*,\s*0\s*,\s*0\s*(?:,\s*0)?\s*\))$/i.test(color))
  )
}

/**
 * 从 background 原始值中提取 image 函数。
 *
 * 不能直接按逗号切分，因为 gradient 和 var() 本身都可能包含嵌套括号；
 * 这里按括号深度扫描，保留完整的 gradient/url 表达式和其中的 var()。
 */
function extractImageFunctions(value: string): string {
  const matches: string[] = []
  const pattern = /(?:-webkit-)?(?:image-set|linear-gradient|radial-gradient|conic-gradient|repeating-linear-gradient|repeating-radial-gradient|repeating-conic-gradient|url)\s*\(/gi
  let match: RegExpExecArray | null

  while ((match = pattern.exec(value))) {
    const open = value.indexOf('(', match.index)
    let depth = 1
    let quote = ''
    let escaped = false
    let close = -1

    for (let i = open + 1; i < value.length; i += 1) {
      const char = value[i]
      if (quote) {
        if (escaped) escaped = false
        else if (char === '\\') escaped = true
        else if (char === quote) quote = ''
        continue
      }
      if (char === '"' || char === "'") {
        quote = char
      } else if (char === '(') {
        depth += 1
      } else if (char === ')' && --depth === 0) {
        close = i
        break
      }
    }

    if (close !== -1) {
      matches.push(value.slice(match.index, close + 1).trim())
      pattern.lastIndex = close + 1
    }
  }

  return matches.join(', ')
}

/**
 * 用 transparent 临时替换 var()，仅用于让浏览器展开 background 的其他 longhand。
 * background-image 会在后面直接使用源码表达式，因此不会丢失变量绑定。
 */
function replaceCssVarsForProbe(value: string): string {
  let result = ''
  let index = 0

  while (index < value.length) {
    if (!/^var\(/i.test(value.slice(index))) {
      result += value[index]
      index += 1
      continue
    }

    let depth = 1
    let quote = ''
    let escaped = false
    let end = index + 4
    for (; end < value.length; end += 1) {
      const char = value[end]
      if (quote) {
        if (escaped) escaped = false
        else if (char === '\\') escaped = true
        else if (char === quote) quote = ''
        continue
      }
      if (char === '"' || char === "'") quote = char
      else if (char === '(') depth += 1
      else if (char === ')' && --depth === 0) break
    }

    result += 'transparent'
    index = end < value.length ? end + 1 : value.length
  }

  return result
}

/**
 * 按规则源码恢复 background 的原始表达式。
 *
 * 只有在 computed style 确实有背景、规则不是内联样式、源码包含 var() 时才恢复，
 * 避免覆盖正常的 CSSOM 读取结果。渐变场景需要保留完整的 image 表达式；
 * 单独的 `background: var(--color)` 则按 background-color 回填变量引用。
 */
function recoverBackgroundFromSource(
  rule: CSSStyleRule,
  computedValues?: CSSStyleDeclaration,
  element?: HTMLElement | null,
): Record<string, string> {
  if (!computedValues || hasInlineBackgroundDeclaration(element)) return {}
  if (!hasMeaningfulComputedBackground(computedValues)) return {}

  const declarations = getRawBackgroundDeclarations(rule)
  const rawValues = declarations.flatMap((declaration) => Object.values(declaration))
  if (!rawValues.some((value) => /gradient\s*\(/i.test(value)) && !rawValues.some((value) => /var\s*\(/i.test(value))) return {}

  const recovered: Record<string, string> = {}
  declarations.forEach((declaration) => {
    Object.entries(declaration).forEach(([property, value]) => {
      if (property === 'background' || property === 'background-position') {
        // `background: var(--color)` 在 CSSOM 中可能已经被解析成具体颜色，
        // 这里直接按 backgroundColor 回填源码表达式，保留变量绑定。
        if (property === 'background' && /^var\s*\(/i.test(value.trim())) {
          recovered['background-color'] = value
          return
        }

        // 临时 style 只负责把 shorthand 拆成长写；var() 已被替换为合法占位值。
        const probe = typeof document !== 'undefined' ? document.createElement('div').style : null
        if (probe) {
          probe.cssText = `${property}: ${replaceCssVarsForProbe(value)}`
          BACKGROUND_EXPORT_PROPS.forEach((prop) => {
            const parsed = readStyleValue(probe, prop)
            if (parsed) recovered[prop] = parsed
          })
        }

        // background-image 必须使用源码中的完整函数，保留 var() 绑定。
        if (property === 'background') {
          const image = extractImageFunctions(value)
          if (image) recovered['background-image'] = image
        }
        return
      }

      recovered[property] = value
    })
  })

  return recovered
}

/**
 * 将恢复出的 CSS 属性写入 getValues 的驼峰结果对象。
 * background-position-x/y 没有完整 position 时，会合并成 position 供面板使用。
 */
export function applyRecoveredBackground(
  rule: CSSStyleRule,
  acc: ValuesAccumulator,
  computedValues?: CSSStyleDeclaration,
  element?: HTMLElement | null,
) {
  const recovered = recoverBackgroundFromSource(rule, computedValues, element)
  const keyMap: Record<string, string> = {
    'background-image': 'backgroundImage',
    'background-position': 'backgroundPosition',
    'background-position-x': 'backgroundPositionX',
    'background-position-y': 'backgroundPositionY',
    'background-size': 'backgroundSize',
    'background-repeat': 'backgroundRepeat',
    'background-attachment': 'backgroundAttachment',
    'background-origin': 'backgroundOrigin',
    'background-color': 'backgroundColor',
  }

  Object.entries(recovered).forEach(([property, value]) => {
    const key = keyMap[property]
    if (key) acc[key] = value
  })

  if (!acc.backgroundPosition && (acc.backgroundPositionX || acc.backgroundPositionY)) {
    acc.backgroundPosition = [acc.backgroundPositionX, acc.backgroundPositionY]
      .filter(Boolean)
      .join(' ')
  }
}
