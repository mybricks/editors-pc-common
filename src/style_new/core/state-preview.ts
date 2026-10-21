/**
 * 伪类状态预览：切到伪类 tab（如悬浮态）时，把该状态的样式直接套到选中的
 * 元素上，不用真的把鼠标放上去就能看到效果；切走 tab、换元素时自动恢复。
 *
 * 原理：把样式表里带该伪类的选择器改写成等价的 data 属性选择器，再给元素
 * 挂上这个属性，例如：
 *   .item:hover  →  .item[data-mybricks-state=":hover"]
 * 特指度不变、声明原样保留，所以显示效果和真实触发该状态一致。
 *
 * 几个关键点：
 * - 规则用全量扫描而不是只取当前 tab 的规则：像 `.topTipBar:hover` 这种
 *   写在祖先上的规则不在 tab 里，但预览时也要生效；
 * - hover/active/focus-within 会同时作用于祖先（压住子元素时父元素也是
 *   hover），所以把整条祖先链都标记；focus/disabled 等只作用于元素自身；
 * - 状态规则的声明一律加 !important：切到状态 tab 就是要看这个状态配的
 *   样式，不能被基础态、内联等任何冲突压住；没有冲突时加 important 也
 *   不影响结果。:not(...) 里的否定规则不加（描述的是“不处于该状态”的元素）；
 * - 预览样式放在 adoptedStyleSheets 里而不是 <style> 标签，
 *   大部分按标签扫描的代码看不到它，不用到处做排除。
 */
import { collectZoneStyleRules } from './zone-tab'
import type { ZoneTab } from './zone-tab'
import { STATE_PREVIEW_ATTR, clearStatePreviewSizes, setStatePreviewSheet, setStatePreviewSize } from './state-preview-tag'

/** 真实交互态：鼠标真悬停、真聚焦等场景下，计算样式会被干扰，StyleMount 用它做保护。 */
export const INTERACTIVE_PSEUDO_STATES: ReadonlySet<string> = new Set([
  ':hover', ':focus', ':active', ':disabled',
])

/** 是否可预览：单冒号伪类可以；::before 这类伪元素的样式不属于元素本身，不预览。 */
export function isPreviewablePseudo(pseudo: string): boolean {
  return pseudo.startsWith(':') && !pseudo.startsWith('::')
}

/** 这些状态会同时作用于祖先（压住子元素时，父元素也处于 hover 等），预览要连祖先一起标记。 */
const CHAIN_STATES: ReadonlySet<string> = new Set([':hover', ':active', ':focus-within'])

type ActivePreview = {
  target: Element
  pseudo: string
  sheet: CSSStyleSheet
  /** 打了预览标记的元素，清除时用 */
  marked: Element[]
}

/** 当前正在预览的内容；同一时刻只有一个元素 + 一个状态 */
let active: ActivePreview | null = null
/** 上次写入的内容，没变化就不重写，省一次解析 */
let lastCssText = ''

