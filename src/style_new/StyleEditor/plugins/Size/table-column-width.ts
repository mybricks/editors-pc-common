import { buildSoloSelector } from '../../../core/build-solo-selector'
import { isComponentScopedSelector } from '../../../core/build-zone-selectors-from-cssom'
import { readInlineStyleProperties } from '../../../core/style-property'
import { createStyleWriteTargetResolver } from '../../../core/style-write-target'
import { collectDisplayZoneTabs } from '../../../core/zone-display-tabs'
import { collectZoneTabs } from '../../../core/zone-tab'
import type { ZoneTab, ZoneSourceRule } from '../../../core/zone-tab'
import type { EditorProps } from '../../../type'

/**
 * 表格列宽映射：选中单元格改宽度时，把宽度写回同列表头（或 col）。
 *
 * 命中以下全部条件才映射，任一不满足按原路径写选中元素：
 *   1. 选中的是原生表格 tbody 里的 td[data-loc]，且不在 data-library-source 内
 *   2. 处于常规编辑上下文（无 pseudo / linkedSelector）
 *   3. 表格带 data-loc、table-layout: fixed、单行表头、无 colspan / rowspan
 *   4. 同列表头是 th 或 col，带 data-loc 且来自 jsx
 *   5. 宽度有可写来源；内联写入时不会波及同文件的多列
 */

const LIBRARY_SOURCE_SELECTOR = '[data-library-source]'
const MAP_CELL_SELECTOR = 'tbody > tr > td[data-loc]'
const SPANNING_HEADER_SELECTOR = ':scope > :is(thead, tbody, tfoot) > tr > [colspan], :scope > thead > tr > [rowspan]'

export type ColumnWidthTarget = {
  targetDom: HTMLElement
  zoneTab: ZoneTab
  selector: string
}

type EditOptions = Extract<EditorProps['editConfig']['options'], { selector: string }>

/* ------------------------------------------------------------------ 单条判定 */

/** 填满 / 适应内容暂不映射到表头；undefined 表示清除，仍要映射到表头。 */
const shouldMapWidth = (value: unknown) => value !== 'fit-content' && value !== '100%'

/** 这一项是否要写表头：宽度，且不是填满 / 适应内容。 */
export function isColumnWidthChange(item: { key: string; value: unknown }): boolean {
  return item.key === 'width' && shouldMapWidth(item.value)
}

/* ------------------------------------------------------------------ 结构判定 */

/** 条件 1：选中的是原生表格单元格；三方组件库由原有 AI / 预览链路处理。 */
function isNativeTableCell(cell: HTMLElement | null | undefined): cell is HTMLElement {
  return !!cell && cell.localName === 'td' && cell.matches(MAP_CELL_SELECTOR) &&
    !cell.closest(LIBRARY_SOURCE_SELECTOR)
}

/** 条件 2：常规编辑上下文，伪类 / 祖先联动选择器不走映射。 */
function isRegularEditContext(options: EditorProps['editConfig']['options'] | undefined): options is EditOptions {
  if (!options || Array.isArray(options)) return false
  const { zoneTab } = options
  return !!zoneTab && !zoneTab.pseudo && !zoneTab.linkedSelector
}

/**
 * 条件 3：固定布局中可以按列号定位单行表头。
 * 若一个 th 横跨两列，改它的 width 会同时影响两列，因此跨列 / 跨行都不映射。
 */
function getFixedLayoutTable(cell: HTMLElement): HTMLTableElement | undefined {
  const table = cell.closest('table') as HTMLTableElement | null
  if (!table?.dataset.loc || !table.tHead || table.tHead.rows.length !== 1) return
  if ((table.ownerDocument.defaultView || window).getComputedStyle(table).tableLayout !== 'fixed') return
  if (table.querySelector(SPANNING_HEADER_SELECTOR)) return
  return table
}

/** 存在跨行表头时，按上一行已占用的列往后找当前单元格真正的列号。 */
export function getColumnIndex(cell: HTMLTableCellElement): number {
  const row = cell.parentElement as HTMLTableRowElement | null
  const section = row?.parentElement as HTMLTableSectionElement | null
  if (!row || !section) return -1
  if (!section.querySelector(':scope > tr > [rowspan]')) return cell.cellIndex

  // 首列跨两行时，下一行的第一个 td 虽然 cellIndex 为 0，实际属于第二列。
  // occupiedUntil 记录每列从哪一行开始空出来。rowSpan=0 会一直占到本段末尾。
  const occupiedUntil: number[] = []
  for (let i = 0; i <= row.sectionRowIndex; i++) {
    const currentRow = section.rows[i]
    if (!currentRow) return -1
    let column = 0
    for (const item of Array.from(currentRow.cells)) {
      while ((occupiedUntil[column] || 0) > i) column++
      if (item === cell) return column
      occupiedUntil[column++] = item.rowSpan ? i + item.rowSpan : section.rows.length
    }
  }
  return -1
}

