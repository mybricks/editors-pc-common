import React, { CSSProperties, useCallback, useLayoutEffect, useState } from 'react';

import {Panel, Select} from '../../components';
import { QuestionCircleOutlined } from '../../components/Icon/QuestionCircleOutlined';
import { useEffectiveStyleValue, useStyleChange, useStyleClear, useStyleEditorContext } from '../../context';
import { getOverflowAdjustment, OVERFLOW_AXIS_KEYS } from '../../../core/overflow';

import type {ChangeEvent, PanelBaseProps} from '../../type';
import css from './index.less'

type OverFlowValueType = Partial<{
  overflowX: CSSProperties['overflowX'];
  overflowY: CSSProperties['overflowY'];
}>;

export interface OverFlowProps extends PanelBaseProps {
  value: OverFlowValueType;
  onChange: ChangeEvent;
}

const VALUE_OPTIONS = [
  // {label: '默认', value: 'unset'},
  { label: '自动', value: 'auto' },
  { label: '显示滚动条', value: 'scroll' },
  { label: '隐藏内容', value: 'hidden' },
  { label: '显示内容', value: 'visible' }
];

const OVERFLOW_KEYS = ['overflow', 'overflowX', 'overflowY'] as const

export const OverFlow = ({ value: fallbackValue, onChange: fallbackOnChange, showTitle, collapse }: OverFlowProps) => {
  const editorContext = useStyleEditorContext()
  const effectiveValue = useEffectiveStyleValue() as OverFlowValueType
  const readValue = (key: keyof OverFlowValueType) => {
    if (editorContext?.getStyleProperty) {
      const winner = editorContext.getStyleProperty(key).winner
      if (!winner?.currentState || winner.value === 'unset') return undefined
      return winner.value.replace(/\s*!important\s*$/i, '') as CSSProperties['overflowX']
    }
    return (editorContext?.effectiveStyle ? effectiveValue : fallbackValue)[key]
  }
  const value = { overflowX: readValue('overflowX'), overflowY: readValue('overflowY') }
  const onChange = useStyleChange(fallbackOnChange)
  const { clear } = useStyleClear(OVERFLOW_KEYS, { mode: 'remove-declaration', fallbackOnChange })
  const [overflowValue, setOverflowValue] = useState<OverFlowValueType>(value)
  const [forceRenderKey, setForceRenderKey] = useState<number>(Math.random())

  // unset 会在回显层转换成 computedValue（通常是 visible），但它本身只是
  // 清空后用于屏蔽低优先级来源的中和值，不应因此把内容溢出面板展开。
  const overflowSources = OVERFLOW_KEYS.map((key) => editorContext?.effectiveStyle?.[key])
  const hasUnsetSource = overflowSources.some((item) =>
    typeof item?.value === 'string' && /^unset$/i.test(item.value.trim())
  )
  const hasConfiguredSource = overflowSources.some((item) =>
    item && item.type !== 'computed' && !(
      typeof item.value === 'string' && /^unset$/i.test(item.value.trim())
    )
  )
  const effectiveCollapse = collapse !== 'inherited' && hasUnsetSource && !hasConfiguredSource
    ? true
    : collapse

  useLayoutEffect(() => {
    setOverflowValue(value)
  }, [value.overflowX, value.overflowY, editorContext?.targetDom])

  const handleAxisChange = (key: keyof OverFlowValueType, next: CSSProperties['overflowX']) => {
    const result = onChange([{ key, value: next }])
    if (result && (result.clearUnsupported || !result.applied)) return
    setOverflowValue(current => ({ ...current, [key]: next }))
  }

  const readNoticeValue = (key: keyof OverFlowValueType) => {
    const declared = overflowValue[key] || editorContext?.getStyleProperty?.(key).winner?.value || 'visible'
    if (/^(initial|unset)$/.test(declared)) return 'visible'
    return declared
  }
  const axisTips = OVERFLOW_AXIS_KEYS.map((key, index) => {
    const otherKey = OVERFLOW_AXIS_KEYS[1 - index]
    const current = readNoticeValue(key)
    let other = readNoticeValue(otherKey)
    if (!['visible', 'clip', 'auto', 'scroll', 'hidden'].includes(other)) {
      other = editorContext?.getStylePreview?.(otherKey) || editorContext?.effectiveStyle?.[otherKey]?.computedValue || ''
    }
    const adjusted = getOverflowAdjustment(current, other)
    if (!adjusted) return undefined
    const direction = index === 0 ? '水平' : '垂直'
    const selected = current === 'clip' ? '裁剪内容' : '显示内容'
    const actual = adjusted === 'auto' ? '自动' : '隐藏内容'
    const configured = overflowValue[key] == null ? '当前为' : '设置为'
    return `${direction}${configured}“${selected}”，受另一方向影响，浏览器实际按“${actual}”处理。`
  })

  const refresh = useCallback(() => {
    if (!clear) return
    const result = clear()
    if (result?.clearUnsupported || (result && !result.applied)) return
    const next = {
      overflowX: editorContext?.getStyleProperty?.('overflowX').winner?.value as CSSProperties['overflowX'],
      overflowY: editorContext?.getStyleProperty?.('overflowY').winner?.value as CSSProperties['overflowY'],
    }
    setOverflowValue(next)
    setForceRenderKey(prev => prev + 1)
  }, [clear, editorContext?.getStyleProperty])

  return (
    <Panel title='内容溢出' showTitle={showTitle} showReset={true} showDelete={!!clear}
      resetFunction={refresh} collapse={effectiveCollapse}>
      <React.Fragment key={forceRenderKey}>
        <Panel.Content>
          {OVERFLOW_AXIS_KEYS.map((key, index) => (
            <Select
              key={key}
              prefix={
                <span className={css.tip} data-mybricks-tip={axisTips[index]}>
                  {index === 0 ? '水平' : '垂直'}
                  {axisTips[index] && <span className={css.tipIcon}><QuestionCircleOutlined /></span>}
                </span>
              }
              value={overflowValue[key]}
              placeholder='默认'
              labelStyle={overflowValue[key] == null ? { color: '#333333', opacity: 1 } : undefined}
              options={VALUE_OPTIONS}
              onChange={(val) => handleAxisChange(key, val)}
            />
          ))}
        </Panel.Content>
      </React.Fragment>
    </Panel>
  )
}
