/**
 * 伪类状态预览：切到伪类 tab（如悬浮态）时，把该状态的样式直接套到选中的
 * 元素上，不用真的把鼠标放上去就能看到效果；换选中和面板卸载都保留预览，
 * 手动切回常规态才退出对应元素（批量模式退出整组）。
 *
 * 原理：把样式表里带该伪类的选择器改写成等价的 data 属性选择器，再给元素
 * 挂上这个属性，例如：
 *   .item:hover  →  .item[data-mybricks-state=":hover"]
 * 特指度不变、声明原样保留，所以显示效果和真实触发该状态一致。
 *
 * 几个关键点：
 * - 规则用全量扫描而不是只取当前 tab 的规则，保留父级状态控制子元素的规则；
 * - 只给主动预览的元素打标记，不把子元素的状态传播给祖先；
 * - 每个元素至多一个预览状态，当前编辑画布共用一张预览样式表；
 * - 状态规则的声明一律加 !important：切到状态 tab 就是要看这个状态配的
 *   样式，不能被基础态、内联等任何冲突压住；没有冲突时加 important 也
 *   不影响结果。:not(...) 里的否定规则不加（描述的是“不处于该状态”的元素）；
 * - 预览样式放在 adoptedStyleSheets 里而不是 <style> 标签，
 *   大部分按标签扫描的代码看不到它，不用到处做排除。
 */
import { collectZoneStyleRules } from './zone-tab'
import type { ZoneTab } from './zone-tab'
import { elMatchesSelectorTail } from './css-modules-match'
import { splitTopLevelSelectors } from './selector-utils'
import { STATE_PREVIEW_ATTR, registerStatePreviewSheet, unregisterStatePreviewSheet, syncStatePreviewSizes } from './state-preview-tag'

/** 真实交互态：鼠标真悬停、真聚焦等场景下，计算样式会被干扰，StyleMount 用它做保护。 */
export const INTERACTIVE_PSEUDO_STATES: ReadonlySet<string> = new Set([
  ':hover', ':focus', ':active', ':disabled',
])

/** 是否可预览：单冒号伪类可以；::before 这类伪元素的样式不属于元素本身，不预览。 */
export function isPreviewablePseudo(pseudo: string): boolean {
  return pseudo.startsWith(':') && !pseudo.startsWith('::')
}

/** 批量元素共用一个会话；单独编辑的会话只有一个元素。 */
type PreviewSession = {
  roots: Set<Element>
  tab: ZoneTab
  pseudo: string
  batch: boolean
  comId?: string
  owner: PreviewRoot
}

type PreviewRoot = {
  root: ShadowRoot
  sheet: CSSStyleSheet
  sessions: Set<PreviewSession>
  lastCssText: string
  frame: number
  view: Window
  observer: MutationObserver
  onResize: () => void
}

const previews = new Map<Element, PreviewSession>()
// 预览退出后仍保留编辑范围；使用 WeakMap 避免模式记录反向持有已删除的 DOM。
let previewModes = new WeakMap<Element, { batch: boolean; comId?: string }>()
let previewRoot: PreviewRoot | null = null
const listeners = new Set<() => void>()

/** 只通知预览归属/状态变化，CSS 内容刷新不触发面板重选 tab。 */
export function onStatePreviewChange(listener: () => void): () => void {
  listeners.add(listener)
  return () => { listeners.delete(listener) }
}

function notifyPreviewChange(): void {
  listeners.forEach(listener => listener())
}

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
 * 把伪元素尾巴去掉，返回能去 DOM 里查的主体。
 * 比如 `.a:hover::after` 改写后是 `.a[data-…]::after`，但 ::after 不是
 * 真实元素、querySelector 查不了它，所以要截成 `.a[data-…]` 来查它挂在哪个元素上。
 */
function previewSubjectSelector(selector: string): string {
  let quote = ''
  let depth = 0
  for (let index = 0; index < selector.length; index++) {
    const ch = selector[index]
    if (ch === '\\') {
      index++
      continue
    }
    if (quote) {
      if (ch === quote) quote = ''
      continue
    }
    if (ch === '"' || ch === "'") {
      quote = ch
      continue
    }
    if (ch === '(' || ch === '[') depth++
    if (ch === ')' || ch === ']') depth--
    if (depth === 0 && ch === ':' && (
      selector[index + 1] === ':' || /^:(before|after|first-line|first-letter)(?![\w-])/.test(selector.slice(index))
    )) {
      const subject = selector.slice(0, index)
      if (!subject || /[\s>+~]$/.test(subject)) return subject + '*'
      return subject
    }
  }
  return selector
}

