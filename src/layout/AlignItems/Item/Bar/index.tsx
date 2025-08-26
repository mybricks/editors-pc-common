import React, { CSSProperties, useContext } from "react";
import FlexContext from "../ItemContext";
import styles from "./index.less";

type Params = {
  flexItem: Pick<CSSProperties, "justifyContent" | "alignItems">;
  flexDirection: CSSProperties["flexDirection"];
};

const LeftBar = () => {
  const { flexDirection, hover, active } = useContext(FlexContext);
  const style : CSSProperties =
    flexDirection !== "row"
      ? { width: 4, height: 5, pointerEvents: "none"}
      : { width: 5, height: 4, pointerEvents: "none"};
  const className = active ? styles.selected : hover ? styles.hover : "";
  return (
    <div style={style} className={`${styles["align-bar"]} ${className}`} />
  );
};

const CenterBar = () => {
  const { flexDirection, hover, active } = useContext(FlexContext);
  const style : CSSProperties =
    flexDirection !== "row"
      ? { width: 4, height: 9, margin: "2px 0", pointerEvents: "none" }
      : { width: 9, height: 4, margin: "0 2px", pointerEvents: "none" };
  const className = active ? styles.selected : hover ? styles.hover : "";
  return (
    <div style={style} className={`${styles["align-bar"]} ${className}`} />
  );
};

const RightBar = () => {
  const { flexDirection, hover, active } = useContext(FlexContext);
  const style : CSSProperties =
    flexDirection !== "row"
      ? { width: 4, height: 5, pointerEvents: "none" }
      : { width: 5, height: 4, pointerEvents: "none" };
  const className = active ? styles.selected : hover ? styles.hover : "";
  return (
    <div style={style} className={`${styles["align-bar"]} ${className}`} />
  );
};

const Point = () => {
  return <div className={styles.point} />;
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
      style={{ display: "flex", ...flexItem, flexDirection, ...style(), pointerEvents:"none"}}
    >
      <LeftBar />
      <CenterBar />
      <RightBar />
    </div>
  );
};

export { Bar, Point };
