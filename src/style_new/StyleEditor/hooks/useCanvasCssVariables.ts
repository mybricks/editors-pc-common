import { useMemo } from 'react'

import { useStyleEditorContext } from '../context'
import type { CssVarOption } from '../../core/css-var'

export interface CanvasCssVariables<T extends CssVarOption = CssVarOption> {
  /** 画布目标节点，作为 CSS 变量解析作用域 */
  targetDom: HTMLElement | null
  /** 该节点上当前生效、且符合当前编辑器类型的变量 */
  variableOptions: T[]
}

/**
 * 读取画布节点上可用于某类编辑器的 CSS 变量。
 *
 * 结果按 targetDom 缓存：收集函数会遍历元素全部自定义属性并逐个校验，
 * 拖拽类插件每帧重算代价明显；返回引用稳定也便于调用方放进依赖数组。
 * 代价是缓存键为节点引用——同一节点上变量值变化（如切主题）不会自动刷新，
 * 需重新选中元素触发。
 *
 * collect 必须是模块级稳定函数，否则缓存会失效。
 */
export function useCanvasCssVariables<T extends CssVarOption>(
  collect: (scopeEl?: Element | null) => T[]
): CanvasCssVariables<T> {
  const context = useStyleEditorContext()
  const targetDom = context?.targetDom ?? null
  const variableOptions = useMemo(() => collect(targetDom), [targetDom, collect])

  return { targetDom, variableOptions }
}
