import React, { CSSProperties, useContext } from "react";
import { Tooltip } from "antd";
import FlexContext from "../ItemContext";
import { extraJustifyContent } from "../../constant";
import styles from "./index.less";

type Params = {
  flexItem: Pick<CSSProperties, "justifyContent" | "alignItems">;
  flexDirection: CSSProperties["flexDirection"];
};

const LeftBar = () => {
  const { flexDirection, hover, active } = useContext(FlexContext);
  const style =
    flexDirection === "row"
      ? { width: 4, height: 12 }
      : { width: 12, height: 4 };
  const className = active ? styles.selected : hover ? styles.hover : "";
  return (
    <div style={style} className={`${styles["align-bar"]} ${className}`} />
  );
};

const CenterBar = () => {
  const { flexDirection, hover, active } = useContext(FlexContext);
  const style =
    flexDirection === "row"
      ? { width: 4, height: 16, margin: "0 2px" }
      : { width: 16, height: 4, margin: "2px 0" };
  const className = active ? styles.selected : hover ? styles.hover : "";
  return (
    <div style={style} className={`${styles["align-bar"]} ${className}`} />
  );
};

const RightBar = () => {
  const { flexDirection, hover, active } = useContext(FlexContext);
  const style =
    flexDirection === "row"
      ? { width: 4, height: 10 }
      : { width: 10, height: 4 };
  const className = active ? styles.selected : hover ? styles.hover : "";
  return (
    <div style={style} className={`${styles["align-bar"]} ${className}`} />
  );
};

const Point = () => {
  return <div className={styles.point} />;
};

const getTitle = ({ flexItem, flexDirection }: Params) => {
  let { justifyContent, alignItems } = flexItem;
  if (extraJustifyContent.includes(justifyContent as string)) {
    if (flexDirection === "row") {
      if (alignItems === "flex-start") return "top";
      if (alignItems === "center") return "center";
      if (alignItems === "flex-end") return "bottom";
    } else {
      if (alignItems === "flex-start") return "left";
      if (alignItems === "center") return "center";
      if (alignItems === "flex-end") return "right";
    }
  }
  if (justifyContent !== "center") {
    justifyContent =
      flexDirection === "row"
        ? justifyContent?.split("-")[1] === "start"
          ? "left"
          : "right"
        : justifyContent?.split("-")[1] === "start"
        ? "top"
        : "bottom";
  }
  if (alignItems !== "center") {
    alignItems =
      flexDirection === "row"
        ? alignItems?.split("-")[1] === "start"
          ? "top"
          : "bottom"
        : alignItems?.split("-")[1] === "start"
        ? "left"
        : "right";
  }
  return `${justifyContent} | ${alignItems}`;
};

const Bar = ({ flexItem, flexDirection }: Params) => {
  return (
    <Tooltip
      title={getTitle({ flexItem, flexDirection })}
      overlayInnerStyle={{ fontSize: 12 }}
    >
      <div style={{ display: "flex", ...flexItem, flexDirection }}>
        <LeftBar />
        <CenterBar />
        <RightBar />
      </div>
    </Tooltip>
  );
};

export { Bar, Point };
