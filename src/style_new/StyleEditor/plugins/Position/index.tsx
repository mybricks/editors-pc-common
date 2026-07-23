import React, { CSSProperties, useCallback, useEffect, useRef, useState } from 'react'

import { Panel } from '../../components'
import { useStyleEditorContext } from '../../context'
import { useDragNumber } from '../../hooks'

import type { ChangeEvent, PanelBaseProps } from '../../type'

import css from './index.less'

interface PositionProps extends PanelBaseProps {
  value: CSSProperties
  onChange: ChangeEvent
}

/** left/top 本身已可编辑的 position（无需再切 absolute） */
const EDITABLE_POSITIONS = new Set(['absolute', 'fixed', 'relative', 'sticky'])
/** 自由定位：按钮高亮，可一键取消 */
const FREE_POSITIONS = new Set(['absolute', 'fixed'])

/** "12px" / 12 → "12"；auto / null / undefined → "" */
function toDisplayValue(val: unknown): string {
  if (val == null) return ''
  const str = String(val)
  if (str === 'auto') return ''
  const num = parseFloat(str)
  return isNaN(num) ? '' : String(num)
}

/** "12" → "12px"；空字符串 / NaN → null（删除属性） */
function toOutputValue(str: string): string | null {
  const num = parseFloat(str)
  if (isNaN(num)) return null
  return `${num}px`
}

/**
 * 计算元素相对 offsetParent（即 absolute 定位上下文）的偏移。
 * 使用 offsetLeft/offsetTop（布局 CSS 像素），避免画布 transform:scale 下
 * getBoundingClientRect 屏幕像素与写入 less 的 left/top 不一致。
 */
function computeDomOffset(dom: HTMLElement): { x: number; y: number } {
  return {
    x: Math.round(dom.offsetLeft),
    y: Math.round(dom.offsetTop),
  }
}

function PositionInput({
  label,
  rawValue,
  cssKey,
  onChange,
  needsActivation,
  onActivate,
  computedValue,
}: {
  label: string
  rawValue: unknown
  cssKey: 'left' | 'top'
  onChange: ChangeEvent
  /**
   * 非自由定位且 left/top 无效时为 true。
   * 拖拽位移或输入改值时自动开启自由定位。
   */
  needsActivation: boolean
  /** 开启自由定位：一次性提交 position:absolute + 当前 X/Y */
  onActivate: () => void
  /** DOM 计算出的实际位置，用于无显式 CSS 值时的回显 */
  computedValue: string
}) {
  const hasExplicitValue = rawValue != null && String(rawValue) !== 'auto' && toDisplayValue(rawValue) !== ''
  const displayValue = hasExplicitValue ? toDisplayValue(rawValue) : computedValue

  const [localValue, setLocalValue] = useState(displayValue)
  const isEditingRef = useRef(false)
  /** 拖拽进行中时为 true，防止父组件 re-render 把 localValue 回写为旧的 computedValue */
  const isDraggingRef = useRef(false)
  /** 当前编辑/拖拽 session 是否已调用过 onActivate，避免重复激活 */
  const activatedRef = useRef(false)

  useEffect(() => {
    if (!isEditingRef.current && !isDraggingRef.current) {
      setLocalValue(displayValue)
    }
  }, [displayValue])

  // 自由定位已开启后，重置 session 标记，便于下次从文档流再进
  useEffect(() => {
    if (!needsActivation) {
      activatedRef.current = false
    }
  }, [needsActivation])

  const handleFocus = useCallback(() => {
    // 纯 focus 不开启自由定位，避免一点击输入框就脱离文档流
    isEditingRef.current = true
  }, [])

  const ensureActivated = useCallback(() => {
    if (needsActivation && !activatedRef.current) {
      activatedRef.current = true
      onActivate()
    }
  }, [needsActivation, onActivate])

  const handleChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value
    setLocalValue(val)
    const out = toOutputValue(val)
    if (out !== null) {
      // 数值真正变化时才开启自由定位
      ensureActivated()
      onChange({ key: cssKey, value: out })
    }
  }, [cssKey, onChange, ensureActivated])

  const handleBlur = useCallback((e: React.FocusEvent<HTMLInputElement>) => {
    isEditingRef.current = false
    isDraggingRef.current = false
    const val = e.target.value.trim()
    const out = toOutputValue(val)
    if (out !== null) {
      ensureActivated()
    }
    // 空值 → 清除显式 CSS，回到 DOM 计算值（不自动开启自由定位）
    onChange({ key: cssKey, value: out })
    setLocalValue(out === null ? computedValue : toDisplayValue(out))
  }, [cssKey, onChange, computedValue, ensureActivated])

  const getDragProps = useDragNumber({
    min: Number.NEGATIVE_INFINITY,
    sensitivity: 1,
    onDragStart: () => {
      isDraggingRef.current = true
      activatedRef.current = false
      if (needsActivation) {
        // 返回数字触发 useCustomEnd 模式，松手时走 onDragEnd 而非 focus/blur
        return parseFloat(computedValue) || 0
      }
    },
    onDragChange: (newVal) => {
      // 第一帧移动时激活（只触发一次）
      ensureActivated()
      setLocalValue(String(newVal))
      onChange({ key: cssKey, value: `${newVal}px` })
    },
    onDragEnd: (finalValue) => {
      isDraggingRef.current = false
      activatedRef.current = false
      onChange({ key: cssKey, value: `${finalValue}px` })
    },
  })

  return (
    <Panel.Item className={css.inputItem}>
      <div className={css.inputRow}>
        <span
          {...getDragProps(localValue, `拖拽调整 ${label}`)}
          className={css.dragLabel}
        >
          {label}
        </span>
        <input
          className={css.numberInput}
          type="text"
          inputMode="numeric"
          value={localValue}
          placeholder="默认"
          onChange={handleChange}
          onFocus={handleFocus}
          onBlur={handleBlur}
        />
      </div>
    </Panel.Item>
  )
}

