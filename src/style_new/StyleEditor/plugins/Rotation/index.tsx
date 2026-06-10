import React, { CSSProperties, useCallback, useEffect, useRef, useState } from 'react'

import { Panel } from '../../components'
import { useDragNumber } from '../../hooks'
import { Ratation } from '../../icons/Rotation'
import { Rotation90R } from '../../icons/Rotation90R'
import { RotationFlipHorizontal } from '../../icons/RotationFlipHorizontal'
import { RotationFlipVertical } from '../../icons/RotationFlipVertical'

import type { ChangeEvent, PanelBaseProps } from '../../type'
import css from './index.less'

// ─── Transform utilities ───────────────────────────────────────────────

function parseTransform(transform: string | undefined): { angle: number; flipX: boolean; flipY: boolean } {
  let angle = 0, flipX = false, flipY = false
  if (!transform || transform === 'none') return { angle, flipX, flipY }

  const rotateMatch = transform.match(/rotate\((-?[\d.]+)deg\)/)
  if (rotateMatch) angle = parseFloat(rotateMatch[1])

  // scale(-1) / scale(-1, -1) / scale(-1, 1)
  const scaleMatch = transform.match(/(?<![XY])scale\((-?[\d.]+)(?:,\s*(-?[\d.]+))?\)/)
  if (scaleMatch) {
    const sx = parseFloat(scaleMatch[1])
    const sy = scaleMatch[2] !== undefined ? parseFloat(scaleMatch[2]) : sx
    if (sx < 0) flipX = true
    if (sy < 0) flipY = true
  }

  const scaleXMatch = transform.match(/scaleX\((-?[\d.]+)\)/)
  if (scaleXMatch && parseFloat(scaleXMatch[1]) < 0) flipX = true

  const scaleYMatch = transform.match(/scaleY\((-?[\d.]+)\)/)
  if (scaleYMatch && parseFloat(scaleYMatch[1]) < 0) flipY = true

  return { angle, flipX, flipY }
}

function composeTransform(angle: number, flipX: boolean, flipY: boolean): string | null {
  const parts: string[] = []
  if (angle !== 0) parts.push(`rotate(${angle}deg)`)
  if (flipX && flipY) parts.push('scale(-1, -1)')
  else if (flipX) parts.push('scaleX(-1)')
  else if (flipY) parts.push('scaleY(-1)')
  return parts.length > 0 ? parts.join(' ') : null
}

// ─── Component ────────────────────────────────────────────────────────

interface RotationProps extends PanelBaseProps {
  value: CSSProperties
  onChange: ChangeEvent
}

export function Rotation({ value, onChange, showTitle, collapse }: RotationProps) {
  const transformStr = value?.transform as string | undefined
  const { angle: parsedAngle, flipX, flipY } = parseTransform(transformStr)

  const [localAngle, setLocalAngle] = useState(String(parsedAngle))
  const isEditingRef = useRef(false)

  useEffect(() => {
    if (!isEditingRef.current) {
      setLocalAngle(String(parsedAngle))
    }
  }, [parsedAngle])

  const commitTransform = useCallback((angle: number, fx: boolean, fy: boolean) => {
    onChange({ key: 'transform', value: composeTransform(angle, fx, fy) })
  }, [onChange])

  const handleFocus = useCallback(() => {
    isEditingRef.current = true
  }, [])

  const handleBlur = useCallback((e: React.FocusEvent<HTMLInputElement>) => {
    isEditingRef.current = false
    const raw = e.target.value.trim()
    const num = raw === '' ? 0 : parseFloat(raw)
    const finalAngle = isNaN(num) ? 0 : num
    setLocalAngle(String(finalAngle))
    commitTransform(finalAngle, flipX, flipY)
  }, [commitTransform, flipX, flipY])

  const handleChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value
    setLocalAngle(val)
    const num = parseFloat(val)
    if (!isNaN(num)) commitTransform(num, flipX, flipY)
  }, [commitTransform, flipX, flipY])

  const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
      e.preventDefault()
      const delta = e.key === 'ArrowUp' ? 1 : -1
      const next = (parseFloat(localAngle) || 0) + delta
      setLocalAngle(String(next))
      commitTransform(next, flipX, flipY)
    } else if (e.key === 'Enter') {
      ;(e.target as HTMLInputElement).blur()
    }
  }, [localAngle, commitTransform, flipX, flipY])

  const getDragAngle = useDragNumber({
    min: -Infinity,
    max: Infinity,
    continuous: true,
    onDragEnd: (finalValue) => {
      commitTransform(Math.round(finalValue), flipX, flipY)
    },
  })

  const handleRotate90R = useCallback(() => {
    const current = parseFloat(localAngle) || parsedAngle
    const next = (current + 90) % 360
    setLocalAngle(String(next))
    commitTransform(next, flipX, flipY)
  }, [localAngle, parsedAngle, flipX, flipY, commitTransform])

  const handleFlipH = useCallback(() => {
    commitTransform(parseFloat(localAngle) || parsedAngle, !flipX, flipY)
  }, [localAngle, parsedAngle, flipX, flipY, commitTransform])

  const handleFlipV = useCallback(() => {
    commitTransform(parseFloat(localAngle) || parsedAngle, flipX, !flipY)
  }, [localAngle, parsedAngle, flipX, flipY, commitTransform])

  const handleReset = useCallback(() => {
    onChange({ key: 'transform', value: null })
    setLocalAngle('0')
  }, [onChange])

  const hasValue = parsedAngle !== 0 || flipX || flipY
  const effectiveCollapse = hasValue ? false : collapse

  return (
    <Panel
      title="角度"
      showTitle={showTitle}
      showReset={true}
      resetFunction={handleReset}
      collapse={effectiveCollapse}
    >
      <Panel.Content>
        {/* Angle input with drag-on-icon */}
        <Panel.Item style={{ display: 'flex', alignItems: 'center', flex: 1, width: 'auto' }}>
          <div
            {...getDragAngle(localAngle, '拖拽调整旋转角度')}
            className={css.angleIconWrap}
          >
            <Ratation />
          </div>
          <input
            type="number"
            value={localAngle}
            placeholder="0"
            onChange={handleChange}
            onFocus={handleFocus}
            onBlur={handleBlur}
            onKeyDown={handleKeyDown}
            style={{
              flex: 1,
              minWidth: 0,
              height: '100%',
              border: 'none',
              background: 'transparent',
              fontSize: 12,
              fontWeight: 400,
              color: 'var(--mybricks-text-color-main, #888)',
              outline: 'none',
              cursor: 'text',
            }}
          />
          <span className={css.degUnit}>°</span>
        </Panel.Item>

        {/* Action buttons: rotate 90R / flip H / flip V */}
        <div
          className={css.actionBtn}
          onClick={handleRotate90R}
          data-mybricks-tip="顺时针旋转90°"
        >
          <Rotation90R />
        </div>
        <div
          className={`${css.actionBtn} ${flipX ? css.actionBtnActive : ''}`}
          onClick={handleFlipH}
          data-mybricks-tip="水平翻转"
        >
          <RotationFlipHorizontal />
        </div>
        <div
          className={`${css.actionBtn} ${flipY ? css.actionBtnActive : ''}`}
          onClick={handleFlipV}
          data-mybricks-tip="垂直翻转"
        >
          <RotationFlipVertical />
        </div>
      </Panel.Content>
    </Panel>
  )
}
