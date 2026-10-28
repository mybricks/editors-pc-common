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

/** SVG 没有 offset 坐标：找到定位容器，将屏幕矩形换算为布局坐标。 */
function computeSvgOffset(dom: SVGElement, computed: CSSStyleDeclaration) {
  const view = dom.ownerDocument.defaultView!
  const rect = dom.getBoundingClientRect()
  // 1. 从直接父级向上查找定位容器；每层只读取一次计算样式，命中后停止。
  let parent = dom.parentElement
  let parentComputed!: CSSStyleDeclaration
  while (parent) {
    const style = view.getComputedStyle(parent)
    if (style.position !== 'static' || style.transform !== 'none' || style.perspective !== 'none'
      || style.filter !== 'none' || /layout|paint|strict|content/.test(style.getPropertyValue('contain'))
      || /transform|perspective|filter/.test(style.willChange)) {
      parentComputed = style
      break
    }
    parent = parent.parentElement
  }
  if (!parent) {
    return {
      left: Math.round(rect.left + view.scrollX - parseFloat(computed.marginLeft)),
      top: Math.round(rect.top + view.scrollY - parseFloat(computed.marginTop)),
    }
  }
  // 2. 按定位容器的边框盒比例消除画布缩放，再扣除边框、margin 并补回滚动量。
  const parentRect = parent.getBoundingClientRect()
  const contentBox = parentComputed.boxSizing === 'content-box'
  const parentWidth = parseFloat(parentComputed.width) + (contentBox
    ? parseFloat(parentComputed.paddingLeft) + parseFloat(parentComputed.paddingRight) + parseFloat(parentComputed.borderLeftWidth) + parseFloat(parentComputed.borderRightWidth) : 0)
  const parentHeight = parseFloat(parentComputed.height) + (contentBox
    ? parseFloat(parentComputed.paddingTop) + parseFloat(parentComputed.paddingBottom) + parseFloat(parentComputed.borderTopWidth) + parseFloat(parentComputed.borderBottomWidth) : 0)
  const scaleX = parentRect.width / parentWidth
  const scaleY = parentRect.height / parentHeight
  return {
    left: Math.round((rect.left - parentRect.left) / scaleX + parent.scrollLeft - parseFloat(parentComputed.borderLeftWidth) - parseFloat(computed.marginLeft)),
    top: Math.round((rect.top - parentRect.top) / scaleY + parent.scrollTop - parseFloat(parentComputed.borderTopWidth) - parseFloat(computed.marginTop)),
  }
}

/** HTML 沿用原逻辑，SVG 单独测量位置与尺寸后生成样式。 */
export function createPositionAbsolutePatch(dom: HTMLElement | SVGElement | null, value: CSSProperties): CSSProperties {
  if (!dom || 'offsetParent' in dom) return createAbsolutePatch(dom, value)

  // 1. 点击开启时读取 SVG 的计算样式，位置计算与尺寸补值共用这一次读取。
  const computed = dom.ownerDocument.defaultView!.getComputedStyle(dom)
  const offset = computeSvgOffset(dom, computed)
  // 2. 只生成样式数据；提交与界面更新仍由 Position 面板处理。
  const style: CSSProperties = {
    position: 'absolute',
    left: `${offset.left}px`,
    top: `${offset.top}px`,
  }
  if (isUnconfiguredSize(value.width)) style.width = `${Math.round(parseFloat(computed.width))}px`
  if (isUnconfiguredSize(value.height)) style.height = `${Math.round(parseFloat(computed.height))}px`
  return style
}
