import React, { CSSProperties, useCallback, useEffect, useRef, useState } from 'react'

import { Panel, ClearButton, InputNumber } from '../../components'
import { useDragNumber } from '../../hooks/useDragNumber'
import { useLengthInputDrag } from '../../hooks/useLengthInputDrag'
import { useStyleEditorContext, useStyleChange } from '../../context'
import { Ratation } from '../../icons/Rotation'
import { Rotation90R } from '../../icons/Rotation90R'
import { RotationFlipHorizontal } from '../../icons/RotationFlipHorizontal'
import { RotationFlipVertical } from '../../icons/RotationFlipVertical'
import { TranslateX, TranslateY, TranslateZ, ScaleX, ScaleY } from '../../icons/TransformAxes'
import { readRotation, readFlips, readTransformAxis, readPerspective, setRotation, setTransformAxis, setPerspective, toggleFlip, clearTransform, readIndividualTransform, serializeIndividualTransform } from './transform-value'
import type { Axis, TransformAxisType, IndividualTransformKey } from './transform-value'

import type { ChangeEvent, PanelBaseProps } from '../../type'
import { highlightZeroOnFocus, highlightZeroOnMouseDown } from '../../utils'
import css from './index.less'
import lang from '../../../index.i18n'

interface TransformProps extends PanelBaseProps {
  value: CSSProperties
  onChange: ChangeEvent
}

function TransformAxisInput({ type, axis, field, onChange }: {
  type: TransformAxisType
  axis: Axis
  field: ReturnType<typeof readTransformAxis> & { readOnly?: boolean }
  onChange: (type: TransformAxisType, axis: Axis, value: string | null) => void
}) {
  const isScale = type === 'scale'
  const Icon = isScale
    ? axis === 'x' ? ScaleX : ScaleY
    : axis === 'z' ? TranslateZ : axis === 'x' ? TranslateX : TranslateY
  const numeric = field.readOnly || (!isScale && axis === 'z' && String(field.value).includes('%'))
    ? null : String(field.value ?? '').match(/^([-+]?(?:\d+\.?\d*|\.\d+)(?:e[-+]?\d+)?)([a-z%]*)$/i)
  const editable = !field.hasValue || !!numeric
  const unit = isScale ? '%' : numeric?.[2] || 'px'
  const displayValue = numeric
    ? isScale ? `${Number((Number(field.value) * 100).toFixed(6))}%` : `${numeric[1]}${unit}`
    : null
  const defaultValue = isScale ? '100%' : '0px'
  const tip = isScale
    ? axis === 'x' ? lang.transformScaleXTip : lang.transformScaleYTip
    : axis === 'z' ? lang.transformTranslateZTip : axis === 'x' ? lang.transformTranslateXTip : lang.transformTranslateYTip
  const handleChange = (next: string | null) => onChange(type, axis, next)
  const getDragProps = useLengthInputDrag(displayValue ?? defaultValue, handleChange, { min: -Infinity })

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
      allowNegative
      disabled={!editable}
      clearable={editable && field.hasValue}
      tip={tip}
      type='number'
      onClear={() => handleChange(null)}
      onChange={handleChange}
    />
  )
}

