import React, { CSSProperties, useCallback, useRef } from "react";
import { VariableNumberInput, withApplyVariableOption, APPLY_VARIABLE_ACTION, buildDetachMenuOptions } from "../../../components";
import { useStyleEditorContext } from "../../../context";
import Icon from "../Icon";
import { useDragNumber, useLengthInputDrag, useStyleDisplayValue, useLengthVarBinding, isCssVarValue } from "../../../hooks";
import styles from "./index.less";
import lang from '../../../../index.i18n'

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
  const getInputValue = (name: GapKey) => {
    const field = name === "rowGap" ? rowGapField : columnGapField;
    const inputValue = isPseudoState ? field.configuredValue : cleared?.[name] ? null : value[name];
    const winner = context?.getStyleProperty?.(name).winner;
    // 变量简写的 computed 已变成像素；胶囊从当前声明读取原始绑定。
    // 伪类只读自己的声明，不把基础态变量当成当前状态的配置。
    if (winner?.currentState && (isCssVarValue(winner.value) || isPseudoState)) {
      return /^unset$/i.test(winner.value.trim()) ? undefined : winner.value;
    }
    return inputValue;
  };
  const rowInputValue = getInputValue("rowGap");
  const columnInputValue = getInputValue("columnGap");
  // 失焦提交和点击清除可能连续发生在同一轮渲染中，不能让清除回调
  // 捕获上一次 render 的 value，否则会把刚提交的间距再次写回。
  const valueRef = useRef(value);
  valueRef.current = { ...value, rowGap: rowInputValue, columnGap: columnInputValue };

  const handleGapChange = useCallback((name: GapKey, next: string | null) => {
    const hasVariable = isCssVarValue(next) || isCssVarValue(valueRef.current.rowGap) || isCssVarValue(valueRef.current.columnGap);
    const nextValue = getGapChange(valueRef.current, name, next);
    valueRef.current = nextValue;
    // 变量与伪类只提交本次编辑的轴，另一轴由原声明保留，不能写回计算值。
    onChange(isPseudoState || hasVariable ? { [name]: next } : nextValue);
  }, [onChange, isPseudoState]);

  const rowBinding = useLengthVarBinding({ value: rowInputValue, computedProp: "rowGap", onChange: next => handleGapChange("rowGap", next) });
  const columnBinding = useLengthVarBinding({ value: columnInputValue, computedProp: "columnGap", onChange: next => handleGapChange("columnGap", next) });
  const getRowPreviewDragProps = useLengthInputDrag(rowGapField.computedPreview, next => handleGapChange("rowGap", next));
  const getColumnPreviewDragProps = useLengthInputDrag(columnGapField.computedPreview, next => handleGapChange("columnGap", next));

  const renderInput = (
    name: "rowGap" | "columnGap",
    inputValue: CSSProperties["rowGap"] | null,
    iconName: "column-gap" | "row-gap",
    title: string,
  ) => {
    const field = name === "rowGap" ? rowGapField : columnGapField;
    const binding = name === "rowGap" ? rowBinding : columnBinding;
    inputValue = name === "rowGap" ? rowInputValue : columnInputValue;
    // 未设置间距时浏览器返回 normal，沿用常规态的空白显示。
    const previewValue = isPseudoState && field.computedPreview !== "normal" ? field.computedPreview : undefined;
    const dragProps = previewValue != null
      ? name === "rowGap" ? getRowPreviewDragProps : getColumnPreviewDragProps
      : getDragProps;

    return (
      <div className={styles.input}>
        <VariableNumberInput
          binding={binding}
          compact
          chipStyle={{ width: "100%", minWidth: 0, marginLeft: 0, padding: "0 8px" }}
          chipPrefix={<div ref={binding.varRef ? binding.anchorRef : undefined} {...binding.dragProps(`${lang.dragGap} ${title}`)}><Icon name={iconName} /></div>}
          menuOptions={[{ label: lang.defaultLabel, value: "default" }, ...buildDetachMenuOptions(binding.fallbackValue)]}
          inputProps={{
            type: "number",
            prefix: <div ref={!binding.varRef ? binding.anchorRef : undefined} {...dragProps(inputValue ?? previewValue, `${lang.dragGap} ${title}`)}><Icon name={iconName} /></div>,
            tip: title,
            placeholder: "",
            style: { padding: "0 8px" },
            value: toInputValue(inputValue),
            defaultValue: toInputValue(inputValue),
            previewValue,
            defaultUnitValue: "px",
            unitOptions: withApplyVariableOption(PX_UNIT_OPTIONS, binding.hasVariables),
            // 空值也保留应用变量入口；箭头容器与绑定后的胶囊保持一致。
            showIcon: true,
            unitSelectStyle: { width: 16 },
            unitIconClassName: styles.unitIcon,
            // 0 也是有效回显值，需要保留“默认”入口。
            clearable: true,
            onClear: () => handleGapChange(name, null),
            onChange: next => handleGapChange(name, next == null ? null : next),
            onAction: action => { if (action === APPLY_VARIABLE_ACTION) binding.openPicker(); },
          }}
        />
      </div>
    );
  };

  return (
    <div className={styles.gap}>
      {flexDirection === "row" && renderInput("columnGap", value.columnGap, "column-gap", lang.columnGapLabel)}
      {flexDirection === "row" && renderInput("rowGap", value.rowGap, "row-gap", lang.rowGapLabel)}
      {flexDirection === "column" && renderInput("rowGap", value.rowGap, "row-gap", lang.rowGapLabel)}
      {flexDirection === "column" && renderInput("columnGap", value.columnGap, "column-gap", lang.columnGapLabel)}
    </div>
  );
};
