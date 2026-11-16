import type { StyleProperty } from '../../../../core/style-property'

export interface MarginClearInput {
  /** 公共入口已确认整组清空，传入四边的来源解析结果。 */
  properties: readonly StyleProperty[]
}
