import { buildSoloSelector } from '../../../core/build-solo-selector'
import { isComponentScopedSelector } from '../../../core/build-zone-selectors-from-cssom'
import { readInlineStyleProperties } from '../../../core/style-property'
import { createStyleWriteTargetResolver } from '../../../core/style-write-target'
import { collectDisplayZoneTabs } from '../../../core/zone-display-tabs'
import { collectZoneTabs } from '../../../core/zone-tab'
import type { ZoneTab } from '../../../core/zone-tab'
import type { EditorProps } from '../../../type'

const LIBRARY_SOURCE_SELECTOR = '[data-library-source]'
const CELL_SELECTOR = 'tbody > tr > td[data-loc]'
const HEAD_RULES_SELECTOR = ':scope > :is(thead, tbody, tfoot) > tr > [colspan], :scope > thead > tr > [rowspan]'

export type ColumnWidthTarget = {
  targetDom: HTMLElement
  zoneTab: ZoneTab
  selector: string
}

type EditOptions = Exclude<EditorProps['editConfig']['options'], Array<any> | undefined>

/** 填满 / 适应内容暂不映射到表头；undefined 表示清除，仍要映射到表头。 */
function shouldMapWidth(value: unknown): boolean {
  return value !== 'fit-content' && value !== '100%';
}

/** 从一批修改里拆出要写表头的宽度项；rest 保持原有顺序，其余属性仍写当前元素。 */
export function splitColumnWidthChange<T extends { key: string; value: unknown }>(
  items: T[],
): { width?: T; rest: T[] } {
  const index = items.findIndex(item => item.key === 'width' && shouldMapWidth(item.value));
  if (index < 0) return { rest: items };
  return { width: items[index], rest: items.filter((_, itemIndex) => itemIndex !== index) };
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

function readLoc(target: HTMLElement): { swappable?: boolean; files?: { jsx?: unknown } } | undefined {
  try {
    return target.dataset.loc ? JSON.parse(target.dataset.loc) : undefined
  } catch {
    return undefined
  }
}

/** 把适配器需要判断的结构信息收敛在这里，主流程只做顺序判断。 */
function getColumnHeader(cell: HTMLElement, table: HTMLTableElement): HTMLElement | undefined {
  if (cell.colSpan !== 1) return
  const index = getColumnIndex(cell as HTMLTableCellElement)
  if (index < 0) return

  const groups = table.querySelectorAll(':scope > colgroup')
  // 多个 colgroup 或一个 col 带 span 时，col 的下标无法直接当作列号。
  if (groups.length > 1 || groups[0]?.querySelector(':scope > col[span]')) return
  const target = (groups.length
    ? groups[0].querySelectorAll<HTMLTableColElement>(':scope > col')[index]
    : table.tHead?.rows[0]?.cells[index]) as HTMLElement | undefined
  if (!target || (target.localName !== 'th' && target.localName !== 'col')) return
  if (!target.dataset.loc || target.closest(LIBRARY_SOURCE_SELECTOR)) return
  return target
}

function readColumnTab(target: HTMLElement, comId: string): ZoneTab | undefined {
  const tab = collectDisplayZoneTabs([target], comId, { baseOnly: true }).mergedTabs[0]
  if (!tab) return
  // 面板按 class 收集 .headerCell。像 .table th:nth-child(2) { width: 30%; } 这样直接写在 th 上的宽度，
  // 还要按标签收集，调整第二列时才能写回这条 Less 规则。
  const tagTab = collectZoneTabs([target], [target.localName], comId, { baseOnly: true })[0]
  const structural = tagTab
    ? tagTab.sourceRules.filter(source => source.rule.style.width &&
        (source.isPageStyle || isComponentScopedSelector(source.selectorPart, comId)) &&
        !tab.sourceRules.some(item => item.rule === source.rule && item.selectorPart === source.selectorPart))
    : []
  if (structural.length) {
    tab.sourceRules = [...tab.sourceRules, ...structural]
    tab.baseRules = tab.sourceRules
  }
  return tab
}

/**
 * 原生固定布局表格里，选中 tbody 单元格改宽度时，实际把宽度写到对应的表头（或 col）。
 * 返回 undefined 表示这次修改仍按原路径写到选中元素。
 */
export function resolveColumnWidthTarget(
  cell: HTMLElement | null | undefined,
  options: EditorProps['editConfig']['options'] | undefined,
): ColumnWidthTarget | undefined {
  // 只处理常规态下选中的原生表格单元格；三方组件库由原有 AI / 预览链路处理。
  if (!cell || cell.localName !== 'td' || !cell.matches(CELL_SELECTOR)) return
  if (cell.closest(LIBRARY_SOURCE_SELECTOR)) return
  if (!options || Array.isArray(options)) return
  const zoneTab = options.zoneTab
  if (!zoneTab || zoneTab.pseudo || zoneTab.linkedSelector) return

  const table = cell.closest('table') as HTMLTableElement | null
  // 固定布局中可以按列号定位单行表头。若一个 th 横跨两列，改它的 width 会同时影响两列。
  if (!table?.dataset.loc || !table.tHead || table.tHead.rows.length !== 1) return
  if ((table.ownerDocument.defaultView || window).getComputedStyle(table).tableLayout !== 'fixed') return
  if (table.querySelector(HEAD_RULES_SELECTOR)) return

  const target = getColumnHeader(cell, table)
  if (!target) return
  const loc = readLoc(target)
  if (!loc?.files?.jsx) return

  const comId = options.comId || ''
  const tab = readColumnTab(target, comId)
  if (!tab) return

  const width = createStyleWriteTargetResolver(tab, target)('width')
  if (!width.selector || width.source === 'host-fallback') return

  // 多个 th 共用一处 JSX 时，改内联 width 会同时动到多列。
  if (width.source === 'inline' || readInlineStyleProperties(target).has('width')) {
    const root = target.getRootNode() as Document | ShadowRoot
    if (loc.swappable === false ||
      root.querySelectorAll(`${target.localName}[data-loc="${CSS.escape(target.dataset.loc!)}"]`).length !== 1) return
  }

  // “应用至全部”沿用表头自己的选址；“只修改当前区域”写这一列专属的单独规则。
  const componentRoot = comId ? (target.getRootNode() as Document | ShadowRoot).getElementById(comId) : null
  const selector = options.soloEdit
    ? buildSoloSelector(target, tab.selector, componentRoot)
    : width.selector

  return { targetDom: target, zoneTab: tab, selector }
}
