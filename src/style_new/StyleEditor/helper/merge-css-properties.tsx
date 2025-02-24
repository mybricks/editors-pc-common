import React from 'react'

// 创建一个缓存容器
let containerCache: HTMLDivElement | null = null
let componentCache: HTMLDivElement | null = null

// 获取或创建容器
const getContainer = () => {
  if (!containerCache) {
    containerCache = document.createElement('div')
    containerCache.style.position = 'absolute'
    containerCache.style.visibility = 'hidden'
    containerCache.style.pointerEvents = 'none'
    containerCache.id = 'only-for-computed-style'
    ;(document.getElementById('root') ?? document.body).appendChild(
      containerCache
    )
  }
  return containerCache
}

// 获取或创建组件元素
const getComponent = () => {
  if (!componentCache) {
    componentCache = document.createElement('div')
    getContainer().appendChild(componentCache)
  }
  return componentCache
}

// 清空组件样式
const clearComponentStyle = (component: HTMLElement) => {
  // 清空所有内联样式
  component.removeAttribute('style')
}

/**
 * @description 通过隐藏的Dom来合并CSS样式，达到精简的效果
 */
export const mergeCSSProperties = (
  cssProperties: React.CSSProperties
): React.CSSProperties => {
  const component = getComponent()
  // 清空之前的样式
  clearComponentStyle(component)
  // 应用新样式
  Object.assign(component.style, cssProperties)
  
  const computedStyle = window.getComputedStyle(component)
  const mergedStyles: React.CSSProperties = {
    ...(cssProperties ?? {}),
  }

  // margin
  if (
    cssProperties.margin ||
    [
      cssProperties.marginLeft,
      cssProperties.marginRight,
      cssProperties.marginTop,
      cssProperties.marginBottom,
    ].filter((t) => !!t).length > 2
  ) {
    mergedStyles.margin = computedStyle.margin
    delete mergedStyles.marginLeft
    delete mergedStyles.marginRight
    delete mergedStyles.marginTop
    delete mergedStyles.marginBottom
  }

  // padding
  if (
    cssProperties.padding ||
    [
      cssProperties.paddingLeft,
      cssProperties.paddingRight,
      cssProperties.paddingTop,
      cssProperties.paddingBottom,
    ].filter((t) => !!t).length > 2
  ) {
    mergedStyles.padding = computedStyle.padding
    delete mergedStyles.paddingLeft
    delete mergedStyles.paddingRight
    delete mergedStyles.paddingTop
    delete mergedStyles.paddingBottom
  }

  // overflow
  if (
    cssProperties.overflow ||
    [cssProperties.overflowX, cssProperties.overflowY].filter((t) => !!t)
      .length > 1
  ) {
    mergedStyles.overflow = computedStyle.overflow
    delete mergedStyles.overflowX
    delete mergedStyles.overflowY
  }

  // borderRadius
  if (
    cssProperties.borderRadius ||
    [
      cssProperties.borderTopLeftRadius,
      cssProperties.borderTopRightRadius,
      cssProperties.borderBottomLeftRadius,
      cssProperties.borderBottomRightRadius,
    ].filter((t) => !!t).length > 2
  ) {
    mergedStyles.borderRadius = computedStyle.borderRadius
    delete mergedStyles.borderTopLeftRadius
    delete mergedStyles.borderTopRightRadius
    delete mergedStyles.borderBottomLeftRadius
    delete mergedStyles.borderBottomRightRadius
  }

  // border
  if (computedStyle.border) {
      // border属性一旦存在，说明全部都一样
      mergedStyles.border = computedStyle.border
      delete mergedStyles.borderTop
      delete mergedStyles.borderTopColor
      delete mergedStyles.borderTopStyle
      delete mergedStyles.borderTopWidth

      delete mergedStyles.borderRight
      delete mergedStyles.borderRightColor
      delete mergedStyles.borderRightStyle
      delete mergedStyles.borderRightWidth

      delete mergedStyles.borderBottom
      delete mergedStyles.borderBottomColor
      delete mergedStyles.borderBottomStyle
      delete mergedStyles.borderBottomWidth
      
      delete mergedStyles.borderLeft
      delete mergedStyles.borderLeftColor
      delete mergedStyles.borderLeftStyle
      delete mergedStyles.borderLeftWidth

      // [bugfix]，在仅配置颜色的时候，发现getComputedStyle会多一个border（borderWidth = 0px, borderStyle === 'none'）出来，先临时删除吧
      if (computedStyle.borderWidth === '0px' && computedStyle.borderStyle === 'none') {
        delete mergedStyles.border
      }
  } else {
    if (mergedStyles.border) {
      // computedStyle.border获取不到的情况下，说明border属性是没用的，删除了吧
      delete mergedStyles.border
    }
    if (computedStyle.borderTop) {
      mergedStyles.borderTop = computedStyle.borderTop
      delete mergedStyles.borderTopColor
      delete mergedStyles.borderTopStyle
      delete mergedStyles.borderTopWidth
    }
    if (computedStyle.borderBottom) {
      mergedStyles.borderBottom = computedStyle.borderBottom
      delete mergedStyles.borderBottomColor
      delete mergedStyles.borderBottomStyle
      delete mergedStyles.borderBottomWidth
    }
    if (computedStyle.borderLeft) {
      mergedStyles.borderLeft = computedStyle.borderLeft
      delete mergedStyles.borderLeftColor
      delete mergedStyles.borderLeftStyle
      delete mergedStyles.borderLeftWidth
    }
    if (computedStyle.borderRight) {
      mergedStyles.borderRight = computedStyle.borderRight
      delete mergedStyles.borderRightColor
      delete mergedStyles.borderRightStyle
      delete mergedStyles.borderRightWidth
    }
  }
  // 不使用这类聚合方式，这类方式会走到前面的路径里生效，所以可以直接删除
  delete mergedStyles.borderWidth
  delete mergedStyles.borderStyle
  delete mergedStyles.borderColor

  return mergedStyles
}

