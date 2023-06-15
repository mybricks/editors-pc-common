import React, {
  useMemo,
  useState,
  useCallback,
  CSSProperties
} from 'react'

import CaretDownOutlined from '@ant-design/icons/CaretDownOutlined'
import CaretLeftOutlined from '@ant-design/icons/CaretLeftOutlined'

import StyleEditor, { DEFAULT_OPTIONS, StyleEditorProvider } from './StyleEditor'

import type {
  EditorProps,
  GetDefaultConfigurationProps
} from './type'
import type { Options, ChangeEvent } from './StyleEditor/type'

import css from './index.less'


export default function ({editConfig}: EditorProps) {
  const { options, setValue, defaultValue } = useMemo(() => {
    return getDefaultConfiguration(editConfig)
  }, [])

  const handleChange: ChangeEvent = useCallback((value) => {
    // console.log('handleChange value: ', value)
    if (Array.isArray(value)) {
      value.forEach(({key, value}) => {
        // @ts-ignore
        // defaultValue[key] = value
        setValue[key] = value
      })
    } else {
      // @ts-ignore
      // defaultValue[value.key] = value.value
      setValue[value.key] = value.value
    }
    // console.log('set setValue: ', setValue)
    // editConfig.value.set(defaultValue)
    editConfig.value.set(setValue)
  }, [])

  const [open, setOpen] = useState(true)

  const title = useMemo(() => {
    return (
      <div className={css.titleContainer} style={{ marginBottom: open ? 3 : 0 }}>
        <div className={css.title} onClick={() => setOpen(!open)}>
          <div>{editConfig.title}</div>
        </div>
        <div className={css.actions}>
          <div onClick={() => setOpen(!open)}>{open ? <CaretDownOutlined style={{ color: '#555' }} /> : <CaretLeftOutlined style={{ color: '#555' }} />}</div>
        </div>
      </div>
    )
  }, [open])

  return {
    render: (
      <StyleEditorProvider value={editConfig}>
        {title}
        <div style={{display: open ? 'block' : 'none'}}>
          <StyleEditor
            defaultValue={defaultValue}
            options={options}
            onChange={handleChange}
          />
        </div>
      </StyleEditorProvider>
    )
  }
}


/**
 * 获取默认的配置项和样式
 */
function getDefaultConfiguration ({value, options}: GetDefaultConfigurationProps) {
  // console.log('options: ', options)

  let finalOptions
  let defaultValue: CSSProperties = {}
  const setValue = value.get() || {}
  if (!options) {
    // 没有options，普通编辑器配置使用，直接使用默认的配置，展示全部
    finalOptions = DEFAULT_OPTIONS
  } else if (Array.isArray(options)) {
    // options是一个数组，直接使用
    finalOptions = options
  } else {
    const { plugins, selector, targetDom } = options
    // 这里还要再处理一下 
    finalOptions = plugins || DEFAULT_OPTIONS
    if (targetDom) {
      // console.time('遍历stylesheets')
      const styleValues = getStyleValues(targetDom, selector)
      // console.timeEnd('遍历stylesheets')

      finalOptions.forEach((option) => {
        let type, config

        if (typeof option === 'string') {
          type = option
          config = {}
        } else {
          type = option.type
          config = option.config || {}
        }

        if (DEFAULT_OPTIONS.includes(type)) {
          // @ts-ignore
          Object.assign(defaultValue, getDefaultValueFunctionMap[type](styleValues, config))
        }
      })

      // console.log('计算得到的默认值: ', JSON.parse(JSON.stringify(defaultValue)))
      // console.log('value.get()得到的值: ', value.get())
    }
  }

  return {
    options: finalOptions,
    defaultValue: Object.assign(defaultValue, setValue),
    setValue
  } as {
    options: Options,
    defaultValue: CSSProperties,
    setValue: CSSProperties
  }
}

