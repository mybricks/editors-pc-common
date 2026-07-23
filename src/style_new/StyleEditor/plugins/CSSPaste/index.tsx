import React, { CSSProperties, useCallback, useRef, useState } from 'react'
import MonacoEditor from '@mybricks/code-editor'

import { useDarkMode } from '../../../../hooks'
import { Panel } from '../../components'
import { useStyleEditorContext } from '../../context'

import { registerCSSPropertiesLanguage } from '../../../css-properties-language'
import { expandPasteConflictClears } from '../../../core/paste-style-merge'
import { resolvePasteCssVarValue } from '../../../core/resolve-paste-css-vars'
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
      // 灵创已有变量则保留 var()；否则只留 fallback
      const value = resolvePasteCssVarValue(entry.value)
      if (value === null) continue
      const transformed = figmaTransform(entry.key, value)
      if (transformed) result.push(...transformed)
    }
  }
  return result
}

const MIN_HEIGHT = 56
const DEFAULT_HEIGHT = 120

/** 与 code/index.tsx 一致：复用项目已有的 light / vs-dark，不 defineTheme / setTheme */
function useEditorTheme(): 'light' | 'vs-dark' {
  const isDark = useDarkMode()
  return isDark ? 'vs-dark' : 'light'
}

export function CSSPaste({ onChange, showTitle, collapse }: CSSPasteProps) {
  const context = useStyleEditorContext()
  const CDN = context?.editConfig?.CDN
  const editorRef = useRef<any>(null)
  const [lastCount, setLastCount] = useState(0)
  const [editorHeight, setEditorHeight] = useState(DEFAULT_HEIGHT)
  const editorTheme = useEditorTheme()

  const onMounted = useCallback((editor: any, monaco: any) => {
    editorRef.current = editor
    registerCSSPropertiesLanguage(monaco)
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
    const changes = expandPasteConflictClears(parseCSS(val))
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
      title="CSS"
      showTitle={showTitle}
      collapse={collapse}
    >
      <Panel.Content style={{ flexDirection: 'column', gap: 4 }}>
        <div className={css.editorWrap}>
          <MonacoEditor
            height={`${editorHeight}px`}
            language="css-properties"
            CDN={CDN}
            theme={editorTheme}
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
