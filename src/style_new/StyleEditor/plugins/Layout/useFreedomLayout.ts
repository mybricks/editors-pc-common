import { useCallback, useEffect, useMemo, useState } from 'react'
import { useStyleEditorContext } from '../../context'
import { readFreedomLayout, submitFreedomLayout } from '../../../core/freedom-layout'
import type { FreedomLayoutMode, LayoutChangeResult } from '../../../core/freedom-layout'

/** Layout 内部的模式回显与切换；源码解析和写入请求沿用 core 工具。 */
export function useFreedomLayout() {
  const context = useStyleEditorContext()
  const options = context?.editConfig.options
  const zoneOptions = options && !Array.isArray(options) ? options : undefined
  const pseudo = zoneOptions && 'zoneTab' in zoneOptions ? zoneOptions.zoneTab?.pseudo : undefined
  const isSoloEdit = !!(zoneOptions && 'soloEdit' in zoneOptions && zoneOptions.soloEdit)
  const componentId = zoneOptions?.comId
  const target = context?.targetDom ?? null
  const value = context?.editConfig.value

  // 样式刷新会更新 Context；DOM 引用不变时也重读标记，覆盖撤销/重做。
  const sourceFreedom = useMemo(() => readFreedomLayout(target, componentId), [context, target, componentId])
  const [freedom, setFreedom] = useState(sourceFreedom)
  // 提交后立即回显；只在源码标记变化时同步，避免旧快照覆盖点击结果。
  useEffect(() => setFreedom(sourceFreedom), [sourceFreedom])

  const changeLayout = useCallback((mode: FreedomLayoutMode): LayoutChangeResult => {
    const result: LayoutChangeResult = pseudo || isSoloEdit
      ? { submitted: false, reason: '自由布局仅支持常规态且非单独编辑模式' }
      : !value
        ? { submitted: false, reason: '自由布局操作不可用：缺少样式写入接口' }
        : submitFreedomLayout(value, target, componentId, mode)
    if (result.submitted) {
      setFreedom(mode === 'freedom')
    } else {
      console.warn('[freedom-layout]', result.reason || '自由布局请求提交失败')
    }
    return result
  }, [value, target, componentId, pseudo, isSoloEdit])

  return { freedom, changeLayout }
}
