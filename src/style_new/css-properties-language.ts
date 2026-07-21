let languageRegistered = false

// CSS 命名颜色 → [r, g, b]（0-255）
const CSS_NAMED_COLORS: Record<string, [number, number, number]> = {
  aliceblue: [240, 248, 255], antiquewhite: [250, 235, 215], aqua: [0, 255, 255],
  aquamarine: [127, 255, 212], azure: [240, 255, 255], beige: [245, 245, 220],
  bisque: [255, 228, 196], black: [0, 0, 0], blanchedalmond: [255, 235, 205],
  blue: [0, 0, 255], blueviolet: [138, 43, 226], brown: [165, 42, 42],
  burlywood: [222, 184, 135], cadetblue: [95, 158, 160], chartreuse: [127, 255, 0],
  chocolate: [210, 105, 30], coral: [255, 127, 80], cornflowerblue: [100, 149, 237],
  cornsilk: [255, 248, 220], crimson: [220, 20, 60], cyan: [0, 255, 255],
  darkblue: [0, 0, 139], darkcyan: [0, 139, 139], darkgoldenrod: [184, 134, 11],
  darkgray: [169, 169, 169], darkgreen: [0, 100, 0], darkgrey: [169, 169, 169],
  darkkhaki: [189, 183, 107], darkmagenta: [139, 0, 139], darkolivegreen: [85, 107, 47],
  darkorange: [255, 140, 0], darkorchid: [153, 50, 204], darkred: [139, 0, 0],
  darksalmon: [233, 150, 122], darkseagreen: [143, 188, 143], darkslateblue: [72, 61, 139],
  darkslategray: [47, 79, 79], darkslategrey: [47, 79, 79], darkturquoise: [0, 206, 209],
  darkviolet: [148, 0, 211], deeppink: [255, 20, 147], deepskyblue: [0, 191, 255],
  dimgray: [105, 105, 105], dimgrey: [105, 105, 105], dodgerblue: [30, 144, 255],
  firebrick: [178, 34, 34], floralwhite: [255, 250, 240], forestgreen: [34, 139, 34],
  fuchsia: [255, 0, 255], gainsboro: [220, 220, 220], ghostwhite: [248, 248, 255],
  gold: [255, 215, 0], goldenrod: [218, 165, 32], gray: [128, 128, 128],
  green: [0, 128, 0], greenyellow: [173, 255, 47], grey: [128, 128, 128],
  honeydew: [240, 255, 240], hotpink: [255, 105, 180], indianred: [205, 92, 92],
  indigo: [75, 0, 130], ivory: [255, 255, 240], khaki: [240, 230, 140],
  lavender: [230, 230, 250], lavenderblush: [255, 240, 245], lawngreen: [124, 252, 0],
  lemonchiffon: [255, 250, 205], lightblue: [173, 216, 230], lightcoral: [240, 128, 128],
  lightcyan: [224, 255, 255], lightgoldenrodyellow: [250, 250, 210], lightgray: [211, 211, 211],
  lightgreen: [144, 238, 144], lightgrey: [211, 211, 211], lightpink: [255, 182, 193],
  lightsalmon: [255, 160, 122], lightseagreen: [32, 178, 170], lightskyblue: [135, 206, 250],
  lightslategray: [119, 136, 153], lightslategrey: [119, 136, 153], lightsteelblue: [176, 196, 222],
  lightyellow: [255, 255, 224], lime: [0, 255, 0], limegreen: [50, 205, 50],
  linen: [250, 240, 230], magenta: [255, 0, 255], maroon: [128, 0, 0],
  mediumaquamarine: [102, 205, 170], mediumblue: [0, 0, 205], mediumorchid: [186, 85, 211],
  mediumpurple: [147, 112, 219], mediumseagreen: [60, 179, 113], mediumslateblue: [123, 104, 238],
  mediumspringgreen: [0, 250, 154], mediumturquoise: [72, 209, 204], mediumvioletred: [199, 21, 133],
  midnightblue: [25, 25, 112], mintcream: [245, 255, 250], mistyrose: [255, 228, 225],
  moccasin: [255, 228, 181], navajowhite: [255, 222, 173], navy: [0, 0, 128],
  oldlace: [253, 245, 230], olive: [128, 128, 0], olivedrab: [107, 142, 35],
  orange: [255, 165, 0], orangered: [255, 69, 0], orchid: [218, 112, 214],
  palegoldenrod: [238, 232, 170], palegreen: [152, 251, 152], paleturquoise: [175, 238, 238],
  palevioletred: [219, 112, 147], papayawhip: [255, 239, 213], peachpuff: [255, 218, 185],
  peru: [205, 133, 63], pink: [255, 192, 203], plum: [221, 160, 221],
  powderblue: [176, 224, 230], purple: [128, 0, 128], rebeccapurple: [102, 51, 153],
  red: [255, 0, 0], rosybrown: [188, 143, 143], royalblue: [65, 105, 225],
  saddlebrown: [139, 69, 19], salmon: [250, 128, 114], sandybrown: [244, 164, 96],
  seagreen: [46, 139, 87], seashell: [255, 245, 238], sienna: [160, 82, 45],
  silver: [192, 192, 192], skyblue: [135, 206, 235], slateblue: [106, 90, 205],
  slategray: [112, 128, 144], slategrey: [112, 128, 144], snow: [255, 250, 250],
  springgreen: [0, 255, 127], steelblue: [70, 130, 180], tan: [210, 180, 140],
  teal: [0, 128, 128], thistle: [216, 191, 216], tomato: [255, 99, 71],
  turquoise: [64, 224, 208], violet: [238, 130, 238], wheat: [245, 222, 179],
  white: [255, 255, 255], whitesmoke: [245, 245, 245], yellow: [255, 255, 0],
  yellowgreen: [154, 205, 50],
}