/**
 * 判断一条改写后的规则，预览是不是真用得到。
 * 预览时只有主动预览的元素挂着标记，所以
 * - 普通规则：能查到带标记的元素 → 用得到；查不到 → 是陪跑的，丢掉
 * - :not(:hover) 这种否定规则：查“挂标记”和“不挂标记”两种情况各自命中
 *   哪些元素，命中面没变化就说明和预览无关，丢掉
 */
function ruleUsesPreviewState(
  root: ShadowRoot,
  activeSelector: string,
  inactiveSelector: string,
  positive: boolean,
): boolean {
  try {
    // 普通规则（处于 hover 就生效的）：查得到带标记的元素就收，查不到就丢
    if (positive) {
      const subject = previewSubjectSelector(activeSelector)
      // 标记截没了，说明它挂在伪元素上（如 ::-webkit-scrollbar-thumb:hover），
      // 伪元素带不了属性、永远命中不了，直接丢
      if (!subject.includes(STATE_PREVIEW_ATTR)) return false
      return !!root.querySelector(subject)
    }
    // :not(:hover) 这种否定规则：比对挂/不挂标记各命中哪些元素，
    // 命中的元素没变化就说明这条规则跟预览无关，丢掉
    const activeMatches = Array.from(root.querySelectorAll(previewSubjectSelector(activeSelector)))
    const inactiveMatches = new Set(root.querySelectorAll(previewSubjectSelector(inactiveSelector)))
    return activeMatches.length !== inactiveMatches.size
      || activeMatches.some((element) => !inactiveMatches.has(element))
  } catch {
    // 遇到 DOM 查询不认识的选择器，验证不了就不收
    return false
  }
}

/**
 * 共用一次源规则扫描，按源码顺序生成各个状态的预览规则。
 * 每次只改写一种伪类，保留原有真实交互配合预览的语义，不扩展不同伪类联合匹配。
 */
function buildPreviewCssText(owner: PreviewRoot): string {
  // 1. 相同状态只处理一次；固定顺序，避免预览开启顺序改变规则优先级。
  const pseudos = Array.from(new Set(Array.from(owner.sessions, session => session.pseudo))).sort()
  const lines: string[] = []
  const seen = new Set<string>()
  // 2. 全量收集，保留父级状态影响子孙的规则；每条规则仍验证实际命中范围。
  collectZoneStyleRules(owner.root).forEach(({ rule }) => {
    if (!rule.selectorText || !rule.style?.length) return
    for (const selector of splitTopLevelSelectors(rule.selectorText)) {
      for (const pseudo of pseudos) {
        const attrSelector = `[${STATE_PREVIEW_ATTR}="${escapeAttrValue(pseudo)}"]`
        const rewritten = replaceStatePseudo(selector, pseudo, attrSelector)
        if (!rewritten) continue
        const inactive = replaceStatePseudo(selector, pseudo, ':not(*)')!
        if (!ruleUsesPreviewState(owner.root, rewritten.text, inactive.text, rewritten.positive)) continue
        const line = `${rewritten.text}{${buildPreviewRuleBody(rewritten.positive, rule)}}`
        if (seen.has(line)) continue
        seen.add(line)
        lines.push(line)
      }
    }
  })
  return lines.join('\n')
}

/** 合并同一帧来自 CSS 写入、撤销重做、窗口变化的刷新。 */
function schedulePreviewRefresh(owner: PreviewRoot): void {
  if (owner.frame) return
  owner.frame = owner.view.requestAnimationFrame(() => {
    owner.frame = 0
    renderPreviewSheet(owner)
  })
}

/** 只处理样式源或预览所在画布的变化，避免属性面板更新引起全表扫描。 */
function previewMutationNeedsRefresh(owner: PreviewRoot, records: MutationRecord[]): boolean {
  const scopes = new Set<Node>()
  for (const session of owner.sessions) {
    for (const target of session.roots) {
      if (!target.isConnected || target.getRootNode() !== owner.root) return true
      const component = session.comId ? owner.root.getElementById(session.comId) : null
      scopes.add(target.closest('[data-desn-page]') || component || owner.root)
    }
  }
  return records.some(record => {
    if (record.target.getRootNode() !== owner.root) return false
    const element = record.target.nodeType === 1 ? record.target as Element : record.target.parentElement
    if (element?.closest('style, link[rel="stylesheet"]')) return true
    const changedNodes = [...Array.from(record.addedNodes), ...Array.from(record.removedNodes)]
    if (changedNodes.some(node => node.nodeType === 1 && (
      (node as Element).matches('style, link[rel="stylesheet"]')
      || (node as Element).querySelector('style, link[rel="stylesheet"]')
    ))) return true
    return Array.from(scopes).some(scope => scope.contains(record.target) || record.target.contains(scope))
  })
}

