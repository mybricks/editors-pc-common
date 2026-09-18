import React, { CSSProperties, useCallback, useEffect, useRef, useState } from 'react'

import { Panel, ClearButton } from '../../components'

import type { ChangeEvent, PanelBaseProps } from '../../type'
import css from './index.less'

const TOP_Z_INDEX = 9999
const BOTTOM_Z_INDEX = -1

interface ZIndexProps extends PanelBaseProps {
  value: CSSProperties
  onChange: ChangeEvent
}

export function ZIndex({ value, onChange, config, showTitle, collapse }: ZIndexProps) {
  const rawValue = value?.zIndex
  const [localValue, setLocalValue] = useState(rawValue != null ? String(rawValue) : '')
  const isEditingRef = useRef(false)
  const numericValue = rawValue == null ? null : Number(rawValue)

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

  const setPreset = useCallback((preset: number) => {
    isEditingRef.current = false
    onChange({ key: 'zIndex', value: preset })
    setLocalValue(String(preset))
  }, [onChange])

  const modeSwitch = (
    <div className={css.modeSwitch}>
      <div
        className={`${css.modeOption} ${numericValue === TOP_Z_INDEX ? css.modeOptionActive : ''}`}
        onClick={() => { if (numericValue !== TOP_Z_INDEX) setPreset(TOP_Z_INDEX) }}
      >
        置顶
      </div>
      <div
        className={`${css.modeOption} ${numericValue === BOTTOM_Z_INDEX ? css.modeOptionActive : ''}`}
        onClick={() => { if (numericValue !== BOTTOM_Z_INDEX) setPreset(BOTTOM_Z_INDEX) }}
      >
        置底
      </div>
    </div>
  )

  const effectiveCollapse = rawValue != null ? false : collapse

  return (
    <Panel
      title='层级'
      showTitle={showTitle}
      showReset={true}
      resetFunction={refresh}
      headerRight={modeSwitch}
      collapse={effectiveCollapse}
    >
      <Panel.Content>
        <Panel.Item className={css.clearRow}>
          <input
            type="number"
            value={localValue}
            placeholder="默认"
            onChange={handleChange}
            onFocus={handleFocus}
            onBlur={handleBlur}
            style={{
              flex: '1 1 auto',
              width: 'auto',
              minWidth: 0,
              height: '100%',
              border: 'none',
              background: 'transparent',
              fontSize: 11,
              fontWeight: 500,
              color: 'var(--mybricks-text-color-main, #888)',
              paddingLeft: 6,
              paddingRight: 2,
              boxSizing: 'border-box' as const,
              cursor: 'text',
              outline: 'none',
            }}
          />
          {localValue !== '' && <ClearButton onClick={refresh} />}
        </Panel.Item>
      </Panel.Content>
    </Panel>
  )
}
