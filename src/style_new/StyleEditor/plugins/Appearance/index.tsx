import React, { CSSProperties, useCallback, useMemo, useState } from 'react'

import {
  Panel,
  InputNumber,
  BorderRadiusSplitOutlined,
  BorderTopLeftRadiusOutlined,
  BorderTopRightRadiusOutlined,
  BorderBottomLeftRadiusOutlined,
  BorderBottomRightRadiusOutlined,
} from '../../components'
import { Opacity as OpacityIcon } from '../../icons/Opacity'
import { allEqual } from '../../utils'
import { useUpdateEffect } from '../../hooks'
import { useDragNumber } from '../../hooks/useDragNumber'

import type { ChangeEvent, PanelBaseProps } from '../../type'

import css from './index.less'

interface AppearanceProps extends PanelBaseProps {
  value: CSSProperties
  onChange: ChangeEvent
}

const DEFAULT_CONFIG = {
  useImportant: false,
}

const RADIUS_UNIT_OPTIONS = [
  { label: 'px', value: 'px' },
  { label: '%', value: '%' },
]

/** 将 CSS opacity (0~1) 转换为百分比整数 (0~100) */
function opacityToPercent(opacity: any): number {
  const n = parseFloat(opacity)
  if (isNaN(n)) return 100
  return Math.round(n * 100)
}

/** 将百分比整数 (0~100) 转换为 CSS opacity */
function percentToOpacity(percent: number): number {
  return Math.min(1, Math.max(0, percent / 100))
}

/** 获取圆角的切换初始值 */
function getRadiusMode(value: CSSProperties): 'all' | 'split' {
  return allEqual([
    value.borderTopLeftRadius,
    value.borderTopRightRadius,
    value.borderBottomRightRadius,
    value.borderBottomLeftRadius,
  ])
    ? 'all'
    : 'split'
}

/** 去除 !important 后缀 */
function stripImportant(val: any): any {
  if (typeof val === 'string') return val.replace(/!.*$/, '')
  return val
}

