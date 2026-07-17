import React, { CSSProperties, useCallback, useRef, useState } from 'react'
import MonacoEditor from '@mybricks/code-editor'

import { Panel } from '../../components'
import { useStyleEditorContext } from '../../context'

import type { ChangeEvent, PanelBaseProps } from '../../type'
import css from './index.less'

interface CSSPasteProps extends PanelBaseProps {
  value: CSSProperties
  onChange: ChangeEvent
}

function kebabToCamel(prop: string): string {
  return prop.replace(/-([a-z])/g, (_, letter) => letter.toUpperCase())
}

/** 需要长度单位的属性，纯数字值自动补 px */
const LENGTH_PROPS = new Set([
  'width', 'height', 'minWidth', 'maxWidth', 'minHeight', 'maxHeight',
  'top', 'right', 'bottom', 'left',
  'margin', 'marginTop', 'marginRight', 'marginBottom', 'marginLeft',
  'padding', 'paddingTop', 'paddingRight', 'paddingBottom', 'paddingLeft',
  'borderRadius',
  'borderTopLeftRadius', 'borderTopRightRadius', 'borderBottomLeftRadius', 'borderBottomRightRadius',
  'borderWidth', 'borderTopWidth', 'borderRightWidth', 'borderBottomWidth', 'borderLeftWidth',
  'fontSize', 'letterSpacing', 'wordSpacing', 'textIndent',
  'gap', 'rowGap', 'columnGap',
  'inset', 'insetBlock', 'insetInline',
  'outlineWidth', 'outlineOffset',
  'translate', 'rotate',
])

function normalizePx(key: string, value: string): string {
  if (/^-?\d+\.?\d*$/.test(value) && LENGTH_PROPS.has(key)) {
    return value + 'px'
  }
  return value
}

function expandShorthands(key: string, value: string): Array<{ key: string; value: string }> {
  if (key === 'gap') {
    const parts = value.trim().split(/\s+/)
    return [
      { key: 'rowGap', value: normalizePx('rowGap', parts[0]) },
      { key: 'columnGap', value: normalizePx('columnGap', parts[1] ?? parts[0]) },
    ]
  }
  return [{ key, value: normalizePx(key, value) }]
}

// ─── Category D：Figma 私有属性，无 CSS 对应，直接跳过 ───────────────────────
const FIGMA_SKIP_PROPS = new Set([
  'fill', 'stroke', 'strokeWidth', 'strokeDasharray', 'strokeLinecap', 'strokeLinejoin',
  'layoutMode', 'layoutAlign', 'contentAlign',
  'primaryAxisAlignItems', 'counterAxisAlignItems',
  'primaryAxisSizingMode', 'counterAxisSizingMode',
  'sizing', 'type',
  'effects', 'counterAxisSpacing', 'layoutGrow', 'constraints', 'colorProfile',
])

// ─── Category C：Figma 特有 → 转换为 CSS ─────────────────────────────────────
type TransformResult = Array<{ key: string; value: string }> | null

