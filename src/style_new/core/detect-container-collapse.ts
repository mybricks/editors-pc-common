/** 整批模拟子元素脱流，测量当前容器和宽度依赖的源码祖先，返回前恢复临时样式。 */
export function detectContainerCollapse(
  parentPlans: { target: HTMLElement; style: Record<string, unknown> }[], widthAncestors: HTMLElement[],
  childPlans: { target: HTMLElement; style: Record<string, unknown> }[],
) {
  const parents = parentPlans.map(plan => plan.target)
  const children = childPlans.map(plan => plan.target)
  const readSize = (element: HTMLElement) => {
    const css = element.ownerDocument.defaultView!.getComputedStyle(element)
    return { width: css.width, height: css.height }
  }
  // 阶段一：保存原布局的 CSS 宽高和内联样式，避免把 padding/border 重复写入 min-*。
  const parentSizes = parentPlans.map(({ target, style }) => ({ element: target, style, before: readSize(target) }))
  const ancestorWidths = widthAncestors.map(element => ({ element, width: readSize(element).width }))
  const childSizes = childPlans.filter(({ style }) => 'width' in style || 'height' in style)
    .map(({ target, style }) => ({ element: target, style, before: readSize(target) }))
  const saved = Array.from(new Set([...parents, ...children, ...widthAncestors])).map(element => ({
    element,
    style: element.getAttribute('style'),
  }))

  try {
    // 阶段二：整批脱流后先读完所有尺寸，再生成各实例的父容器保护；原本 absolute 的子元素不参与模拟。
    for (const { element, style } of parentSizes) {
      element.style.setProperty('position', String(style.position), 'important')
    }
    for (const child of children) child.style.setProperty('position', 'absolute', 'important')
    const afterParents = new Map(parents.map(element => [element, readSize(element)]))
    const afterAncestors = new Map(widthAncestors.map(element => [element, readSize(element).width]))
    const parentPatches = new Map<HTMLElement, { minWidth?: string; minHeight?: string }>()
    for (const { element, before } of parentSizes) {
      const after = afterParents.get(element)!
      if (parseFloat(after.width) < parseFloat(before.width)) {
        let widthTarget = element
        let minWidth = before.width
        // 百分比宽度保护最外层收缩的源码祖先；共享祖先复用同一份原尺寸和补值。
        for (const ancestor of ancestorWidths) {
          if (ancestor.element !== element && ancestor.element.contains(widthTarget) &&
            parseFloat(afterAncestors.get(ancestor.element)!) < parseFloat(ancestor.width)) {
            widthTarget = ancestor.element
            minWidth = ancestor.width
          }
        }
        parentPatches.set(widthTarget, { ...parentPatches.get(widthTarget), minWidth })
      }
      if (parseFloat(after.height) < parseFloat(before.height)) {
        parentPatches.set(element, { ...parentPatches.get(element), minHeight: before.height })
      }
    }
    // 阶段三：先保护各父容器，再应用各子元素的位置，为宽高检测还原最终定位环境。
    parentPatches.forEach((patch, element) => {
      if (patch.minWidth) element.style.setProperty('min-width', patch.minWidth, 'important')
      if (patch.minHeight) element.style.setProperty('min-height', patch.minHeight, 'important')
    })
    for (const { target, style } of childPlans) {
      for (const key of ['left', 'top']) {
        if (style[key] !== undefined) target.style.setProperty(key, String(style[key]), 'important')
      }
    }
    // 阶段四：宽高共用检测，缩小补 min-*，变大才固定原尺寸；先稳定宽度，避免换行干扰高度判断。
    const childSizePatches = new Map<HTMLElement, { width?: string; height?: string; minWidth?: string; minHeight?: string }>(
      childSizes.map(({ element }) => [element, {}]),
    )
    for (const { dimension, minKey } of [
      { dimension: 'width', minKey: 'minWidth' },
      { dimension: 'height', minKey: 'minHeight' },
    ] as const) {
      for (const { element, style, before } of childSizes) {
        if (!(dimension in style)) continue
        const beforeSize = Math.round(parseFloat(before[dimension]))
        const afterSize = Math.round(parseFloat(readSize(element)[dimension]))
        if (afterSize < beforeSize) {
          childSizePatches.get(element)![minKey] = before[dimension]
        } else if (afterSize > beforeSize) {
          childSizePatches.get(element)![dimension] = before[dimension]
        }
      }
      // 当前轴整批读完再应用补值，沿用一次模拟，不逐元素重复脱流。
      childSizePatches.forEach((patch, element) => {
        for (const key of [dimension, minKey]) {
          if (patch[key]) element.style.setProperty(key.replace(/[A-Z]/g, char => `-${char.toLowerCase()}`), patch[key]!, 'important')
        }
      })
    }
    return {
      parentPatches,
      childSizePatches,
    }
  } finally {
    // 阶段五：测量结束即恢复 DOM；实际样式仍统一由外部计划写入。
    for (const { element, style } of saved) {
      element.setAttribute('style', style ?? '')
      if (style === null) element.removeAttribute('style')
    }
  }
}
