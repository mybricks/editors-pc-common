import { classMatchesShortName } from './css-modules-match'
import { splitTopLevelSelectors } from './selector-utils'

function getChildIndex(element: Element): number {
  const parent = element.parentElement
  if (!parent) return 1
  return Array.from(parent.children).indexOf(element) + 1
}

function isOnlyChild(element: Element): boolean {
  return element.parentElement?.children.length === 1
}

function appendNthChild(selector: string, index: number): string {
  const pseudoMatch = selector.match(/(:{1,2}[a-zA-Z\-]+(?:\([^)]*\))?\s*)$/)
  if (pseudoMatch) {
    const insertAt = selector.lastIndexOf(pseudoMatch[1])
    return `${selector.slice(0, insertAt)}:nth-child(${index})${selector.slice(insertAt)}`
  }
  return `${selector}:nth-child(${index})`
}

function omitTopLevelFirstChild(segments: string[]): string[] {
  // 顶层运行时常混入编辑器容器等非源码兄弟节点；顶层的第一个节点无需参与页面内定位。
  return segments[0]?.includes(':nth-child(1)') ? segments.slice(1) : segments
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

function isRelevantSoloSelector(expectedSelector: string, candidateSelector: string): boolean {
  if (
    candidateSelector === expectedSelector ||
    candidateSelector.endsWith(` ${expectedSelector}`)
  ) {
    return true
  }

  if (!candidateSelector.includes(':nth-child(')) return false

  const expectedSegments = expectedSelector.split(' ')
  const tailSegments = expectedSegments.slice(-2)
  const targetTail = expectedSegments[expectedSegments.length - 1]

  // 短规则必须包含当前选中元素本身：父级单独的 nth-child 规则不能让子元素进入单独编辑。
  return candidateSelector === targetTail || candidateSelector === tailSegments.join(' ')
}

type MatchedSoloRule = {
  rule: CSSStyleRule
  selector: string
}

export type SavedSoloRule = {
  body: string
  selector: string
}

export type SavedSoloStyle = SavedSoloRule & {
  rules: SavedSoloRule[]
}

function findMatchingSoloRules(root: Document | ShadowRoot, selector: string): MatchedSoloRule[] {
  const expectedSelector = normalizeSelector(selector)
  const matches: MatchedSoloRule[] = []
  const inspectRules = (rules: CSSRuleList | CSSRule[] | undefined | null): void => {
    if (!rules) return
    for (const rule of Array.from(rules)) {
      // CSSMediaRule 等分组规则也可能包含用户写入的单独样式。
      const nestedRules = (rule as any).cssRules as CSSRuleList | undefined
      if (nestedRules) inspectRules(nestedRules)

      const selectorText = (rule as CSSStyleRule).selectorText
      if (!selectorText) continue
      const matchedSelector = splitTopLevelSelectors(selectorText).find((part) => {
        const normalized = normalizeSelector(part)
        return isRelevantSoloSelector(expectedSelector, normalized)
      })
      if (matchedSelector) {
        matches.push({ rule: rule as CSSStyleRule, selector: normalizeSelector(matchedSelector) })
      }
    }
  }

  for (const sheet of Array.from(root.styleSheets)) {
    try {
      inspectRules(sheet.cssRules || sheet.rules)
    } catch {
      // 跨域样式表无法读取，跳过即可。
    }
  }
  return matches
}

function resolveSourceSelector(
  sourceSelector: string,
  runtimeSelector: string,
  matchedRuntimeSelector: string,
): string {
  const normalizedRuntimeSelector = normalizeSelector(runtimeSelector)
  const runtimeSegments = normalizedRuntimeSelector.split(' ')
  const matchedSegments = matchedRuntimeSelector.split(' ')
  const sourceSegments = normalizeSelector(sourceSelector).split(' ')
  const lastRelevantStart = runtimeSegments.length - matchedSegments.length
  let matchedStartIndex = -1

  for (let start = Math.max(0, runtimeSegments.length - 2); start <= lastRelevantStart; start += 1) {
    if (runtimeSegments.slice(start, start + matchedSegments.length).join(' ') === matchedRuntimeSelector) {
      matchedStartIndex = start
      break
    }
  }

  if (matchedStartIndex < 0) {
    return sourceSelector
  }

  return sourceSegments.slice(matchedStartIndex, matchedStartIndex + matchedSegments.length).join(' ')
}

function findTargetTailNthRules(
  root: Document | ShadowRoot,
  targetDom: Element,
  baseSelector: string,
): MatchedSoloRule[] {
  const baseTail = baseSelector.trim().split(/\s+/).pop() || baseSelector
  const matches: MatchedSoloRule[] = []
  const inspectRules = (rules: CSSRuleList | CSSRule[] | undefined | null): void => {
    if (!rules) return
    for (const rule of Array.from(rules)) {
      const nestedRules = (rule as any).cssRules as CSSRuleList | undefined
      if (nestedRules) inspectRules(nestedRules)

      const selectorText = (rule as CSSStyleRule).selectorText
      if (!selectorText) continue
      const matchedSelector = splitTopLevelSelectors(selectorText).find((part) => {
        const lastSegment = part.trim().split(/\s+/).pop() || ''
        if (!lastSegment.includes(':nth-child(')) return false
        try {
          return targetDom.matches(part)
        } catch {
          return false
        }
      })
      if (matchedSelector) {
        matches.push({
          rule: rule as CSSStyleRule,
          selector: appendNthChild(baseTail, getChildIndex(targetDom)),
        })
      }
    }
  }

  for (const sheet of Array.from(root.styleSheets)) {
    try {
      inspectRules(sheet.cssRules || sheet.rules)
    } catch {
      // 跨域样式表无法读取，跳过即可。
    }
  }
  return matches
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
      if (current === targetDom && isOnlyChild(current)) {
        // 末级仍需保留基础 selector；唯一子节点不需要 nth-child(1) 区分。
        segments.unshift(selector)
      } else if (!isOnlyChild(current)) {
        segments.unshift(appendNthChild(selector, getChildIndex(current)))
      }
    }
    current = current.parentElement
  }

  // 未标记区域沿用原 selector，保证第三方元素等既有场景不退化。
  const filteredSegments = omitTopLevelFirstChild(segments)
  return filteredSegments.length ? filteredSegments.join(' ') : baseTail
}