const FIGMA_TO_CSS: Record<string, (value: string) => TransformResult> = {
  // angle: 45 deg → transform: rotate(45deg)；值为 0 则跳过
  angle: (v) => {
    const num = parseFloat(v)
    if (isNaN(num) || num === 0) return null
    return [{ key: 'transform', value: `rotate(${num}deg)` }]
  },
  // blend-mode: multiply → mix-blend-mode: multiply
  blendMode: (v) => [{ key: 'mixBlendMode', value: v }],
  // item-spacing: 12 → gap: 12px
  itemSpacing: (v) => [{ key: 'gap', value: normalizePx('gap', v) }],
  // horizontal-padding: 16 → padding-left: 16px + padding-right: 16px
  horizontalPadding: (v) => {
    const val = normalizePx('padding', v)
    return [
      { key: 'paddingLeft', value: val },
      { key: 'paddingRight', value: val },
    ]
  },
  // vertical-padding: 8 → padding-top: 8px + padding-bottom: 8px
  verticalPadding: (v) => {
    const val = normalizePx('padding', v)
    return [
      { key: 'paddingTop', value: val },
      { key: 'paddingBottom', value: val },
    ]
  },
  // layout-wrap: wrap → flex-wrap: wrap
  layoutWrap: (v) => [{ key: 'flexWrap', value: v }],
  // rotation: 45 → transform: rotate(45deg)（angle 的别名）
  rotation: (v) => {
    const num = parseFloat(v)
    if (isNaN(num) || num === 0) return null
    return [{ key: 'transform', value: `rotate(${num}deg)` }]
  },
  // line-height: AUTO → line-height: normal
  lineHeight: (v) => {
    if (v.toUpperCase() === 'AUTO') return [{ key: 'lineHeight', value: 'normal' }]
    return [{ key: 'lineHeight', value: v }]
  },
  // text-case: UPPER/LOWER/TITLE → text-transform
  textCase: (v) => {
    const map: Record<string, string> = {
      UPPER: 'uppercase', LOWER: 'lowercase', TITLE: 'capitalize', NONE: 'none',
    }
    const mapped = map[v.toUpperCase()]
    return mapped ? [{ key: 'textTransform', value: mapped }] : null
  },
  // font-weight: Regular/Medium/SemiBold/Bold/... → numeric
  fontWeight: (v) => {
    const namedWeights: Record<string, string> = {
      thin: '100', hairline: '100',
      extralight: '200', ultralight: '200',
      light: '300',
      regular: '400', normal: '400', book: '400',
      medium: '500',
      semibold: '600', demibold: '600',
      bold: '700',
      extrabold: '800', ultrabold: '800',
      black: '900', heavy: '900',
    }
    const mapped = namedWeights[v.toLowerCase().replace(/[\s-]/g, '')]
    return [{ key: 'fontWeight', value: mapped ?? v }]
  },
  // layer-blur / blur: 8 → filter: blur(8px)
  layerBlur: (v) => {
    const px = /^-?\d+\.?\d*$/.test(v) ? v + 'px' : v
    return [{ key: 'filter', value: `blur(${px})` }]
  },
  blur: (v) => {
    const px = /^-?\d+\.?\d*$/.test(v) ? v + 'px' : v
    return [{ key: 'filter', value: `blur(${px})` }]
  },
  // background-blur / backdrop-blur → backdrop-filter: blur(8px)
  backgroundBlur: (v) => {
    const px = /^-?\d+\.?\d*$/.test(v) ? v + 'px' : v
    const value = `blur(${px})`
    return [
      { key: 'backdropFilter', value },
      { key: 'WebkitBackdropFilter', value },
    ]
  },
  backdropBlur: (v) => {
    const px = /^-?\d+\.?\d*$/.test(v) ? v + 'px' : v
    const value = `blur(${px})`
    return [
      { key: 'backdropFilter', value },
      { key: 'WebkitBackdropFilter', value },
    ]
  },
}

