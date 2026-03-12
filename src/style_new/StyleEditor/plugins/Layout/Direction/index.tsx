import React, { CSSProperties, useMemo } from "react";
import Icon from "../Icon";
import { Layout } from "../types";
import styles from "./index.less";

export interface AlignItemsProps {
  position?: CSSProperties["position"] | "default";
  flexDirection: CSSProperties["flexDirection"];
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
  onSelect,
}: AlignItemsProps) => {
  const isAbsolute = position === "absolute";
  const isDefault = position === "default";
  const isInherit = position === "inherit";
  const isRow = flexDirection === "row";
  const isColumn = flexDirection === "column";

  const isActive = (value: Layout) => {
    if (isAbsolute) {
      return value === "absolute";
    }

    if (isDefault) {
      return value === "default";
    }

    if (isInherit && isRow) {
      return value === "row";
    }

    if (isInherit && isColumn) {
      return value === "column";
    }
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