/**
 * 已保存的单独规则在运行时会经过 CSS Modules 编译；优先匹配完整路径。
 * 短规则直接通过 DOM 匹配 CSSOM，只接受末级带 nth-child 的规则。
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
      if (current === targetDom && isOnlyChild(current)) {
        segments.unshift(selector)
      } else if (!isOnlyChild(current)) {
        segments.unshift(appendNthChild(selector, getChildIndex(current)))
      }
    }
    current = current.parentElement
  }

  const filteredSegments = omitTopLevelFirstChild(segments)
  return filteredSegments.length
    ? filteredSegments.join(' ')
    : getRuntimeSelector(targetDom, baseTail)
}

export const getSavedSoloStyle = (
  targetDom: Element,
  baseSelector: string,
  componentRoot?: Element | null,
  root: Document | ShadowRoot = document,
): SavedSoloStyle | null => {
  const sourceSelector = buildSoloSelector(targetDom, baseSelector, componentRoot)
  const runtimeSelector = getRuntimeSoloSelector(targetDom, baseSelector, componentRoot)
  const matchedRules = runtimeSelector ? findMatchingSoloRules(root, runtimeSelector) : []
  const targetTailRules = matchedRules.length
    ? []
    : findTargetTailNthRules(root, targetDom, baseSelector)
  const rawSavedRules = (matchedRules.length ? matchedRules : targetTailRules)
    .filter(({ rule }) => rule.style.length > 0)
    .map(({ rule, selector }): SavedSoloRule => ({
      body: rule.style.cssText,
      selector: matchedRules.length
        ? resolveSourceSelector(sourceSelector, runtimeSelector!, selector)
        : selector,
    }))
  const savedRulesBySelector = new Map<string, SavedSoloRule>()
  rawSavedRules.forEach((savedRule) => {
    const existingRule = savedRulesBySelector.get(savedRule.selector)
    if (existingRule) {
      existingRule.body = `${existingRule.body};${savedRule.body}`
    } else {
      savedRulesBySelector.set(savedRule.selector, { ...savedRule })
    }
  })
  const savedRules = Array.from(savedRulesBySelector.values())
  const primaryRule = savedRules[0]
  if (!primaryRule) return null
  return {
    ...primaryRule,
    rules: savedRules,
  }
}
