import type { StyleProperty } from '../style-property'

export interface MarginClearInput {
  /** 公共入口已确认整组清空且存在后备来源，传入四边的解析结果。 */
  properties: readonly (StyleProperty & {
    /** 公共层解析的后备来源信息，删除当前 winner 后是否仍有其他来源接管。 */
    hasFallback: boolean
  })[]
  /** 简写的来源解析结果，用于生成整组删除或拆写计划。 */
  shorthand: StyleProperty
}

export interface MarginPanelStateInput {
  sides: readonly {
    winner: StyleProperty['winner']
    computedValue: string | undefined
  }[]
}
