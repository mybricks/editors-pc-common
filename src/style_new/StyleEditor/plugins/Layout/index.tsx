import React, { CSSProperties, useCallback, useEffect, useState } from "react";
import Direction from "./Direction";
import AlignItems from "./AlignItems";
import JustifyContent from "./JustifyContent";
import Padding, { PaddingProps } from "./Padding";
import Gap, { GapProps } from "./Gap";
import type { Layout } from "./types";
import { Panel } from "../../components";
import type { ChangeEvent, PanelBaseProps } from "../../type";
import styles from "./index.less";

interface LayoutEditorProps extends PanelBaseProps {
  value: Record<string, any>;
  onChange: ChangeEvent;
}

interface LayoutModel {
  display?: CSSProperties["display"];
  position?: CSSProperties["position"] | "default";
  flexDirection: CSSProperties["flexDirection"];
  alignItems: CSSProperties["alignItems"];
  justifyContent: CSSProperties["justifyContent"];
  flexWrap: CSSProperties["flexWrap"];
  rowGap: CSSProperties["rowGap"];
  columnGap: CSSProperties["columnGap"];
  overflow?: CSSProperties["overflow"] | "visible" | "hidden";
  paddingType?: "independentPadding" | "dependentPadding";
  padding?: CSSProperties["padding"];
  paddingTop?: CSSProperties["paddingTop"];
  paddingRight?: CSSProperties["paddingRight"];
  paddingBottom?: CSSProperties["paddingBottom"];
  paddingLeft?: CSSProperties["paddingLeft"];
}

const LAYOUT_KEYS = new Set([
  'display', 'position', 'flexDirection', 'alignItems', 'justifyContent',
  'flexWrap', 'rowGap', 'columnGap', 'overflow',
  'paddingTop', 'paddingRight', 'paddingBottom', 'paddingLeft',
]);

const NON_CSS_KEYS = new Set(['paddingType']);

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

const defaultValue: LayoutModel = {
  display: "flex",
  position: "inherit",
  flexDirection: "row",
  alignItems: "flex-start",
  justifyContent: "flex-start",
  flexWrap: "nowrap",
  rowGap: 0,
  columnGap: 0,
};

export function Layout({ value, onChange, showTitle, collapse }: LayoutEditorProps) {
  const [forceRenderKey, setForceRenderKey] = useState<number>(Math.random());
  const [isReset, setIsReset] = useState(false);

  const currentValue = isReset ? {} : (value ?? {});

  const editValue = Object.fromEntries(
    Object.entries(currentValue).filter(([key, v]) => v != null && LAYOUT_KEYS.has(key))
  );

  const refresh = useCallback(() => {
    const keys = Object.keys(value ?? {}).filter(key => LAYOUT_KEYS.has(key));
    onChange(keys.map(key => ({ key, value: null })));
    setIsReset(true);
    setForceRenderKey(prev => prev + 1);
  }, [value, onChange]);

  useEffect(() => {
    if (isReset && value && Object.keys(value).some(k => value[k] != null)) {
      setIsReset(false);
    }
  }, [value, isReset]);

  return (
    <Panel title="布局" showTitle={showTitle} showReset={true} showDelete={false} resetFunction={refresh} collapse={collapse}>
      <React.Fragment key={forceRenderKey}>
        <LayoutEditor
          editValue={editValue}
          onChangeValue={(newVal) => {
            onChange(
              Object.entries(newVal)
                .filter(([key]) => !NON_CSS_KEYS.has(key))
                .map(([key, val]) => ({ key, value: val }))
            );
          }}
        />
      </React.Fragment>
    </Panel>
  );
}

interface LayoutEditorInternalProps {
  editValue: Record<string, any>;
  onChangeValue: (val: Record<string, any>) => void;
}