function parseColorValue(raw: string): { r: number; g: number; b: number; a: number } | null {
  const s = raw.trim()

  // #rgb / #rrggbb / #rrggbbaa
  if (s.startsWith('#')) {
    const hex = s.slice(1)
    if (hex.length === 3) {
      return {
        r: parseInt(hex[0] + hex[0], 16) / 255,
        g: parseInt(hex[1] + hex[1], 16) / 255,
        b: parseInt(hex[2] + hex[2], 16) / 255,
        a: 1,
      }
    }
    if (hex.length === 6) {
      return {
        r: parseInt(hex.slice(0, 2), 16) / 255,
        g: parseInt(hex.slice(2, 4), 16) / 255,
        b: parseInt(hex.slice(4, 6), 16) / 255,
        a: 1,
      }
    }
    if (hex.length === 8) {
      return {
        r: parseInt(hex.slice(0, 2), 16) / 255,
        g: parseInt(hex.slice(2, 4), 16) / 255,
        b: parseInt(hex.slice(4, 6), 16) / 255,
        a: parseInt(hex.slice(6, 8), 16) / 255,
      }
    }
    return null
  }

  // rgb() / rgba()
  const rgbaMatch = s.match(/^rgba?\(\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)(?:\s*,\s*([\d.]+))?\s*\)$/)
  if (rgbaMatch) {
    return {
      r: Number(rgbaMatch[1]) / 255,
      g: Number(rgbaMatch[2]) / 255,
      b: Number(rgbaMatch[3]) / 255,
      a: rgbaMatch[4] !== undefined ? Number(rgbaMatch[4]) : 1,
    }
  }

  // hsl() / hsla()
  const hslaMatch = s.match(/^hsla?\(\s*([\d.]+)\s*,\s*([\d.]+)%\s*,\s*([\d.]+)%(?:\s*,\s*([\d.]+))?\s*\)$/)
  if (hslaMatch) {
    const h = Number(hslaMatch[1]) / 360
    const sat = Number(hslaMatch[2]) / 100
    const l = Number(hslaMatch[3]) / 100
    const a = hslaMatch[4] !== undefined ? Number(hslaMatch[4]) : 1
    const hue2rgb = (p: number, q: number, t: number) => {
      if (t < 0) t += 1
      if (t > 1) t -= 1
      if (t < 1 / 6) return p + (q - p) * 6 * t
      if (t < 1 / 2) return q
      if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6
      return p
    }
    const q = l < 0.5 ? l * (1 + sat) : l + sat - l * sat
    const p = 2 * l - q
    return { r: hue2rgb(p, q, h + 1 / 3), g: hue2rgb(p, q, h), b: hue2rgb(p, q, h - 1 / 3), a }
  }

  // named color
  const named = CSS_NAMED_COLORS[s.toLowerCase()]
  if (named) {
    return { r: named[0] / 255, g: named[1] / 255, b: named[2] / 255, a: 1 }
  }

  return null
}

