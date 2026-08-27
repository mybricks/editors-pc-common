import React, { CSSProperties, useCallback, useLayoutEffect, useRef, useState } from 'react';

import {Panel, Select} from '../../components';

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

export const OverFlow = ({ value, onChange, showTitle, collapse }: OverFlowProps) => {
  const [overflowX, setOverflowX] = useState(value.overflowX)
  const [overflowY, setOverflowY] = useState(value.overflowY)
  const overflowValueRef = useRef<OverFlowValueType>({...value})
  const [forceRenderKey, setForceRenderKey] = useState<number>(Math.random())

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
    onChange(keys.map((key) => ({key, value: next[key]})))
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
    onChange([
      { key: 'overflow', value: null },
      { key: 'overflowX', value: null },
      { key: 'overflowY', value: null },
    ])
    overflowValueRef.current = {}
    setOverflowX(undefined)
    setOverflowY(undefined)
    setForceRenderKey(prev => prev + 1)
  }, [onChange])

  return (
    <Panel title='内容溢出' showTitle={showTitle} showReset={true} resetFunction={refresh} collapse={collapse}>
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
