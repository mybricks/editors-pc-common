// @ts-ignore
import { compare } from 'specificity'
import { toLine } from './css-code-codec'
import { calculateSafeSpecificity } from './selector-utils'
import type { ZoneSourceRule, ZoneTab } from './zone-tab'

const SIDES = ['top', 'right', 'bottom', 'left']
const SHORTHANDS: Record<string, string[]> = {
  font: ['font-family', 'font-size', 'font-weight', 'font-style', 'font-stretch', 'font-variant', 'line-height'],
  background: ['background-color', 'background-image', 'background-size', 'background-position', 'background-repeat', 'background-origin', 'background-clip', 'background-attachment'],
  border: SIDES.flatMap(side => ['width', 'style', 'color'].map(key => `border-${side}-${key}`)),
  'border-color': SIDES.map(side => `border-${side}-color`),
  'border-width': SIDES.map(side => `border-${side}-width`),
  'border-style': SIDES.map(side => `border-${side}-style`),
  'border-radius': ['border-top-left-radius', 'border-top-right-radius', 'border-bottom-right-radius', 'border-bottom-left-radius'],
  margin: SIDES.map(side => `margin-${side}`),
  padding: SIDES.map(side => `padding-${side}`),
  gap: ['row-gap', 'column-gap'],
  overflow: ['overflow-x', 'overflow-y'],
  flex: ['flex-grow', 'flex-shrink', 'flex-basis'],
  'text-decoration': ['text-decoration-line', 'text-decoration-color', 'text-decoration-style', 'text-decoration-thickness'],
}
SIDES.forEach(side => { SHORTHANDS[`border-${side}`] = ['width', 'style', 'color'].map(key => `border-${side}-${key}`) })

export const cssPropertyName = (key: string) => key.startsWith('--')
  ? key
  : toLine(key).replace(/^webkit-/, '-webkit-')

export type StyleSourceCandidate = {
  property: string
  value: string
  important: boolean
  label: string
  source?: ZoneSourceRule
  specificity?: any
  sourceOrder: number
  inline: boolean
  currentState: boolean
}

export type StyleClearPlan = {
  key: string
  winner: StyleSourceCandidate | null
  candidates: StyleSourceCandidate[]
} & (
  | { action: 'delete' | 'write-unset'; selector: string; value: null | 'unset' | 'unset !important' }
  | { action: 'noop' | 'unsupported'; reason: string }
)

export type StyleProperty = {
  winner: StyleSourceCandidate | null
  candidates: StyleSourceCandidate[]
  clearPlan: StyleClearPlan
}

export function readStaticInlineStyleInfo(target: HTMLElement | null, key: string, deletion = false): boolean {
  try {
    const info = JSON.parse(target?.dataset?.styleInfo || '{}')
    return [key, key[0]?.toLowerCase() + key.slice(1), key[0]?.toUpperCase() + key.slice(1)].some(alias => {
      const entry = info[alias]
      return entry?.kind === 'static' && !entry.hasSpread && !entry.duplicate &&
        (deletion
          ? typeof entry.propertyStart === 'number' && typeof entry.propertyEnd === 'number'
          : typeof entry.valueStart === 'number' && typeof entry.valueEnd === 'number')
    })
  } catch { return false }
}

export function resolveEffectiveStyleSource(candidates: StyleSourceCandidate[]): StyleSourceCandidate | null {
  return candidates.reduce<StyleSourceCandidate | null>((winner, candidate) => {
    if (!winner) return candidate
    if (candidate.important !== winner.important) return candidate.important ? candidate : winner
    if (candidate.inline !== winner.inline) return candidate.inline ? candidate : winner
    if (candidate.specificity && winner.specificity) {
      const order = compare(candidate.specificity, winner.specificity)
      if (order) return order > 0 ? candidate : winner
    }
    return candidate.sourceOrder >= winner.sourceOrder ? candidate : winner
  }, null)
}

function planClear(key: string, candidates: StyleSourceCandidate[], target: HTMLElement | null): StyleClearPlan {
  const winner = resolveEffectiveStyleSource(candidates)
  const base = { key, candidates, winner }
  if (!winner || !winner.currentState) return { ...base, action: 'noop', reason: 'no-local-declaration' }
  if (/^unset$/i.test(winner.value.trim())) return { ...base, action: 'noop', reason: 'already-neutralized' }
  const selector = winner.label
  if (!selector) return { ...base, action: 'unsupported', reason: 'winner-selector-unavailable' }
  // 同 selector 多条规则无法通过现有通道区分源码位置。
  if (!winner.inline && candidates.some(c => c !== winner && c.label === selector && c.source?.rule !== winner.source?.rule)) {
    return { ...base, action: 'unsupported', reason: 'ambiguous-source-selector' }
  }
  const action = candidates.length === 1 && winner.property === cssPropertyName(key) ? 'delete' : 'write-unset'
  if (winner.inline && !readStaticInlineStyleInfo(target, key)) {
    return { ...base, action: 'unsupported', reason: 'dynamic-or-untracked-inline-style' }
  }
  if (winner.inline && action === 'delete' && !readStaticInlineStyleInfo(target, key, true)) {
    return { ...base, action: 'unsupported', reason: 'inline-delete-range-unavailable' }
  }
  if (winner.inline && action === 'write-unset' && winner.important) {
    return { ...base, action: 'unsupported', reason: 'inline-important-cannot-be-written-by-jsx-style' }
  }
  return { ...base, action, selector, value: action === 'delete' ? null : winner.important ? 'unset !important' : 'unset' }
}