export function Appearance({ value, onChange, config, showTitle, collapse }: AppearanceProps) {
  const [{ useImportant }] = useState({ ...DEFAULT_CONFIG, ...config })
  const [splitRadiusSyncKey, setSplitRadiusSyncKey] = useState(0)

  // ─── Opacity state ───────────────────────────────────────────────────────
  const [opacityForceKey, setOpacityForceKey] = useState(0)

  const opacityPercent = useMemo(() => {
    return opacityToPercent(value?.opacity)
  }, [value?.opacity])

  const handleOpacityChange = useCallback(
    (val: string) => {
      const num = parseFloat(val)
      if (!isNaN(num)) {
        onChange({ key: 'opacity', value: percentToOpacity(num) })
      }
    },
    [onChange]
  )
  const getDragPropsOpacity = useDragNumber({
    min: 0,
    max: 100,
    onDragStart: currentValue => {
      const parsed = parseFloat(currentValue)
      return isNaN(parsed) ? opacityPercent : parsed
    },
    onDragChange: value => {
      handleOpacityChange(String(value))
    },
    onDragEnd: finalValue => {
      handleOpacityChange(String(finalValue))
    },
  })

  // ─── Radius state ────────────────────────────────────────────────────────
  const defaultRadiusValue = useMemo(() => {
    const defaultValue = Object.assign({}, value)
    Object.entries(defaultValue).forEach(([key, v]) => {
      if (typeof v === 'string') {
        // @ts-ignore
        defaultValue[key] = v.replace(/!.*$/, '')
      }
    })
    return defaultValue
  }, [])

  const [radiusValue, setRadiusValue] = useState(defaultRadiusValue)
  const [radiusMode, setRadiusMode] = useState<'all' | 'split'>(() => getRadiusMode(value))

  // 分离模式下圆角汇总显示：全等则显示值，否则为 undefined（显示占位符"混合"）
  const mixedRadiusValue = useMemo(() => {
    const vals = [
      stripImportant(radiusValue.borderTopLeftRadius),
      stripImportant(radiusValue.borderTopRightRadius),
      stripImportant(radiusValue.borderBottomRightRadius),
      stripImportant(radiusValue.borderBottomLeftRadius),
    ]
    return allEqual(vals) ? vals[0] : undefined
  }, [radiusValue])
  const isMixedRadius = mixedRadiusValue === undefined

  const handleRadiusChange = useCallback(
    (updates: CSSProperties & Record<string, any>) => {
      setRadiusValue(prev => ({ ...prev, ...updates }))
      onChange(
        Object.keys(updates).map(key => ({
          key,
          value: `${updates[key]}${useImportant ? '!important' : ''}`,
        }))
      )
    },
    [onChange, useImportant]
  )
  const getRadiusDragUnit = useCallback(() => {
    const base = String(stripImportant(radiusValue.borderTopLeftRadius ?? '')).trim()
    const parsed = parseFloat(base)
    if (!base || isNaN(parsed)) return 'px'
    const unit = base.replace(String(parsed), '').trim()
    return unit || 'px'
  }, [radiusValue.borderTopLeftRadius])

  const emitUnifiedRadiusByDrag = useCallback(
    (nextNumber: number, syncLocalState: boolean) => {
      const nextValue = `${nextNumber}${getRadiusDragUnit()}`
      const updates = {
        borderTopLeftRadius: nextValue,
        borderTopRightRadius: nextValue,
        borderBottomLeftRadius: nextValue,
        borderBottomRightRadius: nextValue,
      }

      if (syncLocalState) {
        handleRadiusChange(updates)
        setSplitRadiusSyncKey(k => k + 1)
        return
      }

      // 分开模式拖拽中仅做预览：更新样式但不立刻刷新下方四个输入框，避免闪动
      onChange(
        Object.keys(updates).map(key => ({
          key,
          value: `${updates[key as keyof typeof updates]}${useImportant ? '!important' : ''}`,
        }))
      )
    },
    [getRadiusDragUnit, handleRadiusChange, onChange, useImportant]
  )

  const getDragPropsRadiusAll = useDragNumber({ min: 0, continuous: true })
  const getDragPropsRadiusCorner = useDragNumber({ min: 0, continuous: true })
  const getDragPropsRadiusSplit = useDragNumber({
    min: 0,
    onDragStart: currentValue => {
      const parsed = parseFloat(currentValue)
      if (!isNaN(parsed)) return parsed
      return parseFloat(stripImportant(radiusValue.borderTopLeftRadius)) || 0
    },
    onDragChange: value => {
      emitUnifiedRadiusByDrag(value, false)
    },
    onDragEnd: finalValue => {
      emitUnifiedRadiusByDrag(finalValue, true)
    },
  })

  // 切换到分离模式时，将统一值同步到各角
  useUpdateEffect(() => {
    if (radiusMode === 'split') {
      handleRadiusChange({
        borderTopLeftRadius: radiusValue.borderTopLeftRadius,
        borderTopRightRadius: radiusValue.borderTopLeftRadius,
        borderBottomLeftRadius: radiusValue.borderTopLeftRadius,
        borderBottomRightRadius: radiusValue.borderTopLeftRadius,
      })
    }
  }, [radiusMode])

  // ─── Reset ───────────────────────────────────────────────────────────────
  const handleReset = useCallback(() => {
    onChange([
      { key: 'opacity', value: null },
      { key: 'borderTopLeftRadius', value: null },
      { key: 'borderTopRightRadius', value: null },
      { key: 'borderBottomLeftRadius', value: null },
      { key: 'borderBottomRightRadius', value: null },
    ])
    setOpacityForceKey(k => k + 1)
  }, [onChange])

  // ─── 主行（opacity + 圆角），统一/分离模式共用 ─────────────────
  const mainRow = (
    <Panel.Content style={{ paddingTop: 0 }}>
      {/* 不透明度输入 */}
      <Panel.Item className={css.inputItem}>
        <span
          className={`${css.inputIcon} ${css.opacityIcon}`}
          {...getDragPropsOpacity(opacityPercent, "{content:'拖拽调整不透明度',position:'left'}")}
        >
          <OpacityIcon />
        </span>
        <input
          key={opacityForceKey}
          type='number'
          className={css.opacityInput}
          defaultValue={opacityPercent}
          min={0}
          max={100}
          step={1}
          onBlur={e => handleOpacityChange(e.target.value)}
          onKeyDown={e => {
            if (e.key === 'Enter') {
              handleOpacityChange((e.target as HTMLInputElement).value)
            }
          }}
        />
        <span className={css.percentSuffix}>%</span>
      </Panel.Item>

      {/* 圆角输入（统一模式）或汇总显示（分离模式） */}
      <Panel.Item className={css.inputItem} style={{ flex: 1 }}>
        <span
          className={css.inputIcon}
          {...(radiusMode === 'split' ? getDragPropsRadiusSplit : getDragPropsRadiusAll)(
            stripImportant(radiusValue.borderTopLeftRadius),
            radiusMode === 'all'
              ? "{content:'拖拽调整圆角半径',position:'left'}"
              : "{content:'拖拽统一调整各圆角',position:'left'}"
          )}
        >
          <BorderRadiusSplitOutlined />
        </span>
        {radiusMode === 'all' ? (
          <InputNumber
            key='radius-all'
            style={{ flex: 1, minWidth: 0, marginLeft: 2 }}
            value={stripImportant(radiusValue.borderTopLeftRadius)}
            defaultUnitValue='px'
            unitOptions={RADIUS_UNIT_OPTIONS}
            onChange={val =>
              handleRadiusChange({
                borderTopLeftRadius: val,
                borderTopRightRadius: val,
                borderBottomLeftRadius: val,
                borderBottomRightRadius: val,
              })
            }
          />
        ) : (
          <InputNumber
            key={`radius-mixed-${isMixedRadius ? 'mixed' : 'same'}`}
            style={{ flex: 1, minWidth: 0, marginLeft: 2 }}
            value={isMixedRadius ? undefined : mixedRadiusValue}
            placeholder='mix'
            defaultUnitValue='px'
            unitOptions={RADIUS_UNIT_OPTIONS}
            onChange={val => {
              handleRadiusChange({
                borderTopLeftRadius: val,
                borderTopRightRadius: val,
                borderBottomLeftRadius: val,
                borderBottomRightRadius: val,
              })
              setSplitRadiusSyncKey(k => k + 1)
            }}
          />
        )}
      </Panel.Item>

    </Panel.Content>
  )

  return (
    <Panel
      title='外观'
      showTitle={showTitle}
      showReset={true}
      showDelete={false}
      resetFunction={handleReset}
      collapse={false}
      rightColumn={
        <div className={css.actionsColumn}>
          <button
            className={`${css.toggleBtn} ${radiusMode === 'split' ? css.toggleBtnActive : ''}`}
            data-mybricks-tip={`{content:'${radiusMode === 'all' ? '分别编辑各圆角' : '统一编辑圆角'}',position:'left'}`}
            onClick={() => setRadiusMode(prev => (prev === 'all' ? 'split' : 'all'))}
          >
            <BorderRadiusSplitOutlined />
          </button>
        </div>
      }
    >
      {mainRow}

      {/* 分离模式：展开四个角的输入（对齐 Border 独立圆角布局） */}
      {radiusMode === 'split' && (
        <div className={css.independentBox}>
          <div className={css.col}>
            <div className={css.row}>
              <Panel.Content style={{ padding: '2px 3px 4px' }}>
                <Panel.Item className={css.editArea} style={{ padding: '0 8px', flex: 1 }}>
                  <span
                    className={css.inputIcon}
                    {...getDragPropsRadiusCorner(
                      stripImportant(radiusValue.borderTopLeftRadius),
                      "{content:'拖拽调整左上圆角',position:'left'}"
                    )}
                  >
                    <BorderTopLeftRadiusOutlined />
                  </span>
                  <InputNumber
                    key={`split-tl-${splitRadiusSyncKey}`}
                    style={{ flex: 1, minWidth: 0, marginLeft: 2 }}
                    value={stripImportant(radiusValue.borderTopLeftRadius)}
                    defaultUnitValue='px'
                    unitOptions={RADIUS_UNIT_OPTIONS}
                    onChange={val => handleRadiusChange({ borderTopLeftRadius: val })}
                  />
                </Panel.Item>
                <Panel.Item className={css.editArea} style={{ padding: '0 8px', flex: 1 }}>
                  <InputNumber
                    key={`split-tr-${splitRadiusSyncKey}`}
                    align='right'
                    style={{ flex: 1, minWidth: 0, marginRight: 2 }}
                    value={stripImportant(radiusValue.borderTopRightRadius)}
                    defaultUnitValue='px'
                    unitOptions={RADIUS_UNIT_OPTIONS}
                    onChange={val => handleRadiusChange({ borderTopRightRadius: val })}
                  />
                  <span
                    className={css.inputIcon}
                    {...getDragPropsRadiusCorner(
                      stripImportant(radiusValue.borderTopRightRadius),
                      "{content:'拖拽调整右上圆角',position:'left'}"
                    )}
                  >
                    <BorderTopRightRadiusOutlined />
                  </span>
                </Panel.Item>
              </Panel.Content>
            </div>
            <div className={css.row}>
              <Panel.Content style={{ padding: '2px 3px 4px' }}>
                <Panel.Item className={css.editArea} style={{ padding: '0 8px', flex: 1 }}>
                  <span
                    className={css.inputIcon}
                    {...getDragPropsRadiusCorner(
                      stripImportant(radiusValue.borderBottomLeftRadius),
                      "{content:'拖拽调整左下圆角',position:'left'}"
                    )}
                  >
                    <BorderBottomLeftRadiusOutlined />
                  </span>
                  <InputNumber
                    key={`split-bl-${splitRadiusSyncKey}`}
                    style={{ flex: 1, minWidth: 0, marginLeft: 2 }}
                    value={stripImportant(radiusValue.borderBottomLeftRadius)}
                    defaultUnitValue='px'
                    unitOptions={RADIUS_UNIT_OPTIONS}
                    onChange={val => handleRadiusChange({ borderBottomLeftRadius: val })}
                  />
                </Panel.Item>
                <Panel.Item className={css.editArea} style={{ padding: '0 8px', flex: 1 }}>
                  <InputNumber
                    key={`split-br-${splitRadiusSyncKey}`}
                    align='right'
                    style={{ flex: 1, minWidth: 0, marginRight: 2 }}
                    value={stripImportant(radiusValue.borderBottomRightRadius)}
                    defaultUnitValue='px'
                    unitOptions={RADIUS_UNIT_OPTIONS}
                    onChange={val => handleRadiusChange({ borderBottomRightRadius: val })}
                  />
                  <span
                    className={css.inputIcon}
                    {...getDragPropsRadiusCorner(
                      stripImportant(radiusValue.borderBottomRightRadius),
                      "{content:'拖拽调整右下圆角',position:'left'}"
                    )}
                  >
                    <BorderBottomRightRadiusOutlined />
                  </span>
                </Panel.Item>
              </Panel.Content>
            </div>
          </div>
        </div>
      )}
    </Panel>
  )
}