/** Category C/D 统一处理：返回转换后的条目数组，或 null 表示跳过 */
function resolveCSSVariableFallback(value: string): string | null {
  if (!/\bvar\(\s*--/i.test(value)) return value

  // Figma 导出的变量名无法映射到灵创主题变量；用 fallback 替换所有 var()。
  // 支持颜色函数、渐变和嵌套 var() 等 fallback 写法；任一变量无 fallback 时跳过整条声明。
  let result = ''
  let cursor = 0

  while (cursor < value.length) {
    const varStart = value.slice(cursor).search(/\bvar\(\s*--/i)
    if (varStart === -1) {
      result += value.slice(cursor)
      break
    }

    const start = cursor + varStart
    const contentStart = value.indexOf('(', start) + 1
    let depth = 1
    let end = contentStart
    for (; end < value.length && depth > 0; end++) {
      if (value[end] === '(') depth++
      else if (value[end] === ')') depth--
    }
    if (depth !== 0) return null

    const content = value.slice(contentStart, end - 1)
    let commaIndex = -1
    let contentDepth = 0
    for (let i = 0; i < content.length; i++) {
      if (content[i] === '(') contentDepth++
      else if (content[i] === ')') contentDepth--
      else if (content[i] === ',' && contentDepth === 0) {
        commaIndex = i
        break
      }
    }
    if (commaIndex === -1) return null

    const fallback = resolveCSSVariableFallback(content.slice(commaIndex + 1).trim())
    if (!fallback) return null
    result += value.slice(cursor, start) + fallback
    cursor = end
  }

  return result.trim()
}

function figmaTransform(key: string, value: string): TransformResult {
  if (FIGMA_SKIP_PROPS.has(key)) return null
  if (Object.prototype.hasOwnProperty.call(FIGMA_TO_CSS, key)) {
    return FIGMA_TO_CSS[key](value)
  }
  return [{ key, value }]
}

function parseCSS(cssText: string): Array<{ key: string; value: string }> {
  const result: Array<{ key: string; value: string }> = []
  for (const line of cssText.split('\n')) {
    const trimmed = line.trim()
    if (!trimmed) continue
    if (trimmed.startsWith('/*') || trimmed.startsWith('//')) continue
    if (trimmed === '{' || trimmed === '}') continue
    const colonIdx = trimmed.indexOf(':')
    if (colonIdx === -1) continue
    const propRaw = trimmed.slice(0, colonIdx).trim()
    if (!/^[\w-]+$/.test(propRaw)) continue
    const valueRaw = trimmed.slice(colonIdx + 1).trim().replace(/;$/, '').trim()
    if (!valueRaw) continue
    for (const entry of expandShorthands(kebabToCamel(propRaw), valueRaw)) {
      const value = resolveCSSVariableFallback(entry.value)
      if (value === null) continue
      const transformed = figmaTransform(entry.key, value)
      if (transformed) result.push(...transformed)
    }
  }
  return result
}

let languageRegistered = false

/** 注册专门用于 CSS 属性声明（无选择器）的 Monaco 语言 */
function registerCSSPropertiesLanguage(monaco: any) {
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
        [/-?\d+\.?\d*(%|px|em|rem|vh|vw|vmin|vmax|dvh|dvw|svh|svw|pt|cm|mm|in|ex|ch|fr|deg|rad|turn|grad|s|ms)\b/, 'number'],
        [/-?\d+\.?\d*\b/, 'number'],
        // 字符串
        [/"[^"]*"/, 'string'],
        [/'[^']*'/, 'string'],
        // 关键字值
        [/\b(flex|grid|block|inline|none|auto|inherit|initial|unset|revert|normal|bold|italic|center|left|right|top|bottom|middle|stretch|baseline|flex-start|flex-end|space-between|space-around|space-evenly|wrap|nowrap|column|row|hidden|visible|scroll|clip|solid|dashed|dotted|double|groove|ridge|inset|outset|absolute|relative|fixed|sticky|static|pointer|default|not-allowed|transparent|currentColor)\b/, 'keyword'],
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

  // 颜色映射（复用 CSS 高亮风格）
  monaco.editor.defineTheme('css-properties-light', {
    base: 'vs',
    inherit: true,
    rules: [
      { token: 'attribute.name', foreground: '9B1C7C' },   // 属性名：深粉/品红
      { token: 'number', foreground: '098658' },            // 数字：绿
      { token: 'number.hex', foreground: '098658' },
      { token: 'string', foreground: 'A31515' },            // 字符串：红
      { token: 'keyword', foreground: '0070C1' },           // 关键字：蓝
      { token: 'type', foreground: '795E26' },              // 函数名：棕
      { token: 'variable.css', foreground: '001080' },      // CSS 变量：深蓝
      { token: 'comment', foreground: '6A9955' },           // 注释：灰绿
      { token: 'delimiter', foreground: '000000' },
      { token: 'identifier', foreground: '001080' },
    ],
    colors: {},
  })
}

const MIN_HEIGHT = 56
const DEFAULT_HEIGHT = 120

export function CSSPaste({ onChange, showTitle, collapse }: CSSPasteProps) {
  const context = useStyleEditorContext()
  const CDN = context?.editConfig?.CDN
  const editorRef = useRef<any>(null)
  const [lastCount, setLastCount] = useState(0)
  const [editorHeight, setEditorHeight] = useState(DEFAULT_HEIGHT)

  const onMounted = useCallback((editor: any, monaco: any) => {
    editorRef.current = editor
    registerCSSPropertiesLanguage(monaco)
    monaco.editor.setTheme('css-properties-light')
    editor.updateOptions({
      lineNumbers: 'off',
      lineDecorationsWidth: 8,
      lineNumbersMinChars: 0,
      glyphMargin: false,
      folding: false,
    })
    // 粘贴后滚动到顶部，保持内容从左上角开始显示
    editor.onDidPaste(() => {
      editor.setScrollPosition({ scrollTop: 0, scrollLeft: 0 })
      editor.setPosition({ lineNumber: 1, column: 1 })
    })
  }, [])

  const handleApply = useCallback(() => {
    if (lastCount > 0) return
    const val = editorRef.current?.getValue?.() ?? ''
    if (!val.trim()) return
    const changes = parseCSS(val)
    if (changes.length > 0) {
      onChange(changes)
      setLastCount(changes.length)
      editorRef.current?.setValue?.('')
      setTimeout(() => setLastCount(0), 2000)
    }
  }, [onChange, lastCount])

  // 拖拽调节高度
  const handleDragMouseDown = useCallback(() => {
    const onMouseMove = (e: MouseEvent) => {
      setEditorHeight(h => Math.max(MIN_HEIGHT, h + e.movementY))
    }
    const onMouseUp = () => {
      document.removeEventListener('mousemove', onMouseMove)
      document.removeEventListener('mouseup', onMouseUp)
      document.body.style.cursor = ''
      document.body.style.userSelect = ''
    }
    document.body.style.cursor = 'ns-resize'
    document.body.style.userSelect = 'none'
    document.addEventListener('mousemove', onMouseMove)
    document.addEventListener('mouseup', onMouseUp)
  }, [])

  return (
    <Panel
      title="粘贴 CSS"
      showTitle={showTitle}
      collapse={collapse}
    >
      <Panel.Content style={{ flexDirection: 'column', gap: 4 }}>
        <div className={css.editorWrap}>
          <MonacoEditor
            height={`${editorHeight}px`}
            language="css-properties"
            CDN={CDN}
            lineNumbers="off"
            value=""
            onMounted={onMounted}
            options={{
              minimap: { enabled: false },
              scrollbar: { vertical: 'hidden', horizontal: 'hidden' },
              overviewRulerLanes: 0,
              hideCursorInOverviewRuler: true,
              renderLineHighlight: 'none',
              folding: false,
              glyphMargin: false,
              lineDecorationsWidth: 8,
              lineNumbersMinChars: 0,
              wordWrap: 'on',
              fontSize: 11,
              padding: { top: 4, bottom: 4 },
              scrollBeyondLastLine: false,
              automaticLayout: true,
            }}
          />
          <div className={css.dragHandle} onMouseDown={handleDragMouseDown} />
        </div>
        <button
          className={`${css.applyBtn}${lastCount > 0 ? ` ${css.applyBtnSuccess}` : ''}`}
          onClick={handleApply}
        >
          {lastCount > 0 ? `已应用 ${lastCount} 条样式` : '应用样式'}
        </button>
      </Panel.Content>
    </Panel>
  )
}