/**
 * @description 拆分CSS样式属性
 */
export const splitCSSProperties = (
  cssProperties: React.CSSProperties
): React.CSSProperties => {
  const component = getComponent()
  // 清空之前的样式
  clearComponentStyle(component)
  // 应用新样式
  Object.assign(component.style, cssProperties)
  
  const computedStyle = window.getComputedStyle(component)
  const splitStyles: React.CSSProperties = {
    ...(cssProperties ?? {})
  }

  // margin
  if (cssProperties.margin) {
    splitStyles.marginTop = computedStyle.marginTop
    splitStyles.marginRight = computedStyle.marginRight
    splitStyles.marginBottom = computedStyle.marginBottom
    splitStyles.marginLeft = computedStyle.marginLeft
    delete splitStyles.margin
  }

  // padding
  if (cssProperties.padding) {
    splitStyles.paddingTop = computedStyle.paddingTop
    splitStyles.paddingRight = computedStyle.paddingRight
    splitStyles.paddingBottom = computedStyle.paddingBottom
    splitStyles.paddingLeft = computedStyle.paddingLeft
    delete splitStyles.padding
  }

  // overflow
  if (cssProperties.overflow) {
    splitStyles.overflowX = computedStyle.overflowX
    splitStyles.overflowY = computedStyle.overflowY
    delete splitStyles.overflow
  }

  // borderRadius
  if (cssProperties.borderRadius) {
    splitStyles.borderTopLeftRadius = computedStyle.borderTopLeftRadius
    splitStyles.borderTopRightRadius = computedStyle.borderTopRightRadius
    splitStyles.borderBottomLeftRadius = computedStyle.borderBottomLeftRadius
    splitStyles.borderBottomRightRadius = computedStyle.borderBottomRightRadius
    delete splitStyles.borderRadius
  }

  // border
  if (cssProperties.border) {
    splitStyles.borderTopWidth = computedStyle.borderTopWidth
    splitStyles.borderTopStyle = computedStyle.borderTopStyle
    splitStyles.borderTopColor = computedStyle.borderTopColor
    splitStyles.borderRightWidth = computedStyle.borderRightWidth
    splitStyles.borderRightStyle = computedStyle.borderRightStyle
    splitStyles.borderRightColor = computedStyle.borderRightColor
    splitStyles.borderBottomWidth = computedStyle.borderBottomWidth
    splitStyles.borderBottomStyle = computedStyle.borderBottomStyle
    splitStyles.borderBottomColor = computedStyle.borderBottomColor
    splitStyles.borderLeftWidth = computedStyle.borderLeftWidth
    splitStyles.borderLeftStyle = computedStyle.borderLeftStyle
    splitStyles.borderLeftColor = computedStyle.borderLeftColor
    delete splitStyles.border
  }

  return {
    ...splitStyles
  }
}

// 清理函数 - 在应用卸载时调用
export const cleanCSSProperties = () => {
  if (containerCache) {
    containerCache.remove()
    containerCache = null
  }
  componentCache = null
}