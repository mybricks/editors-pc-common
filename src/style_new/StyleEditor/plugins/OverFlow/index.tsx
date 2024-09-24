import React, {CSSProperties} from 'react';

import {Panel, Select, WidthOutlined, HeightOutlined} from '../../components';

import type {ChangeEvent} from '../../type';

type OverFlowValueType = Partial<{
  overflowX: CSSProperties['overflowX'];
  overflowY: CSSProperties['overflowY'];
}>;

export interface OverFlowProps {
  value: OverFlowValueType;
  onChange: ChangeEvent;
  showTitle: boolean;
}

const VALUE_OPTIONS = [
  {label: '默认', value: 'unset'},
  {label: '自动', value: 'auto'},
  {label: '滚动', value: 'scroll'},
  {label: '隐藏', value: 'hidden'},
  {label: '显示', value: 'visible'}
];

export const OverFlow = ({value, onChange, showTitle}: OverFlowProps) => {
  return (
    <Panel title='滚动条' showTitle={showTitle}>
      <Panel.Content>
        <Select
          tip='水平'
          prefix={<WidthOutlined/>}
          style={{padding: 0}}
          defaultValue={value.overflowX}
          options={VALUE_OPTIONS}
          onChange={(val) => onChange({key: 'overflowX', value: val})}
        />
        <Select
          tip='垂直'
          prefix={<HeightOutlined/>}
          style={{padding: 0}}
          defaultValue={value.overflowY}
          options={VALUE_OPTIONS}
          onChange={(val) => onChange({key: 'overflowY', value: val})}
        />
      </Panel.Content>
    </Panel>
  )
}