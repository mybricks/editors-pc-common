import React, { CSSProperties, useCallback, useMemo, useRef, useState } from 'react'

import {
  Panel, VariableNumberInput,
  withApplyVariableOption, buildDetachMenuOptions,
  APPLY_VARIABLE_ACTION,
} from '../../components'
import { useLengthInputDrag } from '../../hooks/useLengthInputDrag'
import { useLengthVarBinding } from '../../hooks/useLengthVarBinding'
import { useStyleEditorContext, useStyleChange } from '../../context'
import { Ratation } from '../../icons/Rotation'
import { Rotation90R } from '../../icons/Rotation90R'
import { RotationFlipHorizontal } from '../../icons/RotationFlipHorizontal'
import { RotationFlipVertical } from '../../icons/RotationFlipVertical'
import { TranslateX, TranslateY, ScaleX, ScaleY, SkewX, SkewY } from '../../icons/TransformAxes'
import { readRotation, readFlips, readTransformAxis, readTransformMatrix, setRotation, setTransformAxis, toggleFlip, clearTransform, readIndividualTransform, serializeIndividualTransform, readSkewAxis, setSkewAxis, isSimpleVarComponent, isScaleValue, getCssVarAngleOptions, getCssVarScaleOptions, resolveAngleVar, resolveScaleVar, matrixToFunctions } from './transform-value'
import type { TransformAxisType, IndividualTransformKey } from './transform-value'
import type { LengthVarBinding } from '../../hooks/useLengthVarBinding'

import type { ChangeEvent, PanelBaseProps } from '../../type'
import css from './index.less'
import lang from '../../../index.i18n'

interface TransformProps extends PanelBaseProps {
  value: CSSProperties
  onChange: ChangeEvent
}

/** 胶囊里数值与单位分开显示，与输入框的「100 %」「15 °」写法一致；解析不到时交回默认文案。 */
function chipNumber(resolved?: string | null): string | undefined {
  const value = parseFloat(resolved ?? '')
  return Number.isFinite(value) ? String(Number(value.toFixed(2))) : undefined
}

