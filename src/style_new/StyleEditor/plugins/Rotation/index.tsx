import React, { CSSProperties, useCallback, useEffect, useRef, useState } from 'react'

import { Panel, ClearButton, InputNumber } from '../../components'
import { useDragNumber } from '../../hooks/useDragNumber'
import { useLengthInputDrag } from '../../hooks/useLengthInputDrag'
import { useStyleEditorContext, useStyleChange } from '../../context'
import { Ratation } from '../../icons/Rotation'
import { Rotation90R } from '../../icons/Rotation90R'
import { RotationFlipHorizontal } from '../../icons/RotationFlipHorizontal'
import { RotationFlipVertical } from '../../icons/RotationFlipVertical'
import { TranslateX, TranslateY, ScaleX, ScaleY } from '../../icons/TransformAxes'
import { readRotation, readFlips, readTransformAxis, setRotation, setTransformAxis, toggleFlip, clearTransform } from './transform-value'
import type { TransformAxisType } from './transform-value'

import type { ChangeEvent, PanelBaseProps } from '../../type'
import css from './index.less'
import lang from '../../../index.i18n'

interface RotationProps extends PanelBaseProps {
  value: CSSProperties
  onChange: ChangeEvent
}

function TransformAxisInput({ type, axis, field, onChange }: {
  type: TransformAxisType
  axis: 'x' | 'y'
  field: ReturnType<typeof readTransformAxis>
  onChange: (type: TransformAxisType, axis: 'x' | 'y', value: string | null) => void
}) {
  const isScale = type === 'scale'
  const Icon = isScale ? axis === 'x' ? ScaleX : ScaleY : axis === 'x' ? TranslateX : TranslateY
  const numeric = String(field.value ?? '').match(/^([-+]?(?:\d+\.?\d*|\.\d+)(?:e[-+]?\d+)?)([a-z%]*)$/i)
  const editable = !field.hasValue || !!numeric
  const unit = isScale ? '%' : numeric?.[2] || 'px'
  const displayValue = numeric
    ? isScale ? `${Number((Math.abs(Number(field.value)) * 100).toFixed(6))}%` : `${numeric[1]}${unit}`
    : null
  const defaultValue = isScale ? '100%' : '0px'
  const tip = isScale
    ? axis === 'x' ? lang.transformScaleXTip : lang.transformScaleYTip
    : axis === 'x' ? lang.transformTranslateXTip : lang.transformTranslateYTip
  const handleChange = (next: string | null) => onChange(type, axis, next)
  const getDragProps = useLengthInputDrag(displayValue ?? defaultValue, handleChange, { min: isScale ? 0 : -Infinity })

  return (
    <InputNumber
      className={css.transformInput}
      style={{ flex: 1, minWidth: 0, paddingLeft: 0, paddingRight: 6 }}
      prefix={<span className={`${css.axisIcon}${isScale ? ` ${css.scaleIcon}` : ''}`} {...(editable ? getDragProps(displayValue ?? defaultValue, tip) : {})}><Icon /></span>}
      value={displayValue}
      previewValue={editable ? defaultValue : String(field.value ?? '—')}
      defaultUnitValue={unit}
      unitOptions={[{ label: unit, value: unit }]}
      suffix={unit !== 'px' ? <span className={css.axisLabel}>{unit}</span> : undefined}
      showIconOnHover
      allowNegative={!isScale}
      disabled={!editable}
      clearable={editable && field.hasValue}
      tip={tip}
      type='number'
      onClear={() => handleChange(null)}
      onChange={handleChange}
    />
  )
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
  const translateX = readTransformAxis(transformStr, 'translate', 'x')
  const translateY = readTransformAxis(transformStr, 'translate', 'y')
  const scaleX = readTransformAxis(transformStr, 'scale', 'x')
  const scaleY = readTransformAxis(transformStr, 'scale', 'y')
  const effectiveCollapse = hasRotation || flipX || flipY || translateX.hasValue || translateY.hasValue || scaleX.hasValue || scaleY.hasValue ? collapse : true
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

  const handleAxisChange = useCallback((type: TransformAxisType, axis: 'x' | 'y', next: string | null) => {
    const value = next != null && type === 'scale' ? String(parseFloat(next) / 100) : next
    commitTransform(setTransformAxis(liveTransformRef.current, type, axis, value))
  }, [commitTransform])

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
    setAngleDraft(commitTransform(clearTransform(liveTransformRef.current)) ? '' : null)
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
      title={lang.rotationPanelTitle}
      showTitle={showTitle}
      showReset={true}
      resetFunction={handleReset}
      onExpand={handleExpand}
      collapse={effectiveCollapse}
    >
      <Panel.Content className={css.rotationPanelContent}>
        <TransformAxisInput type='translate' axis='x' field={translateX} onChange={handleAxisChange} />
        <TransformAxisInput type='translate' axis='y' field={translateY} onChange={handleAxisChange} />
      </Panel.Content>
      <Panel.Content className={css.rotationPanelContent}>
        <TransformAxisInput type='scale' axis='x' field={scaleX} onChange={handleAxisChange} />
        <TransformAxisInput type='scale' axis='y' field={scaleY} onChange={handleAxisChange} />
      </Panel.Content>
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
            {...getDragAngle(localAngle, lang.dragRotation)}
            className={css.angleIconWrap}
          >
            <Ratation />
          </div>
          <input
            type="number"
            value={localAngle}
            data-mybricks-tip={lang.rotationAngleTip}
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
            data-mybricks-tip={lang.rotateCW90Tip}
          >
            <Rotation90R />
          </div>
          <div
            className={`${css.actionBtn} ${flipX ? css.actionBtnActive : ''}`}
            onClick={handleFlipH}
            data-mybricks-tip={lang.flipHorizontalTip}
          >
            <RotationFlipHorizontal />
          </div>
          <div
            className={`${css.actionBtn} ${flipY ? css.actionBtnActive : ''}`}
            onClick={handleFlipV}
            data-mybricks-tip={lang.flipVerticalTip}
          >
            <RotationFlipVertical />
          </div>
        </div>
      </Panel.Content>
    </Panel>
  )
}
