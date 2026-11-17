import type { MarginPanelStateInput } from './type'

/** 无声明或只剩 unset 时折叠，避免删掉最后一条 unset 后重新展开空面板。 */
export function shouldCollapseEmptyMargin({ sides }: MarginPanelStateInput): boolean {
  return sides.every(({ winner, computedValue }) => {
    // 显式 0、基础态和运行时规则仍是有效配置，不能仅按数值为零折叠。
    if (winner) return /^unset$/i.test(winner.value.trim())
    // 没有声明的方向还可能有浏览器默认边距，需要保留展示。
    const value = computedValue?.trim()
    return !value || value === '0' || value === '0px'
  })
}
