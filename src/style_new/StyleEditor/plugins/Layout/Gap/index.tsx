import React, { CSSProperties, useCallback, useRef, useState } from "react";
import { InputNumber } from "../../../components";
import { useStyleEditorContext } from "../../../context";
import Icon from "../Icon";
import { useDragNumber } from "../../../hooks";
import styles from "./index.less";

type Value = Partial<{
  rowGap: CSSProperties["rowGap"] | null;
  columnGap: CSSProperties["columnGap"] | null;
}>;
type GapKey = "rowGap" | "columnGap";

export interface GapProps {
  value: Value;
  cleared?: Partial<Record<GapKey, boolean>>;
  onChange: (value: Value) => void;
  flexDirection: CSSProperties["flexDirection"];
}

const PX_UNIT_OPTIONS = [{ label: "px", value: "px" }];

function toInputValue(value: CSSProperties["rowGap"] | null): string | undefined {
  if (value == null || value === "") return undefined;
  return typeof value === "number" ? `${value}px` : value;
}

function getGapChange(
  value: Value,
  name: GapKey,
  next: string | null,
): Value {
  return {
    ...value,
    [name]: next,
  };
}

function getComputedGapValue(
  targetDom: HTMLElement | null | undefined,
  name: GapKey,
  fallbackValue: CSSProperties["rowGap"] | null,
): string {
  let computedValue: unknown = fallbackValue;

  if (targetDom && typeof window !== "undefined") {
    const computedStyle = window.getComputedStyle(targetDom);
    computedValue = computedStyle.getPropertyValue(name === "rowGap" ? "row-gap" : "column-gap");
  }

  const numericValue = parseFloat(String(computedValue ?? ""));
  return Number.isNaN(numericValue) ? "0" : String(Math.round(numericValue));
}

export default ({ value, cleared, onChange, flexDirection }: GapProps) => {
  const getDragProps = useDragNumber({ continuous: true });
  const targetDom = useStyleEditorContext()?.targetDom;
  const [inputRevision, setInputRevision] = useState<Record<GapKey, number>>({ rowGap: 0, columnGap: 0 });
  // 失焦提交和点击清除可能连续发生在同一轮渲染中，不能让清除回调
  // 捕获上一次 render 的 value，否则会把刚提交的间距再次写回。
  const valueRef = useRef(value);
  valueRef.current = value;

  const handleGapChange = useCallback((name: GapKey, next: string | null) => {
    const nextValue = getGapChange(valueRef.current, name, next);
    valueRef.current = nextValue;
    onChange(nextValue);
    // 清除时即使计算值与原回显相同，也要重挂载以清掉输入框内的草稿。
    if (next === null) {
      setInputRevision((previous) => ({ ...previous, [name]: previous[name] + 1 }));
    }
  }, [onChange]);

  const renderInput = (
    name: "rowGap" | "columnGap",
    inputValue: CSSProperties["rowGap"] | null,
    iconName: "column-gap" | "row-gap",
    title: string,
  ) => {
    const isDefault = !!cleared?.[name] || inputValue == null || inputValue === "";
    const displayValue = isDefault
      ? `${getComputedGapValue(targetDom, name, null)}px`
      : toInputValue(inputValue);

    return (
      <div className={styles.input}>
        <InputNumber
          key={`${name}-${inputRevision[name]}`}
          type="number"
          prefix={
            <div {...getDragProps(displayValue, `拖拽调整${title}`)}>
              <Icon name={iconName} />
            </div>
          }
          tip={title}
          style={{ padding: "0 8px" }}
          value={displayValue}
          defaultUnitValue="px"
          unitOptions={PX_UNIT_OPTIONS}
          // 计算值只是回显；只有显式配置后才出现「默认」操作。
          clearable={!isDefault}
          onClear={() => handleGapChange(name, null)}
          onChange={(next) => handleGapChange(name, next == null ? null : next)}
        />
      </div>
    );
  };

  return (
    <div className={styles.gap}>
      {flexDirection === "row" && renderInput("columnGap", value.columnGap, "column-gap", "列间距")}
      {flexDirection === "row" && renderInput("rowGap", value.rowGap, "row-gap", "行间距")}
      {flexDirection === "column" && renderInput("rowGap", value.rowGap, "row-gap", "行间距")}
    </div>
  );
};
