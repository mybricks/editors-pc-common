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

function expandShorthands(key: string, value: string): Array<{ key: string; value: string }> {
  if (key === 'gap') {
    const parts = value.trim().split(/\s+/)
    return [
      { key: 'rowGap', value: parts[0] },
      { key: 'columnGap', value: parts[1] ?? parts[0] },
    ]
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
    result.push(...expandShorthands(kebabToCamel(propRaw), valueRaw))
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
