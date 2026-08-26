import React, {
  useState,
  useRef,
  useCallback,
  useEffect,
  useMemo,
  CSSProperties,
} from 'react'

import {
  Panel,
  Select,
  ColorEditor,
  MinusOutlined,
  BoxShadowInnerOutlined,
  BoxShadowOuterOutlined,
  BoxShadowBlurRadiusOutlined,
  BoxShadowSpreadRadiusOutlined,
  TextShadowOutlined,
  SketchPopup,
  SketchCloseIcon,
  VariableNumberInput,
  withApplyVariableOption,
  APPLY_VARIABLE_ACTION,
} from '../../components'
import { useDragNumber, useCanvasColorVariables, useLengthVarBinding } from '../../hooks'
import type { UnitOption } from '../../components/InputNumber'
import type { LengthVarBinding } from '../../hooks'
import { resolveCssVarColor } from '../../../core/resolve-css-var-color'
import type { CssVarColorOption } from '../../../core/resolve-css-var-color'
import { resolveCssVarLength } from '../../../core/resolve-css-var-length'
import { Blur as BlurIcon } from '../../icons/Blur'
import { BackgroundBlur as BackgroundBlurIcon } from '../../icons/BackgroundBlur'

import type { ChangeEvent, PanelBaseProps } from '../../type'
import css from './index.less'
import {
  EffectLayer,
  EffectType,
  EFFECT_TYPE_LABELS,
  createDefaultLayer,
  parseEffects,
  serializeEffects,
  fingerprintEffects,
  fingerprintFromChanges,
  hasEffectType,
  isShadowType,
  isBlurType,
  isBoxShadowLayer,
  isShadowLayer,
  isTextShadowLayer,
} from './layers'
import type { CssEffectsBundle } from './layers'

interface EffectsProps extends PanelBaseProps {
  value: CSSProperties
  onChange: ChangeEvent
}

function GripIcon() {
  return (
    <svg width='8' height='12' viewBox='0 0 8 12' fill='currentColor'>
      <circle cx='2' cy='2' r='1.2' />
      <circle cx='6' cy='2' r='1.2' />
      <circle cx='2' cy='6' r='1.2' />
      <circle cx='6' cy='6' r='1.2' />
      <circle cx='2' cy='10' r='1.2' />
      <circle cx='6' cy='10' r='1.2' />
    </svg>
  )
}

function EffectTypeIcon({ type }: { type: EffectType }) {
  if (type === 'innerShadow') return <BoxShadowInnerOutlined />
  if (type === 'dropShadow') return <BoxShadowOuterOutlined />
  if (type === 'textShadow') return <TextShadowOutlined />
  if (type === 'backgroundBlur') return <BackgroundBlurIcon />
  return <BlurIcon />
}

function readCssBundle(value: CSSProperties): CssEffectsBundle {
  return {
    boxShadow: value.boxShadow as string | undefined,
    textShadow: value.textShadow as string | undefined,
    filter: value.filter as string | undefined,
    backdropFilter: (value as any).backdropFilter as string | undefined,
    WebkitBackdropFilter: ((value as any).WebkitBackdropFilter ?? (value as any).webkitBackdropFilter) as string | undefined,
  }
}

