import React, { CSSProperties, useEffect, useMemo } from "react";
import Icon from "../Icon";
import { Layout } from "../types";
import styles from "./index.less";
import lang from '../../../../index.i18n'

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
    title: lang.directionNone,
    value: "default",
    render: () => <Icon name="smart" />,
  },
  {
    title: lang.directionInline,
    value: "inline",
    render: () => <Icon className={styles.inlineIcon} name="inline" />,
  },
  {
    title: lang.directionColumn,
    value: "column",
    render: () => <Icon name="column-direction" />,
  },
  {
    title: lang.directionRow,
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
  const isInline = display === "inline";
  const isFlexLike = display === "flex" || display === "inline-flex";

  // 高亮逻辑只看 display + flexDirection，与容器自身的 position 无关
  const isActive = (value: Layout) => {
    if (value === "absolute") return isAbsolute;
    if (value === "inline") return isInline;
    if (value === "default") return !isFlexLike && !isInline;
    if (value === "row") return isFlexLike && isRow;
    if (value === "column") return isFlexLike && isColumn;
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

  const activeIndex = flexFlow.findIndex(({ value }) => isActive(value as Layout));

  return (
    <div>
      <div
        className={styles.directionWrap}
        style={{ "--active-index": activeIndex, "--n": flexFlow.length } as React.CSSProperties}
      >
        {activeIndex >= 0 && <div className={styles.slider} />}
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
