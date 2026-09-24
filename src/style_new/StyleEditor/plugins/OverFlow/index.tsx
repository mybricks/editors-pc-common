import React, { CSSProperties, useCallback, useLayoutEffect, useRef, useState } from 'react';

import {Panel, Select} from '../../components';
import { useEffectiveStyleValue, useStyleChange, useStyleClear, useStyleEditorContext } from '../../context';

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

export const OverFlow = ({ onChange: fallbackOnChange, showTitle, collapse }: OverFlowProps) => {
  const editorContext = useStyleEditorContext()
  const value = useEffectiveStyleValue() as OverFlowValueType
  const onChange = useStyleChange(fallbackOnChange)
  const { clear } = useStyleClear(OVERFLOW_KEYS, { mode: 'remove-declaration', fallbackOnChange })
  const [overflowX, setOverflowX] = useState(value.overflowX)
  const [overflowY, setOverflowY] = useState(value.overflowY)
  const overflowValueRef = useRef<OverFlowValueType>({...value})
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
    overflowValueRef.current = {...value}
    setOverflowX(value.overflowX)
    setOverflowY(value.overflowY)
  }, [value.overflowX, value.overflowY])

  const emitOverflow = (next: OverFlowValueType) => {
    overflowValueRef.current = next
    setOverflowX(next.overflowX)
    setOverflowY(next.overflowY)
    const keys = ['overflowX', 'overflowY'] as const
    onChange(keys.map((key) => ({key, value: next[key] ?? null})))
  }

  const overflowXChange = (val: CSSProperties['overflowX']) => {
    const next: OverFlowValueType = {
      overflowY: overflowValueRef.current.overflowY ?? 'visible',
      overflowX: val,
    }

    //显示和隐藏需要x、y轴同时联动生效
    if (val === 'visible') {
      next.overflowY = 'visible'
    }

    if (val === 'hidden') {
      next.overflowY = 'hidden'
    }

    if (val === 'scroll' && next.overflowY === 'visible') {
      next.overflowY = 'auto'
    }
    emitOverflow(next)
  }

  const overflowYChange = (val: CSSProperties['overflowY']) => {
    const next: OverFlowValueType = {
      overflowX: overflowValueRef.current.overflowX ?? 'visible',
      overflowY: val,
    }

    //显示和隐藏需要x、y轴同时联动生效
    if (val === 'visible') {
      next.overflowX = 'visible'
    }

    if (val === 'hidden') {
      next.overflowX = 'hidden'
    }

    if (val === 'scroll' && next.overflowX === 'visible') {
      next.overflowX = 'auto'
    }
    emitOverflow(next)
  }

  const refresh = useCallback(() => {
    if (!clear) return
    const result = clear()
    if (result?.clearUnsupported || (result && !result.applied)) return
    const next = {
      overflowX: editorContext?.getStyleProperty?.('overflowX').winner?.value as CSSProperties['overflowX'],
      overflowY: editorContext?.getStyleProperty?.('overflowY').winner?.value as CSSProperties['overflowY'],
    }
    overflowValueRef.current = next
    setOverflowX(next.overflowX)
    setOverflowY(next.overflowY)
    setForceRenderKey(prev => prev + 1)
  }, [clear, editorContext?.getStyleProperty])

  return (
    <Panel title='内容溢出' showTitle={showTitle} showReset={true} showDelete={!!clear}
      resetFunction={refresh} collapse={effectiveCollapse}>
      <React.Fragment key={forceRenderKey}>
        <Panel.Content>
          <Select
            prefix={<span className={css.tip}>水平</span>}
            // style={{padding: 0}}
            // defaultValue={overflowX}
            value={overflowX}
            options={VALUE_OPTIONS}
            onChange={(val) => overflowXChange(val)}
          />
          <Select
            prefix={<span className={css.tip}>垂直</span>}
            // style={{padding: 0}}
            // defaultValue={overflowY}
            value={overflowY}
            options={VALUE_OPTIONS}
            onChange={(val) => overflowYChange(val)}
          />
        </Panel.Content>
      </React.Fragment>
    </Panel>
  )
}