export function Position({ value, onChange, showTitle }: PositionProps) {
  const leftVal = value?.left
  const topVal = value?.top
  const positionVal = (value as any)?.position
  const positionStr = positionVal != null ? String(positionVal) : 'static'

  const editorContext = useStyleEditorContext()
  const targetDom = editorContext?.targetDom ?? null
  const [domOffset, setDomOffset] = useState<{ x: number; y: number } | null>(null)
  /**
   * 切换瞬间的乐观状态。不能用 getComputedStyle 兜底高亮：
   * 取消后 value 已清掉，但 DOM/computed 可能短暂仍是 absolute，且之后无重渲染，高亮会卡住。
   */
  const [optimisticFree, setOptimisticFree] = useState<boolean | null>(null)

  const isFreeFromValue = FREE_POSITIONS.has(positionStr)
  const isFreePosition = optimisticFree ?? isFreeFromValue
  // static / 未设置：改 X/Y 时需自动开启自由定位
  const needsActivation = !(optimisticFree ?? EDITABLE_POSITIONS.has(positionStr))

  // value 回传与乐观状态对齐后，清除乐观标记
  useEffect(() => {
    if (optimisticFree == null) return
    if (optimisticFree === isFreeFromValue) {
      setOptimisticFree(null)
    }
  }, [optimisticFree, isFreeFromValue])

  useEffect(() => {
    if (!targetDom) {
      setDomOffset(null)
      return
    }
    const update = () => setDomOffset(computeDomOffset(targetDom))
    update()
    const observer = new ResizeObserver(update)
    observer.observe(targetDom)
    if (targetDom.offsetParent) {
      observer.observe(targetDom.offsetParent as Element)
    }
    return () => observer.disconnect()
  }, [targetDom])

  const computedX = domOffset != null ? String(domOffset.x) : ''
  const computedY = domOffset != null ? String(domOffset.y) : ''

  /** 开启自由定位：锁定当前 DOM 位置（点击瞬间重新计算，避免闭包旧值） */
  const handleActivate = useCallback(() => {
    const offset = targetDom ? computeDomOffset(targetDom) : { x: 0, y: 0 }
    setDomOffset(offset)
    setOptimisticFree(true)
    onChange([
      { key: 'position', value: 'absolute' },
      { key: 'left', value: `${offset.x}px` },
      { key: 'top', value: `${offset.y}px` },
    ])
  }, [onChange, targetDom])

  /** 取消自由定位：清理 position / left / top */
  const handleDeactivate = useCallback(() => {
    setOptimisticFree(false)
    onChange([
      { key: 'position', value: null },
      { key: 'left', value: null },
      { key: 'top', value: null },
    ])
  }, [onChange])

  return (
    <Panel
      title='位置'
      showTitle={false}
      showDelete={false}
      collapse={false}
    >
      <div className={css.headerRow}>
        {showTitle !== false && <div className={css.title}>位置</div>}
        <div className={css.modeSwitch}>
          <div
            className={`${css.modeOption} ${!isFreePosition ? css.modeOptionActive : ''}`}
            onClick={() => { if (isFreePosition) handleDeactivate() }}
          >
            默认
          </div>
          <div
            className={`${css.modeOption} ${isFreePosition ? css.modeOptionActive : ''}`}
            onClick={() => { if (!isFreePosition) handleActivate() }}
          >
            绝对定位
          </div>
        </div>
      </div>
      <Panel.Content>
        <PositionInput
          label='X'
          rawValue={leftVal}
          cssKey='left'
          onChange={onChange}
          needsActivation={needsActivation}
          onActivate={handleActivate}
          computedValue={computedX}
        />
        <PositionInput
          label='Y'
          rawValue={topVal}
          cssKey='top'
          onChange={onChange}
          needsActivation={needsActivation}
          onActivate={handleActivate}
          computedValue={computedY}
        />
      </Panel.Content>
    </Panel>
  )
}
