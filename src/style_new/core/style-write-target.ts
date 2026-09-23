// @ts-ignore
import { compare } from 'specificity'
import { collectSubjectClassSelectors, isZoneTabNoiseClass } from './build-zone-selectors-from-cssom'
import { calculateSafeSpecificity } from './selector-utils'
import { getStyleResolution } from './style-property'
import type { StyleResolution } from './style-property'
import { resolveZoneFallbackSelector, splitZoneSelectorState, subjectClassNames } from './zone-tab'
import type { ZoneSourceRule, ZoneTab } from './zone-tab'

export type StyleWriteCandidate = {
  selector: string
  runtimeSelector?: string
  specificity: NonNullable<ReturnType<typeof calculateSafeSpecificity>>
  sourceOrder: number
}

export type StyleWriteTarget = {
  selector: string | null
  source: 'property-winner' | 'inline' | 'computed-highest-selector' | 'classname-fallback'
    | 'current-rule' | 'host-fallback' | 'scoped-state-fallback' | 'unsupported'
  candidates: StyleWriteCandidate[]
  reason: string
}

/** 相同特指度按样式表顺序选择；完全相同则保留原顺序。其他属性的 important 不参与。 */
function compareWriteCandidates(a: StyleWriteCandidate, b: StyleWriteCandidate): number {
  return compare(b.specificity, a.specificity) || b.sourceOrder - a.sourceOrder
}

function collectRuleCandidates(
  sources: ZoneSourceRule[], target: HTMLElement, pseudo: string | null, appendState = false
): StyleWriteCandidate[] {
  const candidates: StyleWriteCandidate[] = []
  sources.forEach(source => {
    if (!source.sourceSelector) return
    const state = splitZoneSelectorState(source.selectorPart)
    if (state.pseudo !== (appendState ? null : pseudo)) return
    try {
      // 状态 Tab 不要求鼠标真的 hover；祖先路径和结构条件仍必须匹配。
      if (!target.matches(state.matchSelector)) return
    } catch { return }
    const ownClasses = subjectClassNames(state.subject, target)
    if (!ownClasses.some(name => target.classList.contains(name) && !isZoneTabNoiseClass(name))) return

    // 保留完整源码路径。把 .parent .title 缩成 .title 会改变落盘规则和权重。
    const selector = source.sourceSelector + (appendState ? pseudo || '' : '')
    const runtimeSelector = source.selectorPart + (appendState ? pseudo || '' : '')
    const specificity = calculateSafeSpecificity(runtimeSelector)
    if (!specificity) return
    candidates.push({ selector, runtimeSelector, specificity, sourceOrder: source.sourceOrder })
  })
  return candidates.sort(compareWriteCandidates)
}

/**
 * 从当前元素的匹配规则选默认写入目标。复用 Tab 收集的 CSSOM，不在各面板重新扫描样式表。
 * 现有状态规则优先；新增状态从基础规则选址后追加状态；无匹配规则才使用自身源码 class。
 */
function resolveDefaultWriteTarget(tab: ZoneTab, target: HTMLElement | null): StyleWriteTarget {
  if (!target) {
    return { selector: null, source: 'unsupported', candidates: [], reason: 'target-unavailable' }
  }
  if (!target.classList?.length && tab.pseudo && !tab.sourceRules.length && tab.baseRules.length &&
    !target.hasAttribute?.('data-drag-insert') && target.getAttribute('data-zone-selector')) {
    // 无自身 class 的结构选择器仍需保留基础规则的源码作用域。
    return {
      selector: resolveZoneFallbackSelector(tab), source: 'scoped-state-fallback',
      candidates: [], reason: 'classless-state-from-base-source-rule',
    }
  }
  if (!target.classList?.length || target.hasAttribute?.('data-drag-insert') ||
    !target.getAttribute('data-zone-selector')) {
    // 无 class/拖入节点继续交给宿主的 JSX inline 或预览路径，不构造新的 Less class。
    return {
      selector: tab.selector || null, source: 'host-fallback', candidates: [],
      reason: 'host-inline-or-preview',
    }
  }

  let candidates = collectRuleCandidates(tab.sourceRules, target, tab.pseudo)
  if (!candidates.length && tab.pseudo) {
    candidates = collectRuleCandidates(tab.baseRules, target, tab.pseudo, true)
  }
  if (candidates.length) {
    return {
      selector: candidates[0].selector, source: 'computed-highest-selector', candidates,
      reason: 'specificity-then-source-order',
    }
  }

  candidates = collectSubjectClassSelectors(target).flatMap(classSelector => {
    const selector = classSelector + (tab.pseudo || '')
    const specificity = calculateSafeSpecificity(selector)
    return specificity ? [{ selector, specificity, sourceOrder: -1 }] : []
  })
  if (candidates.length) {
    return {
      selector: candidates[0].selector, source: 'classname-fallback', candidates,
      reason: 'no-matching-rule-use-first-source-class',
    }
  }
  return {
    selector: null, source: 'unsupported', candidates: [], reason: 'no-writable-classname',
  }
}

/**
 * 写入执行器在提交时创建解析器，同一批属性的默认目标惰性计算一次；winner 每次实时读取，
 * 因此 record() 后的连续编辑和清空无需等待 CSSOM 重编译。
 */
export function createStyleWriteTargetResolver(
  tab: ZoneTab,
  target: HTMLElement | null = tab.target as HTMLElement || null,
  resolution: StyleResolution = getStyleResolution(tab, target)
) {
  let defaultTarget: StyleWriteTarget | undefined
  const getDefaultTarget = () => defaultTarget || (defaultTarget = resolveDefaultWriteTarget(tab, target))
  return (key: string, mode?: 'current-rule'): StyleWriteTarget => {
    if (mode === 'current-rule') {
      // 统一间距要求所有方向落在一个规则；合并 Tab 后这个规则也由权重决定。
      const current = getDefaultTarget()
      return {
        ...current, source: current.selector ? 'current-rule' : current.source,
        reason: `explicit-current-rule:${current.reason}`,
      }
    }
    const winner = resolution.get(key).winner
    if (winner?.currentState && winner.label) {
      return {
        selector: winner.label, source: winner.inline ? 'inline' : 'property-winner',
        candidates: [], reason: 'existing-property-declaration',
      }
    }
    if (winner?.currentState) {
      return { selector: null, source: 'unsupported', candidates: [], reason: 'winner-selector-unavailable' }
    }
    return getDefaultTarget()
  }
}
