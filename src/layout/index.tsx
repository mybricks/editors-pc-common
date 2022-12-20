import { EditorProps } from "@/interface";
import React, { CSSProperties, useCallback, useState } from "react";
import Direction from "./Direction";
import AlignItems from "./AlignItems";
import JustifyContent from "./JustifyContent";
import { Layout } from "./types";
import styles from "./index.less";
interface LayoutProps {
  layout: Layout;
  flexDirection: CSSProperties["flexDirection"];
  alignItems: CSSProperties["alignItems"];
  justifyContent: CSSProperties["justifyContent"];
  flexWrap: CSSProperties["flexWrap"];
}

export default function ({ editConfig }: EditorProps): JSX.Element {
  const { value } = editConfig;
  const _value = value.get();

  const [model, setModel] = useState<LayoutProps>({
    layout: "flex-row",
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "flex-start",
    flexWrap: "nowrap",
    ..._value
  });

  const updateValue = useCallback(
    (
      style: Partial<
        | Pick<
          CSSProperties,
          "justifyContent" | "alignItems" | "flexDirection" | "flexWrap"
        >
        | { layout: Layout }
      >
    ) => {
      value.set({ ...model, ...style });
    },
    [model]
  );

  const renderFlexDirection = () => {
    const onSelect = (layout: Layout) => {
      const flexDirection =
        layout === "absolute"
          ? model.flexDirection
          : (layout.split("-")[1] as CSSProperties["flexDirection"]);
      setModel((pre) => ({ ...pre, layout, flexDirection }));
      updateValue({ layout, flexDirection });
    };
    return <Direction layout={model.layout} onSelect={onSelect} />;
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
    return model.layout !== "absolute" ? (
      <JustifyContent
        layout={model.layout}
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
    return model.layout !== "absolute" ? (
      <AlignItems
        flexDirection={model?.flexDirection}
        justifyContent={model.justifyContent}
        alignItems={model.alignItems}
        onSelected={onSelectFlexItem}
      />
    ) : null;
  };

  return (
    <div className={styles.layout}>
      <div className={styles.left}>
        {renderFlexDirection()}
        {renderJustifyContent()}
      </div>
      <div className={styles.right}>{renderAlignItems()}</div>
    </div>
  );
}