import { EditorProps } from "@/interface";
import React, { CSSProperties, useCallback, useState } from "react";
import Direction from "./Direction";
import AlignItems from "./AlignItems";
import JustifyContent from "./JustifyContent";
import Padding, { PaddingProps } from "./Padding";
import Gap, { GapProps } from "./Gap";
import { Layout } from "./types";
import styles from "./index.less";
interface LayoutProps {
  display?: CSSProperties["display"];
  position?: CSSProperties["position"] | "smart";
  flexDirection: CSSProperties["flexDirection"];
  alignItems: CSSProperties["alignItems"];
  justifyContent: CSSProperties["justifyContent"];
  flexWrap: CSSProperties["flexWrap"];
  rowGap: CSSProperties["rowGap"];
  columnGap: CSSProperties["columnGap"];
  overflow?: CSSProperties["overflow"] | "visible" | "hidden";
  paddingType: "independentPadding" | "dependentPadding";
  padding: CSSProperties["padding"];
  paddingTop: CSSProperties["paddingTop"];
  paddingRight: CSSProperties["paddingRight"];
  paddingBottom: CSSProperties["paddingBottom"];
  paddingLeft: CSSProperties["paddingLeft"];
}

/** 写出：将样式对象中的裸数字值补上 px 单位（仅 number 类型触发，字符串原样保留） */
function normalizePx(style: Record<string, unknown>): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  for (const [key, val] of Object.entries(style)) {
    result[key] = typeof val === "number" ? `${val}px` : val;
  }
  return result;
}

/** 读入：将 "11px" 形式的 px 字符串还原为数字，供内部 InputNumber 组件正常回显 */
function parsePxValues(style: Record<string, unknown>): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  for (const [key, val] of Object.entries(style)) {
    result[key] =
      typeof val === "string" && /^-?\d+(\.\d+)?px$/.test(val)
        ? parseFloat(val)
        : val;
  }
  return result;
}

const defaultOptions = {
  position: true,
  direction: true,
  align: true,
  gap: true,
  wrap: true,
};

const defaultValue = {
  display: "flex",
  position: "inherit",
  flexDirection: "row",
  alignItems: "flex-start",
  justifyContent: "flex-start",
  flexWrap: "nowrap",
  rowGap: 0,
  columnGap: 0,
};