export function Effects({ value, onChange, showTitle, collapse }: EffectsProps) {
  const { targetDom, variableOptions } = useCanvasColorVariables()
  const parseBundle = useCallback(
    (bundle: CssEffectsBundle) => parseEffects(bundle, {
      classifyColorToken: (token) => {
        if (resolveCssVarColor(token, targetDom) != null) return true
        if (resolveCssVarLength(token, targetDom) != null) return false
        return undefined
      },
    }),
    [targetDom]
  )
  const [layers, setLayers] = useState<EffectLayer[]>(() => parseBundle(readCssBundle(value)))
  const layersRef = useRef(layers)
  layersRef.current = layers
  const lastEmittedRef = useRef(fingerprintEffects(readCssBundle(value)))
  const lastParsedTargetRef = useRef(targetDom)
  const valueRef = useRef(value)
  valueRef.current = value

  const [activeIndex, setActiveIndex] = useState<number | null>(null)
  const [popupOpen, setPopupOpen] = useState(false)
  const [showPopup, setShowPopup] = useState(false)
  const triggerRefs = useRef<Array<HTMLDivElement | null>>([])
  const activeTriggerRef = useRef<HTMLDivElement | null>(null)

  // 外部 CSS → 本地
  useEffect(() => {
    const bundle = readCssBundle(value)
    const fp = fingerprintEffects(bundle)
    const targetChanged = lastParsedTargetRef.current !== targetDom
    if (!targetChanged && fp === lastEmittedRef.current) return
    const next = parseBundle(bundle)
    lastParsedTargetRef.current = targetDom
    lastEmittedRef.current = fp
    setLayers(next)
  }, [value.boxShadow, value.textShadow, value.filter, (value as any).backdropFilter, (value as any).WebkitBackdropFilter, targetDom, parseBundle])

  const emitLayers = useCallback((next: EffectLayer[]) => {
    // 会话内保持用户排序，不 normalize（模糊可夹在阴影中间）
    const prev = readCssBundle(valueRef.current)
    const changes = serializeEffects(next, prev)
    lastEmittedRef.current = fingerprintFromChanges(changes)
    setLayers(next)
    onChange(changes)
  }, [onChange])

  const handleAddOption = useCallback((type: string) => {
    const effectType = type as EffectType
    if (!EFFECT_TYPE_LABELS[effectType]) return
    if (isBlurType(effectType) && hasEffectType(layersRef.current, effectType)) return
    emitLayers([createDefaultLayer(effectType), ...layersRef.current])
  }, [emitLayers])

  const handleLayerRemove = useCallback((index: number) => {
    if (activeIndex === index) {
      setPopupOpen(false)
      setActiveIndex(null)
    } else if (activeIndex != null && activeIndex > index) {
      setActiveIndex(activeIndex - 1)
    }
    emitLayers(layersRef.current.filter((_, i) => i !== index))
  }, [emitLayers, activeIndex])

  const handleLayerChange = useCallback((index: number, partial: Partial<EffectLayer> & { type?: EffectType }) => {
    emitLayers(layersRef.current.map((l, i) => {
      if (i !== index) return l
      if (partial.type && partial.type !== l.type) {
        // 类型切换由 handleTypeChange 完整替换
        return { ...l, ...partial } as EffectLayer
      }
      return { ...l, ...partial } as EffectLayer
    }))
  }, [emitLayers])

  const handleTypeChange = useCallback((index: number, nextType: EffectType) => {
    const current = layersRef.current
    if (isBlurType(nextType)) {
      const occupied = current.findIndex((l, i) => i !== index && l.type === nextType)
      if (occupied >= 0) return
    }
    const prev = current[index]
    if (!prev) return

    if (isShadowType(nextType) && isBlurType(prev.type)) {
      const next = createDefaultLayer(nextType)
      next.id = prev.id
      emitLayers(current.map((l, i) => (i === index ? next : l)))
      return
    }
    if (isBlurType(nextType) && isShadowType(prev.type)) {
      emitLayers(current.map((l, i) => (i === index ? {
        id: prev.id,
        type: nextType,
        blurRadius: prev.blurRadius && prev.blurRadius !== '0px' ? prev.blurRadius : '4px',
      } : l)))
      return
    }
    if (isShadowType(nextType) && isShadowLayer(prev)) {
      const next = createDefaultLayer(nextType)
      if (isShadowLayer(next)) {
        next.id = prev.id
        next.offsetX = prev.offsetX
        next.offsetY = prev.offsetY
        next.blurRadius = prev.blurRadius
        next.color = prev.color
      }
      emitLayers(current.map((l, i) => (i === index ? next : l)))
      return
    }
    emitLayers(current.map((l, i) => (i === index ? { ...l, type: nextType } as EffectLayer : l)))
  }, [emitLayers])

  const addOptions = useMemo(() => {
    const hasLayer = hasEffectType(layers, 'layerBlur')
    const hasBg = hasEffectType(layers, 'backgroundBlur')
    return [
      { label: '外阴影', value: 'dropShadow', icon: <BoxShadowOuterOutlined /> },
      { label: '内阴影', value: 'innerShadow', icon: <BoxShadowInnerOutlined /> },
      { label: '文字阴影', value: 'textShadow', icon: <TextShadowOutlined /> },
      { label: '图层模糊', value: 'layerBlur', icon: <BlurIcon />, disabled: hasLayer },
      { label: '背景模糊', value: 'backgroundBlur', icon: <BackgroundBlurIcon />, disabled: hasBg },
    ]
  }, [layers])

  const openPopup = useCallback((index: number) => {
    activeTriggerRef.current = triggerRefs.current[index] ?? null
    setActiveIndex(index)
    setShowPopup(true)
    setPopupOpen(true)
  }, [])

  // ── DnD：全部效果层可排序（会话内保序）──────────────────────────────────
  const [dragIndex, setDragIndex] = useState<number | null>(null)
  const [overState, setOverState] = useState<{ index: number; half: 'top' | 'bottom' } | null>(null)
  const dragBlockedRef = useRef(false)

  const handleDragStart = useCallback((e: React.DragEvent<HTMLDivElement>, index: number) => {
    if (dragBlockedRef.current) {
      e.preventDefault()
      dragBlockedRef.current = false
      return
    }
    setDragIndex(index)
    e.dataTransfer.effectAllowed = 'move'
  }, [])

  const handleDragOver = useCallback((e: React.DragEvent<HTMLDivElement>, index: number) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
    const rect = e.currentTarget.getBoundingClientRect()
    const half = e.clientY < rect.top + rect.height / 2 ? 'top' : 'bottom'
    setOverState({ index, half })
  }, [])

  const handleDrop = useCallback((e: React.DragEvent<HTMLDivElement>, targetIndex: number) => {
    e.preventDefault()
    if (dragIndex === null) return
    const rect = e.currentTarget.getBoundingClientRect()
    const half = e.clientY < rect.top + rect.height / 2 ? 'top' : 'bottom'
    let insertAt = half === 'top' ? targetIndex : targetIndex + 1
    if (dragIndex < insertAt) insertAt -= 1
    setDragIndex(null)
    setOverState(null)
    if (dragIndex === insertAt) return

    const next = [...layersRef.current]
    const [removed] = next.splice(dragIndex, 1)
    next.splice(insertAt, 0, removed)
    if (activeIndex === dragIndex) setActiveIndex(insertAt)
    else if (activeIndex != null) {
      if (dragIndex < activeIndex && insertAt >= activeIndex) setActiveIndex(activeIndex - 1)
      else if (dragIndex > activeIndex && insertAt <= activeIndex) setActiveIndex(activeIndex + 1)
    }
    emitLayers(next)
  }, [dragIndex, emitLayers, activeIndex])

  const handleDragEnd = useCallback(() => {
    setDragIndex(null)
    setOverState(null)
  }, [])

  const effectiveCollapse = layers.length === 0 && collapse !== 'inherited' ? true : collapse
  const activeLayer = activeIndex != null ? layers[activeIndex] : null

  const typeOptionsForActive = useMemo(() => {
    if (!activeLayer) return []
    return (Object.keys(EFFECT_TYPE_LABELS) as EffectType[]).map((type) => {
      const occupiedByOther = isBlurType(type)
        && layers.some((l, i) => i !== activeIndex && l.type === type)
      return {
        label: EFFECT_TYPE_LABELS[type],
        value: type,
        disabled: occupiedByOther,
        icon: <EffectTypeIcon type={type} />,
      }
    })
  }, [activeLayer, activeIndex, layers])

  return (
    <Panel
      title='效果'
      showTitle={showTitle}
      collapse={effectiveCollapse}
      showDelete={false}
      addOptions={addOptions}
      onAddOption={handleAddOption}
      rightColumn={
        // 继承/只读回显时不渲染层删除列，避免 rightColumn 绕过 Panel 的减号隐藏
        layers.length > 0 && collapse !== 'inherited' ? (
          <div className={css.deleteColumn}>
            {layers.map((layer, index) => (
              <div
                key={layer.id}
                className={css.deleteBtn}
                onClick={() => handleLayerRemove(index)}
              >
                <MinusOutlined />
              </div>
            ))}
          </div>
        ) : undefined
      }
    >
      {layers.length > 0 && (
        <div
          className={css.layerList}
          onDragLeave={(e) => {
            if (!e.currentTarget.contains(e.relatedTarget as Node)) setOverState(null)
          }}
        >
          {layers.map((layer, index) => (
            <div
              key={layer.id}
              className={`${css.layerItemWrapper}${dragIndex === index ? ` ${css.layerDragging}` : ''}`}
              draggable
              onMouseDown={(e) => {
                dragBlockedRef.current = !(e.target as HTMLElement).closest('[data-drag-handle]')
              }}
              onDragStart={(e) => handleDragStart(e, index)}
              onDragOver={(e) => handleDragOver(e, index)}
              onDrop={(e) => handleDrop(e, index)}
              onDragEnd={handleDragEnd}
            >
              {overState?.index === index && overState.half === 'top' && dragIndex !== index && (
                <div className={css.dropIndicator} />
              )}
              <Panel.Item
                className={css.layerRow}
                style={{ marginLeft: 0, width: '100%' }}
                activeWhenBlur={false}
              >
                <div
                  ref={(el) => { triggerRefs.current[index] = el }}
                  className={css.layerRowInner}
                  onClick={() => openPopup(index)}
                  data-mybricks-tip='点击编辑效果'
                >
                  <span className={css.dragHandle} data-drag-handle onClick={(e) => e.stopPropagation()}>
                    <GripIcon />
                  </span>
                  <span className={`${css.layerIcon}${isBoxShadowLayer(layer) ? ` ${css.layerIconShadow}` : ''}`}>
                    <EffectTypeIcon type={layer.type} />
                  </span>
                  <span className={css.layerLabel}>{EFFECT_TYPE_LABELS[layer.type]}</span>
                </div>
              </Panel.Item>
              {overState?.index === index && overState.half === 'bottom' && dragIndex !== index && (
                <div className={css.dropIndicator} />
              )}
            </div>
          ))}
        </div>
      )}

      <SketchPopup
        open={popupOpen}
        mounted={showPopup && !!activeLayer && activeIndex != null}
        anchorRef={activeTriggerRef}
        onClose={() => setPopupOpen(false)}
        className={css.effectSketch}
        repositionKey={activeLayer ? `${activeLayer.id}-${activeLayer.type}` : ''}
      >
        {activeLayer && activeIndex != null && (
          <EffectSketchBody
            layer={activeLayer}
            targetDom={targetDom}
            variableOptions={variableOptions}
            typeOptions={typeOptionsForActive}
            onTypeChange={(type) => handleTypeChange(activeIndex, type)}
            onChange={(partial) => handleLayerChange(activeIndex, partial)}
            onClose={() => setPopupOpen(false)}
          />
        )}
      </SketchPopup>
    </Panel>
  )
}

