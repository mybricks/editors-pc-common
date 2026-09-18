import { collectMatchingRuleSources } from './rule-collector'
import { normalizeCssProperty } from './property-registry'
import {
  resolveCascadeCandidates,
  resolveCascadeRuleSources,
  resolveInlineStyle,
} from './resolver'
import type {
  CascadeCandidate,
  CascadeMode,
  CascadeRuleSource,
  CssCascadeSession,
  CssCascadeSessionOptions,
} from './types'

export function createCssCascadeSession(
  element: HTMLElement,
  options: CssCascadeSessionOptions = {}
): CssCascadeSession {
  const sourcesByMode = new Map<CascadeMode, CascadeRuleSource[]>()
  const winnerCache = new Map<string, CascadeCandidate | null>()
  const inlineCache = new Map<string, CascadeCandidate | null>()

  const getSources = (mode: CascadeMode): CascadeRuleSource[] => {
    let sources = sourcesByMode.get(mode)
    if (!sources) {
      sources = collectMatchingRuleSources(element, mode)
      sourcesByMode.set(mode, sources)
    }
    return sources
  }

  const getInlineCandidate = (property: string): CascadeCandidate | null => {
    const normalized = normalizeCssProperty(property)
    if (!inlineCache.has(normalized)) {
      inlineCache.set(normalized, resolveInlineStyle(element.style, normalized))
    }
    return inlineCache.get(normalized) || null
  }

  const resolve = (
    property: string,
    mode: CascadeMode = 'default'
  ): CascadeCandidate | null => {
    const normalized = normalizeCssProperty(property)
    const cacheKey = `${mode}:${normalized}`
    if (!winnerCache.has(cacheKey)) {
      const ruleWinner = resolveCascadeRuleSources(getSources(mode), normalized)
      winnerCache.set(
        cacheKey,
        resolveCascadeCandidates(ruleWinner, getInlineCandidate(normalized))
      )
    }
    return winnerCache.get(cacheKey) || null
  }

  return {
    resolve,
    resolveValue(property, mode = 'default') {
      const normalized = normalizeCssProperty(property)
      const winner = resolve(normalized, mode)
      if (winner) {
        return { value: winner.value, winner, fromComputedStyle: false }
      }
      const value = options.computedStyle?.getPropertyValue(normalized) || ''
      return { value, winner: null, fromComputedStyle: !!value }
    },
    resolveAll(properties, mode = 'default') {
      const result = new Map<string, CascadeCandidate>()
      properties.forEach((property) => {
        const normalized = normalizeCssProperty(property)
        const winner = resolve(normalized, mode)
        if (winner) result.set(normalized, winner)
      })
      return result
    },
    getInlineCandidate,
    hasInlineDeclaration(property) {
      return !!getInlineCandidate(property)
    },
  }
}
