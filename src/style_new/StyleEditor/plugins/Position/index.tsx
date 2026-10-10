import React, { CSSProperties, useCallback, useEffect, useMemo, useState } from 'react'

import { Panel, InputNumber } from '../../components'
import { useEffectiveStyleValue, useStyleChange, useStyleEditorContext } from '../../context'
import { useDragNumber } from '../../hooks'
import { useStyleDisplayValue } from '../../hooks/useStyleDisplayValue'
import { collectZoneTabs, mergeZoneTabsByState } from '../../../core/zone-tab'
import { createStyleResolution } from '../../../core/style-property'

import type { ChangeEvent, PanelBaseProps } from '../../type'

import css from './index.less'
import lang from '../../../index.i18n'

interface PositionProps extends PanelBaseProps {
  value: CSSProperties
  onChange: ChangeEvent
}

/** 偏移属性本身已可编辑的 position（无需再切 absolute） */
const EDITABLE_POSITIONS = new Set(['absolute', 'fixed', 'relative', 'sticky'])
/** 自由定位：按钮高亮，可一键取消 */
const FREE_POSITIONS = new Set(['absolute', 'fixed'])
const POSITION_UNIT_OPTIONS = [
  { label: '默认', value: 'default' },
  {label: '', value: '—divider_', type: 'divider'},
  { label: 'px', value: 'px' },
  { label: '%', value: '%' },
]
const POSITION_UNIT_SELECT_STYLE: CSSProperties = {
  background: 'transparent',
}