/** 建立共享样式表和监听，最后一份预览退出时一并释放。 */
function createPreviewRoot(root: ShadowRoot): PreviewRoot {
  const doc = root.ownerDocument
  const view = doc.defaultView!
  const sheet = new CSSStyleSheet()
  root.adoptedStyleSheets = [...root.adoptedStyleSheets, sheet]
  registerStatePreviewSheet(sheet)
  const owner: PreviewRoot = {
    root, sheet, view,
    sessions: new Set(), lastCssText: '', frame: 0,
    observer: new MutationObserver(records => {
      if (previewMutationNeedsRefresh(owner, records)) schedulePreviewRefresh(owner)
    }),
    onResize: () => schedulePreviewRefresh(owner),
  }
  owner.observer.observe(root, {
    subtree: true, childList: true, characterData: true,
    attributes: true, attributeFilter: ['style', 'class', 'data-style-info'],
  })
  // ShadowRoot 自身收不到宿主移除通知，文档观察只用于清理断连的预览。
  if ('host' in root) owner.observer.observe(doc, { subtree: true, childList: true })
  view.addEventListener('resize', owner.onResize)
  previewRoot = owner
  return owner
}

function disposePreviewRoot(owner: PreviewRoot): void {
  owner.observer.disconnect()
  owner.view.removeEventListener('resize', owner.onResize)
  owner.view.cancelAnimationFrame(owner.frame)
  owner.root.adoptedStyleSheets = owner.root.adoptedStyleSheets.filter(sheet => sheet !== owner.sheet)
  unregisterStatePreviewSheet(owner.sheet)
  previewRoot = null
}

/** 移除元素的会话归属；其余同组元素继续保留，空会话直接释放。 */
function detachPreviewTarget(target: Element): void {
  const session = previews.get(target)
  if (!session) return
  session.roots.delete(target)
  previews.delete(target)
  target.removeAttribute(STATE_PREVIEW_ATTR)
  if (!session.roots.size) session.owner.sessions.delete(session)
}

/** 汇总仍在使用的尺寸链；共享祖先的快照保留到最后一个使用者退出。 */
function syncPreviewSizes(): void {
  const elements = new Set<Element>()
  for (const target of previews.keys()) {
    for (let el: Element | null = target; el && !elements.has(el);) {
      elements.add(el)
      const root = el.getRootNode() as Document | ShadowRoot
      el = el.parentElement || ('host' in root ? root.host : null)
    }
  }
  syncStatePreviewSizes(elements)
}

/** 刷新时只清理已断连的元素或已被宿主移除的预览表，不牵连其他会话。 */
function renderPreviewSheet(owner: PreviewRoot): void {
  // 1. 先取消待执行刷新并剔除失效记录，防止保留已删除的 DOM。
  owner.view.cancelAnimationFrame(owner.frame)
  owner.frame = 0
  const sheetAlive = owner.root.adoptedStyleSheets.includes(owner.sheet)
  let changed = false
  for (const session of owner.sessions) {
    for (const target of session.roots) {
      if (!sheetAlive || !target.isConnected || target.getRootNode() !== owner.root) {
        detachPreviewTarget(target)
        previewModes.delete(target)
        changed = true
      }
    }
  }
  // 同一 root 内换父级也需要更新尺寸链，释放旧祖先引用。
  syncPreviewSizes()
  // 2. 空 root 释放监听；仍有预览时仅在内容变化后替换 CSS。
  if (!owner.sessions.size) {
    disposePreviewRoot(owner)
  } else {
    const cssText = buildPreviewCssText(owner)
    if (cssText !== owner.lastCssText) {
      owner.sheet.replaceSync(cssText)
      owner.lastCssText = cssText
    }
  }
  if (changed) notifyPreviewChange()
}

/**
 * 在页面（或组件根）范围内找出与 tab 选择器匹配的所有元素，
 * 和面板“影响 N 个区域”的统计口径一致；找不到时退回选中元素自己。
 */
function findSimilarElements(anchor: Element, tabSelector: string, comId: string): Element[] {
  const base = tabSelector.replace(/:{1,2}[a-zA-Z-]+(\([^)]*\))?/g, '').trim()
  if (!base) return [anchor]
  const doc = anchor.getRootNode() as Document | ShadowRoot
  const pageRoot = anchor.closest('[data-desn-page]')
  const scope = pageRoot || (comId ? doc.getElementById(comId) : null) || doc
  try {
    const nodes = Array.from(scope.querySelectorAll(base))
    if (nodes.length > 0) return nodes
  } catch { /* 哈希短名或非法选择器，走兜底 */ }
  // 兜底：CSS Modules 短名在运行时查不到，按末段类名匹配找
  const rootEl = scope instanceof Element ? scope : null
  const descendants = Array.from(scope.querySelectorAll('*'))
  const candidates = rootEl ? [rootEl, ...descendants] : descendants
  const matched = candidates.filter((el) => elMatchesSelectorTail(el, base))
  return matched.length > 0 ? matched : [anchor]
}