/** 位移/缩放的单个轴：字面量走数值输入，单个 var() 换成变量胶囊。 */
function TransformAxisInput({ type, axis, field, previewValue, binding, onChange }: {
  type: TransformAxisType
  axis: 'x' | 'y'
  field: ReturnType<typeof readTransformAxis> & { readOnly?: boolean }
  previewValue?: string
  binding: LengthVarBinding
  onChange: (type: TransformAxisType, axis: 'x' | 'y', value: string | null) => void
}) {
  const isScale = type === 'scale'
  const Icon = isScale ? axis === 'x' ? ScaleX : ScaleY : axis === 'x' ? TranslateX : TranslateY
  // 变量分量是字符串，不参与数值解析；表达式（calc 等）仍走只读回显。
  const varComponent = typeof field.value === 'string' && isSimpleVarComponent(field.value) ? field.value : null
  const numeric = field.readOnly || varComponent ? null : String(field.value ?? '').match(/^([-+]?(?:\d+\.?\d*|\.\d+)(?:e[-+]?\d+)?)([a-z%]*)$/i)
  const editable = !field.hasValue || !!numeric
  const unit = isScale ? '%' : numeric?.[2] || 'px'
  const displayValue = numeric
    ? isScale ? `${Number((Number(field.value) * 100).toFixed(6))}%` : `${numeric[1]}${unit}`
    : null
  const defaultValue = isScale ? '100%' : '0px'
  const tip = isScale
    ? axis === 'x' ? lang.transformScaleXTip : lang.transformScaleYTip
    : axis === 'x' ? lang.transformTranslateXTip : lang.transformTranslateYTip
  const handleChange = (next: string | null) => onChange(type, axis, next)
  const dragValue = displayValue ?? previewValue ?? defaultValue
  const getDragProps = useLengthInputDrag(dragValue, handleChange, { min: -Infinity })
  const bound = !!binding.varRef
  // 轴图标同时是拖拽手柄和变量弹层锚点，绑定态与未绑定态共用同一个节点。
  const handle = (
    <div
      className={`${css.axisIcon}${isScale ? ` ${css.scaleIcon}` : ''}`}
      ref={binding.anchorRef}
      {...(bound
        ? binding.dragProps(`${tip}${lang.dragUnbindSuffix}`)
        : editable ? getDragProps(dragValue, tip) : {})}
    >
      <Icon />
    </div>
  )

  return (
    <VariableNumberInput
      binding={isScale ? { ...binding, displayText: chipNumber(binding.resolvedValue) ?? binding.displayText } : binding}
      chipUnitLabel={isScale ? '%' : undefined}
      inputKey={`${type}-${axis}`}
      chipPrefix={handle}
      // 有单位时与未绑定输入框的 paddingRight: 6 对齐，单位落在同一位置；位移只有箭头，保持原样。
      chipStyle={{ flex: '1 1 0', minWidth: 0, marginLeft: 0, ...(isScale ? { paddingRight: 6 } : {}) }}
      compact
      menuOptions={[
        { label: lang.defaultLabel, value: 'default' },
        ...buildDetachMenuOptions(binding.fallbackValue),
      ]}
      emptyText={lang.noSizeVariables}
      inputProps={{
        className: css.transformInput,
        style: { flex: 1, minWidth: 0, paddingLeft: 0, paddingRight: 6 },
        prefix: handle,
        value: displayValue,
        previewValue: previewValue ?? (editable ? defaultValue : String(field.value ?? '—')),
        defaultUnitValue: unit,
        unitOptions: withApplyVariableOption([{ label: unit, value: unit }], binding.hasVariables),
        // 不传 suffix：自定义 suffix 会绕过 unitOptions，连带丢掉「应用变量...」入口，
        // 单位文案交给单位下拉自己渲染（与行高、间距面板一致）。
        showIcon: true,
        showIconOnHover: true,
        allowNegative: true,
        disabled: !editable,
        clearable: editable && field.hasValue,
        tip,
        type: 'number',
        onClear: () => handleChange(null),
        onChange: handleChange,
        onAction: action => { if (action === APPLY_VARIABLE_ACTION) binding.openPicker() },
      }}
    />
  )
}

/** 倾斜没有独立属性，也没有 3D 版本，写入固定落在 transform 上；单位固定度。 */
function SkewAxisInput({ axis, field, previewValue, binding, onChange }: {
  axis: 'x' | 'y'
  field: ReturnType<typeof readSkewAxis>
  previewValue?: number
  binding: LengthVarBinding
  onChange: (axis: 'x' | 'y', value: number | string | null) => void
}) {
  const Icon = axis === 'x' ? SkewX : SkewY
  const tip = axis === 'x' ? lang.transformSkewXTip : lang.transformSkewYTip
  const raw = typeof field.value === 'string' && isSimpleVarComponent(field.value) ? field.value : null
  const displayValue = field.value == null || raw ? null : `${field.value}°`
  const handleChange = (next: string | null) => {
    if (next == null) return onChange(axis, null)
    // 变量原样写入；只有字面量才换算成度数。
    if (isSimpleVarComponent(next)) return onChange(axis, next)
    const parsed = parseFloat(next)
    onChange(axis, Number.isFinite(parsed) ? parsed : null)
  }
  const dragValue = displayValue ?? `${previewValue ?? 0}°`
  const getDragProps = useLengthInputDrag(dragValue, handleChange, { min: -Infinity })
  const bound = !!binding.varRef
  const handle = (
    <div
      className={css.axisIcon}
      ref={binding.anchorRef}
      {...(bound ? binding.dragProps(`${tip}${lang.dragUnbindSuffix}`) : getDragProps(dragValue, tip))}
    >
      <Icon />
    </div>
  )

  return (
    <VariableNumberInput
      binding={{ ...binding, displayText: chipNumber(binding.resolvedValue) ?? binding.displayText }}
      chipUnitLabel='°'
      inputKey={`skew-${axis}`}
      chipPrefix={handle}
      chipStyle={{ flex: '1 1 0', minWidth: 0, marginLeft: 0, paddingRight: 6 }}
      compact
      menuOptions={[
        { label: lang.defaultLabel, value: 'default' },
        ...buildDetachMenuOptions(binding.fallbackValue),
      ]}
      emptyText={lang.noAngleVariables}
      inputProps={{
        className: css.transformInput,
        style: { flex: 1, minWidth: 0, paddingLeft: 0, paddingRight: 6 },
        prefix: handle,
        value: displayValue,
        previewValue: previewValue ?? '0',
        defaultUnitValue: '°',
        unitOptions: withApplyVariableOption([{ label: '°', value: '°' }], binding.hasVariables),
        showIcon: true,
        showIconOnHover: true,
        allowNegative: true,
        clearable: field.hasValue,
        tip,
        type: 'number',
        onClear: () => handleChange(null),
        onChange: handleChange,
        onAction: action => { if (action === APPLY_VARIABLE_ACTION) binding.openPicker() },
      }}
    />
  )
}

