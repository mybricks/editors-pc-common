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

/** 编辑器内置的 position 语义；其余为真实 CSS 值（fixed/relative 等），读入时需原样保留，避免被当成 inherit 后写出为 null 而丢失 */
function isPreservedCssPosition(pos: unknown): pos is CSSProperties['position'] {
  if (pos == null || typeof pos !== 'string') return false;
  if (pos === 'absolute' || pos === 'default' || pos === 'inherit') return false;
  if (pos === 'row' || pos === 'column') return false;
  return true;
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
  const _value = parsePxValues(editValue || {});

  if ((_value as any).alignItems === "normal") (_value as any).alignItems = "flex-start";
  if ((_value as any).justifyContent === "normal") (_value as any).justifyContent = "flex-start";

  const _position: string = ["absolute", "default"].includes(_value.position as string)
    ? (_value.position as string)
    : isPreservedCssPosition(_value.position)
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
      // 切换到默认：清除所有 flex 布局相关属性；容器自身的 position 不动
      if (style.position === "default") {
        onChangeValue({
          display: null,
          flexDirection: null,
          alignItems: null,
          justifyContent: null,
          flexWrap: null,
          rowGap: null,
          columnGap: null,
        });
        return;
      }
      // 处于默认状态时，只写出本次变化的非 flex 属性（如 overflow、padding）
      // 注意：style.display 有值说明正在切换到 flex 布局，需要放行
      if (model.position === "default" && style.position === undefined && style.display === undefined) {
        const FLEX_KEYS = new Set(['display', 'flexDirection', 'alignItems', 'justifyContent', 'flexWrap', 'rowGap', 'columnGap', 'position']);
        const out: Record<string, any> = {};
        for (const [k, v] of Object.entries(style)) {
          if (!FLEX_KEYS.has(k)) out[k] = v;
        }
        onChangeValue(normalizePx(out));
        return;
      }
      // 仅按 patch 写出，不合并 model
      onChangeValue(normalizePx(style as Record<string, unknown>));
    },
    [model]
  );

  // isFlexActive：当前是否处于 flex 横/纵布局（与容器 position 无关）
  const isFlexActive = model.display === "flex" && (model.flexDirection === "row" || model.flexDirection === "column");
  const hasSelectedDirection = model.position === "default" || model.position === "absolute" || isFlexActive ||
    isPreservedCssPosition(model.position);

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

      if (isDefault) {
        // 切换到默认：清空 flex 相关样式，不动容器 position
        setModel(prev => ({ ...prev, flexDirection, display: undefined, position: "default", flexWrap }));
        emitValue({ position: "default" });
        return;
      }

      if (isAbsolute) {
        setModel(prev => ({ ...prev, flexDirection, display: "block", position: "absolute", flexWrap }));
        emitValue({ display: "block", flexDirection, position: "absolute", flexWrap });
        return;
      }

      // 横/纵切换：只改 display + flex 字段，容器自身的 position 完全不动
      // model.position 设为 "inherit" 仅用于退出 "default" 内部状态，不会写出
      // 从默认切换到 flex 时，alignItems / justifyContent 初始化为 center
      const comingFromDefault = model.position === "default";
      const alignItems = comingFromDefault ? "center" : model.alignItems;
      const justifyContent = comingFromDefault ? "center" : model.justifyContent;
      setModel(prev => ({ ...prev, flexDirection, display: "flex", position: "inherit", flexWrap, alignItems, justifyContent }));
      if (comingFromDefault) {
        emitValue({ display: "flex", flexDirection, flexWrap, alignItems, justifyContent });
      } else {
        emitValue({ display: "flex", flexDirection, flexWrap });
      }
    };
    return (
      <Direction
        position={model.position}
        flexDirection={model.flexDirection}
        display={model.display}
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
    return hasSelectedDirection && isFlexActive ? (
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
    return hasSelectedDirection && isFlexActive ? (
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
    return hasSelectedDirection && isFlexActive ? (
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
                display: isFlexActive ? void 0 : "none",
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
