// @ts-ignore
import { compare } from 'specificity'
import { toLine } from './css-code-codec'
import { calculateSafeSpecificity } from './selector-utils'
import {
  BATCH_CLEAR_SHORTHANDS, getShorthandFamily, STYLE_SHORTHANDS, stylePropertyKey,
} from './style-shorthand-groups'
import type { ZoneSourceRule, ZoneTab } from './zone-tab'
import { expandBorderShorthand, expandFourShorthand } from './shorthand-normalizer'

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

export function readInlineStyleProperties(target: HTMLElement | null): Set<string> {
  try {
    return new Set(Object.keys(JSON.parse(target?.dataset?.styleInfo || '{}'))
      .filter(Boolean)
      .map(key => cssPropertyName(key[0].toLowerCase() + key.slice(1))))
  } catch { return new Set() }
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
    const shorthandNames = Object.keys(STYLE_SHORTHANDS).filter(name => !!style.getPropertyValue(name))
    shorthandNames.forEach(name => {
      // CSSOM 枚举通常只有 longhand，简写本身也必须进入索引。
      expanded.add(name)
      STYLE_SHORTHANDS[name].forEach(key => expanded.add(key))
    })
    const inlineProperties = !source ? readInlineStyleProperties(target) : undefined
    // 某个 longhand 的 unset/important 可能使整个简写无法序列化，但源码中的
    // border 仍可能存在。四边贡献完整时继续保守标记，防止只删 border-width
    // 后原 border 的宽度重新露出。JSX 则可以用源码元数据精确判断原始写法。
    const possibleShorthands = Object.keys(STYLE_SHORTHANDS).filter(name =>
      shorthandNames.includes(name) || STYLE_SHORTHANDS[name].every(key => !!style.getPropertyValue(key))
    )
    const contributingShorthands = inlineProperties?.size
      ? possibleShorthands.filter(name => inlineProperties.has(name))
      : possibleShorthands
    const specificity = source && calculateSafeSpecificity(source.selectorPart, target)
    expanded.forEach(key => {
      const value = style.getPropertyValue(key).trim()
      if (!value) return
      // CSSOM 可能合成简写；有简写贡献时保守地补长写，不删除整个简写。
      const shorthand = contributingShorthands.find(name => STYLE_SHORTHANDS[name].includes(key))
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
        const wireKey = stylePropertyKey(property)
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

      // 写入简写后立即刷新长写来源，连续输入/重置不等待 CSSOM 重编译。
      const border = value != null ? expandBorderShorthand(stylePropertyKey(property), value) : null
      const flex = value != null && property === 'flex' ? target?.ownerDocument?.createElement('div').style : undefined
      if (flex) flex.setProperty('flex', String(value).replace(/\s*!important\s*$/i, '').trim())
      if (value != null && (flex || property === 'margin' || property === 'padding' || (border && STYLE_SHORTHANDS[property]))) {
        const expanded = flex
          ? STYLE_SHORTHANDS.flex.map(key => flex.getPropertyValue(key))
          : border
          ? STYLE_SHORTHANDS[property].map(key => border[stylePropertyKey(key)])
          : expandFourShorthand(value)
        const shorthand = remaining[remaining.length - 1]
        if (expanded && shorthand) STYLE_SHORTHANDS[property].forEach((longhand, position) => {
          const others = (index.get(longhand) || []).filter(candidate => candidate.label !== selector)
          // var() 等不透明简写可能无法展开，移除旧值即可，不能缓存空值作为 winner。
          if (expanded[position]) others.push({
            ...shorthand,
            value: expanded[position].replace(/\s*!important\s*$/i, '').trim(),
          })
          index.set(longhand, others)
          cache.delete(longhand)
        })
      }

      // 删除 shorthand 时同步移除它在 longhand 索引中的贡献，避免源码/CSSOM
      // 尚未完成重编译时，后续查询仍把已经删除的简写当作生效来源。
      if (value == null) {
        ;(STYLE_SHORTHANDS[property] || []).forEach(longhand => {
          const longhandCandidates = index.get(longhand) || []
          index.set(
            longhand,
            longhandCandidates.filter(candidate =>
              candidate.label !== selector || candidate.property !== property
            )
          )
          cache.delete(longhand)
        })
      }

      // 写一个 longhand 后，CSSOM 尚未刷新，旧的合成简写已经不能再作为来源。
      const affected = STYLE_SHORTHANDS[property] || [property]
      Object.entries(STYLE_SHORTHANDS).forEach(([name, longhands]) => {
        if (name === property || !longhands.some(key => affected.includes(key))) return
        index.set(name, (index.get(name) || []).filter(candidate => candidate.label !== selector))
        cache.delete(name)
      })
    },
  }
}

