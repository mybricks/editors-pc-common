import React, { CSSProperties, useMemo } from "react";
import Icon from "../Icon";
import { Layout } from "../types";
import styles from "./index.less";

export interface AlignItemsProps {
  position?: CSSProperties["position"] | "smart";
  flexDirection: CSSProperties["flexDirection"];
  onSelect: (layout: Layout) => void;
}

const defaultFlexFlow = [
  {
    title: "智能排版",
    value: "smart",
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
  {
    title: "自由排版",
    value: "absolute",
    render: () => <Icon name="absolute" />,
  },
];

export default ({
  defaultDirection = [],
  position,
  flexDirection,
  onSelect,
}: AlignItemsProps) => {
  const isAbsolute = position === "absolute";
  const isSmart = position === "smart";
  const isInherit = position === "inherit";
  const isRow = flexDirection === "row";
  const isColumn = flexDirection === "column";

  const isActive = (value: Layout) => {
    if (isAbsolute) {
      return value === "absolute";
    }

    if (isSmart) {
      return value === "smart";
    }

    if (isInherit && isRow) {
      return value === "row";
    }

    if (isInherit && isColumn) {
      return value === "column";
    }
  };

  const flexFlow = useMemo(() => {
    console.warn("defaultDirection", defaultDirection);
    console.warn("defaultDirection", defaultDirection);
    console.warn("defaultDirection", defaultDirection);

    if (defaultDirection.length === 0) {
      return defaultFlexFlow;
    } else {
      return defaultFlexFlow.filter(({ value }) =>
        defaultDirection.includes(value as Layout)
      );
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
