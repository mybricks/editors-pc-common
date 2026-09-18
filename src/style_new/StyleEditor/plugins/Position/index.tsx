import React, { CSSProperties, useCallback, useEffect, useState } from 'react'

import { Panel, InputNumber } from '../../components'
import { useStyleEditorContext } from '../../context'
import { useDragNumber } from '../../hooks'

import type { ChangeEvent, PanelBaseProps } from '../../type'

import css from './index.less'

interface PositionProps extends PanelBaseProps {
  value: CSSProperties
  onChange: ChangeEvent
}

/** 偏移属性本身已可编辑的 position（无需再切 absolute） */
const EDITABLE_POSITIONS = new Set(['absolute', 'fixed', 'relative', 'sticky'])
/** 自由定位：按钮高亮，可一键取消 */
const FREE_POSITIONS = new Set(['absolute', 'fixed'])
const POSITION_UNIT_OPTIONS = [
  { label: 'px', value: 'px' },
  { label: '%', value: '%' },
]
const POSITION_UNIT_SELECT_STYLE: CSSProperties = {
  background: 'transparent',
}

/** 未声明或使用默认值时交给 InputNumber 通过 placeholder 显示「默认」。 */
function toInputValue(value: unknown): string | undefined {
  if (value == null || value === '' || value === 'auto' || value === 'inherit') {
    return undefined
  }
  return typeof value === 'number' ? `${value}px` : String(value)
}

/**
 * 计算元素相对 offsetParent（即 absolute 定位上下文）的偏移。
 * 使用 offsetLeft/offsetTop（布局 CSS 像素），避免画布 transform:scale 下
 * getBoundingClientRect 屏幕像素与写入 less 的 CSS 偏移值不一致。
 */
function computeDomOffset(dom: HTMLElement): { top: number; left: number } {
  return {
    top: Math.round(dom.offsetTop),
    left: Math.round(dom.offsetLeft),
  }
}

function computeDomSize(dom: HTMLElement): { width: number; height: number } {
  return {
    width: Math.round(dom.offsetWidth),
    height: Math.round(dom.offsetHeight),
  }
}

function isUnconfiguredSize(value: unknown): boolean {
  return value == null || value === '' || value === 'auto' || value === 'inherit'
}

type PositionDirection = 'top' | 'right' | 'bottom' | 'left'

function PositionInput({
  label,
  rawValue,
  cssKey,
  onChange,
  needsActivation,
  onActivate,
}: {
  label: string
  rawValue: unknown
  cssKey: PositionDirection
  onChange: ChangeEvent
  /**
   * 非自由定位且偏移属性无效时为 true。
   * 拖拽位移或输入改值时自动开启自由定位。
   */
  needsActivation: boolean
  /** 开启自由定位：一次性提交 position:absolute + 当前偏移 */
  onActivate: () => void
}) {
  const isLocked = needsActivation

  const handleChange = useCallback((nextValue: string | null) => {
    if (nextValue == null) {
      onChange({ key: cssKey, value: null })
      return
    }
    if (needsActivation) onActivate()
    onChange({ key: cssKey, value: nextValue })
  }, [cssKey, needsActivation, onActivate, onChange])

  const dragProps = useDragNumber({
    min: Number.NEGATIVE_INFINITY,
    sensitivity: 1,
    onDragChange: (newVal) => {
      if (needsActivation) onActivate()
      onChange({ key: cssKey, value: `${newVal}${String(rawValue).trim().endsWith('%') ? '%' : 'px'}` })
    },
  })

  return (
    <InputNumber
      style={{ flex: 1, minWidth: 0 }}
      prefix={(
        <span
          {...(!isLocked ? dragProps(toInputValue(rawValue), `拖拽调整 ${label}`) : {})}
          className={`${css.dragLabel} ${isLocked ? css.dragLabelDisabled : ''}`}
        >
          {label}
        </span>
      )}
      value={toInputValue(rawValue)}
      defaultValue={toInputValue(rawValue)}
      defaultUnitValue='px'
      unitOptions={POSITION_UNIT_OPTIONS}
      unitSelectStyle={POSITION_UNIT_SELECT_STYLE}
      placeholder='默认'
      allowNegative
      showIcon
      showIconOnHover
      unitHideLabelList={['px']}
      disabled={isLocked}
      clearable={!isLocked}
      onClear={() => onChange({ key: cssKey, value: null })}
      onChange={handleChange}
    />
  )
}

