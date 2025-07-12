import React, {CSSProperties} from 'react';

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
  {label: '自动', value: 'auto'},
  {label: '显示', value: 'scroll'},
  {label: '隐藏', value: 'hidden'},
  // {label: '显示', value: 'visible'}
];

export const OverFlow = ({value, onChange, showTitle, collapse}: OverFlowProps) => {
  return (
    <Panel title='滚动条' showTitle={showTitle} collapse={collapse}>
      <Panel.Content>
        <Select
          prefix={<span className={css.tip}>水平</span>}
          // style={{padding: 0}}
          defaultValue={value.overflowX}
          options={VALUE_OPTIONS}
          onChange={(val) => onChange({key: 'overflowX', value: val})}
        />
        <Select
          prefix={<span className={css.tip}>垂直</span>}
          // style={{padding: 0}}
          defaultValue={value.overflowY}
          options={VALUE_OPTIONS}
          onChange={(val) => onChange({key: 'overflowY', value: val})}
        />
      </Panel.Content>
    </Panel>
  )
}