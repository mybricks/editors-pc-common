import { buildSoloSelector, getSavedSoloStyle } from '../../../core/build-solo-selector'
import { isComponentScopedSelector } from '../../../core/build-zone-selectors-from-cssom'
import { parseToStyleData } from '../../../core/css-code-codec'
import { readInlineStyleProperties } from '../../../core/style-property'
import { createStyleWriteTargetResolver } from '../../../core/style-write-target'
import { collectDisplayZoneTabs } from '../../../core/zone-display-tabs'
import { collectZoneTabs } from '../../../core/zone-tab'
import type { EditorProps } from '../../../type'

function getColumnIndex(cell: HTMLTableCellElement) {
  const row = cell.parentElement as HTMLTableRowElement
  const body = row.parentElement as HTMLTableSectionElement
  if (!body.querySelector(':scope > tr > [rowspan]')) return cell.cellIndex

  // 首列跨两行时，下一行的第一个 td 虽然 cellIndex 为 0，实际属于第二列。
  // occupiedUntil 记录每列从哪一行开始空出来。rowSpan=0 会一直占到本段末尾。
  const occupiedUntil: number[] = []
  for (let i = 0; i <= row.sectionRowIndex; i++) {
    let column = 0
    for (const item of Array.from(body.rows[i].cells)) {
      while (occupiedUntil[column] > i) column++
      if (item === cell) return column
      occupiedUntil[column++] = item.rowSpan ? i + item.rowSpan : body.rows.length
    }
  }
  return -1
}

/** 仅给固定布局原生表格的 W 提供实际元素和样式来源。 */
export function getNativeTableColumnWidth(cell: Element | null, options: EditorProps['editConfig']['options']) {
  // 选中原生 td 的常规态才找列。Ant Design 的 td、Hover 等仍交给各自原来的编辑流程。
  if (!cell?.matches('tbody > tr > td[data-loc]') || cell.closest('[data-library-source]')) return
  if (!options || Array.isArray(options) || !options.zoneTab || options.zoneTab.pseudo || options.zoneTab.linkedSelector) return
  const comId = options.comId || ''
  const table = cell.closest('table')
  // 固定布局中可以按列号定位单行表头。若一个 th 横跨两列，改它的 width 会同时影响两列。
  if (!table?.dataset.loc || table.tHead?.rows.length !== 1 || getComputedStyle(table).tableLayout !== 'fixed' ||
    table.querySelector(':scope > :is(thead, tbody, tfoot) > tr > [colspan], :scope > thead > tr > [rowspan]')) return

  const index = getColumnIndex(cell as HTMLTableCellElement)
  const groups = table.querySelectorAll(':scope > colgroup')
  // 例如调整第二列，先找本表第二个 col。没有 colgroup 时，宽度由首行第二个 th 控制。
  // 多个 colgroup 或一个 col 带 span 时，col 的下标无法直接当作列号。
  if (groups.length > 1 || groups[0]?.querySelector(':scope > col[span]')) return
  const target = groups.length ? groups[0].querySelectorAll<HTMLTableColElement>(':scope > col')[index]
    : table.tHead.rows[0].cells[index]
  if (!target?.matches('th[data-loc], col[data-loc]') || target.closest('[data-library-source]')) return

  const root = table.getRootNode() as Document | ShadowRoot
  const loc = JSON.parse(target.dataset.loc!)
  if (!loc.files?.jsx) return

  const tab = collectDisplayZoneTabs([target], comId, { baseOnly: true }).mergedTabs[0]
  if (!tab) return
  // 面板按 class 收集 .headerCell。像 .table th:nth-child(2) { width: 30%; } 这样直接写在 th 上的宽度，
  // 还要按标签收集，调整第二列时才能写回这条 Less 规则。
  const tagTab = collectZoneTabs([target], [target.localName], comId, { baseOnly: true })[0]
  const structural = tagTab.sourceRules.filter(source => source.rule.style.width &&
    (source.isPageStyle || isComponentScopedSelector(source.selectorPart, comId)) &&
    !tab.sourceRules.some(item => item.rule === source.rule && item.selectorPart === source.selectorPart))
  const soloSelector = buildSoloSelector(target, tab.selector, root.getElementById(comId))
  // 表头专属规则可能还设了颜色。列宽映射只把 width 交给原有的范围切换。
  const sources = [...tab.sourceRules, ...structural].flatMap(source => {
    if (source.sourceSelector !== soloSelector || !soloSelector.includes(':nth-child(')) return [source]
    return source.rule.style.width ? [{ ...source, declarationKeys: ['width'] }] : []
  })
  tab.sourceRules = sources
  tab.baseRules = sources

  const width = createStyleWriteTargetResolver(tab, target)('width')
  if (!width.selector || width.source === 'host-fallback') return
  // map 生成的三个 th 可以共用一处 JSX。Less 还能按列区分，改这处 JSX 的内联 width 却会动到三列。
  if (width.source === 'inline' || readInlineStyleProperties(target).has('width')) {
    if (loc.swappable === false ||
      root.querySelectorAll(`${target.localName}[data-loc="${CSS.escape(target.dataset.loc!)}"]`).length !== 1) return
  }
  // 若多个 th 共用 .headerCell 的宽度，“全部”沿用这个类，“当前”取对应 th 的专属 selector。
  const selector = options.soloEdit ? soloSelector : width.selector
  return { selector, targetDom: target, zoneTab: tab }
}

type Column = NonNullable<ReturnType<typeof getNativeTableColumnWidth>>
type EditConfig = EditorProps['editConfig']

// 设计器的 value.set 同步从 edtContext.focusArea 读取 DOM 和源码位置。写列宽时两者都取自 th/col，
// 调用结束后在 finally 恢复原来的 td，下一次修改高度仍写到用户选中的元素。
export function withColumnFocus<T>(context: NonNullable<EditConfig['edtContext']>, target: HTMLElement, run: () => T): T {
  const original = context.focusArea
  context.focusArea = { ele: target, dataset: target.dataset }
  try {
    return run()
  } finally {
    context.focusArea = original
  }
}

// 比如同一条专属规则有 width: 240px 和 color: red。切回“全部”只取出 width 做备份和删除，
// 再切回“当前”就能恢复 240px，期间表头一直保留红色。
export function getColumnSoloWidthRules(column: Column, componentRoot: Element | null) {
  const root = column.targetDom.getRootNode() as Document | ShadowRoot
  const saved = getSavedSoloStyle(column.targetDom, column.zoneTab.selector, componentRoot, root)
  return (saved?.rules || []).filter(rule => rule.selector === column.selector && rule.declarationKeys.includes('width'))
    .map(rule => ({
      selector: rule.selector,
      body: `width: ${parseToStyleData(rule.body, rule.selector).width};`,
      declarationKeys: ['width'],
    }))
}