// ── Sketch body ────────────────────────────────────────────────────────────

/** 效果里的长度只用 px，下拉的存在意义是挂「应用变量...」入口 */
const EFFECT_UNIT_OPTIONS: UnitOption[] = [{ label: 'px', value: 'px' }]
/** 与未绑定态的输入框同宽，胶囊不把行撑破 */
const EFFECT_CHIP_STYLE: CSSProperties = { flex: 1, minWidth: 0, paddingLeft: 6 }
/** 输入框图标左距对齐 ColorEditor 色块（内部 8px − prefix 的 2px） */
const EFFECT_INPUT_STYLE: CSSProperties = { flex: 1, paddingLeft: 6 }

interface EffectNumberFieldProps {
  label: string
  icon: React.ReactNode
  /** 拖拽手柄的提示文案，绑定态会追加解绑说明 */
  tip: string
  value: string
  binding: LengthVarBinding
  unitOptions: UnitOption[]
  /** 未绑定态的拖拽手柄，正负值域各有一份 */
  getDragProps: ReturnType<typeof useDragNumber>
  allowNegative?: boolean
  onChange: (next: string) => void
}

/** 效果弹层里的一行数值：支持拖拽、直接输入，以及绑定 CSS 长度变量 */
function EffectNumberField({
  label,
  icon,
  tip,
  value,
  binding,
  unitOptions,
  getDragProps,
  allowNegative,
  onChange,
}: EffectNumberFieldProps) {
  // 图标既是拖拽手柄也是变量弹层的锚点，绑定态由胶囊接着渲染它，位置不跳动
  const handle = (
    <div
      ref={binding.anchorRef}
      {...(binding.varRef
        ? binding.dragProps(`${tip}（将解除变量绑定）`)
        : getDragProps(value, tip))}
    >
      <div className={css.effectLabelIcon}>{icon}</div>
    </div>
  )

  return (
    <div className={css.effectRow}>
      <span className={css.effectLabel}>{label}</span>
      <VariableNumberInput
        binding={binding}
        chipStyle={EFFECT_CHIP_STYLE}
        chipPrefix={handle}
        nestedPicker
        inputProps={{
          style: EFFECT_INPUT_STYLE,
          allowNegative,
          prefix: handle,
          defaultValue: value,
          defaultUnitValue: 'px',
          unitOptions,
          showIcon: true,
          showIconOnHover: true,
          fallbackValue: 0,
          onChange: (next) => onChange(next || '0px'),
          onAction: (action) => {
            if (action === APPLY_VARIABLE_ACTION) binding.openPicker()
          },
        }}
      />
    </div>
  )
}

