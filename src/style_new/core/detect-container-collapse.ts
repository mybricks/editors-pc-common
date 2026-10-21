/** 整批模拟子元素脱流，测量当前容器和宽度依赖的源码祖先，返回前恢复临时样式。 */
export function detectContainerCollapse(
  parent: HTMLElement, parentPosition: string, parents: HTMLElement[], widthAncestors: HTMLElement[],
) {
  const children = parents.flatMap(element => Array.from(element.children) as HTMLElement[])
  const readSize = (element: HTMLElement) => {
    const css = element.ownerDocument.defaultView!.getComputedStyle(element)
    return { width: css.width, height: css.height }
  }
  const before = readSize(parent)
  const ancestorWidths = widthAncestors.map(element => ({ element, width: readSize(element).width }))
  const saved = Array.from(new Set([...parents, ...children])).map(element => ({
    element,
    style: element.getAttribute('style'),
  }))

  try {
    for (const element of parents) {
      element.style.setProperty('position', parentPosition, 'important')
    }
    for (const child of children) {
      child.style.setProperty('position', 'absolute', 'important')
    }
    const after = readSize(parent)
    const collapseWidth = parseFloat(after.width) < parseFloat(before.width)
    let widthTarget = parent
    let minWidth = before.width
    // 百分比宽度跟随祖先缩小：保护最外层收缩的源码容器，避免 min-width 反过来撑大祖先。
    if (collapseWidth) {
      for (const { element, width } of ancestorWidths) {
        if (parseFloat(readSize(element).width) < parseFloat(width)) {
          widthTarget = element
          minWidth = width
        }
      }
    }
    return {
      before,
      after,
      collapseWidth,
      collapseHeight: parseFloat(after.height) < parseFloat(before.height),
      widthTarget,
      minWidth,
    }
  } finally {
    for (const { element, style } of saved) {
      element.setAttribute('style', style ?? '')
      if (style === null) element.removeAttribute('style')
    }
  }
}
