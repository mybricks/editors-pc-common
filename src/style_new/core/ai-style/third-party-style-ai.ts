import { classMatchesShortName } from '../css-modules-match'
import { collectSubjectClassSelectors } from '../build-zone-selectors-from-cssom'
import { readStaticInlineStyleInfo } from '../style-property'
import type { ZoneTab } from '../zone-tab'
import type { StyleWriteTarget } from '../style-write-target'

/** 判断三方内部节点是否需要交给 AI，例如 input 带源码标记、searchInput class 却在外层 span 上。 */
export function shouldUseAIForThirdPartyStyle(
  target: HTMLElement | null,
  tab: ZoneTab,
  writeTargets: Map<string, StyleWriteTarget>
): boolean {
  // 1. 只处理带源码标记的三方节点；状态样式不能使用普通 inline 预览。
  if (!target?.getAttribute('data-library-source') || !target.getAttribute('data-zone-selector')) return false
  if (target.hasAttribute('data-drag-insert') || tab.pseudo) return false

  // 2. 只有找不到可写 class，或 inline 没有源码位置时才考虑 AI；后者包含上一次 AI 预览。
  const needsAIWrite = Array.from(writeTargets.entries()).some(([key, writeTarget]) => {
    const hasNoWritableClass = !writeTarget.selector && writeTarget.reason.endsWith('no-writable-classname')
    const hasUntrackedInlineStyle = writeTarget.source === 'inline' && !readStaticInlineStyleInfo(target, key)
    return hasNoWritableClass || hasUntrackedInlineStyle
  })
  if (!needsAIWrite || collectSubjectClassSelectors(target).length > 0) return false

  // 3. 确认源码 class 在组件内部的祖先上，而不在当前节点上。
  const sourceClasses = (target.getAttribute('data-zone-classnames') || '').split(/[\s,]+/).filter(Boolean)
  const matchesSourceClass = (element: Element) => sourceClasses.some(name =>
    Array.from(element.classList).some(runtime => classMatchesShortName(runtime, name)))
  if (matchesSourceClass(target)) return false

  const boundary = target.closest('[data-wrap-container]') || target.closest('[data-desn-page]')
  let parent = target.parentElement
  while (parent && parent !== boundary) {
    if (matchesSourceClass(parent)) return true
    parent = parent.parentElement
  }
  return false
}