export type StyleResolution = ReturnType<typeof createStyleResolution>

/**
 * 整组恢复默认时删除 winning source 内的整个属性族，允许低优先级样式重新生效。
 * CSSOM 会合成/拆开简写，不能用 item() 判断源码究竟写了 margin 还是四条长写，
 * 因此同时清理该组所有写法；部分清空仍保留 unset，避免删除未选中的配置。
 */
export function createBatchStyleClearPlans(
  keys: readonly string[],
  resolution: StyleResolution,
  target: HTMLElement | null
): StyleClearPlan[] {
  let plannedKeys = Array.from(new Set(keys.flatMap(key => {
    const property = cssPropertyName(key)
    return BATCH_CLEAR_SHORTHANDS.includes(property)
      ? STYLE_SHORTHANDS[property].map(stylePropertyKey)
      : [stylePropertyKey(property)]
  })))
  const deletes: StyleClearPlan[] = []

  BATCH_CLEAR_SHORTHANDS.forEach(property => {
    const longhands = STYLE_SHORTHANDS[property].map(stylePropertyKey)
    if (!longhands.every(longhand => plannedKeys.includes(longhand))) return

    const longhandProperties = longhands.map(longhand => resolution.get(longhand))
    if (property === 'margin' || property === 'padding') {
      // 间距的整组清空包含稀疏长写和多来源配置；按生效来源删除，不生成 unset。
      // 未生效的其他来源保留，清空后允许它们自然回显。
      const winners = longhandProperties.map(item => item.winner).filter((item): item is StyleSourceCandidate =>
        !!item?.currentState
      )
      const sources = winners.filter((item, index) => winners.findIndex(other =>
        other.label === item.label && other.inline === item.inline
      ) === index)
      const groupPlans: StyleClearPlan[] = []
      const family = getShorthandFamily(property)
      for (const source of sources) {
        if (!source.label) return
        const properties = source.inline
          ? family.filter(name => readInlineStyleProperties(target).has(name)) : family
        if (source.inline && (!properties.length || properties.some(name =>
          !readStaticInlineStyleInfo(target, stylePropertyKey(name), true)
        ))) return
        properties.forEach(name => groupPlans.push({
          key: stylePropertyKey(name), winner: source,
          candidates: resolution.get(name).candidates,
          action: 'delete', selector: source.label, value: null,
        }))
      }
      if (groupPlans.length) {
        plannedKeys = plannedKeys.filter(key => !longhands.includes(key))
        deletes.push(...groupPlans)
      }
      return
    }
    const winner = longhandProperties[0]?.winner
    if (!winner) return
    const family = getShorthandFamily(property)
    const sameSource = longhandProperties.every(({ winner: current }) =>
      !!current &&
      current.currentState &&
      family.includes(current.property) &&
      current.label === winner.label &&
      current.inline === winner.inline &&
      current.source === winner.source
    )
    if (!sameSource || !winner.label) return

    // 多个 selector 同时提供同一组圆角时，清空生效来源需要写入 unset，
    const hasOtherCurrentSource = longhandProperties.some(({ winner: current, candidates }) =>
      candidates.some(candidate =>
        candidate.currentState &&
        (candidate.label !== current?.label || candidate.inline !== current?.inline || candidate.source !== current?.source)
      )
    )
    if (hasOtherCurrentSource && property === 'border-radius') return

    let deleteProperties = family
    if (winner.inline) {
      // JSX 的源码范围才是原始声明信息，不能要求 CSSOM 展开的每个 longhand
      // 都有独立源码范围；但组内任意动态属性仍必须阻止整个动作。
      const inlineProperties = readInlineStyleProperties(target)
      deleteProperties = family.filter(name => inlineProperties.has(name))
      if (
        deleteProperties.some(name => !readStaticInlineStyleInfo(target, stylePropertyKey(name), true)) ||
        !STYLE_SHORTHANDS[property].every(longhand => deleteProperties.some(name =>
          name === longhand || STYLE_SHORTHANDS[name]?.includes(longhand)
        ))
      ) return
    }

    plannedKeys = plannedKeys.filter(key => !longhands.includes(key))
    deleteProperties.forEach(name => {
      const current = resolution.get(name)
      deletes.push({
        key: stylePropertyKey(name),
        winner,
        candidates: current.candidates,
        action: 'delete',
        selector: winner.label,
        value: null,
      })
    })
  })

  return [
    ...plannedKeys.map(key => resolution.get(key).clearPlan),
    ...deletes,
  ]
}

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
