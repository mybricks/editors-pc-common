import React, { CSSProperties, useCallback, useEffect, useRef, useState } from 'react'

import { Panel } from '../../components'

import type { ChangeEvent, PanelBaseProps } from '../../type'

interface ZIndexProps extends PanelBaseProps {
  value: CSSProperties
  onChange: ChangeEvent
}

export function ZIndex({ value, onChange, config, showTitle, collapse }: ZIndexProps) {
  const rawValue = value?.zIndex
  const [localValue, setLocalValue] = useState(rawValue != null ? String(rawValue) : '')
  const isEditingRef = useRef(false)

  // 父组件值变化时（如重置、外部设置），同步本地状态
  useEffect(() => {
    if (!isEditingRef.current) {
      setLocalValue(rawValue != null ? String(rawValue) : '')
    }
  }, [rawValue])

  const refresh = useCallback(() => {
    onChange({ key: 'zIndex', value: null })
    setLocalValue('')
  }, [onChange])

  const handleFocus = useCallback(() => {
    isEditingRef.current = true
  }, [])

  // onChange 处理键盘输入 + 原生 spinner 点击（type="number" 的步进箭头）
  const handleChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value
    setLocalValue(val)
    const num = parseInt(val, 10)
    if (!isNaN(num)) {
      onChange({ key: 'zIndex', value: num })
    }
  }, [onChange])

  const handleBlur = useCallback((e: React.FocusEvent<HTMLInputElement>) => {
    isEditingRef.current = false
    const val = e.target.value.trim()
    if (!val) {
      onChange({ key: 'zIndex', value: null })
      setLocalValue('')
    } else {
      const num = parseInt(val, 10)
      onChange({ key: 'zIndex', value: isNaN(num) ? null : num })
      setLocalValue(isNaN(num) ? '' : String(num))
    }
  }, [onChange])

  const effectiveCollapse = rawValue != null ? false : collapse

  return (
    <Panel title='层级' showTitle={showTitle} showReset={true} resetFunction={refresh} collapse={effectiveCollapse}>
      <Panel.Content>
        <Panel.Item>
          <input
            type="number"
            value={localValue}
            placeholder="默认"
            onChange={handleChange}
            onFocus={handleFocus}
            onBlur={handleBlur}
            style={{
              width: '100%',
              height: '100%',
              border: 'none',
              background: 'transparent',
              fontSize: 12,
              fontWeight: 500,
              color: 'var(--mybricks-text-color-main, #888)',
              paddingLeft: 6,
              paddingRight: 2,
              boxSizing: 'border-box' as const,
              cursor: 'text',
              outline: 'none',
            }}
          />
        </Panel.Item>
      </Panel.Content>
    </Panel>
  )
}
