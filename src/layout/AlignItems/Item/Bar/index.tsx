import React, { CSSProperties, useContext } from "react";
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
    flexDirection !== "row"
      ? { width: 4, height: 6}
      : { width: 6, height: 4 };
  const className = active ? styles.selected : hover ? styles.hover : "";
  return (
    <div style={style} className={`${styles["align-bar"]} ${className}`} />
  );
};

const CenterBar = () => {
  const { flexDirection, hover, active } = useContext(FlexContext);
  const style =
    flexDirection !== "row"
      ? { width: 4, height: 9, margin: "2px 0" }
      : { width: 9, height: 4, margin: "0 2px" };
  const className = active ? styles.selected : hover ? styles.hover : "";
  return (
    <div style={style} className={`${styles["align-bar"]} ${className}`} />
  );
};

const RightBar = () => {
  const { flexDirection, hover, active } = useContext(FlexContext);
  const style =
    flexDirection !== "row"
      ? { width: 4, height: 6 }
      : { width: 6, height: 4 };
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

  const style = () => {
    if (flexItem.justifyContent === "space-around" || flexItem.justifyContent === "space-between") {
      if (flexDirection === "column") {
        return {
          height: '100%'
        }
      } else if (flexDirection === "row") {
        return {
          width: '100%'
        }
      }
    }
  }

  return (
    <div
      data-mybricks-tip={getTitle({ flexItem, flexDirection })}
      style={{ display: "flex", ...flexItem, flexDirection, ...style()}}
    >
      <LeftBar />
      <CenterBar />
      <RightBar />
    </div>
  );
};

export { Bar, Point };