/** 未声明或使用默认值时让输入框保持空白。 */
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
  previewValue,
  tip,
  cssKey,
  onChange,
  needsActivation,
  onActivate,
}: {
  label: string
  tip: string
  rawValue: unknown
  previewValue?: string
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
  const dragValue = toInputValue(rawValue) ?? toInputValue(previewValue)

  const handleChange = useCallback((nextValue: string | null) => {
    if (nextValue == null || nextValue?.includes('default')) {
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
      onChange({ key: cssKey, value: `${newVal}${String(dragValue).trim().endsWith('%') ? '%' : 'px'}` })
    },
  })

  return (
    <InputNumber
      style={{ flex: 1, minWidth: 0, paddingRight: '6px' }}
      prefix={(
        <span
          {...(!isLocked ? dragProps(dragValue, `${lang.dragPosition} ${label}`) : {})}
          className={`${css.dragLabel} ${isLocked ? css.dragLabelDisabled : ''}`}
        >
          {label}
        </span>
      )}
      tip={tip}
      value={toInputValue(rawValue)}
      previewValue={toInputValue(previewValue)}
      defaultValue={toInputValue(rawValue)}
      defaultUnitValue='px'
      unitOptions={POSITION_UNIT_OPTIONS}
      unitDisabledList={['default']}
      unitSelectStyle={POSITION_UNIT_SELECT_STYLE}
      placeholder=''
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

export function Position({ value: panelValue, onChange: fallbackOnChange, showTitle }: PositionProps) {
  const editorContext = useStyleEditorContext();
  const effectiveValue = useEffectiveStyleValue();
  const options = editorContext?.editConfig.options;
  const zoneTab = options && !Array.isArray(options) && "zoneTab" in options ? options.zoneTab : null;
  const hasZoneTab = !!zoneTab;
  const isPseudoState = !!zoneTab?.pseudo && !zoneTab.pseudo.startsWith('::');
  // 非 Zone 模式（如单独编辑）的回显值来自 props，effectiveStyle 在此模式下为空。
  const value = hasZoneTab ? effectiveValue : panelValue;
  const positionField = useStyleDisplayValue('position');
  const topField = useStyleDisplayValue('top');
  const rightField = useStyleDisplayValue('right');
  const bottomField = useStyleDisplayValue('bottom');
  const leftField = useStyleDisplayValue('left');
  const [leftVal, setLeftVal] = useState(value?.left)
  const [topVal, setTopVal] = useState(value?.top)
  const [rightVal, setRightVal] = useState(value?.right)
  const [bottomVal, setBottomVal] = useState(value?.bottom)
  const onChange = useStyleChange(fallbackOnChange);

  const positionVal = value?.position ?? (isPseudoState ? positionField.computedPreview : undefined)
  const positionStr = positionVal != null ? String(positionVal) : 'static'

  const targetDom = editorContext?.targetDom ?? null
  const offsetPreview = useMemo(() => {
    if (!isPseudoState || !targetDom?.isConnected || !zoneTab) return null
    // 新增伪类尚无 CSS 规则，Tab 的基础规则可能早于上一次编辑；位置预览单独读取最新常规声明。
    const selectors = [zoneTab.baseSelector, ...Array.from(targetDom.classList, name => '.' + name)]
    const normalTab = mergeZoneTabsByState(collectZoneTabs([targetDom], selectors, (options as any)?.comId))
      .find(tab => !tab.pseudo)
    if (!normalTab) return null
    const resolution = createStyleResolution(normalTab, targetDom)
    return Object.fromEntries(['top', 'right', 'bottom', 'left'].map(key => {
      const declaration = editorContext?.effectiveStyle?.[key]
      return [key, declaration && declaration.type !== 'computed' ? undefined : resolution.get(key).winner?.value]
    }))
  }, [zoneTab, targetDom, options, editorContext?.effectiveStyle])
  /**
   * 切换瞬间的乐观状态。不能用 getComputedStyle 兜底高亮：
   * 取消后 value 已清掉，但 DOM/computed 可能短暂仍是 absolute，且之后无重渲染，高亮会卡住。
   */
  const [optimisticFree, setOptimisticFree] = useState<boolean | null>(null)

  const isFreeFromValue = FREE_POSITIONS.has(positionStr)
  // 伪类未配置时仍可能沿用基础态定位，清空不能把只读预览锁成“默认”。
  const isFreePosition = isPseudoState ? isFreeFromValue : optimisticFree ?? isFreeFromValue
  // static / 未设置：修改偏移时需自动开启自由定位
  const needsActivation = !(isPseudoState ? EDITABLE_POSITIONS.has(positionStr) : optimisticFree ?? EDITABLE_POSITIONS.has(positionStr))

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

  /** 取消自由定位：伪类显式覆盖基础态定位，并清理四个偏移属性 / zIndex。 */
  const handleDeactivate = useCallback(() => {
    setOptimisticFree(false)
    onChange([
      { key: 'position', value: isPseudoState ? 'static' : null },
      { key: 'top', value: null },
      { key: 'right', value: null },
      { key: 'bottom', value: null },
      { key: 'left', value: null },
      { key: 'zIndex', value: null },
    ])
  }, [isPseudoState, onChange])

  return (
    <Panel
      title={lang.positionPanelTitle}
      showTitle={false}
      showDelete={false}
      collapse={false}
      // keepTopBorder={!isFreePosition}
    >
      <div className={css.headerRow}>
        {showTitle !== false && <div className={css.title}>{lang.positionPanelTitle}</div>}
        <div className={css.modeSwitch}>
          <div
            className={`${css.modeOption} ${!isFreePosition ? css.modeOptionActive : ''}`}
            onClick={() => { if (isFreePosition) handleDeactivate() }}
          >
            {lang.positionDefault}
          </div>
          <div
            className={`${css.modeOption} ${isFreePosition ? css.modeOptionActive : ''}`}
            onClick={() => { if (!isFreePosition) handleActivate() }}
          >
            {lang.positionAbsolute}
          </div>
        </div>
      </div>
      {isFreePosition && (
        <>
          <Panel.Content>
            <PositionInput
              label={lang.positionTopLabel}
              tip='相对顶部定位'
              rawValue={topVal}
              previewValue={isPseudoState ? offsetPreview ? offsetPreview.top : topField.computedPreview : undefined}
              cssKey='top'
              onChange={onChange}
              needsActivation={needsActivation}
              onActivate={handleActivate}
            />
            <PositionInput
              label={lang.positionRightLabel}
              tip='相对右侧定位'
              rawValue={rightVal}
              previewValue={isPseudoState ? offsetPreview ? offsetPreview.right : rightField.computedPreview : undefined}
              cssKey='right'
              onChange={onChange}
              needsActivation={needsActivation}
              onActivate={handleActivate}
            />
          </Panel.Content>
          <Panel.Content>
            <PositionInput
              label={lang.positionBottomLabel}
              tip='相对底部定位'
              rawValue={bottomVal}
              previewValue={isPseudoState ? offsetPreview ? offsetPreview.bottom : bottomField.computedPreview : undefined}
              cssKey='bottom'
              onChange={onChange}
              needsActivation={needsActivation}
              onActivate={handleActivate}
            />
            <PositionInput
              label={lang.positionLeftLabel}
              tip='相对左侧定位'
              rawValue={leftVal}
              previewValue={isPseudoState ? offsetPreview ? offsetPreview.left : leftField.computedPreview : undefined}
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
