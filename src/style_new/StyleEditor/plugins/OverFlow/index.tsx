import React, { CSSProperties, useCallback, useEffect, useMemo, useState } from 'react';

import {Panel, Select, WidthOutlined, HeightOutlined} from '../../components';

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

  const overflowXChange = (val: string) => {
    onChange({ key: 'overflowX', value: val })

    //显示和隐藏需要x、y轴同时联动生效
    if (val === 'visible') {
      setOverflowY('visible')
      onChange({ key: 'overflowY', value: 'visible' })
      return
    }

    if (val === 'hidden') {
      setOverflowY('hidden')
      onChange({ key: 'overflowY', value: 'hidden' })
      return
    }


    if (val === 'scroll' && overflowY === 'visible') {
      setOverflowY('auto')
      onChange({ key: 'overflowY', value: 'auto' })
      return
    }

  }

  const overflowYChange = (val: string) => {
    onChange({ key: 'overflowY', value: val })

    //显示和隐藏需要x、y轴同时联动生效
    if (val === 'visible') {
      setOverflowX('visible')
      onChange({ key: 'overflowX', value: 'visible' })
      return
    }

    if (val === 'hidden') {
      setOverflowX('hidden')
      onChange({ key: 'overflowX', value: 'hidden' })
      return
    }

    if (val === 'scroll' && overflowX === 'visible') {
      setOverflowX('auto')
      onChange({ key: 'overflowX', value: 'auto' })
      return
    }
  }

  return (
    <Panel title='内容溢出' showTitle={showTitle} collapse={collapse}>
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
    </Panel>
  )
}