export function Transform({ value, onChange: fallbackOnChange, showTitle, collapse }: TransformProps) {
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
  const readIndividualValue = (key: IndividualTransformKey): string | null => {
    const source = context?.effectiveStyle?.[key]
    const winner = context?.getStyleProperty?.(key).winner
    const raw = context?.getStyleProperty
      ? (winner?.currentState ? winner.value : undefined)
      : context?.effectiveStyle
        ? (source?.type !== 'computed' ? source?.value : undefined)
        : context?.authoredStyle ? context.authoredStyle[key] : value?.[key]
    return raw == null ? null : String(raw) + (winner?.important ? ' !important' : '')
  }
  const individual = {
    translate: readIndividualValue('translate'),
    rotate: readIndividualValue('rotate'),
    scale: readIndividualValue('scale'),
  }
  // 按声明来源选择编辑对象；none/0 仍属于独立属性，不能退回去改 transform。
  const rotationTransform = individual.rotate != null ? readIndividualTransform('rotate', individual.rotate) : transformStr
  const scaleTransform = individual.scale != null ? readIndividualTransform('scale', individual.scale) : transformStr
  const translateTransform = individual.translate != null ? readIndividualTransform('translate', individual.translate) : transformStr
  const angleEditable = individual.rotate == null || rotationTransform !== null
  const scaleEditable = individual.scale == null || scaleTransform !== null
  const readAxis = (type: TransformAxisType, axis: Axis) => {
    const source = type === 'scale' ? scaleTransform : translateTransform
    return individual[type] != null && source === null
      ? { hasValue: true, value: individual[type], readOnly: true }
      : readTransformAxis(source, type, axis)
  }
  const targetDom = context?.targetDom
  const zoneSelector = (context?.editConfig.options as { zoneTab?: { selector: string } })?.zoneTab?.selector
  const { angle: parsedAngle, hasRotation } = readRotation(rotationTransform)
  const { flipX, flipY } = readFlips(scaleTransform)
  const translateX = readAxis('translate', 'x')
  const translateY = readAxis('translate', 'y')
  const translateZ = readAxis('translate', 'z')
  const scaleX = readAxis('scale', 'x')
  const scaleY = readAxis('scale', 'y')
  const perspective = readPerspective(transformStr)
  const perspectiveNumeric = perspective.value?.match(/^([-+]?(?:\d+\.?\d*|\.\d+)(?:e[-+]?\d+)?)([a-z]*)$/i)
  const perspectiveUnit = perspectiveNumeric?.[2] || 'px'
  const perspectiveEditable = individual.translate == null && (!perspective.hasValue || !!perspectiveNumeric)
  const showPerspective = translateZ.hasValue && parseFloat(String(translateZ.value)) !== 0
  const effectiveCollapse = hasRotation || !angleEditable || flipX || flipY || translateX.hasValue || translateY.hasValue || translateZ.hasValue || scaleX.hasValue || scaleY.hasValue || perspective.hasValue || clearTransform(transformStr) !== transformStr ? collapse : true
  const angleDisplay = parsedAngle == null ? '' : String(parsedAngle)
  const anglePlaceholder = angleEditable ? (hasRotation ? undefined : '0') : individual.rotate || undefined
  const [angleDraft, setAngleDraft] = useState<string | null>(null)
  const localAngle = angleDraft ?? angleDisplay
  const isEditingRef = useRef(false)
  const inputChangedRef = useRef(false)
  const dragRef = useRef<{
    start: number; input: HTMLInputElement | null; initialText: string; changed: boolean
  } | null>(null)
  // 连续拖拽、快捷按钮都从最近一次写入继续，避免父组件回传前丢掉其他变换。
  const liveTransformRef = useRef(transformStr)
  const liveIndividualRef = useRef(individual)
  const sourceRef = useRef({ transformStr, targetDom, zoneSelector, ...individual })
  if (sourceRef.current.transformStr !== transformStr || sourceRef.current.targetDom !== targetDom ||
    sourceRef.current.zoneSelector !== zoneSelector || sourceRef.current.translate !== individual.translate ||
    sourceRef.current.rotate !== individual.rotate || sourceRef.current.scale !== individual.scale) {
    liveTransformRef.current = transformStr
    liveIndividualRef.current = individual
    sourceRef.current = { transformStr, targetDom, zoneSelector, ...individual }
  }

  useEffect(() => {
    if (!isEditingRef.current && !dragRef.current) setAngleDraft(null)
  }, [transformStr, individual.rotate])

  useEffect(() => {
    isEditingRef.current = false
    inputChangedRef.current = false
    dragRef.current = null
    setAngleDraft(null)
  }, [targetDom, zoneSelector])

  const commitTransform = useCallback((next: string | null, key: IndividualTransformKey | 'transform' = 'transform') => {
    const current = key === 'transform' ? liveTransformRef.current : liveIndividualRef.current[key]
    if (next === current) return true
    const result = onChange({ key, value: next })
    if (result && !result.applied) return false
    if (key === 'transform') liveTransformRef.current = next
    // 源码回传前用 none 表示已清空，继续保留本次编辑来源，避免带回旧的另一轴。
    else liveIndividualRef.current[key] = next ?? `none${current?.match(/\s*!important\s*$/i)?.[0] || ''}`
    return true
  }, [onChange])

  const editTransform = useCallback((key: IndividualTransformKey, edit: (value: string | null) => string | null) => {
    const raw = liveIndividualRef.current[key]
    if (raw == null) return commitTransform(edit(liveTransformRef.current))
    const parsed = readIndividualTransform(key, raw)
    if (parsed === null) return false
    return commitTransform(serializeIndividualTransform(key, edit(parsed)), key)
  }, [commitTransform])

  const commitAngle = useCallback((angle: number | null) =>
    editTransform('rotate', current => setRotation(current, angle)), [editTransform])

  const handleAxisChange = useCallback((type: TransformAxisType, axis: Axis, next: string | null) => {
    if (type === 'translate' && axis === 'z' && next?.includes('%')) return
    const value = next != null && type === 'scale' ? String(parseFloat(next) / 100) : next
    editTransform(type, current => {
      const updated = setTransformAxis(current, type, axis, value)
      if (type === 'translate' && axis === 'z' && liveIndividualRef.current.translate == null) {
        // Z 位移和透视一次提交；归零/默认一起退出，连续修改保留用户设置的透视距离。
        return setPerspective(updated, value == null || parseFloat(value) === 0
          ? null : readPerspective(current).value ?? '500px')
      }
      return updated
    })
  }, [editTransform])

  const handlePerspectiveChange = useCallback((next: string | null) => {
    if (next != null && (!perspectiveEditable || !Number.isFinite(parseFloat(next)) || parseFloat(next) <= 0 || next.includes('%'))) return
    commitTransform(setPerspective(liveTransformRef.current, next))
  }, [commitTransform, perspectiveEditable])

  const handleFocus = useCallback((event: React.FocusEvent<HTMLInputElement>) => {
    isEditingRef.current = true
    highlightZeroOnFocus(event)
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
    const raw = liveIndividualRef.current.rotate
    const current = readRotation(raw != null ? readIndividualTransform('rotate', raw) : liveTransformRef.current).angle ?? 0
    const next = (current + 90) % 360
    inputChangedRef.current = false
    setAngleDraft(commitAngle(next) ? String(next) : null)
  }, [commitAngle])

  const handleFlipH = useCallback(() => {
    editTransform('scale', current => toggleFlip(current, 'x'))
  }, [editTransform])

  const handleFlipV = useCallback(() => {
    editTransform('scale', current => toggleFlip(current, 'y'))
  }, [editTransform])

  const handleReset = useCallback(() => {
    inputChangedRef.current = false
    isEditingRef.current = false
    // 独立声明与 transform 一起提交；未支持的表达式及旋转形式保留。
    const changes: Array<{ key: IndividualTransformKey | 'transform'; value: string | null }> = []
    ;(['translate', 'rotate', 'scale'] as const).forEach(key => {
      const raw = liveIndividualRef.current[key]
      const parsed = raw != null ? readIndividualTransform(key, raw) : null
      if (parsed !== null && clearTransform(parsed) === null) changes.push({ key, value: null })
    })
    if (changes.length) {
      const next = clearTransform(liveTransformRef.current)
      if (next !== liveTransformRef.current) changes.push({ key: 'transform', value: next })
      const result = onChange(changes)
      if (result && !result.applied) { setAngleDraft(null); return }
      changes.forEach(({ key, value }) => {
        if (key === 'transform') liveTransformRef.current = value
        else liveIndividualRef.current[key] = `none${liveIndividualRef.current[key]?.match(/\s*!important\s*$/i)?.[0] || ''}`
      })
      setAngleDraft('')
      return
    }
    setAngleDraft(commitTransform(clearTransform(liveTransformRef.current)) ? '' : null)
  }, [commitTransform, onChange])

  const handleClear = useCallback(() => {
    inputChangedRef.current = false
    isEditingRef.current = false
    setAngleDraft(commitAngle(null) ? '' : null)
  }, [commitAngle])

  return (
    <Panel
      title={lang.transformPanelTitle}
      showTitle={showTitle}
      showReset={true}
      resetFunction={handleReset}
      collapse={effectiveCollapse}
    >
      <Panel.Content className={`${css.transformPanelContent} ${css.threeAxes}`}>
        <TransformAxisInput type='translate' axis='x' field={translateX} onChange={handleAxisChange} />
        <TransformAxisInput type='translate' axis='y' field={translateY} onChange={handleAxisChange} />
        <TransformAxisInput type='translate' axis='z' field={translateZ} onChange={handleAxisChange} />
      </Panel.Content>
      {showPerspective && <Panel.Content className={`${css.transformPanelContent} ${css.perspectiveControls}`}>
        <span className={css.axisLabel}>{lang.transformPerspectiveLabel}</span>
        <InputNumber
          style={{ minWidth: 0 }}
          value={perspectiveNumeric ? `${perspectiveNumeric[1]}${perspectiveUnit}` : null}
          previewValue={perspective.hasValue && !perspectiveNumeric ? perspective.value || '—' : undefined}
          placeholder={lang.notConfiguredPlaceholder}
          defaultUnitValue={perspectiveUnit}
          unitOptions={[{ label: perspectiveUnit, value: perspectiveUnit }]}
          suffix={<span className={css.axisLabel}>{perspectiveUnit}</span>}
          showIconOnHover
          disabled={!perspectiveEditable}
          clearable={perspective.hasValue}
          tip={individual.translate != null ? lang.transformPerspectiveIndividualTip : lang.transformPerspectiveTip}
          type='number'
          onClear={() => handlePerspectiveChange(null)}
          onChange={handlePerspectiveChange}
        />
      </Panel.Content>}
      <Panel.Content className={css.transformPanelContent}>
        <TransformAxisInput type='scale' axis='x' field={scaleX} onChange={handleAxisChange} />
        <TransformAxisInput type='scale' axis='y' field={scaleY} onChange={handleAxisChange} />
      </Panel.Content>
      <Panel.Content className={css.transformPanelContent}>
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
            {...(angleEditable ? getDragAngle(localAngle, lang.dragRotation) : {})}
            className={css.angleIconWrap}
          >
            <Ratation />
          </div>
          <input
            type="number"
            value={localAngle}
            disabled={!angleEditable}
            placeholder={anglePlaceholder}
            data-mybricks-tip={lang.rotationAngleTip}
            onChange={handleChange}
            onFocus={handleFocus}
            onMouseDown={highlightZeroOnMouseDown}
            className={css.angleInput}
            onBlur={handleBlur}
            onKeyDown={handleKeyDown}
            style={{
              flex: 1,
              minWidth: 0,
              height: '100%',
              border: 'none',
              background: 'transparent',
              fontSize: 11,
              outline: 'none',
              cursor: 'text',
            }}
          />
          {angleEditable && (hasRotation || localAngle !== '') && <ClearButton onClick={handleClear} />}
          {(localAngle !== '' || anglePlaceholder === '0') && <span className={css.degUnit}>°</span>}
        </Panel.Item>

        {/* Action buttons: rotate 90R / flip H / flip V */}
        <div className={css.actionButtons}>
          <div
            className={css.actionBtn}
            onClick={angleEditable ? handleRotate90R : undefined}
            aria-disabled={!angleEditable}
            style={angleEditable ? undefined : { opacity: 0.35, cursor: 'default' }}
            data-mybricks-tip={lang.rotateCW90Tip}
          >
            <Rotation90R />
          </div>
          <div
            className={`${css.actionBtn} ${flipX ? css.actionBtnActive : ''}`}
            onClick={scaleEditable ? handleFlipH : undefined}
            aria-disabled={!scaleEditable}
            style={scaleEditable ? undefined : { opacity: 0.35, cursor: 'default' }}
            data-mybricks-tip={lang.flipHorizontalTip}
          >
            <RotationFlipHorizontal />
          </div>
          <div
            className={`${css.actionBtn} ${flipY ? css.actionBtnActive : ''}`}
            onClick={scaleEditable ? handleFlipV : undefined}
            aria-disabled={!scaleEditable}
            style={scaleEditable ? undefined : { opacity: 0.35, cursor: 'default' }}
            data-mybricks-tip={lang.flipVerticalTip}
          >
            <RotationFlipVertical />
          </div>
        </div>
      </Panel.Content>
    </Panel>
  )
}
