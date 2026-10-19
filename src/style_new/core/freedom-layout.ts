import { collectZoneTabs, mergeZoneTabsByState } from './zone-tab'
import { createStyleResolution } from './style-property'
import { createStyleWriteTargetResolver } from './style-write-target'
import type { EditorProps } from '../type'

export const LAYOUT_MODE_KEY = '--layout-mode'
export type FreedomLayoutMode = 'freedom' | 'row' | 'column' | 'default' | 'inline' | 'reset'
/** 仅表示请求已提交；原有 value.set 返回 void，不能据此确认组件库已完成转换。 */
export type LayoutChangeResult = { submitted: boolean; reason?: string }

function inspectTarget(target: HTMLElement, componentId?: string) {
  const classes = Array.from(target.classList, name => '.' + name)
  const tab = mergeZoneTabsByState(collectZoneTabs([target], classes, componentId)).find(tab => !tab.pseudo)
  return tab ? { tab, resolution: createStyleResolution(tab, target) } : null
}

/** 只读目标自身的声明；CSS 自定义属性的继承值不能代表子容器模式。 */
export function readFreedomLayout(target: HTMLElement | null, componentId?: string): boolean {
  return !!target && inspectTarget(target, componentId)?.resolution.get(LAYOUT_MODE_KEY).winner?.value.trim() === 'freedom'
}

/** 进入时只提交标记，父 display/position 由宿主完成全部子节点测量后再写入。 */
export function createLayoutStylePatch(mode: FreedomLayoutMode, display: string): Record<string, any> {
  if (mode === 'freedom') return { [LAYOUT_MODE_KEY]: 'freedom' }
  const isInline = ['inline', 'inline-flex', 'inline-block'].includes(display)
  const style: Record<string, any> = {
    [LAYOUT_MODE_KEY]: null,
    display: mode === 'row' || mode === 'column' ? (isInline ? 'inline-flex' : 'flex')
      : mode === 'inline' ? 'inline' : (isInline && mode !== 'reset' ? 'inline-block' : 'block'),
  }
  if (mode === 'row' || mode === 'column') style.flexDirection = mode
  if (mode === 'reset') Object.assign(style, {
    flexDirection: null, flexFlow: null, flexWrap: null, alignItems: null, justifyContent: null,
    gap: null, rowGap: null, columnGap: null,
    overflow: null, paddingTop: null, paddingRight: null, paddingBottom: null, paddingLeft: null,
  })
  return style
}

export function submitFreedomLayout(
  value: EditorProps['editConfig']['value'],
  container: HTMLElement | null,
  componentId: string | undefined,
  mode: FreedomLayoutMode,
): LayoutChangeResult {
  if (!container?.isConnected || !componentId) return { submitted: false, reason: '无法定位元素的样式源码，请重新选择容器' }
  try {
    const inspected = inspectTarget(container, componentId)
    if (!inspected) return { submitted: false, reason: '无法定位元素的样式源码，请重新选择容器' }
    const { tab, resolution } = inspected
    const selector = createStyleWriteTargetResolver(tab, container, resolution)(LAYOUT_MODE_KEY).selector
    if (!selector || selector === 'inline') return { submitted: false, reason: '自由布局暂不支持内联样式或缺少 selector 的目标' }
    const display = container.ownerDocument.defaultView!.getComputedStyle(container).display
    // 不传 DOM、批量计划或文件路径；宿主通过既有 focusArea 和 data-loc 解析。
    value.set(createLayoutStylePatch(mode, display), { selector })
    return { submitted: true }
  } catch (error) {
    return { submitted: false, reason: error instanceof Error ? error.message : '自由布局请求提交失败' }
  }
}