const getDefaultValueFunctionMap = {
  font(values: CSSProperties, config: any) {
    // 搞定
    return {
      color: values.color,
      fontSize: values.fontSize,
      textAlign: values.textAlign,
      fontWeight: values.fontWeight,
      fontFamily: values.fontFamily,
      lineHeight: values.lineHeight,
      letterSpacing: values.letterSpacing
    }
  },
  border(values: CSSProperties, config: any) {
    return {
      borderTopColor: values.borderTopColor,
      borderBottomColor: values.borderBottomColor,
      borderRightColor: values.borderRightColor,
      borderLeftColor: values.borderLeftColor,
      borderTopLeftRadius: values.borderTopLeftRadius,
      borderTopRightRadius: values.borderTopRightRadius,
      borderBottomRightRadius: values.borderBottomRightRadius,
      borderBottomLeftRadius: values.borderBottomLeftRadius,
      borderTopStyle: values.borderTopStyle,
      borderBottomStyle: values.borderBottomStyle,
      borderRightStyle: values.borderRightStyle,
      borderLeftStyle: values.borderLeftStyle,
      borderTopWidth: values.borderTopWidth,
      borderBottomWidth: values.borderBottomWidth,
      borderLeftWidth: values.borderLeftWidth,
      borderRightWidth: values.borderRightWidth
    }
  },
  background(values: CSSProperties, config: any) {
    return {
      backgroundColor: values.backgroundColor,
      backgroundImage: values.backgroundImage,
      backgroundRepeat: values.backgroundRepeat,
      backgroundPosition: values.backgroundPosition,
      backgroundSize: values.backgroundSize
    }
  },
  padding(values: CSSProperties, config: any) {
    // 搞定
    return {
      paddingTop: values.paddingTop,
      paddingRight: values.paddingRight,
      paddingBottom: values.paddingBottom,
      paddingLeft: values.paddingLeft
    }
  },
  size(values: CSSProperties, config: any) {
    return {
      width: values.width,
      height: values.height
    }
  }
}

// const getDefaultValueFunctionMap2 = {
//   font(domStyle: CSSStyleDeclaration, bodyStyle: CSSStyleDeclaration, config: any) {
//     const {
//       color,
//       fontSize,
//       textAlign,
//       fontWeight,
//       fontFamily,
//       lineHeight,
//       letterSpacing
//     } = domStyle

//     return {
//       color,
//       fontSize,
//       fontWeight,
//       lineHeight,
//       // TODO: 提供切换能力？不设置或设置具体值
//       letterSpacing: letterSpacing == 'normal' ? '0px' : letterSpacing,
//       // 观察: 目前若是默认值，即与body上字体值相同则代表默认(默认时font-family设置失效)
//       fontFamily: fontFamily === bodyStyle.fontFamily ? '' : fontFamily,
//       // 观察: 基本都是使用常规的左中右
//       textAlign: ['left', 'right', 'center'].includes(textAlign) ? textAlign : 'left',
//     }
//   },
//   border() {
//     return {}
//   },
//   background(domStyle: CSSStyleDeclaration, bodyStyle: CSSStyleDeclaration, config: any) {
//     const { backgroundColor, backgroundImage } = domStyle
//     return {
//       backgroundColor,
//       backgroundImage
//     }
//   },
//   padding(domStyle: CSSStyleDeclaration, bodyStyle: CSSStyleDeclaration, config: any) {
//     return {
//       paddingTop: domStyle.paddingTop,
//       paddingRight: domStyle.paddingRight,
//       paddingBottom: domStyle.paddingBottom,
//       paddingLeft: domStyle.paddingLeft
//     }
//   }
// }

/**
 * 临时兼容options/plugins配置，原先的“bgcolor”和“bgimage”合并为“background”
 * 同时督促团队内同学顺手进行修改
 */
function temporarily_compatible_with_options (options: Options): Options {
  let useBackgroundIndex: undefined | number

  const finalOptions = options.filter((option, index) => {

    let type = typeof option === 'string' ? option : option.type

    if (['BGCOLOR', 'BGIMAGE'].includes(type)) {
      if (typeof useBackgroundIndex === 'undefined') {
        useBackgroundIndex = index
      }

      return false
    }
   
    return true
  })

  if (typeof useBackgroundIndex === 'number') {
    finalOptions.splice(useBackgroundIndex, 0 , 'background')
  }

  return finalOptions
}

// function endDomLoopTraversal (element: HTMLElement) {
//   const value = element.classList.value
//   // 返回true，就结束遍历，只遍历至组件的父节点
//   return !!!['com-', 'desn-', 'focus-', '-hover'].find((reg) => {
//     return !value.match(reg)
//   })
// }

function getStyleValues (element: HTMLElement, selector: string) {
  const classListValue = element.classList.value
  const finalRules = sortCSSRulesByPriority(getStyleRules(element, classListValue.indexOf(selector) !== -1 ? null : selector))
  const classList = classListValue.split(' ')

  // 我们默认如果有selector, 那它一定是写在样式最后面的，那这里排序可以先去掉
  finalRules.sort((a, b) => {
    const bIndex = classList.indexOf(b.selectorText.slice(1))
    const aIndex = classList.indexOf(a.selectorText.slice(1))

    if ((aIndex === -1 && bIndex === -1) || (aIndex === -1 || bIndex === -1)) {
      return -1
    }

    return aIndex - bIndex
  })
  
  // 目前是最后面的权重最大
  // console.log('最终的排序 finalRules: ', finalRules)

  const computedValues = window.getComputedStyle(element)
  const values = getValues(finalRules, computedValues)

  return values
}

