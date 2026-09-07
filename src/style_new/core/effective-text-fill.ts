import {
  clipHasText,
  isTransparentColor,
} from '../StyleEditor/helper/paint-stack'
import { isGradientValue } from '../StyleEditor/helper/gradient-border'
import {
  collectSubjectClassSelectors,
  resolveCssomSourceSelector,
} from './build-zone-selectors-from-cssom'
import { parseCssVar } from './css-var'
import { getDocument } from './dom'
import { resolveCssPaintPreview } from './resolve-css-var-color'
import { forEachSelectorPart } from './selector-utils'

type StyleBag = Record<string, any>

export type TextFillCleanupTarget = {
  selector: string
  properties: string[]
}

const NON_IMAGE_VALUES = new Set([
  '',
  'none',
  'initial',
  'inherit',
  'unset',
  'revert',
])

function readComputed(
  computedValues: CSSStyleDeclaration,
  kebab: string,
  camel: string
): string {
  return (
    computedValues.getPropertyValue?.(kebab) ||
    (computedValues as any)[camel] ||
    ''
  ).trim()
}

function hasBackgroundImage(value: unknown): value is string {
  return (
    typeof value === 'string' &&
    !NON_IMAGE_VALUES.has(value.trim().toLowerCase())
  )
}

function isTextPaint(value: string, element: Element): boolean {
  if (!value) return false
  const resolved = resolveCssPaintPreview(value, element)
  return isGradientValue(resolved) || /\burl\s*\(/i.test(resolved)
}

function getTextFillCleanupProperties(
  rule: CSSStyleRule,
  element: Element
): string[] {
  const properties: string[] = []
  const add = (property: string) => {
    if (!properties.includes(property)) properties.push(property)
  }
  const read = (property: string) => rule.style.getPropertyValue(property).trim()

  const background = read('background')
  const backgroundImage = read('background-image')
  if (background && isTextPaint(background, element)) add('background')
  if (backgroundImage && isTextPaint(backgroundImage, element)) add('backgroundImage')

  const backgroundClip = read('background-clip')
  const webkitBackgroundClip = read('-webkit-background-clip')
  const color = read('color')
  const webkitTextFillColor = read('-webkit-text-fill-color')
  if (backgroundClip && clipHasText(backgroundClip)) add('backgroundClip')
  if (webkitBackgroundClip && clipHasText(webkitBackgroundClip)) {
    add('WebkitBackgroundClip')
  }
  if (color && isTransparentColor(color)) add('color')
  if (webkitTextFillColor && isTransparentColor(webkitTextFillColor)) {
    add('WebkitTextFillColor')
  }

  return properties
}

/**
 * 收集共同组成当前文字渐变的源码声明位置。
 *
 * 一个文字渐变可能跨多个 class：背景图在 `.hero .title`，clip/透明色在
 * `.textGradient`。从渐变切换到实色时必须按各自来源删除，否则旧声明仍会
 * 通过级联覆盖新写入的 color。这里只扫描当前组件作用域内、实际命中元素的
 * 默认态规则，不修改变量定义，也不触碰 hover 等状态规则。
 */
export function collectTextFillCleanupTargets(
  element: HTMLElement | null,
  comId: string
): TextFillCleanupTarget[] {
  if (!element || !comId) return []

  const computed = window.getComputedStyle(element)
  const computedImage = computed.getPropertyValue('background-image').trim()
  const computedClip = computed.getPropertyValue('background-clip').trim()
  const computedWebkitClip = computed
    .getPropertyValue('-webkit-background-clip')
    .trim()
  if (
    !hasBackgroundImage(computedImage) ||
    (!clipHasText(computedClip) && !clipHasText(computedWebkitClip))
  ) {
    return []
  }

  const targets = new Map<string, Set<string>>()
  const subjectClasses = new Set(
    collectSubjectClassSelectors(element).map((selector) => selector.replace(/^\./, ''))
  )
  const addRule = (rule: CSSStyleRule) => {
    const cleanupProperties = getTextFillCleanupProperties(rule, element)
    if (cleanupProperties.length === 0) return

    forEachSelectorPart(rule.selectorText, (part) => {
      if (!part.includes(comId)) return
      try {
        if (!element.matches(part)) return
      } catch {
        return
      }

      const selector = resolveCssomSourceSelector(part, element, comId)
      // 默认态改色不能顺带清理 hover/focus 等独立状态。
      if (!selector || /:{1,2}[a-zA-Z-]/.test(selector)) return
      // 只清理以当前节点自身 class 为主体的规则，避免 `.hero *` 等宽泛规则
      // 被一次局部文字改色全局改写。
      const lastSegment = selector.trim().split(/\s+/).pop() || ''
      const lastClasses = (lastSegment.match(/\.([a-zA-Z_][a-zA-Z0-9_-]*)/g) || [])
        .map((token) => token.slice(1))
      if (
        subjectClasses.size > 0 &&
        !lastClasses.some((className) => subjectClasses.has(className))
      ) {
        return
      }
      const propertySet = targets.get(selector) ?? new Set<string>()
      cleanupProperties.forEach((property) => propertySet.add(property))
      targets.set(selector, propertySet)
    })
  }

  const visitRules = (rules: CSSRuleList | undefined | null) => {
    if (!rules) return
    for (const rule of Array.from(rules)) {
      if (rule instanceof CSSStyleRule) {
        addRule(rule)
        continue
      }
      visitRules((rule as CSSRule & { cssRules?: CSSRuleList }).cssRules)
    }
  }

  const root = getDocument()
  const styleElements = Array.from(
    (root as Document | ShadowRoot).querySelectorAll('style')
  ) as HTMLStyleElement[]
  for (const styleElement of styleElements) {
    try {
      visitRules(styleElement.sheet?.cssRules)
    } catch {}
  }

  return Array.from(targets, ([selector, properties]) => ({
    selector,
    properties: Array.from(properties),
  }))
}

/**
 * `background: var(...)` 在 CSSOM 解析阶段无法判断变量最终是颜色还是图片，
 * getValues 会先把它放进 backgroundColor。这里只识别这种明确的歧义来源，
 * 不触碰真正声明在 background-color 上的变量。
 */
function isAmbiguousBackgroundVar(
  rules: CSSStyleRule[],
  value: unknown
): value is string {
  if (typeof value !== 'string' || !parseCssVar(value)) return false

  const normalized = value.trim()
  const hasExplicitColor = rules.some(
    (rule) => rule.style.getPropertyValue('background-color').trim() === normalized
  )
  if (hasExplicitColor) return false

  return rules.some(
    (rule) => rule.style.getPropertyValue('background').trim() === normalized
  )
}

/**
 * 用浏览器最终计算结果补齐跨选择器组成的文字填充。
 *
 * 例如 background-image 写在 `.sceneSubtitle`，而 background-clip:text 写在
 * `.textGradient`。Zone 规则扫描只拥有前者，但 Font / Background 面板需要看到
 * 两条规则共同形成的实际绘制角色。
 */
export function reconcileEffectiveTextFill(
  values: StyleBag,
  computedValues: CSSStyleDeclaration,
  rules: CSSStyleRule[]
): boolean {
  const computedBackgroundImage = readComputed(
    computedValues,
    'background-image',
    'backgroundImage'
  )
  const computedBackgroundClip = readComputed(
    computedValues,
    'background-clip',
    'backgroundClip'
  )
  const computedWebkitBackgroundClip = readComputed(
    computedValues,
    '-webkit-background-clip',
    'webkitBackgroundClip'
  )
  const effectiveClip = [
    computedBackgroundClip,
    computedWebkitBackgroundClip,
  ].find(clipHasText)

  const authoredBackgroundImage = values.backgroundImage
  const ambiguousBackgroundVar = isAmbiguousBackgroundVar(
    rules,
    values.backgroundColor
  )
  const ownsBackgroundImage =
    hasBackgroundImage(authoredBackgroundImage) || ambiguousBackgroundVar

  if (
    !ownsBackgroundImage ||
    !effectiveClip ||
    !hasBackgroundImage(computedBackgroundImage)
  ) {
    return false
  }

  // `background: var(--gradient)` 已确认实际解析为图片时，将当前 Zone 自有的
  // 原始变量迁到 image 槽；不能写入 computed 展开值，否则编辑会丢失变量绑定。
  if (!hasBackgroundImage(authoredBackgroundImage) && ambiguousBackgroundVar) {
    values.backgroundImage = values.backgroundColor
  }
  values.backgroundClip = effectiveClip
  values.webkitBackgroundClip = effectiveClip
  values.WebkitBackgroundClip = effectiveClip

  const computedTextFill = readComputed(
    computedValues,
    '-webkit-text-fill-color',
    'webkitTextFillColor'
  )
  if (computedTextFill) {
    values.webkitTextFillColor = computedTextFill
    values.WebkitTextFillColor = computedTextFill
  }

  const computedBackgroundColor = readComputed(
    computedValues,
    'background-color',
    'backgroundColor'
  )
  if (
    ambiguousBackgroundVar &&
    !!computedBackgroundColor &&
    isTransparentColor(computedBackgroundColor)
  ) {
    // 该 var() 实际解析进 background-image，不能再作为纯色背景层展示。
    values.backgroundColor = ''
  }

  return true
}