export default function ({ editConfig }: EditorProps): JSX.Element {
  const { value, options } = editConfig;
  let option = typeof options === "function" ? options() : { ...options };
  option = { ...defaultOptions, ...option };
  const _value = parsePxValues(value.get() || {});

  const [model, setModel] = useState<LayoutProps>({
    ...defaultValue,
    ..._value,
    position: ["absolute", "smart", "inherit"].includes(_value.position)
      ? _value.position
      : "inherit",
  });

  const initialFlexDirection = _value.flexDirection ?? defaultValue.flexDirection;
  const [rowFlexWrap, setRowFlexWrap] = useState<CSSProperties["flexWrap"]>(
    initialFlexDirection === "row" ? (_value.flexWrap || defaultValue.flexWrap) : "nowrap"
  );
  const [columnFlexWrap, setColumnFlexWrap] = useState<CSSProperties["flexWrap"]>(
    initialFlexDirection === "column" ? (_value.flexWrap || defaultValue.flexWrap) : "nowrap"
  );

  const updateValue = useCallback(
    (
      style: Partial<
        Pick<
          CSSProperties,
          | "justifyContent"
          | "alignItems"
          | "flexDirection"
          | "flexWrap"
          | "display"
          | "position"
          | "rowGap"
          | "columnGap"
        >
      >
    ) => {
      value.set(
        style.position === "smart"
          ? { position: "smart" }
          : normalizePx({ ...model, ...style })
      );
    },
    [model]
  );

  const renderFlexDirection = () => {
    const onSelect = (layout: Layout) => {
      const isAbsolute = layout === "absolute" || layout === "smart";
      const flexDirection = isAbsolute ? model.flexDirection : layout;
    
      let flexWrap = model.flexWrap;
      if (layout === "column" && model.flexDirection === "row") {
        setRowFlexWrap(model.flexWrap);
        flexWrap = columnFlexWrap;
      } else if (layout === "row" && model.flexDirection === "column") {
        setColumnFlexWrap(model.flexWrap);
        flexWrap = rowFlexWrap;
      }

      const newStyles: Partial<LayoutProps> = {
        flexDirection,
        display: isAbsolute ? "block" : "flex",
        position: isAbsolute ? layout : undefined,
        flexWrap,
      };

      setModel(prev => ({
        ...prev,
        ...newStyles,
        position: isAbsolute ? layout : "inherit",
      }));

      updateValue({
        ...newStyles,
        position: isAbsolute ? layout : "inherit",
      });
    };
    return (
      <Direction
        defaultDirection={option.defaultDirection}
        position={model.position}
        flexDirection={model.flexDirection}
        onSelect={onSelect}
      />
    );
  };

  const hasSelectedDirection =
    model.position === "absolute" ||
    model.position === "smart" ||
    (model.position === "inherit" && (model.flexDirection === "row" || model.flexDirection === "column"));

  const renderJustifyContent = () => {
    const onSelect = (justifyContent: CSSProperties["justifyContent"]) => {
      //如果直接返回normal会导致九宫格没有高亮点
      if(justifyContent == "normal"){
        justifyContent = "flex-start"
      }
      setModel((pre) => ({ ...pre, justifyContent }));
      updateValue({ justifyContent });
    };
    const onWrapToggle = (flexWrap: CSSProperties["flexWrap"]) => {
      setModel((pre) => ({ ...pre, flexWrap }));
      updateValue({ flexWrap });
      if (model.flexDirection === "row") {
        setRowFlexWrap(flexWrap);
      } else if (model.flexDirection === "column") {
        setColumnFlexWrap(flexWrap);
      }
    };
    return hasSelectedDirection && model.position !== "absolute" && model.position !== "smart" ? (
      <JustifyContent
        flexDirection={model.flexDirection}
        justifyContent={model.justifyContent}
        flexWrap={model.flexWrap}
        onSelect={onSelect}
        onWrapToggle={onWrapToggle}
      />
    ) : null;
  };

  const renderAlignItems = () => {
    const onSelectFlexItem = ({
      alignItems,
      justifyContent,
    }: Pick<CSSProperties, "justifyContent" | "alignItems">) => {
      setModel((pre) => ({
        ...pre,
        alignItems,
        justifyContent,
      }));
      updateValue({ justifyContent, alignItems });
    };
    return hasSelectedDirection && model.position !== "absolute" && model.position !== "smart" ? (
      <AlignItems
        flexDirection={model?.flexDirection}
        justifyContent={model.justifyContent}
        alignItems={model.alignItems}
        onSelected={onSelectFlexItem}
      />
    ) : null;
  };

  const renderGap = () => {
    const onChange = (value: GapProps["value"]) => {
      setModel((pre) => ({ ...pre, ...value }));
      //updateValue({ ...value });
    };
    const onBlur = (value: GapProps["value"]) => {
      setModel((pre) => ({ ...pre, ...value }));
      updateValue({ ...value });
    };
    return hasSelectedDirection &&
      model.position !== "absolute" &&
      model.position !== "smart" &&
      option.gap ? (
      <Gap
        value={{ rowGap: model.rowGap, columnGap: model.columnGap }}
        onChange={onChange}
        onBlur={onBlur}
        flexDirection={model.flexDirection}
      />
    ) : null;
  };

  const renderOverflow = () => {
    const isHidden = model.overflow === "hidden";
    const toggle = () => {
      const overflow = isHidden ? "visible" : "hidden";
      const newModel = { ...model, overflow };
      setModel(newModel);
      value.set(normalizePx(newModel));
    };
    if (!hasSelectedDirection) return null;
    return (
      <div className={styles.overflowRow} onClick={toggle}>
        <div className={`${styles.checkbox} ${isHidden ? styles.checkboxChecked : ""}`}>
          {isHidden && (
            <svg width="10" height="8" viewBox="0 0 10 8" fill="none">
              <path d="M1 3.5L3.8 6.5L9 1" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          )}
        </div>
        <span className={styles.overflowLabel}>超出容器不显示</span>
      </div>
    );
  };

  //边距渲染
  const renderPadding = () => {
    const onPaddingToggle = (
      paddingType: "independentPadding" | "dependentPadding"
    ) => {
      setModel((pre) => ({ ...pre, paddingType }));
      updateValue({ paddingType });
    };
    const onBlur = (value: PaddingProps["value"]) => {
      setModel((pre) => ({ ...pre, ...value }));
      updateValue({ ...value });
    };

    const onChange = (value: PaddingProps["value"]) => {
      setModel((pre) => ({ ...pre, ...value }));
      //updateValue({ ...value });
    };

    if (!hasSelectedDirection) return null;
    return (
      <Padding
        value={{
          paddingTop: model.paddingTop,
          paddingRight: model.paddingRight,
          paddingBottom: model.paddingBottom,
          paddingLeft: model.paddingLeft,
        }}
        paddingType={model.paddingType}
        onPaddingToggle={onPaddingToggle}
        onChange={onChange}
        onBlur={onBlur}
        model={model}
      ></Padding>
    );
  };

  return (
    <div>
      {renderFlexDirection()}
      {hasSelectedDirection && (
        <div className={styles.layout}>
          <div className={styles.centerLayout}>
            <div
              className={styles.right}
              style={{
                display:
                  model.position !== "absolute" && model.position !== "smart"
                    ? void 0
                    : "none",
              }}
            >
              {renderAlignItems()}
            </div>
          </div>
          <div className={styles.left}>
            {renderGap()}
            {renderJustifyContent()}
          </div>
        </div>
      )}
      {renderOverflow()}
    </div>
  );
}
