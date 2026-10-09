import React, { CSSProperties, useCallback, useRef } from "react";
import { InputNumber } from "../../../components";
import { useStyleEditorContext } from "../../../context";
import Icon from "../Icon";
import { useDragNumber, useLengthInputDrag, useStyleDisplayValue } from "../../../hooks";
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
  // 清空后传入 undefined，让公共 InputNumber 回到空值状态。
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
  const context = useStyleEditorContext();
  const options = context?.editConfig.options;
  const pseudo = options && !Array.isArray(options) && "zoneTab" in options ? options.zoneTab?.pseudo : null;
  const isPseudoState = !!pseudo && !pseudo.startsWith("::");
  const rowGapField = useStyleDisplayValue("rowGap");
  const columnGapField = useStyleDisplayValue("columnGap");
  // 失焦提交和点击清除可能连续发生在同一轮渲染中，不能让清除回调
  // 捕获上一次 render 的 value，否则会把刚提交的间距再次写回。
  const valueRef = useRef(value);
  valueRef.current = value;

  const handleGapChange = useCallback((name: GapKey, next: string | null) => {
    const nextValue = getGapChange(valueRef.current, name, next);
    valueRef.current = nextValue;
    // 伪类只提交本次编辑的轴，避免把另一轴的常规态预览写成配置。
    onChange(isPseudoState ? { [name]: next } : nextValue);
  }, [onChange, isPseudoState]);

  const getRowPreviewDragProps = useLengthInputDrag(rowGapField.computedPreview, next => handleGapChange("rowGap", next));
  const getColumnPreviewDragProps = useLengthInputDrag(columnGapField.computedPreview, next => handleGapChange("columnGap", next));

  const renderInput = (
    name: "rowGap" | "columnGap",
    inputValue: CSSProperties["rowGap"] | null,
    iconName: "column-gap" | "row-gap",
    title: string,
  ) => {
    const field = name === "rowGap" ? rowGapField : columnGapField;
    // 当前态声明和只读预览直接随 Context 更新，不受旧 model/cleared 标记影响。
    inputValue = isPseudoState ? field.configuredValue : cleared?.[name] ? null : inputValue;
    // 未设置间距时浏览器返回 normal，沿用常规态的空白显示。
    const previewValue = isPseudoState && field.computedPreview !== "normal" ? field.computedPreview : undefined;
    const dragProps = previewValue != null
      ? name === "rowGap" ? getRowPreviewDragProps : getColumnPreviewDragProps
      : getDragProps;

    return (
      <div className={styles.input}>
        <InputNumber
          type="number"
          prefix={
            <div {...dragProps(inputValue ?? previewValue, `拖拽调整${title}`)}>
              <Icon name={iconName} />
            </div>
          }
          tip={title}
          placeholder=""
          style={{ padding: "0 8px" }}
          value={toInputValue(inputValue)}
          defaultValue={toInputValue(inputValue)}
          previewValue={previewValue}
          defaultUnitValue="px"
          unitOptions={PX_UNIT_OPTIONS}
          // 0 也是有效回显值，需要保留“默认”入口；空值时公共组件会自动隐藏入口。
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
      {flexDirection === "column" && renderInput("columnGap", value.columnGap, "column-gap", "列间距")}
    </div>
  );
};
