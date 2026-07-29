import { classMatchesShortName } from './css-modules-match'

function getChildIndex(element: Element): number {
  const parent = element.parentElement
  if (!parent) return 1
  return Array.from(parent.children).indexOf(element) + 1
}

function appendNthChild(selector: string, index: number): string {
  const pseudoMatch = selector.match(/(:{1,2}[a-zA-Z\-]+(?:\([^)]*\))?\s*)$/)
  if (pseudoMatch) {
    const insertAt = selector.lastIndexOf(pseudoMatch[1])
    return `${selector.slice(0, insertAt)}:nth-child(${index})${selector.slice(insertAt)}`
  }
  return `${selector}:nth-child(${index})`
}

function getZoneClassSelector(element: Element): string | null {
  const classNames = (element.getAttribute('data-zone-classnames') || '')
    .split(/\s+/)
    .filter(Boolean)
  return classNames.length ? classNames.map((className) => `.${className}`).join('') : null
}

function getRuntimeZoneClassSelector(element: Element): string | null {
  const classNames = (element.getAttribute('data-zone-classnames') || '')
    .split(/\s+/)
    .filter(Boolean)
  const runtimeClasses = Array.from(element.classList)
  const matchedClasses = classNames
    .map((className) => runtimeClasses.find((runtimeClass) => classMatchesShortName(runtimeClass, className)))
    .filter((className): className is string => !!className)

  return matchedClasses.length ? matchedClasses.map((className) => `.${className}`).join('') : null
}

function getRuntimeSelector(element: Element, sourceSelector: string): string {
  const runtimeClasses = Array.from(element.classList)
  return sourceSelector.replace(/\.([a-zA-Z_][a-zA-Z0-9_-]*)/g, (classToken, className) => {
    const runtimeClass = runtimeClasses.find((candidate) => classMatchesShortName(candidate, className))
    return runtimeClass ? `.${runtimeClass}` : classToken
  })
}

function normalizeSelector(selector: string): string {
  return selector.replace(/\s+/g, ' ').trim()
}

function findMatchingSoloRule(root: Document | ShadowRoot, selector: string): CSSStyleRule | null {
  const expectedSelector = normalizeSelector(selector)
  const inspectRules = (rules: CSSRuleList | CSSRule[] | undefined | null): CSSStyleRule | null => {
    if (!rules) return null
    for (const rule of Array.from(rules)) {
      // CSSMediaRule 等分组规则也可能包含用户写入的单独样式。
      const nestedRules = (rule as any).cssRules as CSSRuleList | undefined
      const nestedMatch = nestedRules ? inspectRules(nestedRules) : null
      if (nestedMatch) return nestedMatch

      const selectorText = (rule as CSSStyleRule).selectorText
      if (!selectorText) continue
      const matches = selectorText.split(',').some((part) => {
        const normalized = normalizeSelector(part)
        return normalized === expectedSelector || normalized.endsWith(` ${expectedSelector}`)
      })
      if (matches) return rule as CSSStyleRule
    }
    return null
  }

  for (const sheet of Array.from(root.styleSheets)) {
    try {
      const match = inspectRules(sheet.cssRules || sheet.rules)
      if (match) return match
    } catch {
      // 跨域样式表无法读取，跳过即可。
    }
  }
  return null
}

/**
 * 用源码中的 data-zone-classnames 构造单独编辑选择器。
 *
 * 不使用编辑器注入的匿名 div：它们不会存在于写回后的页面源码中。
 * 例如：.section:nth-child(8) .cardGrid:nth-child(2)
 *       .testCard:nth-child(3) .testCardExpect:nth-child(2)
 */
export const buildSoloSelector = (
  targetDom: Element,
  baseSelector: string,
  componentRoot?: Element | null,
): string => {
  const baseTail = baseSelector.trim().split(/\s+/).pop() || baseSelector
  const segments: string[] = []
  let current: Element | null = targetDom

  while (current && current !== componentRoot) {
    const zoneClassSelector = getZoneClassSelector(current)
    if (zoneClassSelector) {
      const selector = current === targetDom ? baseTail : zoneClassSelector
      segments.unshift(appendNthChild(selector, getChildIndex(current)))
    }
    current = current.parentElement
  }

  // 未标记区域沿用原 selector，保证第三方元素等既有场景不退化。
  return segments.length ? segments.join(' ') : appendNthChild(baseTail, getChildIndex(targetDom))
}

/**
 * 已保存的单独规则在运行时会经过 CSS Modules 编译；用 DOM 上的实际类名构造同一路径，
 * 再从 CSSOM 中精确比对，避免把普通批量规则误识别为单独编辑规则。
 */
function getRuntimeSoloSelector(
  targetDom: Element,
  baseSelector: string,
  componentRoot?: Element | null,
): string | null {
  const baseTail = baseSelector.trim().split(/\s+/).pop() || baseSelector
  const segments: string[] = []
  let current: Element | null = targetDom

  while (current && current !== componentRoot) {
    const zoneClassSelector = getRuntimeZoneClassSelector(current)
    if (zoneClassSelector) {
      const selector = current === targetDom
        ? getRuntimeSelector(current, baseTail)
        : zoneClassSelector
      segments.unshift(appendNthChild(selector, getChildIndex(current)))
    }
    current = current.parentElement
  }

  return segments.length ? segments.join(' ') : null
}

export const getSavedSoloStyleBody = (
  targetDom: Element,
  baseSelector: string,
  componentRoot?: Element | null,
  root: Document | ShadowRoot = document,
): string | null => {
  const runtimeSelector = getRuntimeSoloSelector(targetDom, baseSelector, componentRoot)
  const rule = runtimeSelector ? findMatchingSoloRule(root, runtimeSelector) : null
  return rule?.style.length ? rule.style.cssText : null
}

export const hasSavedSoloStyle = (
  targetDom: Element,
  baseSelector: string,
  componentRoot?: Element | null,
  root: Document | ShadowRoot = document,
): boolean => {
  return getSavedSoloStyleBody(targetDom, baseSelector, componentRoot, root) !== null
}
