import React, { CSSProperties } from "react";
import Icon from "../Icon";
import { Layout } from "../types";
import styles from "./index.less";

export interface AlignItemsProps {
  position?: CSSProperties["position"];
  flexDirection: CSSProperties["flexDirection"];
  onSelect: (layout: Layout) => void;
}

const defaultFlexFlow = [
  {
    title: "自由排列",
    value: "absolute",
    render: () => <Icon name="absolute" />,
  },
  {
    title: "横向排列",
    value: "row",
    render: () => <Icon name="row-direction" />,
  },
  {
    title: "纵向排列",
    value: "column",
    render: () => <Icon name="column-direction" />,
  },
];

export default ({ position, flexDirection, onSelect }: AlignItemsProps) => {
  const isAbsolute = position === "absolute";

  const isActive = (value: Layout) => {
    return (
      (isAbsolute && value === "absolute") ||
      (!isAbsolute && value === flexDirection)
    );
  };
  return (
    <div className={styles.directionWrap}>
      {defaultFlexFlow.map(({ title, value, render }) => (
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
  );
};
