import React, { CSSProperties, useCallback, useRef } from "react";
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
  // 清空后传入 undefined，让公共 InputNumber 回到“默认”占位态。
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
  // 失焦提交和点击清除可能连续发生在同一轮渲染中，不能让清除回调
  // 捕获上一次 render 的 value，否则会把刚提交的间距再次写回。
  const valueRef = useRef(value);
  valueRef.current = value;

  const handleGapChange = useCallback((name: GapKey, next: string | null) => {
    const nextValue = getGapChange(valueRef.current, name, next);
    valueRef.current = nextValue;
    onChange(nextValue);
  }, [onChange]);

  const renderInput = (
    name: "rowGap" | "columnGap",
    inputValue: CSSProperties["rowGap"] | null,
    iconName: "column-gap" | "row-gap",
    title: string,
  ) => {
    // const isDefault = !!cleared?.[name] || inputValue == null || inputValue === "";
    // const computedValue = getComputedGapValue(targetDom, name, inputValue);

    return (
      <div className={styles.input}>
        <InputNumber
          type="number"
          prefix={
            <div {...getDragProps(inputValue, `拖拽调整${title}`)}>
              <Icon name={iconName} />
            </div>
          }
          tip={title}
          style={{ padding: "0 8px" }}
          value={toInputValue(cleared?.[name] ? null : inputValue)}
          defaultValue={toInputValue(cleared?.[name] ? null : inputValue)}
          defaultUnitValue="px"
          unitOptions={PX_UNIT_OPTIONS}
          // 0 也是有效回显值，需要保留清除按钮；空值时公共组件会自动隐藏按钮。
          clearable
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