export function Position({ value, onChange, showTitle }: PositionProps) {
  const [leftVal, setLeftVal] = useState(value?.left)
  const [topVal, setTopVal] = useState(value?.top)
  const [rightVal, setRightVal] = useState(value?.right)
  const [bottomVal, setBottomVal] = useState(value?.bottom)

  const positionVal = (value as any)?.position
  const positionStr = positionVal != null ? String(positionVal) : 'static'

  const editorContext = useStyleEditorContext()
  const targetDom = editorContext?.targetDom ?? null
  /**
   * 切换瞬间的乐观状态。不能用 getComputedStyle 兜底高亮：
   * 取消后 value 已清掉，但 DOM/computed 可能短暂仍是 absolute，且之后无重渲染，高亮会卡住。
   */
  const [optimisticFree, setOptimisticFree] = useState<boolean | null>(null)

  const isFreeFromValue = FREE_POSITIONS.has(positionStr)
  const isFreePosition = optimisticFree ?? isFreeFromValue
  // static / 未设置：修改偏移时需自动开启自由定位
  const needsActivation = !(optimisticFree ?? EDITABLE_POSITIONS.has(positionStr))

  // value 回传与乐观状态对齐后，清除乐观标记
  useEffect(() => {
    if (optimisticFree == null) return
    if (optimisticFree === isFreeFromValue) {
      setOptimisticFree(null)
    }
  }, [optimisticFree, isFreeFromValue])

  useEffect(() => {
    setLeftVal(value?.left)
    setTopVal(value?.top)
    setRightVal(value?.right)
    setBottomVal(value?.bottom)
  }, [value?.left, value?.top, value?.right, value?.bottom])

  /** 开启自由定位：锁定当前 DOM 位置（点击瞬间重新计算，避免闭包旧值） */
  const handleActivate = useCallback(() => {
    const offset = targetDom
      ? computeDomOffset(targetDom)
      : { top: 0, left: 0 }
    const size = targetDom ? computeDomSize(targetDom) : null
    const changes = [
      { key: 'position', value: 'absolute' },
      { key: 'left', value: `${offset.left}px` },
      { key: 'top', value: `${offset.top}px` },
    ]
    if (size && isUnconfiguredSize(value.width)) {
      changes.push({ key: 'width', value: `${size.width}px` })
    }
    if (size && isUnconfiguredSize(value.height)) {
      changes.push({ key: 'height', value: `${size.height}px` })
    }
    setOptimisticFree(true)
    onChange(changes)
    setLeftVal(`${offset.left}px`)
    setTopVal(`${offset.top}px`)
  }, [onChange, targetDom, value.height, value.width])

  /** 取消自由定位：清理 position 及四个偏移属性 / zIndex */
  const handleDeactivate = useCallback(() => {
    setOptimisticFree(false)
    onChange([
      { key: 'position', value: null },
      { key: 'top', value: null },
      { key: 'right', value: null },
      { key: 'bottom', value: null },
      { key: 'left', value: null },
      { key: 'zIndex', value: null },
    ])
  }, [onChange])

  return (
    <Panel
      title='位置'
      showTitle={false}
      showDelete={false}
      collapse={false}
      keepTopBorder={!isFreePosition}
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
            自由定位
          </div>
        </div>
      </div>
      {isFreePosition && (
        <>
          <Panel.Content>
            <PositionInput
              label='上'
              rawValue={topVal}
              cssKey='top'
              onChange={onChange}
              needsActivation={needsActivation}
              onActivate={handleActivate}
            />
            <PositionInput
              label='右'
              rawValue={rightVal}
              cssKey='right'
              onChange={onChange}
              needsActivation={needsActivation}
              onActivate={handleActivate}
            />
          </Panel.Content>
          <Panel.Content>
            <PositionInput
              label='下'
              rawValue={bottomVal}
              cssKey='bottom'
              onChange={onChange}
              needsActivation={needsActivation}
              onActivate={handleActivate}
            />
            <PositionInput
              label='左'
              rawValue={leftVal}
              cssKey='left'
              onChange={onChange}
              needsActivation={needsActivation}
              onActivate={handleActivate}
            />
          </Panel.Content>
        </>
      )}
    </Panel>
  )
}
