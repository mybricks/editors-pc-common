import React, { CSSProperties, useCallback, useEffect, useRef, useState } from 'react'

import { Panel, ClearButton } from '../../components'
import { useDragNumber } from '../../hooks/useDragNumber'
import { useStyleEditorContext, useStyleChange } from '../../context'
import { Ratation } from '../../icons/Rotation'
import { Rotation90R } from '../../icons/Rotation90R'
import { RotationFlipHorizontal } from '../../icons/RotationFlipHorizontal'
import { RotationFlipVertical } from '../../icons/RotationFlipVertical'
import { readRotation, readFlips, setRotation, toggleFlip, clearRotationAndFlips } from './transform-value'

import type { ChangeEvent, PanelBaseProps } from '../../type'
import css from './index.less'

interface RotationProps extends PanelBaseProps {
  value: CSSProperties
  onChange: ChangeEvent
}

export function Rotation({ value, onChange: fallbackOnChange, showTitle, collapse }: RotationProps) {
  const context = useStyleEditorContext()
  const onChange = useStyleChange(fallbackOnChange)
  const source = context?.effectiveStyle?.transform
  const property = context?.getStyleProperty?.('transform')
  const declaredTransform = context?.getStyleProperty
    ? (property?.winner?.currentState ? property.winner.value : undefined)
    : context?.effectiveStyle
      ? (source?.type !== 'computed' ? source?.value : undefined)
      : context?.authoredStyle ? context.authoredStyle.transform : value?.transform
  const transformStr = typeof declaredTransform === 'string' && !/^unset$/i.test(declaredTransform.trim())
    ? declaredTransform : null
  const targetDom = context?.targetDom
  const zoneSelector = (context?.editConfig.options as { zoneTab?: { selector: string } })?.zoneTab?.selector
  const { angle: parsedAngle, hasRotation } = readRotation(transformStr)
  const { flipX, flipY } = readFlips(transformStr)
  const angleDisplay = parsedAngle == null ? '' : String(parsedAngle)
  const [angleDraft, setAngleDraft] = useState<string | null>(null)
  const localAngle = angleDraft ?? angleDisplay
  const isEditingRef = useRef(false)
  const inputChangedRef = useRef(false)
  const dragRef = useRef<{
    start: number; input: HTMLInputElement | null; initialText: string; changed: boolean
  } | null>(null)
  // 连续拖拽、快捷按钮都从最近一次写入继续，避免父组件回传前丢掉其他变换。
  const liveTransformRef = useRef(transformStr)
  const sourceRef = useRef({ transformStr, targetDom, zoneSelector })
  if (sourceRef.current.transformStr !== transformStr || sourceRef.current.targetDom !== targetDom ||
    sourceRef.current.zoneSelector !== zoneSelector) {
    liveTransformRef.current = transformStr
    sourceRef.current = { transformStr, targetDom, zoneSelector }
  }

  useEffect(() => {
    if (!isEditingRef.current && !dragRef.current) setAngleDraft(null)
  }, [transformStr])

  useEffect(() => {
    isEditingRef.current = false
    inputChangedRef.current = false
    dragRef.current = null
    setAngleDraft(null)
  }, [targetDom, zoneSelector])

  const commitTransform = useCallback((next: string | null) => {
    if (next === liveTransformRef.current) return true
    const result = onChange({ key: 'transform', value: next })
    if (result && !result.applied) return false
    liveTransformRef.current = next
    return true
  }, [onChange])

  const commitAngle = useCallback((angle: number | null) =>
    commitTransform(setRotation(liveTransformRef.current, angle)), [commitTransform])

  const handleFocus = useCallback(() => {
    isEditingRef.current = true
  }, [])

  const handleBlur = useCallback((e: React.FocusEvent<HTMLInputElement>) => {
    isEditingRef.current = false
    if (!inputChangedRef.current) {
      setAngleDraft(null)
      return
    }
    inputChangedRef.current = false
    const raw = e.currentTarget.value.trim()
    if (e.currentTarget.validity?.badInput || (raw && !Number.isFinite(Number(raw)))) {
      setAngleDraft(null)
      return
    }
    const angle = raw ? Number(raw) : null
    setAngleDraft(commitAngle(angle) ? (angle == null ? '' : String(angle)) : null)
  }, [commitAngle])

  const handleChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.currentTarget.value
    inputChangedRef.current = true
    setAngleDraft(val)
    if (val.trim() && Number.isFinite(Number(val))) commitAngle(Number(val))
  }, [commitAngle])

  const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
      e.preventDefault()
      const delta = e.key === 'ArrowUp' ? 1 : -1
      const current = parseFloat(e.currentTarget.value)
      const next = (Number.isFinite(current) ? current : 0) + delta
      inputChangedRef.current = false
      setAngleDraft(commitAngle(next) ? String(next) : null)
    } else if (e.key === 'Enter') {
      e.currentTarget.blur()
    }
  }, [commitAngle])

  const getDragAngle = useDragNumber({
    min: -Infinity,
    max: Infinity,
    onDragStart: (_current, input) => {
      const draft = parseFloat(input?.value ?? '')
      const start = hasRotation ? (Number.isFinite(draft) ? draft : parsedAngle ?? 0) : 0
      dragRef.current = { start, input, initialText: input?.value ?? '', changed: false }
      return start
    },
    onDragChange: angle => {
      const drag = dragRef.current
      if (!drag || (!drag.changed && angle === drag.start)) return
      drag.changed = true
      inputChangedRef.current = false
      setAngleDraft(commitAngle(angle) ? String(angle) : null)
    },
    onDragEnd: angle => {
      const drag = dragRef.current
      dragRef.current = null
      if (!drag) return
      if (!drag.changed && (angle === drag.start || (drag.input && drag.input.value === drag.initialText))) {
        if (drag.input) drag.input.value = drag.initialText
        return
      }
      inputChangedRef.current = false
      setAngleDraft(commitAngle(angle) ? String(angle) : null)
    },
  })

  const handleRotate90R = useCallback(() => {
    const current = readRotation(liveTransformRef.current).angle ?? 0
    const next = (current + 90) % 360
    inputChangedRef.current = false
    setAngleDraft(commitAngle(next) ? String(next) : null)
  }, [commitAngle])

  const handleFlipH = useCallback(() => {
    commitTransform(toggleFlip(liveTransformRef.current, 'x'))
  }, [commitTransform])

  const handleFlipV = useCallback(() => {
    commitTransform(toggleFlip(liveTransformRef.current, 'y'))
  }, [commitTransform])

  const handleReset = useCallback(() => {
    inputChangedRef.current = false
    isEditingRef.current = false
    setAngleDraft(commitTransform(clearRotationAndFlips(liveTransformRef.current)) ? '' : null)
  }, [commitTransform])

  const handleClear = useCallback(() => {
    inputChangedRef.current = false
    isEditingRef.current = false
    setAngleDraft(commitAngle(null) ? '' : null)
  }, [commitAngle])

  // 新增零度旋转，沿用角度写入入口以保留其他 transform 函数。
  const handleExpand = useCallback(() => {
    inputChangedRef.current = false
    isEditingRef.current = false
    setAngleDraft(commitAngle(0) ? '0' : null)
  }, [commitAngle])

  return (
    <Panel
      title="旋转"
      showTitle={showTitle}
      showReset={true}
      resetFunction={handleReset}
      onExpand={handleExpand}
      collapse={collapse}
    >
      <Panel.Content className={css.rotationPanelContent}>
        {/* Angle input with drag-on-icon */}
        <Panel.Item
          style={{
            display: 'flex',
            alignItems: 'center',
            flex: '1 1 0',
            width: 'auto',
            minWidth: 0,
          }}
        >
          <div
            {...getDragAngle(localAngle, '拖拽调整旋转角度')}
            className={css.angleIconWrap}
          >
            <Ratation />
          </div>
          <input
            type="number"
            value={localAngle}
            data-mybricks-tip="旋转角度"
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
              fontSize: 11,
              fontWeight: 400,
              color: 'var(--mybricks-text-color-main, #888)',
              outline: 'none',
              cursor: 'text',
            }}
          />
          {(hasRotation || localAngle !== '') && <ClearButton onClick={handleClear} />}
          {localAngle !== '' && <span className={css.degUnit}>°</span>}
        </Panel.Item>

        {/* Action buttons: rotate 90R / flip H / flip V */}
        <div className={css.actionButtons}>
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
        </div>
      </Panel.Content>
    </Panel>
  )
}
