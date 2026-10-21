/** 同步测量直接子元素脱流后的容器尺寸，返回前恢复临时样式。 */
export function detectContainerCollapse(parent: HTMLElement, parentPosition: string) {
  const children = Array.from(parent.children) as HTMLElement[]
  const readSize = () => {
    const css = parent.ownerDocument.defaultView!.getComputedStyle(parent)
    return { width: css.width, height: css.height }
  }
  const before = readSize()
  const saved = [parent, ...children].map(element => ({
    element,
    style: element.getAttribute('style'),
  }))

  try {
    parent.style.setProperty('position', parentPosition, 'important')
    for (const child of children) {
      child.style.setProperty('position', 'absolute', 'important')
    }
    const after = readSize()
    return {
      before,
      after,
      collapseWidth: parseFloat(after.width) < parseFloat(before.width),
      collapseHeight: parseFloat(after.height) < parseFloat(before.height),
    }
  } finally {
    for (const { element, style } of saved) {
      element.setAttribute('style', style ?? '')
      if (style === null) element.removeAttribute('style')
    }
  }
}