/** 一个 Tab 共用一份稀疏索引。控件查询不扫描 CSSOM。 */
export function createStyleResolution(tab: ZoneTab, target: HTMLElement | null = tab.target as HTMLElement || null) {
  const index = new Map<string, StyleSourceCandidate[]>()
  const cache = new Map<string, StyleProperty>()
  const addStyle = (style: CSSStyleDeclaration, source?: ZoneSourceRule) => {
    const declared = Array.from({ length: style.length }, (_, i) => style.item(i))
    const expanded = new Set(declared)
    const shorthandNames = Object.keys(SHORTHANDS).filter(name => !!style.getPropertyValue(name))
    shorthandNames.forEach(name => SHORTHANDS[name].forEach(key => expanded.add(key)))
    const specificity = source && calculateSafeSpecificity(source.selectorPart, target)
    expanded.forEach(key => {
      const value = style.getPropertyValue(key).trim()
      if (!value) return
      // CSSOM 可能合成简写；有简写贡献时保守地补长写，不删除整个简写。
      const shorthand = shorthandNames.find(name => SHORTHANDS[name].includes(key))
      const candidate: StyleSourceCandidate = {
        property: shorthand || key,
        value,
        important: style.getPropertyPriority(key) === 'important',
        label: source?.sourceSelector || (source ? '' : 'inline'),
        source,
        specificity,
        sourceOrder: source?.sourceOrder ?? Number.MAX_SAFE_INTEGER,
        inline: !source,
        currentState: source ? tab.sourceRules.some(item => item.rule === source.rule && item.selectorPart === source.selectorPart) : !tab.pseudo,
      }
      const list = index.get(key) || []
      list.push(candidate)
      index.set(key, list)
    })
  }
  const sources = tab.pseudo ? [...tab.baseRules, ...tab.sourceRules] : tab.sourceRules
  sources.filter((source, i) => sources.findIndex(item => item.rule === source.rule && item.selectorPart === source.selectorPart) === i)
    .forEach(source => addStyle(source.rule.style, source))
  if (target?.style && !tab.pseudo?.startsWith('::')) addStyle(target.style)

  return {
    get(key: string): StyleProperty {
      const property = cssPropertyName(key)
      if (!cache.has(property)) {
        const candidates = index.get(property) || []
        const wireKey = property.startsWith('--') ? property : property.replace(/-([a-z])/g, (_, letter) => letter.toUpperCase())
        const clearPlan = planClear(wireKey, candidates, target)
        cache.set(property, { candidates, winner: clearPlan.winner, clearPlan })
      }
      return cache.get(property)!
    },
    /** 连续编辑时先记录本次实际目标，避免源码重编译前读到上次 CSSOM。 */
    record(key: string, value: any, selector: string) {
      const property = cssPropertyName(key)
      const candidates = index.get(property) || []
      const previous = candidates.find(c => c.label === selector)
      const remaining = candidates.filter(c => c.label !== selector)
      if (value != null) {
        const source = tab.sourceRules.find(s => s.sourceSelector === selector)
        remaining.push({
          property,
          value: String(value).replace(/\s*!important\s*$/i, '').trim(),
          important: /!important\s*$/i.test(String(value)),
          label: selector,
          source: previous?.source || source,
          specificity: previous?.specificity || (source && calculateSafeSpecificity(source.selectorPart, target)),
          sourceOrder: previous?.sourceOrder ?? source?.sourceOrder ?? Number.MAX_SAFE_INTEGER,
          inline: selector === 'inline',
          currentState: true,
        })
      }
      index.set(property, remaining)
      cache.delete(property)
    },
  }
}

export type StyleResolution = ReturnType<typeof createStyleResolution>
const resolutions = new WeakMap<ZoneTab, StyleResolution>()
export function getStyleResolution(tab: ZoneTab, target?: HTMLElement | null): StyleResolution {
  let result = resolutions.get(tab)
  if (!result) {
    result = createStyleResolution(tab, target)
    resolutions.set(tab, result)
  }
  return result
}
export function invalidateStyleResolution(tab: ZoneTab) { resolutions.delete(tab) }

// 兼容现有日志及清空入口；都查询同一份属性结果。
export function collectStyleSourceCandidates(target: HTMLElement | null, tabs: ZoneTab[], tab: ZoneTab | null, key: string) {
  const current = tab || tabs.find(item => !item.pseudo)
  return current ? getStyleResolution(current, target).get(key).candidates : []
}
export function createStyleClearPlan(target: HTMLElement | null, tabs: ZoneTab[], tab: ZoneTab | null, key: string): StyleClearPlan {
  const current = tab || tabs.find(item => !item.pseudo)
  return current ? getStyleResolution(current, target).get(key).clearPlan : planClear(key, [], target)
}
