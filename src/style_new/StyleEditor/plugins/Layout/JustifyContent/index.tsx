import React, { CSSProperties } from "react";
import Icon from "../Icon";
import styles from "./index.less";

export interface JustifyContentProps {
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
  flexDirection,
  justifyContent,
  flexWrap,
  onSelect,
  onWrapToggle,
}: JustifyContentProps) => {
  const renderWrap = () => {
    // const title = flexWrap === "wrap" ? "换行" : "不换行";
    const title = "换行"; // 这里提示词不应该变
    return (
      <div
        data-mybricks-tip={title}
        className={`${styles.wrap} ${
          flexWrap === "wrap" ? styles.selected : ""
        }`}
        onClick={() => onWrapToggle(flexWrap === "wrap" ? "nowrap" : "wrap")}
      >
        <Icon name="wrap" style={{opacity:0.85}}/>
      </div>
    );
  };

  return (
    <>
      <div className={styles.justifyWrap}>
        {defaultJustifyContent.map(({ title, value, render }) => (
          <div
            key={value}
            data-mybricks-tip={title}
            className={`${styles.svgWrapper} ${
              justifyContent === value ? styles["justifyContent-select"] : ""
            }`}
            onClick={() =>
              onSelect(justifyContent === value ? "normal" : value)
            }
          >
            {render(flexDirection)}
          </div>
        ))}
          {renderWrap()}
      </div>
    </>
  );
};