/** 扫描一行文本，提取所有颜色 token 的起止列（1-based）及颜色值 */
function extractColorsFromLine(line: string): Array<{ startCol: number; endCol: number; color: { r: number; g: number; b: number; a: number } }> {
  const results: Array<{ startCol: number; endCol: number; color: { r: number; g: number; b: number; a: number } }> = []

  // 匹配 hex / rgb / rgba / hsl / hsla / named color（在值侧）
  const COLOR_RE = /#[0-9a-fA-F]{3,8}\b|rgba?\([^)]+\)|hsla?\([^)]+\)|\b([a-zA-Z]+)\b/g
  let m: RegExpExecArray | null

  while ((m = COLOR_RE.exec(line)) !== null) {
    const token = m[0]
    // 纯字母 token（命名颜色）：必须在颜色表里才处理；rgb()/hsl() 函数不走这条
    if (!token.includes('(') && /^[a-zA-Z]/.test(token)) {
      if (!CSS_NAMED_COLORS[token.toLowerCase()]) continue
    }
    const color = parseColorValue(token)
    if (!color) continue
    results.push({ startCol: m.index + 1, endCol: m.index + token.length + 1, color })
  }

  return results
}

/**
 * 注册专门用于 CSS 属性声明（无选择器/花括号）的 Monaco 语言；
 * 不高亮主题，复用全局 vs / vs-dark。包含颜色预览装饰器。
 */
export function registerCSSPropertiesLanguage(monaco: any) {
  if (languageRegistered) return
  languageRegistered = true

  monaco.languages.register({ id: 'css-properties' })

  monaco.languages.setMonarchTokensProvider('css-properties', {
    tokenizer: {
      root: [
        // 注释
        [/\/\*/, 'comment', '@comment'],
        [/\/\/.*$/, 'comment'],
        // CSS 属性名（紧接 :）
        [/[\w-]+(?=\s*:)/, 'attribute.name'],
        // 冒号分隔
        [/:/, 'delimiter'],
        // 十六进制颜色
        [/#[0-9a-fA-F]{3,8}\b/, 'number.hex'],
        // CSS 变量 var(--xxx) 或 var(--xxx, fallback)
        [/var\(--[\w-]+[^)]*\)/, 'variable.css'],
        // 数值 + 单位
        [
          /-?\d+\.?\d*(%|px|em|rem|vh|vw|vmin|vmax|dvh|dvw|svh|svw|pt|cm|mm|in|ex|ch|fr|deg|rad|turn|grad|s|ms)\b/,
          'number',
        ],
        [/-?\d+\.?\d*\b/, 'number'],
        // 字符串
        [/"[^"]*"/, 'string'],
        [/'[^']*'/, 'string'],
        // 关键字值
        [
          /\b(flex|grid|block|inline|none|auto|inherit|initial|unset|revert|normal|bold|italic|center|left|right|top|bottom|middle|stretch|baseline|flex-start|flex-end|space-between|space-around|space-evenly|wrap|nowrap|column|row|hidden|visible|scroll|clip|solid|dashed|dotted|double|groove|ridge|inset|outset|absolute|relative|fixed|sticky|static|pointer|default|not-allowed|transparent|currentColor)\b/,
          'keyword',
        ],
        // 函数调用（rgba / linear-gradient / etc.）
        [/[\w-]+(?=\()/, 'type'],
        // 其余字母数字（属性值的其他部分）
        [/[\w-]+/, 'identifier'],
        // 标点
        [/[;,()\/]/, 'delimiter'],
      ],
      comment: [
        [/[^/*]+/, 'comment'],
        [/\*\//, 'comment', '@pop'],
        [/[/*]/, 'comment'],
      ],
    },
  })

  // 颜色装饰器：让 Monaco 在颜色值旁边显示小色块
  monaco.languages.registerColorProvider('css-properties', {
    provideDocumentColors(model: any) {
      const lines: string[] = model.getValue().split('\n')
      const result: any[] = []
      lines.forEach((line: string, lineIdx: number) => {
        const matches = extractColorsFromLine(line)
        for (const { startCol, endCol, color } of matches) {
          result.push({
            color: { red: color.r, green: color.g, blue: color.b, alpha: color.a },
            range: {
              startLineNumber: lineIdx + 1,
              startColumn: startCol,
              endLineNumber: lineIdx + 1,
              endColumn: endCol,
            },
          })
        }
      })
      return result
    },
    provideColorPresentations(_model: any, colorInfo: any) {
      const { red: r, green: g, blue: b, alpha: a } = colorInfo.color
      const toHex = (v: number) => Math.round(v * 255).toString(16).padStart(2, '0')
      const hexAlpha = a < 1 ? toHex(a) : ''
      const label = `#${toHex(r)}${toHex(g)}${toHex(b)}${hexAlpha}`
      return [{ label }]
    },
  })
}
