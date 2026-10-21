import {
  buildZoneSelectorsFromCssom,
  collectSubjectClassSelectors,
  fallbackZoneSelectorsFromClassnames,
} from './build-zone-selectors-from-cssom'
import { collectSourceAntClassNames } from './style-write-target'
import { scanPseudoSelectors } from './scan-pseudo-selectors'
import { collectZoneTabs, getZoneTabLabels, mergeZoneTabsByState } from './zone-tab'
import type { ZoneTab } from './zone-tab'

/**
 * 算出元素的变体列表（即样式面板顶部的那些 tab：常规、悬浮态、激活态…），
 * 返回排好序的 tab 和展示名。
 * 样式面板和getVariations 共用
 */
export function collectDisplayZoneTabs(
  domList: Element[],
  comId: string
): Array<{ tab: ZoneTab; label: string }> {
  const result: string[] = []
  const baseSelectors: string[] = []

  for (const dom of domList) {
    // CSSOM 先收集组件样式表命中的选择器（含后代路径），内部已用 classList 补自身 class。
    // 无 comId / CSSOM 为空时直接用 classList；纯标签节点再走祖先+tag 兜底。
    // :hover 等伪类由 scanPseudoSelectors 另扫 CSSOM，不在这里拼。
    let bases = comId
      ? buildZoneSelectorsFromCssom(dom, comId)
      : collectSubjectClassSelectors(dom)
    if (!bases.length && dom.classList.length && dom.getAttribute('data-zone-selector') && !dom.hasAttribute('data-drag-insert')) {
      bases = collectSourceAntClassNames(dom).map(name => `.${name}`)
    }
    if (!bases.length) {
      bases = fallbackZoneSelectorsFromClassnames(dom)
    }

    for (const s of bases) {
      if (!baseSelectors.includes(s)) baseSelectors.push(s)
      if (!result.includes(s)) result.push(s)
    }
  }

  const tabs = collectZoneTabs(domList, baseSelectors, comId)
  const tabKeys = new Set(tabs.map((tab) => tab.selector))
  for (const pseudo of scanPseudoSelectors(baseSelectors, comId, domList)) {
    if (!tabKeys.has(pseudo) && !/:nth-child\(\d+\)$/.test(pseudo)) {
      const baseSelector = [...baseSelectors]
        .sort((a, b) => b.length - a.length)
        .find((base) => pseudo.startsWith(base)) || pseudo
      tabs.push({
        selector: pseudo,
        baseSelector,
        pseudo: pseudo.slice(baseSelector.length) || null,
        sourceRules: [],
        baseRules: [],
        effectiveStyle: {},
      })
    }
  }
  // 保持 CSSOM 命中顺序，同时把没有可读 sourceRule 的兼容 fallback 放在末尾。
  const ordered = result.map((selector) => tabs.find((tab) => tab.selector === selector)).filter(Boolean) as ZoneTab[]
  tabs.filter((tab) => !result.includes(tab.selector)).forEach((tab) => ordered.push(tab))
  const merged = mergeZoneTabsByState(ordered)
  const labels = getZoneTabLabels(merged.map((tab) => tab.selector))
  // 未配置中文名的伪类保留 CSSOM 顺序，但整体排在已命名状态之后。
  const displayTabs = merged
    .map((tab, index) => ({ tab, label: labels[index], index }))
    .sort((a, b) => {
      const getRank = (item: { tab: ZoneTab; label: string }) => {
        if (!item.tab.pseudo) return 0
        return item.label === item.tab.pseudo ? 2 : 1
      }
      const byRank = getRank(a) - getRank(b)
      return byRank || a.index - b.index
    })
  return displayTabs
}
