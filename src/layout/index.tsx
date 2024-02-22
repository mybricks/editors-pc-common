import { EditorProps } from "@/interface";
import React, { CSSProperties, useCallback, useState } from "react";
import Direction from "./Direction";
import AlignItems from "./AlignItems";
import JustifyContent from "./JustifyContent";
import Gap, { GapProps } from "./Gap";
import { Layout } from "./types";
import styles from "./index.less";
interface LayoutProps {
  display?: CSSProperties["display"];
  position?: CSSProperties["position"];
  flexDirection: CSSProperties["flexDirection"]  | 'smart';
  alignItems: CSSProperties["alignItems"];
  justifyContent: CSSProperties["justifyContent"];
  flexWrap: CSSProperties["flexWrap"];
  rowGap: CSSProperties["rowGap"];
  columnGap: CSSProperties["columnGap"];
}

const defaultOptions = {
  position: true,
  direction: true,
  align: true,
  gap: true,
  wrap: true,
}

const defaultValue = {
  display: "flex",
  position: "inherit",
  flexDirection: "column",
  alignItems: "flex-start",
  justifyContent: "flex-start",
  flexWrap: "nowrap",
  rowGap: 0,
  columnGap: 0
}

export default function ({ editConfig }: EditorProps): JSX.Element {
  const { value, options } = editConfig;
  let option = typeof options === 'function' ? options() : { ...options }
  option = { ...defaultOptions, ...option }
  const _value = value.get();

  const [model, setModel] = useState<LayoutProps>({
    ...defaultValue,
    ..._value,
  });

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
      value.set({ ...model, ...style });
    },
    [model]
  );

  const renderFlexDirection = () => {
    const onSelect = (layout: Layout) => {
      const isAbsolute = layout === "absolute";
      const flexDirection = !isAbsolute ? layout : model.flexDirection;
      setModel((pre) => ({
        ...pre,
        flexDirection,
        display: isAbsolute ? "block" : "flex",
        position: isAbsolute ? layout : "inherit",
      }));
      updateValue({
        flexDirection,
        display: isAbsolute ? "block" : "flex",
        position: isAbsolute ? layout : "inherit",
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
      setModel((pre) => ({ ...pre, justifyContent }));
      updateValue({ justifyContent });
    };
    const onWrapToggle = (flexWrap: CSSProperties["flexWrap"]) => {
      setModel((pre) => ({ ...pre, flexWrap }));
      updateValue({ flexWrap });
    };
    return model.position !== "absolute" && model.flexDirection !== "smart" ? (
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
    return model.position !== "absolute" && model.flexDirection !== "smart" ? (
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
      updateValue({ ...value });
    };
    return model.position !== "absolute" && model.flexDirection !== "smart" && option.gap ? (
      <Gap
        value={{ rowGap: model.rowGap, columnGap: model.columnGap }}
        onChange={onChange}
      />
    ) : null;
  };

  return (
    <div className={styles.layout}>
      <div className={styles.left}>
        {renderFlexDirection()}
        {renderJustifyContent()}
        {renderGap()}
      </div>
      <div className={styles.rightLayout}>
        <div className={styles.right}>{renderAlignItems()}</div>
      </div>
    </div>
  );
}
