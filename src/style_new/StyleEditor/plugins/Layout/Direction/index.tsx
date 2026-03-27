import React, { CSSProperties, useMemo } from "react";
import Icon from "../Icon";
import { Layout } from "../types";
import styles from "./index.less";

export interface AlignItemsProps {
  defaultDirection?: Layout[];
  position?: CSSProperties["position"] | "default";
  flexDirection: CSSProperties["flexDirection"];
  /** 用于区分「真实 CSS 定位 + display:block」与 flex 布局，避免误高亮横/纵向 */
  display?: CSSProperties["display"];
  onSelect: (layout: Layout) => void;
}

const defaultFlexFlow = [
  {
    title: "默认",
    value: "default",
    render: () => <Icon name="smart" />,
  },
  {
    title: "纵向排版",
    value: "column",
    render: () => <Icon name="column-direction" />,
  },
  {
    title: "横向排版",
    value: "row",
    render: () => <Icon name="row-direction" />,
  },
];

export default ({
  defaultDirection = [],
  position,
  flexDirection,
  display,
  onSelect,
}: AlignItemsProps) => {
  const isAbsolute = position === "absolute";
  const isRow = flexDirection === "row";
  const isColumn = flexDirection === "column";

  // 高亮逻辑只看 display + flexDirection，与容器自身的 position 无关
  const isActive = (value: Layout) => {
    if (value === "absolute") return isAbsolute;
    if (value === "default") return display !== "flex";
    if (value === "row") return display === "flex" && isRow;
    if (value === "column") return display === "flex" && isColumn;
    return false;
  };

  const flexFlow = useMemo(() => {
    if (defaultDirection.length === 0) {
      return defaultFlexFlow
    } else {
      return defaultFlexFlow.filter(({ value }) =>
        defaultDirection.includes(value as Layout)
      )
    }
  }, [defaultDirection]);

  return (
    <div>
      <div className={styles.directionWrap}>
        {flexFlow.map(({ title, value, render }) => (
          <div
            key={value}
            data-mybricks-tip={title}
            className={`${styles["direction"]} ${
              isActive(value as Layout) ? styles["direction-active"] : ""
            }`}
            onClick={() => onSelect(value as Layout)}
          >
            {render()}
          </div>
        ))}
      </div>
    </div>
  );
};
