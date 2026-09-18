import { calculateSafeSpecificity } from '../selector-utils'

import { readStyleDeclarationCandidates } from './declaration-reader'
import { normalizeCssProperty } from './property-registry'
import { compareCascadePriority, ZERO_SPECIFICITY } from './priority'
import type {
  CascadeCandidate,
  CascadeRuleSource,
  CssSpecificity,
} from './types'

function selectWinner(candidates: CascadeCandidate[]): CascadeCandidate | null {
  let winner: CascadeCandidate | null = null
  candidates.forEach((candidate) => {
    if (!winner || compareCascadePriority(candidate.priority, winner.priority) >= 0) {
      winner = candidate
    }
  })
  return winner
}

function getRuleSpecificity(source: CascadeRuleSource): CssSpecificity | null {
  const selector = source.selectorPart || source.rule.selectorText
  return calculateSafeSpecificity(
    selector,
    (source.target || null) as HTMLElement | null
  ) as CssSpecificity | null
}

/** 在调用方提供的规则来源中，按属性级别计算真正的赢家。 */
export function resolveCascadeRuleSources(
  sources: CascadeRuleSource[],
  property: string
): CascadeCandidate | null {
  const normalizedProperty = normalizeCssProperty(property)
  const candidates: CascadeCandidate[] = []
  let cascadeOrder = 0

  const orderedSources = sources
    .map((source, index) => ({ source, index }))
    .sort((left, right) => {
      const leftOrder = left.source.sourceOrder ?? left.index
      const rightOrder = right.source.sourceOrder ?? right.index
      return leftOrder - rightOrder || left.index - right.index
    })

  orderedSources.forEach(({ source, index }) => {
    const specificity = getRuleSpecificity(source)
    if (!specificity) return
    const declarations = readStyleDeclarationCandidates(source.rule.style, normalizedProperty)
    declarations.forEach((declaration) => {
      candidates.push({
        property: normalizedProperty,
        authoredProperty: declaration.authoredProperty,
        value: declaration.value,
        priority: {
          important: declaration.important,
          inline: false,
          specificity,
          sourceOrder: cascadeOrder++,
        },
        source: {
          kind: 'rule',
          style: source.rule.style,
          rule: source.rule,
          selector: source.selectorPart || source.rule.selectorText,
          sourceOrder: source.sourceOrder ?? index,
        },
      })
    })
  })

  return selectWinner(candidates)
}

/** 读取内联声明；shorthand 会展开成目标 longhand，同时保留 authoredProperty。 */
export function resolveInlineStyle(
  style: CSSStyleDeclaration,
  property: string,
  sourceOrder = 0
): CascadeCandidate | null {
  const normalizedProperty = normalizeCssProperty(property)
  const candidates = readStyleDeclarationCandidates(style, normalizedProperty).map(
    (declaration, index): CascadeCandidate => ({
      property: normalizedProperty,
      authoredProperty: declaration.authoredProperty,
      value: declaration.value,
      priority: {
        important: declaration.important,
        inline: true,
        specificity: ZERO_SPECIFICITY,
        sourceOrder: sourceOrder + index,
      },
      source: { kind: 'inline', style },
    })
  )
  return selectWinner(candidates)
}

export function resolveCascadeCandidates(
  ruleWinner: CascadeCandidate | null,
  inlineWinner: CascadeCandidate | null
): CascadeCandidate | null {
  if (!ruleWinner) return inlineWinner
  if (!inlineWinner) return ruleWinner
  return compareCascadePriority(inlineWinner.priority, ruleWinner.priority) >= 0
    ? inlineWinner
    : ruleWinner
}
