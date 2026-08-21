import { getCssVarOpacityOptions, CssVarOpacityOption } from '../../core/resolve-css-var-opacity'
import { useCanvasCssVariables } from './useCanvasCssVariables'
import type { CanvasCssVariables } from './useCanvasCssVariables'

type CanvasOpacityVariables = CanvasCssVariables<CssVarOpacityOption>

/** 读取画布节点上可用于不透明度编辑的 CSS 变量（0~1 无单位数值）。 */
export function useCanvasOpacityVariables(): CanvasOpacityVariables {
  return useCanvasCssVariables(getCssVarOpacityOptions)
}
