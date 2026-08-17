import { getCssVarLengthOptions, CssVarLengthOption } from '../../core/resolve-css-var-length'
import { useCanvasCssVariables } from './useCanvasCssVariables'
import type { CanvasCssVariables } from './useCanvasCssVariables'

type CanvasLengthVariables = CanvasCssVariables<CssVarLengthOption>

/** 读取画布节点上可用于尺寸/间距编辑的 CSS 变量。 */
export function useCanvasLengthVariables(): CanvasLengthVariables {
  return useCanvasCssVariables(getCssVarLengthOptions)
}