function getValues (rules: CSSStyleRule[], computedValues: CSSStyleDeclaration) {
  // TODO: 先一个个来吧，后面改一下
  /** font */
  let color // 继承属性
  let fontSize // 继承属性
  let textAlign // 继承属性
  let fontWeight // 继承属性
  let lineHeight // 继承属性
  let fontFamily // 继承属性
  let letterSpacing // 继承属性
  /** font */

  /** padding */
  let paddingTop // 非继承属性
  let paddingRight // 非继承属性
  let paddingBottom // 非继承属性
  let paddingLeft // 非继承属性
  /** padding */

  /** background */
  let backgroundColor // 非继承属性
  let backgroundImage // 非继承属性
  let backgroundRepeat // 非继承属性
  let backgroundPosition // 非继承属性
  let backgroundSize // 非继承属性
  /** background */

  /** border */
  let borderTopColor // 非继承属性
  let borderRightColor // 非继承属性
  let borderBottomColor // 非继承属性
  let borderLeftColor // 非继承属性
  let borderTopLeftRadius // 非继承属性
  let borderTopRightRadius // 非继承属性
  let borderBottomRightRadius // 非继承属性
  let borderBottomLeftRadius // 非继承属性
  let borderTopStyle // 非继承属性
  let borderRightStyle // 非继承属性
  let borderBottomStyle // 非继承属性
  let borderLeftStyle // 非继承属性
  let borderTopWidth // 非继承属性
  let borderBottomWidth // 非继承属性
  let borderLeftWidth // 非继承属性
  let borderRightWidth // 非继承属性
  /** border */

  /** size */
  let width // 非继承属性
  let height // 非继承属性
  /** size */

  rules.forEach((rule, index) => {
    // 不可继承的属性只有非index才需要处理
    const { style } = rule

    /** font */
    const {
      color: styleColor,
      fontSize: styleFontSize,
      textAlign: styleTextAlign,
      fontWeight: styleFontWeight,
      lineHeight: styleLineHeight,
      fontFamily: styleFontFamily,
      letterSpacing: styleLetterSpacing
    } = style
    if (styleColor) {
      color = styleColor
    }
    if (styleFontSize) {
      fontSize = styleFontSize
    }
    if (styleTextAlign) {
      textAlign = styleTextAlign
    }
    if (styleFontWeight) {
      fontWeight = styleFontWeight
    }
    if (styleLineHeight) {
      lineHeight = styleLineHeight
    }
    if (styleFontFamily) {
      fontFamily = styleFontFamily
    }
    if (styleLetterSpacing) {
      letterSpacing = styleLetterSpacing
    }
    /** font */

    /** padding */
    const {
      paddingTop: stylePaddingTop,
      paddingRight: stylePaddingRight,
      paddingBottom: stylePaddingBottom,
      paddingLeft: stylePaddingLeft
    } = style
    if (!index) {
      if (stylePaddingTop) {
        paddingTop = stylePaddingTop
      }
      if (stylePaddingRight) {
        paddingRight = stylePaddingRight
      }
      if (stylePaddingBottom) {
        paddingBottom = stylePaddingBottom
      }
      if (stylePaddingLeft) {
        paddingLeft = stylePaddingLeft
      }
    }
    /** padding */

    /** background */
    const {
      backgroundColor: styleBackgroundColor,
      backgroundImage: styleBackgroundImage,
      backgroundRepeat: styleBackgroundRepeat,
      backgroundPosition: styleBackgroundPosition,
      backgroundSize: styleBackgroundSize
    } = style
    if (!index) {
      if (styleBackgroundColor) {
        backgroundColor = styleBackgroundColor
      }
      if (styleBackgroundImage) {
        backgroundImage = styleBackgroundImage
      }
      if (styleBackgroundRepeat) {
        backgroundRepeat = styleBackgroundRepeat
      }
      if (styleBackgroundPosition) {
        backgroundPosition = styleBackgroundPosition
      }
      if (styleBackgroundSize) {
        backgroundSize = styleBackgroundSize
      }
    }
    /** background */

    /** border */
    const {
      borderTopColor: styleBorderTopColor,
      borderRightColor: styleBorderRightColor,
      borderBottomColor: styleBorderBottomColor,
      borderLeftColor: styleBorderLeftColor,
      borderTopLeftRadius: styleBorderTopLeftRadius,
      borderTopRightRadius: styleBorderTopRightRadius,
      borderBottomRightRadius: styleBorderBottomRightRadius,
      borderBottomLeftRadius: styleBorderBottomLeftRadius,
      borderTopStyle: styleBorderTopStyle,
      borderRightStyle: styleBorderRightStyle,
      borderBottomStyle: styleBorderBottomStyle,
      borderLeftStyle: styleBorderLeftStyle,
      borderTopWidth: styleBorderTopWidth,
      borderBottomWidth: styleBorderBottomWidth,
      borderLeftWidth: styleBorderLeftWidth,
      borderRightWidth: styleBorderRightWidth
    } = style
    if (!index) {
      if (styleBorderTopColor) {
        borderTopColor = styleBorderTopColor
      }
      if (styleBorderRightColor) {
        borderRightColor = styleBorderRightColor
      }
      if (styleBorderBottomColor) {
        borderBottomColor = styleBorderBottomColor
      }
      if (styleBorderLeftColor) {
        borderLeftColor = styleBorderLeftColor
      }
      if (styleBorderTopLeftRadius) {
        borderTopLeftRadius = styleBorderTopLeftRadius
      }
      if (styleBorderTopRightRadius) {
        borderTopRightRadius = styleBorderTopRightRadius
      }
      if (styleBorderBottomRightRadius) {
        borderBottomRightRadius = styleBorderBottomRightRadius
      }
      if (styleBorderBottomLeftRadius) {
        borderBottomLeftRadius = styleBorderBottomLeftRadius
      }
      if (styleBorderTopStyle) {
        borderTopStyle = styleBorderTopStyle
      }
      if (styleBorderRightStyle) {
        borderRightStyle = styleBorderRightStyle
      }
      if (styleBorderBottomStyle) {
        borderBottomStyle = styleBorderBottomStyle
      }
      if (styleBorderLeftStyle) {
        borderLeftStyle = styleBorderLeftStyle
      }
      if (styleBorderTopWidth) {
        borderTopWidth = styleBorderTopWidth
      }
      if (styleBorderBottomWidth) {
        borderBottomWidth = styleBorderBottomWidth
      }
      if (styleBorderLeftWidth) {
        borderLeftWidth = styleBorderLeftWidth
      }
      if (styleBorderRightWidth) {
        borderRightWidth = styleBorderRightWidth
      }
    }
    /** border */

    /** size */
    const {
      width: styleWidth,
      height: styleHeight
    } = style
    if (!index) {
      if (styleWidth) {
        width = styleWidth
      }
      if (styleHeight) {
        height = styleHeight
      }
    }
    /** size */
  })

  /** font */
  if (!color) {
    color = computedValues.color
  }
  if (!fontSize) {
    fontSize = computedValues.fontSize
  }
  if (!textAlign) {
    textAlign = computedValues.textAlign
  }
  if (!fontWeight) {
    fontWeight = computedValues.fontWeight
  }
  if (!lineHeight) {
    lineHeight = computedValues.lineHeight
  }
  if (!fontFamily) {
    // fontFamily = computedValues.fontFamily
    fontFamily = 'inherit'
  }
  if (!letterSpacing) {
    letterSpacing = computedValues.letterSpacing
  }
  /** font */

  /** padding */
  if (!paddingTop) {
    // paddingTop = computedValues.paddingTop
    paddingTop = '0px'
  }
  if (!paddingRight) {
    // paddingRight = computedValues.paddingRight
    paddingRight = '0px'
  }
  if (!paddingBottom) {
    // paddingBottom = computedValues.paddingBottom
    paddingBottom = '0px'
  }
  if (!paddingLeft) {
    // paddingLeft = computedValues.paddingLeft
    paddingLeft = '0px'
  }
  /** padding */


  /** background */
  if (!backgroundColor) {
    backgroundColor = computedValues.backgroundColor
  }
  if (!backgroundImage) {
    // backgroundImage = computedValues.backgroundImage
    backgroundImage = 'none'
  }
  if (!backgroundRepeat) {
    backgroundRepeat = computedValues.backgroundRepeat
  }
  if (!backgroundPosition) {
    // backgroundPosition = computedValues.backgroundPosition
    backgroundPosition = 'left top'
  }
  if (!backgroundSize) {
    backgroundSize = computedValues.backgroundSize
  }
  /** background */

  /** border */
  if (!borderTopColor) {
    borderTopColor = computedValues.borderTopColor // 默认使用当前元素color,否则为浏览器默认颜色
  }
  if (!borderRightColor) {
    borderRightColor = computedValues.borderRightColor
  }
  if (!borderBottomColor) {
    borderBottomColor = computedValues.borderBottomColor
  }
  if (!borderLeftColor) {
    borderLeftColor = computedValues.borderLeftColor
  }
  if (!borderTopLeftRadius) {
    borderTopLeftRadius = computedValues.borderTopLeftRadius
  }
  if (!borderTopRightRadius) {
    borderTopRightRadius = computedValues.borderTopRightRadius
  }
  if (!borderBottomRightRadius) {
    borderBottomRightRadius = computedValues.borderBottomRightRadius
  }
  if (!borderBottomLeftRadius) {
    borderBottomLeftRadius = computedValues.borderBottomLeftRadius
  }
  if (!borderTopStyle) {
    borderTopStyle = computedValues.borderTopStyle
  }
  if (!borderRightStyle) {
    borderRightStyle = computedValues.borderRightStyle
  }
  if (!borderBottomStyle) {
    borderBottomStyle = computedValues.borderBottomStyle
  }
  if (!borderLeftStyle) {
    borderLeftStyle = computedValues.borderLeftStyle
  }
  if (!borderTopWidth) {
    borderTopWidth = computedValues.borderTopWidth
  }
  if (!borderBottomWidth) {
    borderBottomWidth = computedValues.borderBottomWidth
  }
  if (!borderLeftWidth) {
    borderLeftWidth = computedValues.borderLeftWidth
  }
  if (!borderRightWidth) {
    borderRightWidth = computedValues.borderRightWidth
  }
  /** border */

  /** size */
  if (!width) {
    width = 'auto'
  }
  if (!height) {
    height = 'auto'
  }
  /** size */

  return {
    color,
    fontSize,
    textAlign,
    fontWeight,
    lineHeight,
    fontFamily,
    letterSpacing,

    paddingTop,
    paddingRight,
    paddingBottom,
    paddingLeft,

    backgroundColor,
    backgroundImage,
    backgroundRepeat,
    backgroundPosition,
    backgroundSize,

    borderTopColor,
    borderBottomColor,
    borderLeftColor,
    borderRightColor,
    borderTopLeftRadius,
    borderTopRightRadius,
    borderBottomRightRadius,
    borderBottomLeftRadius,
    borderTopStyle,
    borderRightStyle,
    borderBottomStyle,
    borderLeftStyle,
    borderTopWidth,
    borderBottomWidth,
    borderLeftWidth,
    borderRightWidth,

    width,
    height
  }
}

