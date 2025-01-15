import React from 'react'
import ReactDOM from 'react-dom'

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
  }
  return componentCache
}

// 测试组件
const HiddenStyleComponent: React.FC<{ style: React.CSSProperties }> = ({
  style,
}) => {
  return (
    <div
      style={style}
      ref={(node) => {
        if (node) {
          componentCache = node
        }
      }}
    />
  )
}

/**
 *
 * @description 通过隐藏的Dom来合并CSS样式，达到精简的效果
 * @param cssProperties
 * @returns
 */
export const mergeCSSProperties = async (
  cssProperties: React.CSSProperties
): Promise<React.CSSProperties> => {
  return new Promise((resolve) => {
    const container = getContainer()

    ReactDOM.render(
      <HiddenStyleComponent style={cssProperties} />,
      container,
      () => {
        const component = getComponent()
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
        delete mergedStyles.borderWidth;
        delete mergedStyles.borderStyle;
        delete mergedStyles.borderColor;

        resolve(mergedStyles)
      }
    )
  })
}

// 清理函数 - 在应用卸载时调用
export const cleanMergeCSSProperties = () => {
  if (containerCache) {
    ReactDOM.unmountComponentAtNode(containerCache)
    containerCache.remove()
    containerCache = null
  }
  componentCache = null
}

// class StyleMerger {
//   mergers: any

//   constructor() {
//     this.mergers = []
//   }

//   register(name: string, merger: any) {
//     this.mergers.push({
//       name,
//       merger,
//     })
//   }

//   mergeAll(styles: any, computedValues: CSSStyleDeclaration) {
//     if (!styles || typeof styles !== 'object') {
//       return styles
//     }

//     let result = { ...styles }
//     for (let merger of this.mergers) {
//       result = merger.merger(result, computedValues)
//     }

//     console.log('mergeResult ===>', result)
//     return result
//   }
// }

// export const styleMerger = new StyleMerger()

// // 辅助函数：安全删除对象属性
// function safeDeleteProps(obj: any, props: any) {
//   props.forEach((prop: any) => {
//     if (obj.hasOwnProperty(prop)) {
//       delete obj[prop]
//     }
//   })
// }

// // 合并margin
// styleMerger.register(
//   'margin',
//   (styles: any, computedValues: CSSStyleDeclaration) => {
//     if (!styles) return styles

//     const result = { ...styles }

//     const nextStyle = {
//       marginTop: styles.marginTop ?? computedValues.marginTop,
//       marginRight: styles.marginRight ?? computedValues.marginRight,
//       marginBottom: styles.marginBottom ?? computedValues.marginBottom,
//       marginLeft: styles.marginLeft ?? computedValues.marginLeft,
//     }

//     if (
//       [
//         styles.marginTop,
//         styles.marginRight,
//         styles.marginBottom,
//         styles.marginLeft,
//       ].filter((t) => !!t).length < 3
//     ) {
//       return result
//     }

//     switch (true) {
//       case ((nextStyle.marginTop === nextStyle.marginRight) ===
//         nextStyle.marginBottom) ===
//         nextStyle.marginLeft: {
//         result.margin = nextStyle.marginTop
//         safeDeleteProps(result, [
//           'marginTop',
//           'marginRight',
//           'marginBottom',
//           'marginLeft',
//         ])
//         return result
//       }
//       case nextStyle.marginTop === nextStyle.marginBottom &&
//         nextStyle.marginRight === nextStyle.marginLeft: {
//         result.margin = `${nextStyle.marginTop} ${nextStyle.marginLeft}`
//         safeDeleteProps(result, [
//           'marginTop',
//           'marginRight',
//           'marginBottom',
//           'marginLeft',
//         ])
//         return result
//       }
//       default: {
//         result.margin = `${nextStyle.marginTop} ${nextStyle.marginRight} ${nextStyle.marginBottom} ${nextStyle.marginLeft}`
//         safeDeleteProps(result, [
//           'marginTop',
//           'marginRight',
//           'marginBottom',
//           'marginLeft',
//         ])
//         return result
//       }
//     }
//   }
// )

// // 合并padding
// styleMerger.register('padding', (styles: any) => {
//   if (!styles) return styles

//   const result = { ...styles }
//   const paddings = {
//     top: styles.paddingTop,
//     right: styles.paddingRight,
//     bottom: styles.paddingBottom,
//     left: styles.paddingLeft,
//   }

