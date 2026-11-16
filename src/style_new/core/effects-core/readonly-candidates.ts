import { resolveStateLinkAncestor } from '../ancestor-state-link'
import { calculateSafeSpecificity, splitTopLevelSelectors } from '../selector-utils'
import { cssPropertyName } from '../style-property'
import type { StyleSourceCandidate } from '../style-property'
import { collectZoneStyleRules, splitAncestorState, splitZoneSelectorState } from '../zone-tab'
import type { ZoneTab } from '../zone-tab'

/**
 * 补齐 Tab 来源索引之外的匹配规则，例如 Antd 的 .ant-btn-primary。
 * 这些规则只参与“删除后会露出什么样式”的判断，不加入 Tab 的可写来源，避免改写组件库样式。
 */
export function collectReadonlyCandidates(key: string, tab: ZoneTab, target: HTMLElement): StyleSourceCandidate[] {
  const property = cssPropertyName(key)
  const represented = [...tab.sourceRules, ...tab.baseRules]
  const candidates: StyleSourceCandidate[] = []
  const linkedAncestor = tab.ancestorStateLink
    ? resolveStateLinkAncestor(target, tab.ancestorStateLink) : null

  collectZoneStyleRules(target.getRootNode() as Document | ShadowRoot).forEach(({ rule, sourceOrder }) => {
    if (tab.excludedRules?.includes(rule)) return
    const value = rule.style.getPropertyValue(property).trim()
    if (!value) return
    splitTopLevelSelectors(rule.selectorText).forEach(selector => {
      // record() 可能已经更新/删除声明；不能再从尚未重编译的 CSSOM 读回旧值。
      if (represented.some(source => source.rule === rule && source.selectorPart === selector)) return
      const ancestorState = splitAncestorState(selector)
      const state = ancestorState || splitZoneSelectorState(selector)
      // 只纳入当前编辑状态适用的规则。例如编辑常规态时不能用 :hover 的阴影作后备值；
      // 编辑祖先联动状态时，还要确认触发状态的祖先确实匹配。
      if (state.pseudo && state.pseudo !== tab.pseudo) return
      if (ancestorState && !tab.ancestorStateLink) return
      try {
        if (!target.matches(state.matchSelector)) return
        if (ancestorState && !linkedAncestor?.matches(ancestorState.ancestorStateSelector)) return
      } catch { return }
      candidates.push({
        property, value, important: rule.style.getPropertyPriority(property) === 'important',
        label: selector, specificity: calculateSafeSpecificity(selector, target),
        sourceOrder, inline: false, currentState: false,
      })
    })
  })
  return candidates
}
