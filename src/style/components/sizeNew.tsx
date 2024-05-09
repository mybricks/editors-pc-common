import React, { useCallback } from "react";

import {
  Panel,
  InputNumber,
  WidthOutlined,
  HeightOutlined,
} from "../../style_new/StyleEditor/components";

import { observe } from "@mybricks/rxui";
import { Ctx } from "../Style";

const UNIT_OPTIONS = [
  { label: "%", value: "%" },
  { label: "px", value: "px" },
  { label: "继承", value: "inherit" },
  { label: "默认", value: "auto" },
];
const UNIT_DISABLED_LIST = ["auto", "inherit"];

export default function Size() {
  const ctx: Ctx = observe(Ctx, { from: "parents" });
  const value = { width: "auto", height: "auto", ...ctx.val };
  const onChange = useCallback((value: Record<string, string>) => {
    ctx.set(value);
  }, []);
  return (
    <Panel title="尺寸">
      <Panel.Content>
        <InputNumber
          tip="宽"
          prefix={<WidthOutlined />}
          prefixTip={"宽"}
          defaultValue={value.width}
          unitOptions={UNIT_OPTIONS}
          unitDisabledList={UNIT_DISABLED_LIST}
          onChange={(width) => onChange({ width })}
          showIcon={true}
        />
        <InputNumber
          tip="高"
          prefix={<HeightOutlined />}
          prefixTip={"高"}
          defaultValue={value.height}
          unitOptions={UNIT_OPTIONS}
          unitDisabledList={UNIT_DISABLED_LIST}
          onChange={(height) => onChange({ height })}
          showIcon={true}
        />
      </Panel.Content>
    </Panel>
  );
}
