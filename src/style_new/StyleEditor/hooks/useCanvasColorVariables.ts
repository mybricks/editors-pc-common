import { useMemo } from 'react'

import { useStyleEditorContext } from '../context'
import { getCssVarColorOptions, CssVarColorOption } from '../../core/resolve-css-var-color'

interface CanvasColorVariables {
  /** 画布目标节点，作为 CSS 变量解析作用域 */
  targetDom: HTMLElement | null
  /** 该节点上当前生效的颜色变量 */
  variableOptions: CssVarColorOption[]
}

/**
 * 读取画布节点上可用于颜色编辑的 CSS 变量。
 *
 * 结果按 targetDom 缓存：getCssVarColorOptions 会遍历元素全部自定义属性并逐个
 * 解析颜色，拖拽类插件每帧重算代价明显；返回引用稳定也便于调用方放进依赖数组。
 * 代价是缓存键为节点引用——同一节点上变量值变化（如切主题）不会自动刷新，
 * 需重新选中元素触发。
 */
export function useCanvasColorVariables(): CanvasColorVariables {
  const context = useStyleEditorContext()
  const targetDom = context?.targetDom ?? null
  const variableOptions = useMemo(() => getCssVarColorOptions(targetDom), [targetDom])

  return { targetDom, variableOptions }
}