/** 按列号取出表头元素：优先 colgroup 的 col，否则单行表头的 cell。 */
function getHeaderElement(table: HTMLTableElement, index: number): Element | undefined {
  const groups = table.querySelectorAll(':scope > colgroup')
  // 多个 colgroup 或一个 col 带 span 时，col 的下标无法直接当作列号。
  if (groups.length > 1 || groups[0]?.querySelector(':scope > col[span]')) return
  return groups.length
    ? groups[0].querySelectorAll<HTMLTableColElement>(':scope > col')[index]
    : table.tHead?.rows[0]?.cells[index]
}

/** 条件 4 前半：同列的表头是 th 或 col，且带可写入的源码定位。 */
function getColumnHeader(cell: HTMLTableCellElement, table: HTMLTableElement): HTMLElement | undefined {
  if (cell.colSpan !== 1) return
  const index = getColumnIndex(cell)
  if (index < 0) return
  const target = getHeaderElement(table, index) as HTMLElement | undefined
  if (!target || (target.localName !== 'th' && target.localName !== 'col')) return
  if (!target.dataset.loc || target.closest(LIBRARY_SOURCE_SELECTOR)) return
  return target
}

/* ------------------------------------------------------------------ 选址 */

function readLoc(target: HTMLElement): { swappable?: boolean; files?: { jsx?: unknown } } | undefined {
  try {
    return target.dataset.loc ? JSON.parse(target.dataset.loc) : undefined
  } catch {
    return undefined
  }
}

/** 只认同作用域内、且 tab 里还没有的 width 规则。 */
function isStructuralWidthRule(source: ZoneSourceRule, tab: ZoneTab, comId: string): boolean {
  if (!source.rule.style.width) return false
  if (!source.isPageStyle && !isComponentScopedSelector(source.selectorPart, comId)) return false
  return !tab.sourceRules.some(item => item.rule === source.rule && item.selectorPart === source.selectorPart)
}

/** 条件 4 后半：收集可写入列宽的表头 Tab。 */
function readColumnTab(target: HTMLElement, comId: string): ZoneTab | undefined {
  const tab = collectDisplayZoneTabs([target], comId, { baseOnly: true }).mergedTabs[0]
  if (!tab) return
  // 面板按 class 收集 .headerCell；像 .table th:nth-child(2) { width: 30%; } 这样直接写在 th 上的宽度，
  // 还要按标签收集，调整第二列时才能写回这条 Less 规则。
  const tagTab = collectZoneTabs([target], [target.localName], comId, { baseOnly: true })[0]
  const structural = (tagTab?.sourceRules ?? []).filter(source => isStructuralWidthRule(source, tab, comId))
  if (structural.length) {
    tab.sourceRules = [...tab.sourceRules, ...structural]
    tab.baseRules = tab.sourceRules
  }
  return tab
}

/** 条件 5 前半：宽度有可写来源，且不能是宿主兜底。 */
function getWidthWrite(tab: ZoneTab, target: HTMLElement) {
  const { selector, source } = createStyleWriteTargetResolver(tab, target)('width')
  return selector && source !== 'host-fallback' ? { selector, source } : undefined
}

/** 条件 5 后半：多个 th 共用一处 JSX 时，改内联 width 会同时动到多列。 */
function canWriteInlineWidth(target: HTMLElement, loc: { swappable?: boolean }): boolean {
  if (loc.swappable === false) return false
  const root = target.getRootNode() as Document | ShadowRoot
  return root.querySelectorAll(`${target.localName}[data-loc="${CSS.escape(target.dataset.loc!)}"]`).length === 1
}

/** “应用至全部”沿用表头自己的选址；“只修改当前区域”写这一列专属的单独规则。 */
function buildWidthSelector(
  selector: string,
  tab: ZoneTab,
  target: HTMLElement,
  comId: string,
  soloEdit: boolean | undefined,
): string {
  if (!soloEdit) return selector
  const componentRoot = comId ? (target.getRootNode() as Document | ShadowRoot).getElementById(comId) : null
  return buildSoloSelector(target, tab.selector, componentRoot)
}

/* ------------------------------------------------------------------ 入口 */

/**
 * 原生固定布局表格里，选中 tbody 单元格改宽度时，实际把宽度写到对应的表头（或 col）。
 * 返回 undefined 表示这次修改仍按原路径写到选中元素。
 */
export function resolveColumnWidthTarget(
  cell: HTMLElement | null | undefined,
  options: EditorProps['editConfig']['options'] | undefined,
): ColumnWidthTarget | undefined {
  if (!isNativeTableCell(cell)) return
  if (!isRegularEditContext(options)) return
  const table = getFixedLayoutTable(cell)
  if (!table) return
  const target = getColumnHeader(cell as HTMLTableCellElement, table)
  if (!target) return
  const loc = readLoc(target)
  if (!loc?.files?.jsx) return
  const comId = options.comId || ''
  const tab = readColumnTab(target, comId)
  if (!tab) return
  const width = getWidthWrite(tab, target)
  if (!width) return
  // 内联写入才需要唯一性校验；写规则文件不按元素定位，不受影响。
  if (width.source === 'inline' || readInlineStyleProperties(target).has('width')) {
    if (!canWriteInlineWidth(target, loc)) return
  }
  const selector = buildWidthSelector(width.selector, tab, target, comId, options.soloEdit)
  return { targetDom: target, zoneTab: tab, selector }
}