function LayoutEditor({ editValue, onChangeValue }: LayoutEditorInternalProps): JSX.Element {
  const option = { ...defaultOptions };
  const _value = parsePxValues(editValue || {});

  if ((_value as any).alignItems === "normal") (_value as any).alignItems = "flex-start";
  if ((_value as any).justifyContent === "normal") (_value as any).justifyContent = "flex-start";

  const _position: string = ["absolute", "default"].includes(_value.position as string)
    ? (_value.position as string)
    : (_value.display === "flex" ? "inherit" : "default");

  const [model, setModel] = useState<LayoutModel>({
    ...defaultValue,
    ..._value,
    flexDirection: ((_value as any).flexDirection ?? defaultValue.flexDirection) as CSSProperties["flexDirection"],
    position: _position as any,
  });

  const initialFlexDirection = ((_value as any).flexDirection ?? defaultValue.flexDirection) as string;
  const [rowFlexWrap, setRowFlexWrap] = useState<CSSProperties["flexWrap"]>(
    initialFlexDirection === "row" ? ((_value as any).flexWrap || defaultValue.flexWrap) as CSSProperties["flexWrap"] : "nowrap"
  );
  const [columnFlexWrap, setColumnFlexWrap] = useState<CSSProperties["flexWrap"]>(
    initialFlexDirection === "column" ? ((_value as any).flexWrap || defaultValue.flexWrap) as CSSProperties["flexWrap"] : "nowrap"
  );

  const emitValue = useCallback(
    (style: Partial<LayoutModel>) => {
      if (style.position === "default") {
        // 切换到默认：清除所有 flex 布局相关属性
        onChangeValue({
          display: null,
          position: null,
          flexDirection: null,
          alignItems: null,
          justifyContent: null,
          flexWrap: null,
          rowGap: null,
          columnGap: null,
        });
        return;
      }
      // 处于默认状态时，只写出本次变化的属性（如 overflow、padding），不写出 flex 属性
      // 注意：如果 style 里带有新的 position（说明正在切换方向），则不走此保护
      if (model.position === "default" && style.position === undefined) {
        const FLEX_KEYS = new Set(['display', 'flexDirection', 'alignItems', 'justifyContent', 'flexWrap', 'rowGap', 'columnGap', 'position']);
        const out: Record<string, any> = {};
        for (const [k, v] of Object.entries(style)) {
          if (!FLEX_KEYS.has(k)) out[k] = v;
        }
        onChangeValue(normalizePx(out));
        return;
      }
      const outStyle = { ...model, ...style } as any;
      if (outStyle.position === "inherit") {
        outStyle.position = null;
      }
      onChangeValue(normalizePx(outStyle));
    },
    [model]
  );

  const hasSelectedDirection =
    model.position === "absolute" ||
    model.position === "default" ||
    (model.position === "inherit" && (model.flexDirection === "row" || model.flexDirection === "column"));

  const renderFlexDirection = () => {
    const onSelect = (layout: Layout) => {
      const isAbsolute = layout === "absolute";
      const isDefault = layout === "default";
      const flexDirection = (isAbsolute || isDefault) ? model.flexDirection : layout;

      let flexWrap = model.flexWrap;
      if (layout === "column" && model.flexDirection === "row") {
        setRowFlexWrap(model.flexWrap);
        flexWrap = columnFlexWrap;
      } else if (layout === "row" && model.flexDirection === "column") {
        setColumnFlexWrap(model.flexWrap);
        flexWrap = rowFlexWrap;
      }

      const newStyles: Partial<LayoutModel> = {
        flexDirection,
        display: isAbsolute ? "block" : "flex",
        position: (isAbsolute || isDefault) ? layout : undefined,
        flexWrap,
      };

      setModel(prev => ({
        ...prev,
        ...newStyles,
        position: (isAbsolute || isDefault) ? layout : "inherit",
      }));

      emitValue({
        ...newStyles,
        position: (isAbsolute || isDefault) ? layout : "inherit",
      });
    };
    return (
      <Direction
        position={model.position}
        flexDirection={model.flexDirection}
        onSelect={onSelect}
      />
    );
  };

  const renderJustifyContent = () => {
    const onSelect = (justifyContent: CSSProperties["justifyContent"]) => {
      if (justifyContent == "normal") {
        justifyContent = "flex-start";
      }
      setModel((pre) => ({ ...pre, justifyContent }));
      emitValue({ justifyContent });
    };
    const onWrapToggle = (flexWrap: CSSProperties["flexWrap"]) => {
      setModel((pre) => ({ ...pre, flexWrap }));
      emitValue({ flexWrap });
      if (model.flexDirection === "row") {
        setRowFlexWrap(flexWrap);
      } else if (model.flexDirection === "column") {
        setColumnFlexWrap(flexWrap);
      }
    };
    return hasSelectedDirection && model.position !== "absolute" && model.position !== "default" ? (
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
      emitValue({ justifyContent, alignItems });
    };
    return hasSelectedDirection && model.position !== "absolute" && model.position !== "default" ? (
      <AlignItems
        flexDirection={model?.flexDirection}
        justifyContent={model.justifyContent}
        alignItems={model.alignItems}
        onSelected={onSelectFlexItem}
      />
    ) : null;
  };

  const renderGap = () => {
    const onGapChange = (val: GapProps["value"]) => {
      setModel((pre) => ({ ...pre, ...val }));
    };
    const onGapBlur = (val: GapProps["value"]) => {
      setModel((pre) => ({ ...pre, ...val }));
      emitValue({ ...val });
    };
    return hasSelectedDirection &&
      model.position !== "absolute" &&
      model.position !== "default" &&
      option.gap ? (
      <Gap
        value={{ rowGap: model.rowGap, columnGap: model.columnGap }}
        onChange={onGapChange}
        onBlur={onGapBlur}
        flexDirection={model.flexDirection}
      />
    ) : null;
  };

  const renderOverflow = () => {
    const isHidden = model.overflow === "hidden";
    const toggle = () => {
      const overflow = isHidden ? "visible" : "hidden";
      setModel((pre) => ({ ...pre, overflow }));
      emitValue({ overflow });
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

  const renderPadding = () => {
    const onPaddingToggle = (paddingType: "independentPadding" | "dependentPadding") => {
      setModel((pre) => ({ ...pre, paddingType }));
      emitValue({ paddingType });
    };
    const onPaddingBlur = (val: PaddingProps["value"]) => {
      setModel((pre) => ({ ...pre, ...val }));
      emitValue({ ...val });
    };
    const onPaddingChange = (val: PaddingProps["value"]) => {
      setModel((pre) => ({ ...pre, ...val }));
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
        paddingType={model.paddingType ?? "dependentPadding"}
        onPaddingToggle={onPaddingToggle}
        onChange={onPaddingChange}
        onBlur={onPaddingBlur}
        model={model}
      />
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
                  model.position !== "absolute" && model.position !== "default"
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