interface EffectSketchBodyProps {
  layer: EffectLayer
  targetDom: HTMLElement | null
  variableOptions: CssVarColorOption[]
  typeOptions: Array<{ label: string; value: EffectType; disabled?: boolean; icon?: React.ReactNode }>
  onTypeChange: (type: EffectType) => void
  onChange: (partial: Partial<EffectLayer>) => void
  onClose: () => void
}

function EffectSketchBody({
  layer,
  targetDom,
  variableOptions,
  typeOptions,
  onTypeChange,
  onChange,
  onClose,
}: EffectSketchBodyProps) {
  const getDragProps = useDragNumber({ continuous: true })
  const getDragPropsNegative = useDragNumber({ continuous: true, min: -Infinity })
  // 切层/切类型时重挂非受控子组件。不要把颜色值并进来：ColorEditor 的取色浮层
  // 是它自己的 portal，颜色一变就重挂会让拖色盘时弹层被反复关掉。
  const forceKey = `${layer.id}-${layer.type}`
  const shadow = isShadowLayer(layer)
  const textShadow = isTextShadowLayer(layer)

  // ── 长度字段的 CSS 变量绑定 ─────────────────────────────────────────────
  // 模糊层没有偏移与扩散，这里仍无条件建 binding（hooks 顺序），取值给 0px 占位
  const offsetXVar = useLengthVarBinding({
    value: isShadowLayer(layer) ? layer.offsetX : '0px',
    onChange: (next) => onChange({ offsetX: next }),
    min: -Infinity,
  })
  const offsetYVar = useLengthVarBinding({
    value: isShadowLayer(layer) ? layer.offsetY : '0px',
    onChange: (next) => onChange({ offsetY: next }),
    min: -Infinity,
  })
  const blurRadiusVar = useLengthVarBinding({
    value: layer.blurRadius,
    onChange: (next) => onChange({ blurRadius: next }),
  })
  const spreadRadiusVar = useLengthVarBinding({
    value: isBoxShadowLayer(layer) ? layer.spreadRadius : '0px',
    onChange: (next) => onChange({ spreadRadius: next }),
  })

  const unitOptions = useMemo(
    () => withApplyVariableOption(EFFECT_UNIT_OPTIONS, blurRadiusVar.hasVariables),
    [blurRadiusVar.hasVariables]
  )

  // 切层/切类型后字段会换一批，锚点随之卸载，残留的弹层会停在旧位置
  useEffect(() => {
    offsetXVar.closePicker()
    offsetYVar.closePicker()
    blurRadiusVar.closePicker()
    spreadRadiusVar.closePicker()
  }, [layer.id, layer.type])

  // 变量列表与作用域由 Effects 统一获取，解析层和当前弹层共享同一份上下文。
  const shadowColor = isShadowLayer(layer) ? layer.color : ''
  const resolvedColor = useMemo(
    () => resolveCssVarColor(shadowColor, targetDom) ?? undefined,
    [shadowColor, targetDom]
  )

  return (
    <>
      <div className={css.effectHeader}>
        <Select
          value={layer.type}
          options={typeOptions}
          onChange={onTypeChange}
          style={{ width: '60%' }}
        />
        <button className={css.effectHeaderBtn} data-mybricks-tip='关闭' onClick={onClose}>
          {SketchCloseIcon}
        </button>
      </div>

      <React.Fragment key={forceKey}>
        {shadow ? (
          <>
            <EffectNumberField
              label='位置'
              icon='X'
              tip='拖拽调整x轴偏移'
              value={layer.offsetX}
              binding={offsetXVar}
              unitOptions={unitOptions}
              getDragProps={getDragPropsNegative}
              allowNegative
              onChange={(next) => onChange({ offsetX: next })}
            />
            <EffectNumberField
              label=''
              icon='Y'
              tip='拖拽调整y轴偏移'
              value={layer.offsetY}
              binding={offsetYVar}
              unitOptions={unitOptions}
              getDragProps={getDragPropsNegative}
              allowNegative
              onChange={(next) => onChange({ offsetY: next })}
            />
            <EffectNumberField
              label='模糊'
              icon={<BoxShadowBlurRadiusOutlined />}
              tip='拖拽调整模糊半径'
              value={layer.blurRadius}
              binding={blurRadiusVar}
              unitOptions={unitOptions}
              getDragProps={getDragProps}
              onChange={(next) => onChange({ blurRadius: next })}
            />
            {!textShadow && (
              <EffectNumberField
                label='扩散'
                icon={<BoxShadowSpreadRadiusOutlined />}
                tip='拖拽调整扩散半径'
                value={layer.spreadRadius}
                binding={spreadRadiusVar}
                unitOptions={unitOptions}
                getDragProps={getDragProps}
                onChange={(next) => onChange({ spreadRadius: next })}
              />
            )}
            <div className={css.effectRow}>
              <span className={css.effectLabel}>颜色</span>
              {/* showSubTabs=false 只关渐变/图片，变量 tab 由 variableOptions 是否为空决定 */}
              <ColorEditor
                style={{ flex: 1 }}
                defaultValue={layer.color}
                resolvedColor={resolvedColor}
                variableOptions={variableOptions}
                scopeEl={targetDom}
                showSubTabs={false}
                onChange={(v) => onChange({ color: v as string })}
              />
            </div>
          </>
        ) : (
          <EffectNumberField
            label='模糊'
            icon={layer.type === 'backgroundBlur' ? <BackgroundBlurIcon /> : <BlurIcon />}
            tip='拖拽调整模糊半径'
            value={layer.blurRadius}
            binding={blurRadiusVar}
            unitOptions={unitOptions}
            getDragProps={getDragProps}
            onChange={(next) => onChange({ blurRadius: next })}
          />
        )}
      </React.Fragment>
    </>
  )
}
