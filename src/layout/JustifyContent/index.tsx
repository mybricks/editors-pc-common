import React, { CSSProperties } from "react";
import { Tooltip } from "antd";
import { Layout } from "../types";
import Icon from "../Icon";
import styles from "./index.less";

export interface JustifyContentProps {
  layout: Layout;
  flexDirection: CSSProperties["flexDirection"];
  justifyContent: CSSProperties["justifyContent"];
  flexWrap: CSSProperties["flexWrap"];
  onSelect: (justifyContent: CSSProperties["justifyContent"]) => void;
  onWrapToggle: (wrap: CSSProperties["flexWrap"]) => void;
}

const defaultJustifyContent = [
  {
    title: "均匀",
    value: "space-around",
    render: (direction: CSSProperties["flexDirection"]) =>
      direction === "row" ? (
        <Icon name="space-around-row" />
      ) : (
        <Icon name="space-around-column" />
      ),
  },
  {
    title: "两端",
    value: "space-between",
    render: (direction: CSSProperties["flexDirection"]) =>
      direction === "row" ? (
        <Icon name="space-between-row" />
      ) : (
        <Icon name="space-between-column" />
      ),
  },
  
];

export default ({
  layout,
  flexDirection,
  justifyContent,
  flexWrap,
  onSelect,
  onWrapToggle,
}: JustifyContentProps) => {
  const renderWrap = () => {
    const title = flexWrap === "wrap" ? "换行" : "不换行";
    return (
      <Tooltip
        title={title}
        placement="bottom"
        overlayInnerStyle={{ fontSize: "12px" }}
      >
        <div
          className={`${styles.wrap} ${flexWrap === "wrap" ? styles.selected : ""}`}
          onClick={() => onWrapToggle(flexWrap === "wrap" ? "nowrap" : "wrap")}
        >
          <Icon name="wrap" />
        </div>
      </Tooltip>
    );
  };

  return layout !== "absolute" ? (
    <>
      <div className={styles.justifyWrap}>
        {defaultJustifyContent.map(({ title, value, render }, index) => (
          <Tooltip
            title={title}
            overlayInnerStyle={{ fontSize: "12px" }}
          >
            <div
              key={index}
              className={`${styles.svgWrapper} ${
                justifyContent === value ? styles["justifyContent-select"] : ""
              }`}
              onClick={() => onSelect(value)}
            >
              {render(flexDirection)}
            </div>
          </Tooltip>
        ))}
      </div>
      {renderWrap()}
    </>
  ) : null;
};
