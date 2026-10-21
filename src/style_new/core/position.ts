import type { CSSProperties } from 'react'

/** 使用布局坐标；传入直接父容器时，扣除它在原 offsetParent 下的偏移。 */
function computeDomOffset(dom: HTMLElement, relativeTo = dom.offsetParent as HTMLElement | null) {
  let top = dom.offsetTop
  let left = dom.offsetLeft
  if (relativeTo && relativeTo !== dom.offsetParent) {
    top -= relativeTo.offsetTop + relativeTo.clientTop
    left -= relativeTo.offsetLeft + relativeTo.clientLeft
  }
  return { top: Math.round(top), left: Math.round(left) }
}

function computeDomSize(dom: HTMLElement) {
  return { width: Math.round(dom.offsetWidth), height: Math.round(dom.offsetHeight) }
}

function isUnconfiguredSize(value: unknown): boolean {
  return value == null || value === '' || value === 'auto' || value === 'inherit'
}

/** Position 和 freeform 共用的样式增量，只测量和生成数据。 */
export function createAbsolutePatch(dom: HTMLElement | null, value: CSSProperties, relativeTo?: HTMLElement): CSSProperties {
  const offset = dom ? computeDomOffset(dom, relativeTo) : { top: 0, left: 0 }
  const size = dom ? computeDomSize(dom) : null
  const style: CSSProperties = {
    position: 'absolute',
    left: `${offset.left}px`,
    top: `${offset.top}px`,
  }
  if (size && isUnconfiguredSize(value.width)) style.width = `${size.width}px`
  if (size && isUnconfiguredSize(value.height)) style.height = `${size.height}px`
  return style
}
