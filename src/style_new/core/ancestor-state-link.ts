import { buildSoloSelector } from './build-solo-selector'
import { collectZoneTabs, mergeZoneTabsByState, selectorSubjectStart, isAncestorLinkPseudo } from './zone-tab'
import type { AncestorLinkPseudo, ZoneTab } from './zone-tab'
import { getStatePreviewContext } from './state-preview'
import { getDocument } from './dom'
import { collectSubjectClassSelectors } from './build-zone-selectors-from-cssom'

export type AncestorStateLink = { ancestorDepth: number; selector: string; pseudo: AncestorLinkPseudo }

/** 只沿真实祖先链读取手动预览，最近的受支持状态祖先优先。 */
export function getNearestStateAncestor(target: Element | null) {
  let ancestor = target?.parentElement || null
  let ancestorDepth = 1
  while (ancestor) {
    const preview = getStatePreviewContext(ancestor)
    if (preview && isAncestorLinkPseudo(preview.pseudo)) return { ancestor, ancestorDepth, preview }
    ancestor = ancestor.parentElement
    ancestorDepth++
  }
  return null
}

/** 按固定层级找当前祖先，不长期引用重编译前的 DOM。 */
export function resolveStateLinkAncestor(target: Element | null, link: AncestorStateLink): Element | null {
  let ancestor = target
  for (let depth = 0; depth < link.ancestorDepth; depth++) ancestor = ancestor?.parentElement || null
  return ancestor
}

/** 批量沿用祖先 Tab 作用域；祖先 solo 时保留它自己的定位范围。 */
export function createAncestorStateLink(target: Element, baseSelector: string, comId: string): AncestorStateLink | null {
  const nearest = getNearestStateAncestor(target)
  if (!nearest) return null
  const { ancestor, ancestorDepth, preview } = nearest
  if (preview.tab.isAdded) {
    // 手动新增的空状态只是临时 Tab；实际写入对应状态样式后才允许后代联动。
    // 通过父级是否保存了变体样式判断
    const persisted = collectZoneTabs([ancestor], [preview.tab.baseSelector], comId).some(tab =>
      tab.pseudo === preview.pseudo && tab.sourceRules.some(source => source.rule.style.length > 0))
    if (!persisted) return null
  }
  let ancestorSelector = preview.tab.baseSelector
  if (!preview.batch) {
    const root = comId ? getDocument().getElementById(comId) : null
    ancestorSelector = buildSoloSelector(ancestor, ancestorSelector, root)
  }
  const subject = baseSelector.slice(selectorSubjectStart(baseSelector))
  return { ancestorDepth, selector: `${ancestorSelector}${preview.pseudo} ${subject}`, pseudo: preview.pseudo as AncestorLinkPseudo }
}

/** 接入祖先状态规则，回显和已有属性写入沿用原状态求值；新属性默认使用联动地址。 */
export function collectAncestorStateLinkTab(target: Element, baseTab: ZoneTab, link: AncestorStateLink, comId = ''): ZoneTab {
  const selectors = Array.from(new Set([baseTab.baseSelector, ...collectSubjectClassSelectors(target)]))
  const tabs = mergeZoneTabsByState(collectZoneTabs([target], selectors, comId, { includeAncestorState: true }))
  const stateTab = tabs.find(tab => tab.pseudo === link.pseudo)
  const normal = tabs.find(tab => !tab.pseudo)
  const sourceRules = stateTab?.sourceRules || []
  return { ...baseTab, pseudo: link.pseudo, selector: `${baseTab.baseSelector}${link.pseudo}`,
    sourceRules, linkedRules: sourceRules, baseRules: normal?.baseRules || baseTab.baseRules,
    effectiveStyle: {}, effectedCssResult: undefined, ancestorStateLink: link, linkedSelector: link.selector }
}

export function hasAncestorStateLinkRule(tab: ZoneTab, link: AncestorStateLink): boolean {
  return (tab.linkedRules || tab.sourceRules).some(source =>
    source.sourceSelector === link.selector && source.rule.style.length > 0)
}
