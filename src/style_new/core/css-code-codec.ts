// @ts-ignore
import { toCSS, toJSON } from 'cssjson'

export interface StyleData {
  styleKey: string
  value: string | number | boolean
}

/**
 * 将驼峰写法改成xx-xx的css命名写法
 * @param styleKey
 */
export function toLine(styleKey: string) {
  return styleKey.replace(/([A-Z])/g, '-$1').toLowerCase()
}

export function toHump(name: String) {
  return name.replace(/\-(\w)/g, (all, letter) => {
    return letter.toUpperCase()
  })
}

export function parseToCssCode(styleData: StyleData, selector: string) {
  const parseStyleData: any = {}
  for (const styleKey in styleData) {
    // @ts-ignore
    parseStyleData[toLine(styleKey)] = styleData[styleKey]
  }

  const cssJson = {
    children: {
      [selector || 'div']: {
        children: {},
        attributes: parseStyleData,
      },
    },
  }

  return toCSS(cssJson)
}

export function parseToStyleData(cssCode: string, selector: string) {
  const styleData = {}
  try {
    const cssJson = toJSON(cssCode.trim().endsWith('}') ? cssCode : (cssCode + '}')) // 包bug
    const cssJsonData = cssJson?.children?.[selector || 'div']?.attributes
    for (const key in cssJsonData) {
      // @ts-ignore
      styleData[toHump(key)] = cssJsonData[key]
    }
  } catch (e: any) {
    console.error(e.message)
  }

  return styleData
}