/**
 * 旋转行：与倾斜/缩放共用 VariableNumberInput，单位下拉、胶囊、变量弹层都由它提供，
 * 箭头大小与 hover 行为因此和上面几行完全一致。
 */
function RotationInput({ field, previewValue, editable, binding, onChange }: {
  field: ReturnType<typeof readRotation>
  /** 无旋转时的回显：继承角度，或不可编辑时的原始声明 */
  previewValue?: string
  editable: boolean
  binding: LengthVarBinding
  onChange: (next: number | string | null) => void
}) {
  const tip = lang.dragRotation
  // 变量引用交给胶囊，输入框只显示字面量
  const displayValue = !field.raw && field.angle != null ? `${field.angle}°` : null
  const handleChange = (next: string | null) => {
    if (next == null) return onChange(null)
    // 变量原样写入；只有字面量才换算成度数。
    if (isSimpleVarComponent(next)) return onChange(next)
    const parsed = parseFloat(next)
    onChange(Number.isFinite(parsed) ? parsed : null)
  }
  const dragValue = displayValue ?? `${previewValue ?? 0}°`
  const getDragProps = useLengthInputDrag(dragValue, handleChange, { min: -Infinity })
  const bound = !!binding.varRef
  // 旋转图标同时是拖拽手柄和变量弹层锚点，与倾斜行一致
  const handle = (
    <div
      className={`${css.axisIcon} ${css.angleIconWrap}`}
      ref={binding.anchorRef}
      {...(bound ? binding.dragProps(`${tip}${lang.dragUnbindSuffix}`) : editable ? getDragProps(dragValue, tip) : {})}
    >
      <Ratation />
    </div>
  )

  return (
    <VariableNumberInput
      binding={{ ...binding, displayText: chipNumber(binding.resolvedValue) ?? binding.displayText }}
      chipUnitLabel='°'
      inputKey='rotate'
      chipPrefix={handle}
      chipStyle={{ flex: '1 1 0', minWidth: 0, marginLeft: 0, paddingRight: 6 }}
      compact
      menuOptions={[
        { label: lang.defaultLabel, value: 'default' },
        ...buildDetachMenuOptions(binding.fallbackValue),
      ]}
      emptyText={lang.noAngleVariables}
      inputProps={{
        className: css.transformInput,
        style: { flex: '1 1 0', minWidth: 0, paddingLeft: 0, paddingRight: 6 },
        prefix: handle,
        value: displayValue,
        previewValue,
        defaultUnitValue: '°',
        unitOptions: withApplyVariableOption([{ label: '°', value: '°' }], binding.hasVariables),
        showIcon: true,
        showIconOnHover: true,
        allowNegative: true,
        // 清除沿用 InputNumber 内置的「默认」项（clearable 默认 true）；
        // 行内不出现 ×，省出输入宽度。
        disabled: !editable,
        tip: lang.rotationAngleTip,
        type: 'number',
        onChange: handleChange,
        onAction: action => { if (action === APPLY_VARIABLE_ACTION) binding.openPicker() },
      }}
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
  // 手写 matrix() 展开成等价函数链，读和编辑都落在函数上；首次编辑即把矩阵写回成链。
  const editableTransform = matrixToFunctions(transformStr) ?? transformStr
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
  const rotationTransform = individual.rotate != null ? readIndividualTransform('rotate', individual.rotate) : editableTransform
  const scaleTransform = individual.scale != null ? readIndividualTransform('scale', individual.scale) : editableTransform
  const translateTransform = individual.translate != null ? readIndividualTransform('translate', individual.translate) : editableTransform
  const angleEditable = individual.rotate == null || rotationTransform !== null
  const scaleEditable = individual.scale == null || scaleTransform !== null
  const readAxis = (type: TransformAxisType, axis: 'x' | 'y'): ReturnType<typeof readTransformAxis> & { readOnly?: boolean } => {
    const source = type === 'scale' ? scaleTransform : translateTransform
    return individual[type] != null && source === null
      ? { hasValue: true, value: individual[type], readOnly: true }
      : readTransformAxis(source, type, axis)
  }
  const targetDom = context?.targetDom
  const zoneSelector = (context?.editConfig.options as { zoneTab?: { selector: string } })?.zoneTab?.selector
  // 继承值只用于预览，编辑来源仍保留原声明。
  const inheritedValues = useMemo(() => {
    const values: Record<string, string | null> = {}
    // skew/skewX/skewY 的继承结果已包含在 transform 的计算矩阵中，没有独立的 skew 属性。
    const keys = ['transform', 'translate', 'rotate', 'scale']
    keys.forEach(key => {
      const style = context?.effectiveStyle?.[key]
      if (style?.value === 'inherit') {
        values[key] = style.computedValue || context?.getStylePreview?.(key) || null
      }
    })
    return values
  }, [context?.effectiveStyle, context?.getStylePreview, targetDom, zoneSelector])
  const inheritedMatrix = useMemo(() => readTransformMatrix(inheritedValues.transform), [inheritedValues.transform])
  const inheritedAngle = individual.rotate == null ? inheritedMatrix?.rotate : undefined
  const inheritedTranslate = individual.translate == null ? inheritedMatrix : null
  const inheritedScale = individual.scale == null ? inheritedMatrix : null
  // 矩阵分解只能得出 skewX，skewY 不存在，所以继承态只回显 X。
  const inheritedSkewX = inheritedMatrix?.skewX

  const { angle: parsedAngle, hasRotation, raw: rotationRaw } = readRotation(rotationTransform)
  const { flipX, flipY } = readFlips(scaleTransform)
  const translateX = readAxis('translate', 'x')
  const translateY = readAxis('translate', 'y')
  const scaleX = readAxis('scale', 'x')
  const scaleY = readAxis('scale', 'y')
  const skewX = readSkewAxis(editableTransform, 'x')
  const skewY = readSkewAxis(editableTransform, 'y')
  const hasTransform = inheritedMatrix || hasRotation || !angleEditable || flipX || flipY || translateX.hasValue || translateY.hasValue || scaleX.hasValue || scaleY.hasValue || skewX.hasValue || skewY.hasValue || clearTransform(editableTransform) !== editableTransform
  // 只在挂载时按值决定是否折叠，之后编辑（含重置清空）不再联动折叠状态，避免面板突然收起。
  const [initialHasTransform] = useState(() => !!hasTransform)
  const effectiveCollapse = initialHasTransform ? collapse : true
  const angleDisplay = parsedAngle == null ? '' : String(parsedAngle)
  // 无旋转时回显继承角度；不可编辑（独立 rotate 无法解析）时回显原始声明
  const anglePreview = angleEditable
    ? (hasRotation ? undefined : String(inheritedAngle ?? 0))
    : individual.rotate ?? undefined
  // 连续拖拽、快捷按钮都从最近一次写入继续，避免父组件回传前丢掉其他变换。
  const liveTransformRef = useRef(editableTransform)
  const liveIndividualRef = useRef(individual)
  const sourceRef = useRef({ transformStr, targetDom, zoneSelector, ...individual })
  if (sourceRef.current.transformStr !== transformStr || sourceRef.current.targetDom !== targetDom ||
    sourceRef.current.zoneSelector !== zoneSelector || sourceRef.current.translate !== individual.translate ||
    sourceRef.current.rotate !== individual.rotate || sourceRef.current.scale !== individual.scale) {
    liveTransformRef.current = editableTransform
    liveIndividualRef.current = individual
    sourceRef.current = { transformStr, targetDom, zoneSelector, ...individual }
  }

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

  const commitAngle = useCallback((angle: number | string | null) =>
    editTransform('rotate', current => setRotation(current, angle)), [editTransform])

  const handleAxisChange = useCallback((type: TransformAxisType, axis: 'x' | 'y', next: string | null) => {
    // 只有百分比字面量换算成 CSS 比例；变量原样落到对应分量。
    const value = next != null && type === 'scale' && isScaleValue(next)
      ? String(Number(parseFloat(next)) / 100)
      : next
    editTransform(type, current => setTransformAxis(current, type, axis, value))
  }, [editTransform])

  const handleSkewChange = useCallback((axis: 'x' | 'y', next: number | string | null) => {
    commitTransform(setSkewAxis(liveTransformRef.current, axis, next))
  }, [commitTransform])

  // ── 变量绑定 ──────────────────────────────────────────────
  // 位移沿用长度域；角度、缩放各用自己的域。collect / resolve 必须是模块级引用，否则每帧重扫变量。
  // 只读态（独立属性写成不支持的表达式）不参与绑定，避免整串表达式被当成一个 var() 渲染成胶囊。
  const translateXBinding = useLengthVarBinding({
    value: translateX.readOnly ? null : translateX.value,
    onChange: next => handleAxisChange('translate', 'x', next),
    min: -Infinity,
    fallback: inheritedTranslate ? `${inheritedTranslate.translateX}px` : '0px',
  })
  const translateYBinding = useLengthVarBinding({
    value: translateY.readOnly ? null : translateY.value,
    onChange: next => handleAxisChange('translate', 'y', next),
    min: -Infinity,
    fallback: inheritedTranslate ? `${inheritedTranslate.translateY}px` : '0px',
  })
  const scaleXBinding = useLengthVarBinding({
    value: scaleX.readOnly ? null : scaleX.value,
    onChange: next => handleAxisChange('scale', 'x', next),
    collect: getCssVarScaleOptions,
    resolve: resolveScaleVar,
    fallback: inheritedScale ? `${inheritedScale.scaleX}%` : '100%',
  })
  const scaleYBinding = useLengthVarBinding({
    value: scaleY.readOnly ? null : scaleY.value,
    onChange: next => handleAxisChange('scale', 'y', next),
    collect: getCssVarScaleOptions,
    resolve: resolveScaleVar,
    fallback: inheritedScale ? `${inheritedScale.scaleY}%` : '100%',
  })
  const skewXBinding = useLengthVarBinding({
    value: skewX.value,
    onChange: next => handleSkewChange('x', next),
    collect: getCssVarAngleOptions,
    resolve: resolveAngleVar,
    fallback: inheritedSkewX != null ? `${inheritedSkewX}deg` : '0deg',
  })
  const skewYBinding = useLengthVarBinding({
    value: skewY.value,
    onChange: next => handleSkewChange('y', next),
    collect: getCssVarAngleOptions,
    resolve: resolveAngleVar,
    fallback: '0deg',
  })
  const rotateBinding = useLengthVarBinding({
    value: rotationRaw ?? angleDisplay,
    onChange: next => {
      // 绑定的变量原样写入；数字/带单位字面量才换算成度数。
      if (isSimpleVarComponent(next)) {
        commitAngle(next)
        return
      }
      const parsed = parseFloat(next)
      commitAngle(Number.isFinite(parsed) ? parsed : null)
    },
    collect: getCssVarAngleOptions,
    resolve: resolveAngleVar,
    fallback: inheritedAngle != null ? `${inheritedAngle}deg` : '0deg',
  })

  const handleRotate90R = useCallback(() => {
    const raw = liveIndividualRef.current.rotate
    const current = readRotation(raw != null ? readIndividualTransform('rotate', raw) : liveTransformRef.current).angle ?? 0
    commitAngle((current + 90) % 360)
  }, [commitAngle])

  const handleFlipH = useCallback(() => {
    editTransform('scale', current => toggleFlip(current, 'x'))
  }, [editTransform])

  const handleFlipV = useCallback(() => {
    editTransform('scale', current => toggleFlip(current, 'y'))
  }, [editTransform])

  const handleReset = useCallback(() => {
    // 独立声明与 transform 一起提交；未支持的表达式/三维独立值保留。
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
      if (result && !result.applied) return
      changes.forEach(({ key, value }) => {
        if (key === 'transform') liveTransformRef.current = value
        else liveIndividualRef.current[key] = `none${liveIndividualRef.current[key]?.match(/\s*!important\s*$/i)?.[0] || ''}`
      })
      return
    }
    commitTransform(clearTransform(liveTransformRef.current))
  }, [commitTransform, onChange])

  return (
    <Panel
      title={lang.transformPanelTitle}
      showTitle={showTitle}
      showReset={true}
      resetFunction={handleReset}
      collapse={effectiveCollapse}
    >
      <Panel.Content className={css.transformPanelContent}>
        <TransformAxisInput type='translate' axis='x' field={translateX} previewValue={inheritedTranslate ? `${inheritedTranslate.translateX}px` : undefined} binding={translateXBinding} onChange={handleAxisChange} />
        <TransformAxisInput type='translate' axis='y' field={translateY} previewValue={inheritedTranslate ? `${inheritedTranslate.translateY}px` : undefined} binding={translateYBinding} onChange={handleAxisChange} />
      </Panel.Content>
      <Panel.Content className={css.transformPanelContent}>
        <TransformAxisInput type='scale' axis='x' field={scaleX} previewValue={inheritedScale ? `${inheritedScale.scaleX}%` : undefined} binding={scaleXBinding} onChange={handleAxisChange} />
        <TransformAxisInput type='scale' axis='y' field={scaleY} previewValue={inheritedScale ? `${inheritedScale.scaleY}%` : undefined} binding={scaleYBinding} onChange={handleAxisChange} />
      </Panel.Content>
      <Panel.Content className={css.transformPanelContent}>
        <SkewAxisInput axis='x' field={skewX} previewValue={inheritedSkewX} binding={skewXBinding} onChange={handleSkewChange} />
        <SkewAxisInput axis='y' field={skewY} binding={skewYBinding} onChange={handleSkewChange} />
      </Panel.Content>
      <Panel.Content className={css.transformPanelContent}>
        {/* 旋转：与倾斜/缩放同一套 VariableNumberInput，单位下拉/胶囊/变量弹层都由它提供 */}
        <RotationInput
          field={{ hasRotation, angle: parsedAngle, raw: rotationRaw }}
          previewValue={anglePreview}
          editable={angleEditable}
          binding={rotateBinding}
          onChange={commitAngle}
        />

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