//   // 检查是否所有值都存在
//   if (Object.values(paddings).some((v) => v !== undefined)) {
//     // 如果四个值都相等
//     if (Object.values(paddings).every((v) => v === paddings.top)) {
//       result.padding = paddings.top
//     }
//     // 如果上下相等且左右相等
//     else if (
//       paddings.top === paddings.bottom &&
//       paddings.left === paddings.right
//     ) {
//       result.padding = `${paddings.top} ${paddings.right}`
//     }
//     // 如果左右相等
//     else if (paddings.left === paddings.right) {
//       result.padding = `${paddings.top} ${paddings.right} ${paddings.bottom}`
//     }
//     // 四个值都不相等
//     else {
//       result.padding = `${paddings.top} ${paddings.right} ${paddings.bottom} ${paddings.left}`
//     }

//     safeDeleteProps(result, [
//       'paddingTop',
//       'paddingRight',
//       'paddingBottom',
//       'paddingLeft',
//     ])
//   }

//   return result
// })

// // 合并borderRadius
// styleMerger.register('borderRadius', (styles: any) => {
//   if (!styles) return styles

//   const result = { ...styles }
//   const radiuses = {
//     topLeft: styles.borderTopLeftRadius,
//     topRight: styles.borderTopRightRadius,
//     bottomRight: styles.borderBottomRightRadius,
//     bottomLeft: styles.borderBottomLeftRadius,
//   }

//   if (Object.values(radiuses).some((v) => v !== undefined)) {
//     // 如果四个值都相等
//     if (Object.values(radiuses).every((v) => v === radiuses.topLeft)) {
//       result.borderRadius = radiuses.topLeft
//     }
//     // 如果对角相等
//     else if (
//       radiuses.topLeft === radiuses.bottomRight &&
//       radiuses.topRight === radiuses.bottomLeft
//     ) {
//       result.borderRadius = `${radiuses.topLeft} ${radiuses.topRight}`
//     }
//     // 四个值都不相等
//     else {
//       result.borderRadius = `${radiuses.topLeft} ${radiuses.topRight} ${radiuses.bottomRight} ${radiuses.bottomLeft}`
//     }

//     safeDeleteProps(result, [
//       'borderTopLeftRadius',
//       'borderTopRightRadius',
//       'borderBottomRightRadius',
//       'borderBottomLeftRadius',
//     ])
//   }

//   return result
// })

// // 合并border
// styleMerger.register('border', (styles: any) => {
//   if (!styles) return styles

//   const result = { ...styles }
//   const directions = ['Top', 'Right', 'Bottom', 'Left']

//   // 首先尝试合并各个方向的完整border属性
//   directions.forEach((direction) => {
//     const width = styles[`border${direction}Width`]
//     const style = styles[`border${direction}Style`]
//     const color = styles[`border${direction}Color`]

//     if (width || style || color) {
//       result[`border${direction}`] = `${width || '1px'} ${style || 'solid'} ${
//         color || 'currentColor'
//       }`
//       safeDeleteProps(result, [
//         `border${direction}Width`,
//         `border${direction}Style`,
//         `border${direction}Color`,
//       ])
//     }
//   })

//   // 收集各个方向的border值
//   const borders = directions.map((direction) => result[`border${direction}`])

//   // 如果所有边都有值
//   if (borders.every(Boolean)) {
//     // 如果所有边相等
//     if (borders.every((v) => v === borders[0])) {
//       result.border = borders[0]
//       safeDeleteProps(
//         result,
//         directions.map((d) => `border${d}`)
//       )
//     }
//     // 如果上下相等且左右相等
//     else if (borders[0] === borders[2] && borders[1] === borders[3]) {
//       result.border = undefined
//       result.borderTop = result.borderBottom = borders[0]
//       result.borderLeft = result.borderRight = borders[1]
//       safeDeleteProps(
//         result,
//         directions.map((d) => `border${d}`)
//       )
//     }
//   }

//   return result
// })

// // 合并overflow
// styleMerger.register('overflow', (styles: any) => {
//   if (!styles) return styles

//   const { overflowX, overflowY } = styles
//   if (overflowX || overflowY) {
//     const result = { ...styles }
//     // 如果两个值相等
//     if (overflowX === overflowY) {
//       result.overflow = overflowX
//       safeDeleteProps(result, ['overflowX', 'overflowY'])
//     }
//     // 如果只有一个值存在
//     else if (overflowX && !overflowY) {
//       result.overflow = overflowX
//       safeDeleteProps(result, ['overflowX'])
//     } else if (!overflowX && overflowY) {
//       result.overflow = overflowY
//       safeDeleteProps(result, ['overflowY'])
//     }
//     return result
//   }
//   return styles
// })
