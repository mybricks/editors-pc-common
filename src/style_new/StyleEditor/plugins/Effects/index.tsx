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
  InputNumber,
  MinusOutlined,
  BoxShadowInnerOutlined,
  BoxShadowOuterOutlined,
  BoxShadowBlurRadiusOutlined,
  BoxShadowSpreadRadiusOutlined,
  SketchPopup,
  SketchCloseIcon,
} from '../../components'
import { useDragNumber } from '../../hooks'
import { Blur as BlurIcon } from '../../icons/Blur'
import { BackgroundBlur as BackgroundBlurIcon } from '../../icons/BackgroundBlur'

import type { ChangeEvent, PanelBaseProps } from '../../type'
import css from './index.less'
import {
  EffectLayer,
  EffectType,
  ShadowEffectLayer,
  EFFECT_TYPE_LABELS,
  createDefaultLayer,
  parseEffects,
  serializeEffects,
  fingerprintEffects,
  fingerprintFromChanges,
  hasEffectType,
  isShadowType,
  isBlurType,
  isShadowLayer,
  type CssEffectsBundle,
} from './layers'

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
  if (type === 'backgroundBlur') return <BackgroundBlurIcon />
  return <BlurIcon />
}

function readCssBundle(value: CSSProperties): CssEffectsBundle {
  return {
    boxShadow: value.boxShadow as string | undefined,
    filter: value.filter as string | undefined,
    backdropFilter: (value as any).backdropFilter as string | undefined,
    WebkitBackdropFilter: ((value as any).WebkitBackdropFilter ?? (value as any).webkitBackdropFilter) as string | undefined,
  }
}

export function Effects({ value, onChange, showTitle, collapse }: EffectsProps) {
  const [layers, setLayers] = useState<EffectLayer[]>(() => parseEffects(readCssBundle(value)))
  const layersRef = useRef(layers)
  layersRef.current = layers
  const lastEmittedRef = useRef(fingerprintEffects(readCssBundle(value)))
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
    if (fp === lastEmittedRef.current) return
    const next = parseEffects(bundle)
    lastEmittedRef.current = fp
    setLayers(next)
  }, [value.boxShadow, value.filter, (value as any).backdropFilter, (value as any).WebkitBackdropFilter])

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
      const next = createDefaultLayer(nextType) as ShadowEffectLayer
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
    emitLayers(current.map((l, i) => (i === index ? { ...l, type: nextType } as EffectLayer : l)))
  }, [emitLayers])

  const addOptions = useMemo(() => {
    const hasLayer = hasEffectType(layers, 'layerBlur')
    const hasBg = hasEffectType(layers, 'backgroundBlur')
    return [
      { label: '外阴影', value: 'dropShadow', icon: <BoxShadowOuterOutlined /> },
      { label: '内阴影', value: 'innerShadow', icon: <BoxShadowInnerOutlined /> },
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

  const effectiveCollapse = layers.length === 0 ? true : collapse
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
        icon: type === 'innerShadow'
          ? <BoxShadowInnerOutlined />
          : type === 'dropShadow'
            ? <BoxShadowOuterOutlined />
            : type === 'backgroundBlur'
              ? <BackgroundBlurIcon />
              : <BlurIcon />,
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
        layers.length > 0 ? (
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
        ) : <></>
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
                  <span className={`${css.layerIcon}${isShadowLayer(layer) ? ` ${css.layerIconShadow}` : ''}`}>
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

interface EffectSketchBodyProps {
  layer: EffectLayer
  typeOptions: Array<{ label: string; value: EffectType; disabled?: boolean; icon?: React.ReactNode }>
  onTypeChange: (type: EffectType) => void
  onChange: (partial: Partial<EffectLayer>) => void
  onClose: () => void
}

function EffectSketchBody({
  layer,
  typeOptions,
  onTypeChange,
  onChange,
  onClose,
}: EffectSketchBodyProps) {
  const getDragProps = useDragNumber({ continuous: true })
  const getDragPropsNegative = useDragNumber({ continuous: true, min: -Infinity })
  const forceKey = `${layer.id}-${layer.type}`
  const shadow = isShadowLayer(layer)

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
            <div className={css.effectRow}>
              <span className={css.effectLabel}>位置</span>
              <InputNumber
                style={{ flex: 1 }}
                allowNegative
                prefix={
                  <div {...getDragPropsNegative(layer.offsetX, '拖拽调整x轴偏移')}>
                    <div className={css.effectLabelIcon}>X</div>
                  </div>
                }
                defaultValue={layer.offsetX}
                fallbackValue={0}
                onChange={(v) => onChange({ offsetX: v || '0px' })}
              />
            </div>
            <div className={css.effectRow}>
              <span className={css.effectLabel}></span>
              <InputNumber
                style={{ flex: 1 }}
                allowNegative
                prefix={
                  <div {...getDragPropsNegative(layer.offsetY, '拖拽调整y轴偏移')}>
                    <div className={css.effectLabelIcon}>Y</div>
                  </div>
                }
                defaultValue={layer.offsetY}
                fallbackValue={0}
                onChange={(v) => onChange({ offsetY: v || '0px' })}
              />
            </div>
            <div className={css.effectRow}>
              <span className={css.effectLabel}>模糊</span>
              <InputNumber
                style={{ flex: 1 }}
                prefix={
                  <div {...getDragProps(layer.blurRadius, '拖拽调整模糊半径')}>
                    <div className={css.effectLabelIcon}>
                      <BoxShadowBlurRadiusOutlined />
                    </div>
                  </div>
                }
                defaultValue={layer.blurRadius}
                fallbackValue={0}
                onChange={(v) => onChange({ blurRadius: v || '0px' })}
              />
            </div>
            <div className={css.effectRow}>
              <span className={css.effectLabel}>扩散</span>
              <InputNumber
                style={{ flex: 1 }}
                prefix={
                  <div {...getDragProps(layer.spreadRadius, '拖拽调整扩散半径')}>
                    <div className={css.effectLabelIcon}>
                      <BoxShadowSpreadRadiusOutlined />
                    </div>
                  </div>
                }
                defaultValue={layer.spreadRadius}
                fallbackValue={0}
                onChange={(v) => onChange({ spreadRadius: v || '0px' })}
              />
            </div>
            <div className={css.effectRow}>
              <span className={css.effectLabel}>颜色</span>
              <ColorEditor
                style={{ flex: 1 }}
                defaultValue={layer.color}
                showSubTabs={false}
                onChange={(v) => onChange({ color: v as string })}
              />
            </div>
          </>
        ) : (
          <div className={css.effectRow}>
            <span className={css.effectLabel}>模糊</span>
            <InputNumber
              style={{ flex: 1 }}
              prefix={
                <div {...getDragProps(layer.blurRadius, '拖拽调整模糊半径')}>
                  <div className={css.effectLabelIcon}>
                    {layer.type === 'backgroundBlur' ? <BackgroundBlurIcon /> : <BlurIcon />}
                  </div>
                </div>
              }
              defaultValue={layer.blurRadius}
              fallbackValue={0}
              onChange={(v) => onChange({ blurRadius: v || '0px' })}
            />
          </div>
        )}
      </React.Fragment>
    </>
  )
}