/**
 * 更新目标的预览：批量操作覆盖同类整组，单独编辑只拆出当前元素。
 * 换选中不调用此入口；只在用户切换变体或编辑范围时更新。
 */
export function applyStatePreview(
  target: Element,
  tab: ZoneTab,
  batchOptions?: { comId: string }
): void {
  const pseudo = tab.pseudo
  if (!pseudo) return
  // 1. 确定本次操作范围，其他元素/分组不受影响；宿主移除的旧表先释放再创建。
  const root = target.getRootNode() as ShadowRoot
  const previousOwner = previewRoot
  if (previousOwner && !root.adoptedStyleSheets.includes(previousOwner.sheet)) {
    renderPreviewSheet(previousOwner)
  }
  const roots = batchOptions ? findSimilarElements(target, tab.selector, batchOptions.comId) : [target]
  const current = previews.get(target)
  if (current && current.owner.root === root && current.pseudo === pseudo && current.batch === !!batchOptions
    && current.comId === batchOptions?.comId && current.tab.selector === tab.selector
    && roots.length === current.roots.size && roots.every(el => current.roots.has(el))) return
  const owner = previewRoot || createPreviewRoot(root)
  const session: PreviewSession = {
    roots: new Set(roots), pseudo, batch: !!batchOptions, comId: batchOptions?.comId, owner,
    // 只保留回显需要的元信息，避免长期引用旧 CSSRule 或已移除的原始目标。
    tab: { selector: tab.selector, baseSelector: tab.baseSelector, pseudo,
      label: tab.label, isAdded: tab.isAdded, sourceRules: [], baseRules: [] },
  }
  for (const el of roots) {
    detachPreviewTarget(el)
  }
  owner.sessions.add(session)
  for (const el of roots) {
    previews.set(el, session)
    previewModes.set(el, { batch: !!batchOptions, comId: batchOptions?.comId })
  }

  // 2. 先冻结未记录的常规尺寸，再标记目标；不向祖先传播伪类。
  syncPreviewSizes()
  for (const el of roots) el.setAttribute(STATE_PREVIEW_ATTR, pseudo)
  // 3. 立即呈现用户操作，并让面板/工具栏同步各自目标的状态。
  renderPreviewSheet(owner)
  notifyPreviewChange()
}

/** 用户退出时清理目标所属分组；不传目标仅用于 undo all 等全局清理。 */
export function clearStatePreview(target?: Element): void {
  // 1. 有目标只退出对应会话，批量会话中的任意元素都能退出整组。
  const session = target ? previews.get(target) : null
  if (target && !session) return
  const owner = session?.owner || previewRoot
  const targets = session ? Array.from(session.roots) : Array.from(previews.keys())
  if (!targets.length) {
    if (!session) previewModes = new WeakMap<Element, { batch: boolean; comId?: string }>()
    return
  }
  targets.forEach(detachPreviewTarget)
  if (!session) previewModes = new WeakMap<Element, { batch: boolean; comId?: string }>()
  // 2. 释放不再使用的尺寸和样式表，保留其他元素的预览。
  syncPreviewSizes()
  if (owner) renderPreviewSheet(owner)
  notifyPreviewChange()
}

/** 样式源变化/undo/redo 时刷新所有有效预览，同一帧只扫描一次每个 root。 */
export function refreshStatePreview(): void {
  if (previewRoot) schedulePreviewRefresh(previewRoot)
}

/** 只查询目标自己的预览，不按同类 class 或父子关系推测状态。 */
export function getStatePreviewMode(target: Element | null): {
  batch: boolean
  comId?: string
} | null {
  if (!target || !target.isConnected) {
    if (target) previewModes.delete(target)
    return null
  }
  return previewModes.get(target) || null
}

export function getStatePreviewContext(target: Element | null): {
  pseudo: string
  batch: boolean
  comId?: string
  tab: ZoneTab
} | null {
  if (!target) return null
  const session = previews.get(target)
  if (!session) return null
  if (!target.isConnected || target.getRootNode() !== session.owner.root
    || !session.owner.root.adoptedStyleSheets.includes(session.owner.sheet)) {
    schedulePreviewRefresh(session.owner)
    return null
  }
  return { pseudo: session.pseudo, batch: session.batch, comId: session.comId, tab: session.tab }
}
