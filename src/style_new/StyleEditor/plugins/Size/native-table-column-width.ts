import { isComponentScopedSelector, resolveCssomSourceSelector } from '../../../core/build-zone-selectors-from-cssom'
import { findCascadeWinnerDetail } from '../../../core/cascade-winner'
import { splitTopLevelSelectors } from '../../../core/selector-utils'
import { getStyleResolution, readStaticInlineStyleInfo } from '../../../core/style-property'
import { createStyleWriteTargetResolver } from '../../../core/style-write-target'
import type { StylePlanItem } from '../../../core/freedom-plan'
import type { EditorProps } from '../../../type'
import type { StyleChangeItem, StyleChangeResult } from '../../type'

function getColumnHeader(cell: HTMLTableCellElement, headerRow: HTMLTableRowElement) {
  const row = cell.parentElement as HTMLTableRowElement
  const body = row.parentElement as HTMLTableSectionElement
  if (!body.querySelector(':scope > tr > [rowspan]')) return headerRow.cells[cell.cellIndex]

  // cellIndex 只数本行的单元格。上一行跨下来的列仍被占用，要跳过才能对上表头。
  const occupiedUntil: number[] = []
  for (let i = 0; i <= row.sectionRowIndex; i++) {
    let column = 0
    for (const item of Array.from(body.rows[i].cells)) {
      while (occupiedUntil[column] > i) column++
      if (item === cell) return headerRow.cells[column]
      occupiedUntil[column] = item.rowSpan === 0 ? body.rows.length : i + item.rowSpan
      column++
    }
  }
}

/** 固定布局优先由 col 定列宽，没有 colgroup 时由第一行表头定宽。 */
export function resolveNativeTableColumnWidth(cell: HTMLElement | null, options: EditorProps['editConfig']['options']) {
  if (!cell?.matches('tbody > tr > td[data-loc]') || cell.closest('[data-library-source]')) return
  if (!options || Array.isArray(options) || !options.zoneTab || options.zoneTab.pseudo || options.zoneTab.linkedSelector) return
  const table = cell.closest('table')
  if (!table?.dataset.loc || table.tHead?.rows.length !== 1 || getComputedStyle(table).tableLayout !== 'fixed' ||
    table.querySelector(':scope > :is(thead, tbody, tfoot) > tr > [colspan], :scope > :is(thead, tfoot) > tr > [rowspan]')) return

  const header = getColumnHeader(cell as HTMLTableCellElement, table.tHead.rows[0])
  if (header?.tagName !== 'TH') return
  let widthTarget: HTMLElement = header
  const groups = table.querySelectorAll(':scope > colgroup')
  if (groups.length) {
    // 一列对应一个 col 时，直接改当前表的列定义；跨列定义不能按下标定位。
    if (groups.length !== 1 || groups[0].querySelector(':scope > col[span]')) return
    const col = groups[0].querySelectorAll<HTMLTableColElement>(':scope > col')[header.cellIndex]
    if (!col) return
    widthTarget = col
  }
  if (!widthTarget.dataset.loc || widthTarget.closest('[data-library-source]')) return
  const loc = JSON.parse(widthTarget.dataset.loc)
  const root = table.getRootNode() as Document | ShadowRoot
  if (!loc.files?.jsx || loc.swappable === false ||
    root.querySelectorAll(`${widthTarget.localName}[data-loc="${CSS.escape(widthTarget.dataset.loc)}"]`).length !== 1) return

  const winner = findCascadeWinnerDetail(widthTarget, 'width')
  let selector = 'inline'
  if (!widthTarget.style.width || winner?.important) {
    // 只复用单独命中本列的业务规则，例如 .colSecond 或 .ruleTable th:nth-child(2)。
    const runtimeSelector = winner?.rule?.selectorText
    if (loc.files.less && runtimeSelector && splitTopLevelSelectors(runtimeSelector).length === 1 &&
      isComponentScopedSelector(runtimeSelector, options.comId || '') && root.querySelectorAll(runtimeSelector).length === 1) {
      selector = resolveCssomSourceSelector(runtimeSelector, widthTarget, options.comId || '')
    }
  }
  if (selector === 'inline' && (winner?.important || (widthTarget.style.width && !readStaticInlineStyleInfo(widthTarget, 'width')))) return

  const tab = options.zoneTab
  const soloSelector = options.soloEdit ? options.selector : undefined
  const column = {
    width: (selector === 'inline' ? widthTarget.style.width : winner?.value) || undefined,
    apply(change: StyleChangeItem | StyleChangeItem[]): StyleChangeResult | undefined {
      const items = Array.isArray(change) ? change : [change]
      const width = items.find(item => item.key === 'width')
      if (!width) return

      const changes: StylePlanItem[] = []
      if (selector !== 'inline' || widthTarget.style.width !== (width.value ?? '')) {
        const value = width.value != null && winner?.important ? `${width.value} !important` : width.value
        changes.push({ target: widthTarget, selector, lessFile: loc.files.less, style: { width: value } })
      }
      // 锁定宽高和面板重置会同时提交多个字段。其余字段仍写 td，整次操作共用一份计划。
      const otherItems = items.filter(item => item.key !== 'width')
      if (otherItems.length) {
        const resolution = getStyleResolution(tab, cell)
        const resolveTarget = createStyleWriteTargetResolver(tab, cell, resolution)
        const lessFile = JSON.parse(cell.dataset.loc!).files.less
        for (const { key, value } of otherItems) {
          const { winner, clearPlan } = resolution.get(key)
          let cellSelector: string | null
          let cellValue = value
          if (value === null) {
            if (!('selector' in clearPlan)) {
              if (clearPlan.action === 'noop') continue
              return { applied: false, clearUnsupported: true }
            }
            cellSelector = soloSelector ?? clearPlan.selector
            cellValue = soloSelector ? (winner?.important ? 'unset !important' : 'unset') : clearPlan.value
          } else {
            const target = resolveTarget(key)
            cellSelector = soloSelector ?? (target.source === 'host-fallback' ? 'inline' : target.selector)
            if (winner?.important && cellSelector !== 'inline') cellValue = `${value} !important`
          }
          if (!cellSelector) return { applied: false }
          changes.push({ target: cell, selector: cellSelector, lessFile, style: { [key]: cellValue } })
        }
      }
      if (changes.length) {
        try {
          (window as any).__mybricks_applyStylePlan({ changes })
        } catch (error) {
          // JSX 的 {...props} 在 DOM 中不可见。宿主准备补丁时拒绝动态 style，交回 td 原入口。
          if (error instanceof Error && /^freeform (?:inline |无法备份动态布局属性 )/.test(error.message)) return
          throw error
        }
        changes.filter(item => item.target === cell).forEach(({ selector, style }) =>
          Object.entries(style).forEach(([key, value]) => getStyleResolution(tab, cell).record(key, value, selector)))
      }
      column.width = width.value ?? undefined
      return { applied: true, clearApplied: items.some(item => item.value === null) }
    },
  }
  return column
}
