import React, { useCallback, useEffect } from "react";

import { Select } from "antd";
import css from "./line.less";
import { editorsConfigKey } from "../constant";
import { useObservable } from "@mybricks/rxui";


const { Option } = Select;

type optionType = {
  value: string;
  label: string;
};

const options: optionType[] = [
  { value: "solid", label: "实线" },
  { value: "dotted", label: "点线" },
  { value: "dashed", label: "虚线" },
  // { value: "double", label: "双线" },
  // { value: "groove", label: "凹槽" },
  // { value: "ridge", label: "脊状" },
  // { value: "inset", label: "嵌入" },
  // { value: "outset", label: "外凸" },
];

class Ctx {
  val!: string;
  value!: {
    get: Function;
    set: Function;
  };
}

const Line = ({ editConfig }: Record<string, any>): any => {
  const { value } = editConfig;
  const model: Ctx = useObservable(Ctx, (next) => {
    const val = value.get();
    next({
      val,
      value,
    });
  });

  const onSelect = useCallback(
    (style: string): void => {
      model.val = style;
      model.value.set(style);
    },
    [value]
  );

  useEffect(() => {
    model.val = value.get();
  }, [JSON.stringify(value.get())]);

  const optionRender = (value: string) => {
    const optionStyle = {
      borderTop: `1px ${value} ${value === model.val ? "#fa6400" : "black"}`,
      width: "60px",
    };
    return (
      <div className={css["option-wrraper"]}>
        <div style={optionStyle} />
      </div>
    );
  };

  const optionsRender = () => {
    return options.map((option) => (
      <Option value={option.value} label={option.label}>
        {optionRender(option.value)}
      </Option>
    ));
  };

  const getOptionLabel = (props: any) => {
    const { value } = props;
    if (value) {
      return optionRender(value);
    }
    return void 0;
  };

  return (
    <div className={`${css["editor-line"]} fangzhou-theme`}>
      <Select
        onSelect={onSelect}
        optionFilterProp="label"
        value={model.val || "solid"}
        dropdownClassName="fangzhou-theme"
        tagRender={(props) => <>{getOptionLabel(props)}</>}
        size={(window as any)[editorsConfigKey]?.size || "small"}
      >
        {optionsRender()}
      </Select>
    </div>
  );
};

export default Line;
