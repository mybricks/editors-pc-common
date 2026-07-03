import React, { CSSProperties, useCallback, useState, useRef } from 'react'

import { Panel } from '../../components'

import type { ChangeEvent, PanelBaseProps } from '../../type'

interface CSSPasteProps extends PanelBaseProps {
  value: CSSProperties
  onChange: ChangeEvent
}

/** 将 kebab-case 转为 camelCase */
function kebabToCamel(prop: string): string {
  return prop.replace(/-([a-z])/g, (_, letter) => letter.toUpperCase())
}

/**
 * 解析 Figma 复制的 CSS 文本，返回 camelCase key 的样式变更列表。
 *
 * Figma Dev 面板输出格式示例：
 *   width: 200px;
 *   background: rgba(75, 88, 181, 1);
 *   border-radius: 8px;
 *   box-shadow: 0px 4px 12px 0px rgba(0, 0, 0, 0.20);
 */
function parseFigmaCSS(cssText: string): Array<{ key: string; value: string }> {
  const result: Array<{ key: string; value: string }> = []
  const lines = cssText.split('\n')

  for (const line of lines) {
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

    result.push({ key: kebabToCamel(propRaw), value: valueRaw })
  }

  return result
}

type Status = 'idle' | 'success' | 'error'

export function CSSPaste({ onChange, showTitle, collapse }: CSSPasteProps) {
  const [status, setStatus] = useState<Status>('idle')
  const [lastCount, setLastCount] = useState(0)
  const [hovered, setHovered] = useState(false)

  const handleClick = useCallback(async () => {
    try {
      const text = await navigator.clipboard.readText()
      if (!text?.trim()) {
        setStatus('error')
        setLastCount(0)
        setTimeout(() => setStatus('idle'), 2000)
        return
      }
      const changes = parseFigmaCSS(text)
      if (changes.length > 0) {
        onChange(changes)
        setLastCount(changes.length)
        setStatus('success')
        setTimeout(() => setStatus('idle'), 2000)
      } else {
        setStatus('error')
        setLastCount(0)
        setTimeout(() => setStatus('idle'), 2000)
      }
    } catch {
      setStatus('error')
      setLastCount(0)
      setTimeout(() => setStatus('idle'), 2000)
    }
  }, [onChange])

  const isSuccess = status === 'success'
  const isError = status === 'error'

  return (
    <Panel
      title="导入样式"
      showTitle={showTitle}
      showDelete={false}
      collapse={false}
    >
      <Panel.Content>
        <Panel.Item activeWhenBlur={false}>
          <button
            onClick={handleClick}
            onMouseEnter={() => setHovered(true)}
            onMouseLeave={() => setHovered(false)}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 6,
              width: '100%',
              height: 26,
              border: isError
                ? '1px dashed #F55753'
                : '1px solid transparent',
              borderRadius: 6,
              background: isSuccess
                ? 'rgba(82,196,26,0.08)'
                : isError
                  ? 'rgba(245,87,83,0.06)'
                  : 'var(--mybricks-bg-color-secondary, #F5F5F5)',
              cursor: 'pointer',
              fontSize: 12,
              color: isError
                ? '#F55753'
                : isSuccess
                  ? '#52c41a'
                  : hovered
                    ? 'var(--mybricks-color-primary, #FA6400)'
                    : 'var(--mybricks-text-color-main, #333)',
              transition: 'all 0.15s',
              padding: '0 10px',
              boxSizing: 'border-box',
            }}
          >
            {isSuccess ? (
              <>
                <svg width="13" height="13" viewBox="0 0 13 13" fill="none">
                  <circle cx="6.5" cy="6.5" r="6" stroke="currentColor" />
                  <path d="M3.5 6.5L5.5 8.5L9.5 4.5" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                已导入 {lastCount} 个样式属性
              </>
            ) : isError ? (
              <>
                <svg width="13" height="13" viewBox="0 0 13 13" fill="none">
                  <circle cx="6.5" cy="6.5" r="6" stroke="currentColor" />
                  <path d="M4.5 4.5L8.5 8.5M8.5 4.5L4.5 8.5" stroke="currentColor" strokeLinecap="round" />
                </svg>
                剪切板中未检测到 CSS
              </>
            ) : (
              <>
                <svg width="13" height="13" viewBox="0 0 13 13" fill="none">
                  <rect x="3" y="1.5" width="7" height="9" rx="1" stroke="currentColor" />
                  <path d="M5 1.5V2.5H8V1.5" stroke="currentColor" strokeLinecap="round" />
                  <path d="M5 5.5H8M5 7.5H7" stroke="currentColor" strokeLinecap="round" />
                </svg>
                读取剪切板 CSS
              </>
            )}
          </button>
        </Panel.Item>
      </Panel.Content>
    </Panel>
  )
}
