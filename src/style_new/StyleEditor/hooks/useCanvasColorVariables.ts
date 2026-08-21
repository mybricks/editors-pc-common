import { getCssVarColorOptions, CssVarColorOption } from '../../core/resolve-css-var-color'
import { useCanvasCssVariables } from './useCanvasCssVariables'
import type { CanvasCssVariables } from './useCanvasCssVariables'

type CanvasColorVariables = CanvasCssVariables<CssVarColorOption>

/** 读取画布节点上可用于颜色编辑的 CSS 变量。 */
export function useCanvasColorVariables(): CanvasColorVariables {
  return useCanvasCssVariables(getCssVarColorOptions)
}
