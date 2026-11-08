import { collectSubjectClassSelectors, resolveCssomSourceSelector } from './build-zone-selectors-from-cssom'
import { collectDisplayZoneTabs } from './zone-display-tabs'
import { splitZoneSelectorState } from './zone-tab'
import type { ZoneTab } from './zone-tab'

type AffectedScope = Element | Document | ShadowRoot

/** 将源码选择器还原为运行时选择器，供无 sourceRule 的 fallback 场景使用。 */
function resolveRuntimeSelector(selector: string, anchor: Element | null, comId: string): string {
  const runtimeClasses = new Map<string, string>()
  let current = anchor
  while (current) {
    for (const name of Array.from(current.classList)) {
      const sourceClass = resolveCssomSourceSelector(`.${name}`, current, comId)
      if (!runtimeClasses.has(sourceClass)) runtimeClasses.set(sourceClass, `.${CSS.escape(name)}`)
    }
    current = current.parentElement
  }
  // 属性字符串中的点不是 class，不能替换。
  return selector.replace(/"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'|\.[a-zA-Z_][a-zA-Z0-9_-]*/g,
    token => runtimeClasses.get(token) || token)
}

/** 按当前元素实际命中的完整 CSS 规则收集元素，不把未命中的共用 class 规则带入范围。 */
export function collectAffectedElements(
  tab: ZoneTab | null,
  fallbackSelectors: readonly string[],
  scope: AffectedScope,
  anchor: Element | null,
  comId = ''
): Set<Element> {
  const selectors = new Map<string, string>()
  if (tab) {
    // 收集真正匹配当前选中元素的 CSS 规则，而不是只收集实际写入目标。
    const target = anchor as HTMLElement | null
    if (target) {
      // Hover Tab 的完整样式来源既包含 .menu，也包含 .menu:hover，所以如果有伪类，需要合并
      const sources = tab.pseudo ? [...tab.baseRules, ...tab.sourceRules] : tab.sourceRules
      // 去重，在伪类 Tab 里，它会把基础规则和状态规则合并起来，所以可能重复
      const uniqueSources = sources.filter((source, index, all) => all.findIndex(item =>
        item.rule === source.rule && item.selectorPart === source.selectorPart
      ) === index)
      // 检查规则是否真的匹配当前元素
      uniqueSources.forEach((source) => {
        // “状态”与“匹配条件”分开，这样统计影响范围时，不要求用户此刻鼠标真的停在每个菜单上
        const { matchSelector } = splitZoneSelectorState(source.selectorPart)
        try {
          // 如 .siderContent .ant-menu：选中的 ul 必须在 siderContent 内且带 ant-menu，才保留。
          if (target.matches(matchSelector)) {
            // 按源码选择器去重，保存完整运行时选择器供后续查询 DOM。
            selectors.set(source.sourceSelector, source.selectorPart)
          }
        } catch {}
      })
    }
  } else {
    fallbackSelectors.forEach(selector => {
      selectors.set(selector, resolveRuntimeSelector(selector, anchor, comId))
    })
  }

  // 同一个 DOM 被多条规则命中时只计一次。
  const affected = new Set<Element>()
  const queriedSelectors = new Set<string>()
  selectors.forEach((runtime, selector) => {
    if (selector === 'inline') {
      if (anchor) affected.add(anchor)
      return
    }
    // 仅忽略hover等主体交互状态；where/not、属性和祖先条件仍由浏览器完整匹配。
    const { matchSelector } = splitZoneSelectorState(runtime)
    // 不同规则的匹配条件相同时，本次调用只查询一次 DOM。
    if (queriedSelectors.has(matchSelector)) return
    queriedSelectors.add(matchSelector)
    try {
      // querySelectorAll() 只查后代，不包括范围节点自己，比如 scope 本身就是那个菜单，只查里面就会漏掉它。所以查两次
      if (scope instanceof Element && scope.matches(matchSelector)) affected.add(scope)
      scope.querySelectorAll(matchSelector).forEach(element => affected.add(element))
    } catch {}
  })
  return affected
}

/** 返回常规 Tab 实际可能同步修改的元素，与面板的影响区域统计共用匹配逻辑。 */
export function getSimilarZones(
  fromEle: HTMLElement,
  scopeEle: Element | Document,
  comId: string
): HTMLElement[] {
  if (!fromEle || !scopeEle) return []
  const { mergedTabs } = collectDisplayZoneTabs([fromEle], comId, { baseOnly: true })
  const tab = mergedTabs.find(item => !item.pseudo) || null
  const scope = fromEle.closest('[data-desn-page]') || scopeEle
  const fallbackSelectors = collectSubjectClassSelectors(fromEle)
  const affected = collectAffectedElements(tab, fallbackSelectors, scope, fromEle, comId)
  const result = Array.from(affected) as HTMLElement[]
  return result
}

export type ApplyUpdateType = 'all' | 'single'

let soloEditState = false

/** 挂载时返回 isSoloEdit，卸载时恢复默认值。 */
export function setSoloEditState(isSoloEdit: boolean): void {
  soloEditState = isSoloEdit
}

/**
 * 返回当前样式面板的编辑模式勾选状态，批量编辑或单独编辑
 * 面板未挂载时返回 'all'。
 */
export function getApplyUpdateType(): ApplyUpdateType {
  return soloEditState ? 'single' : 'all'
}
