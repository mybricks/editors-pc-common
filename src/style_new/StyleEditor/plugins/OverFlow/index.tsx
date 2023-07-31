import React, { CSSProperties } from "react";
import { Panel, Select } from "../../components";
import type { ChangeEvent } from "../../type";

type OverFlowValueType = Partial<{
  overflowX: CSSProperties["overflowX"];
  overflowY: CSSProperties["overflowY"];
}>;

export interface OverFlowProps {
  value: OverFlowValueType;
  onChange: ChangeEvent;
}

const VALUE_OPTIONS = [
  { label: "自动", value: "auto" },
  { label: "滚动", value: "scroll" },
  { label: "隐藏", value: "hidden" },
];

export const OverFlow = ({ value, onChange }: OverFlowProps) => {
  return (
    <Panel title="滚动">
      <Panel.Content>
        <Select
          tip="水平"
          defaultValue={value?.overflowX}
          options={VALUE_OPTIONS}
          onChange={(val) => onChange({ key: "overflowX", value: val })}
        />
        <Select
          tip="垂直"
          defaultValue={value?.overflowY}
          options={VALUE_OPTIONS}
          onChange={(val) => onChange({ key: "overflowY", value: val })}
        />
      </Panel.Content>
    </Panel>
  );
};
