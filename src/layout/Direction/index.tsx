import React, { CSSProperties } from "react";
import { Tooltip } from "antd";
import { Layout } from "../types";
import Icon from '../Icon'
import styles from "./index.less";

export interface AlignItemsProps {
  layout: Layout;
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
    value: "flex-row",
    render: () => <Icon name="row-direction" />,
  },
  {
    title: "纵向排列",
    value: "flex-column",
    render: () => <Icon name="column-direction" />,
  },
];

export default ({ layout, onSelect }: AlignItemsProps) => {
  return (
    <div className={styles["flex-direction"]}>
      {defaultFlexFlow.map(({ title, value, render }, index) => (
        <Tooltip
          title={title}
          placement="top"
          overlayInnerStyle={{ fontSize: 12 }}
        >
          <div
            key={index}
            className={`${styles["direction"]} ${layout === value ? styles["direction-active"] : ""
              }`}
            onClick={() => onSelect(value as Layout)}
          >
            {render()}
          </div>
        </Tooltip>
      ))}
    </div>
  );
};
