import React, { CSSProperties, useCallback, useMemo, useState } from 'react'

import { Panel } from '../../components'
import { Opacity as OpacityIcon } from '../../icons/Opacity'
import { useDragNumber } from '../../hooks/useDragNumber'

import type { ChangeEvent, PanelBaseProps } from '../../type'

import css from './index.less'

interface AppearanceProps extends PanelBaseProps {
  value: CSSProperties
  onChange: ChangeEvent
}

/** 将 CSS opacity (0~1) 转换为百分比整数 (0~100) */
function opacityToPercent(opacity: any): number {
  const n = parseFloat(opacity)
  if (isNaN(n)) return 100
  return Math.round(n * 100)
}

/** 将百分比整数 (0~100) 转换为 CSS opacity */
function percentToOpacity(percent: number): number {
  return Math.min(1, Math.max(0, percent / 100))
}

export function Appearance({ value, onChange, showTitle, collapse }: AppearanceProps) {
  const [opacityForceKey, setOpacityForceKey] = useState(0)

  const opacityPercent = useMemo(() => {
    return opacityToPercent(value?.opacity)
  }, [value?.opacity])

  const handleOpacityChange = useCallback(
    (val: string) => {
      const trimmed = val.trim()
      // 清空后回车/失焦：直接应用 0
      if (!trimmed) {
        onChange({ key: 'opacity', value: 0 })
        return
      }
      const num = parseFloat(trimmed)
      if (!isNaN(num)) {
        onChange({ key: 'opacity', value: percentToOpacity(num) })
      }
    },
    [onChange]
  )
  const getDragPropsOpacity = useDragNumber({
    min: 0,
    max: 100,
    onDragStart: (_currentValue, inputEl) => {
      // 优先读输入框 DOM，避免清空设为 0 后 props 尚未回传时从 100 起拖
      if (inputEl) {
        const domValue = parseFloat(inputEl.value)
        if (!isNaN(domValue)) return domValue
      }
      return opacityPercent
    },
    onDragChange: value => {
      handleOpacityChange(String(value))
    },
    onDragEnd: finalValue => {
      handleOpacityChange(String(finalValue))
    },
  })

  const handleReset = useCallback(() => {
    onChange([{ key: 'opacity', value: null }])
    setOpacityForceKey(k => k + 1)
  }, [onChange])

  // 未设置不透明度（默认 100%）时强制折叠，与效果面板空状态一致
  const effectiveCollapse = opacityPercent === 100 ? true : collapse

  return (
    <Panel
      title='不透明度'
      showTitle={showTitle}
      showReset={true}
      showDelete={true}
      resetFunction={handleReset}
      collapse={effectiveCollapse}
    >
      <Panel.Content style={{ paddingTop: 0 }}>
        <Panel.Item className={css.inputItem}>
          <span
            className={`${css.inputIcon} ${css.opacityIcon}`}
            {...getDragPropsOpacity(opacityPercent, "{content:'拖拽调整不透明度',position:'left'}")}
          >
            <OpacityIcon />
          </span>
          <input
            key={opacityForceKey}
            type='number'
            className={css.opacityInput}
            defaultValue={opacityPercent}
            min={0}
            max={100}
            step={1}
            onBlur={e => {
              const v = e.target.value.trim()
              if (!v || isNaN(parseFloat(v))) {
                handleOpacityChange('')
                e.target.value = '0'
              } else {
                handleOpacityChange(v)
              }
            }}
            onKeyDown={e => {
              if (e.key === 'Enter') {
                const input = e.target as HTMLInputElement
                const v = input.value.trim()
                if (!v || isNaN(parseFloat(v))) {
                  handleOpacityChange('')
                  input.value = '0'
                } else {
                  handleOpacityChange(v)
                }
              }
            }}
          />
          <span className={css.percentSuffix}>%</span>
        </Panel.Item>
      </Panel.Content>
    </Panel>
  )
}