function escapeAttrValue(value: string): string {
  return value.replace(/\\/g, '\\\\').replace(/"/g, '\\"')
}

/**
 * 把选择器里的状态伪类替换成属性选择器：
 * `.card:hover .panel` → `.card[data-…] .panel`。
 * - `\` 转义和引号里的内容原样跳过，不会误改；
 * - token 后面跟字母/数字/横杠时不替换，防止把 :hovered 误当成 :hover；
 * - :not(:hover) 里的也替换，语义正好对上：没打标记 = 不处于该状态。
 * positive 表示替换发生在 :not() 外面（即「处于该状态就命中」的规则），
 * 只有这类规则才加 !important。
 * 选择器里没这个伪类时返回 null。
 */
function replaceStatePseudo(
  selector: string,
  pseudo: string,
  attrSelector: string
): { text: string; positive: boolean } | null {
  const NOT_PREFIX = ':not('
  let result = ''
  let replaced = false
  let positive = false
  let quote = ''
  let depth = 0
  const negationDepths: number[] = []
  let i = 0
  while (i < selector.length) {
    const ch = selector[i]
    if (quote) {
      result += ch
      if (ch === quote) quote = ''
      i++
      continue
    }
    if (ch === '\\') {
      result += selector.slice(i, i + 2)
      i += 2
      continue
    }
    if (ch === '"' || ch === "'") {
      quote = ch
      result += ch
      i++
      continue
    }
    if (ch === ':' && selector.startsWith(pseudo, i)) {
      const next = selector[i + pseudo.length]
      if (!next || (!/[\w-]/.test(next) && next !== '(')) {
        result += attrSelector
        i += pseudo.length
        replaced = true
        if (!negationDepths.length) positive = true
        continue
      }
    }
    if (ch === ':' && selector.startsWith(NOT_PREFIX, i)) {
      result += NOT_PREFIX
      i += NOT_PREFIX.length
      depth++
      negationDepths.push(depth)
      continue
    }
    if (ch === '(') {
      result += ch
      i++
      depth++
      continue
    }
    if (ch === ')') {
      if (negationDepths.length && negationDepths[negationDepths.length - 1] === depth) {
        negationDepths.pop()
      }
      result += ch
      i++
      depth--
      continue
    }
    result += ch
    i++
  }
  return replaced ? { text: result, positive } : null
}

/**
 * 拼出规则的声明体。状态生效的规则（positive）一律给每条声明补 !important：
 * 切到状态 tab 就是要看状态配的样式，无论基础态是普通声明、!important
 * 还是内联，都不能压住它。不用担心误伤——某个属性没有冲突时，
 * 只有这一条声明，加不加 important 结果都一样。
 * 否定规则（:not 里的）不适用，原样返回。
 */
function buildPreviewRuleBody(positive: boolean, rule: CSSStyleRule): string {
  if (!positive) return rule.style.cssText
  const declarations: string[] = []
  for (let index = 0; index < rule.style.length; index++) {
    const property = rule.style.item(index)
    const value = rule.style.getPropertyValue(property)
    declarations.push(`${property}: ${value} !important`)
  }
  return declarations.join('; ')
}

/**
 * 扫描全部样式规则，把含该伪类的选择器改写后拼成预览样式表内容。
 * 用全量扫描是因为像 `.topTipBar:hover` 这种写在祖先上的规则
 * 不在当前 tab 里，但预览时也要生效。
 */
function buildPreviewCssText(pseudo: string): string {
  const attrSelector = `[${STATE_PREVIEW_ATTR}="${escapeAttrValue(pseudo)}"]`
  const lines: string[] = []
  collectZoneStyleRules().forEach(({ rule }) => {
    const selectorText = rule.selectorText
    if (!selectorText) return
    if (!rule.style?.length) return
    const rewritten = replaceStatePseudo(selectorText, pseudo, attrSelector)
    if (!rewritten) return
    lines.push(`${rewritten.text}{${buildPreviewRuleBody(rewritten.positive, rule)}}`)
  })
  return lines.join('\n')
}

function renderPreviewSheet(pseudo: string): void {
  if (!active) return
  const cssText = buildPreviewCssText(pseudo)
  if (cssText === lastCssText) return
  active.sheet.replaceSync(cssText)
  lastCssText = cssText
}

/** 在元素所在的文档/shadow root 里创建预览样式表，挂到 adoptedStyleSheets 末尾。 */
function adoptPreviewSheet(target: Element): CSSStyleSheet {
  const root = target.getRootNode() as Document | ShadowRoot
  const sheet = new CSSStyleSheet()
  const existing = Array.from(root.adoptedStyleSheets || [])
  root.adoptedStyleSheets = [...existing, sheet]
  return sheet
}

/** 把预览样式表摘掉，其他样式表不受影响。 */
function disposePreviewSheet(target: Element, sheet: CSSStyleSheet): void {
  const root = target.getRootNode() as Document | ShadowRoot
  root.adoptedStyleSheets = Array.from(root.adoptedStyleSheets || [])
    .filter((item) => item !== sheet)
}

/**
 * 冻结元素向上的整条链（含 shadow host）的尺寸。
 * 遍历范围和 readNormalStyleSignature 保持一致，保证签名两边都用冻结值。
 */
function freezeSignatureChainSizes(target: Element): void {
  for (let el: Element | null = target; el;) {
    setStatePreviewSize(el, el.clientWidth, el.clientHeight)
    const root = el.getRootNode() as Document | ShadowRoot
    el = el.parentElement || ('host' in root ? (root as ShadowRoot).host : null)
  }
}

/**
 * 开始预览：给元素（需要时连同祖先链）打上标记，挂上预览样式表。
 * 样式源变化后的内容刷新由 refreshStatePreview 负责。
 */
export function applyStatePreview(target: Element, tab: ZoneTab): void {
  clearStatePreview()
  const pseudo = tab.pseudo
  if (!pseudo) return

  const marked: Element[] = [target]
  if (CHAIN_STATES.has(pseudo)) {
    // 沿祖先链向上标记，到根节点为止
    for (let el = target.parentElement; el; el = el.parentElement) {
      marked.push(el)
    }
  }

  const sheet = adoptPreviewSheet(target)
  active = { target, pseudo, sheet, marked }
  setStatePreviewSheet(sheet)
  marked.forEach((el) => el.setAttribute(STATE_PREVIEW_ATTR, pseudo))
  // 预览样式马上要应用、布局可能变化；先把整条链的尺寸冻结下来，
  // 签名比较用它，避免“预览改了布局”被误判成“常规态变了”
  freezeSignatureChainSizes(target)
  renderPreviewSheet(pseudo)
}

/** 结束预览：去掉所有标记、摘掉样式表，画布恢复原样。 */
export function clearStatePreview(): void {
  if (!active) return
  active.marked.forEach((el) => el.removeAttribute(STATE_PREVIEW_ATTR))
  disposePreviewSheet(active.target, active.sheet)
  setStatePreviewSheet(null)
  clearStatePreviewSizes()
  active = null
  lastCssText = ''
}

/** 样式源变化后重算预览内容；没在预览时啥也不做。 */
export function refreshStatePreview(): void {
  if (!active) return
  renderPreviewSheet(active.pseudo)
}