function getStyleRules (element: HTMLElement, selector: string | null) {
  const finalRules = []

  for (let i = 0; i < document.styleSheets.length; i++) {
    try {
      const sheet = document.styleSheets[i]
      const rules = sheet.cssRules ? sheet.cssRules : sheet.rules
  
      for (let j = 0; j < rules.length; j++) {
        const rule = rules[j]
        if (rule instanceof CSSStyleRule) {
          const { selectorText } = rule
          if (element.matches(selectorText) || selector === selectorText) {
            finalRules.push(rule)
          }
        }
      }
    } catch {}
  }

  return finalRules
}

function sortCSSRulesByPriority(rules: CSSStyleRule[]): CSSStyleRule[] {
  return rules.sort((a, b) => {
    const aPriority = getCSSRulePriority(a.selectorText)
    const bPriority = getCSSRulePriority(b.selectorText)
    if (aPriority > bPriority) {
      return -1
    } else if (aPriority < bPriority) {
      return 1
    } else {
      return rules.indexOf(a) < rules.indexOf(b) ? -1 : 1
    }
  })
}

function getCSSRulePriority(selectorText: string) {
  let priority = 0
  const selectorParts = selectorText.split(',')
  for (const part of selectorParts) {
    const specificity = getSelectorSpecificity(part)
    priority += specificity * 1000
  }
  return priority
}

function getSelectorSpecificity(selector: string) {
  const specificity = [0, 0, 0]
  const selectorParts = selector.split(' ')
  for (const part of selectorParts) {
    if (part.startsWith('.')) {
      specificity[1]++
    } else if (part.startsWith('[') || part.startsWith(':')) {
      specificity[1]++
    } else if (part.startsWith('#')) {
      specificity[0]++
    } else {
      specificity[2]++
    }
  }
  return parseInt(specificity.join(''))
}
