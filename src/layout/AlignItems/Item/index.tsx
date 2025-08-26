import React, { useState, CSSProperties, useMemo } from "react";
import FlexContext from "./ItemContext";
import { Bar, Point } from "./Bar";
import { extraJustifyContent } from "../constant";

type Params = {
  flexItem: Pick<CSSProperties, "justifyContent" | "alignItems">;
  flexDirection: CSSProperties["flexDirection"];
};

type FlexItem = Pick<CSSProperties, "justifyContent" | "alignItems">;

export interface FlexItemProps
  extends Pick<
    CSSProperties,
    "flexDirection" | "justifyContent" | "alignItems"
  > {
  flexItem: FlexItem;
  onSelected: (p: FlexItem) => void;
}

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
  return `${justifyContent} ${alignItems}`;
};

export default ({
  flexDirection,
  justifyContent,
  alignItems,
  flexItem,
  onSelected,
}: FlexItemProps) => {
  const [hover, setHover] = useState<boolean>(false);
  const isActive = useMemo(() => {
    return (
      flexItem.justifyContent === justifyContent &&
      flexItem.alignItems === alignItems
    );
  }, [flexItem, justifyContent, alignItems]);

  const [showTip, setShowTip] = useState('');

  const dot = useMemo(() => {
    if (justifyContent == "normal" || justifyContent == "center" || justifyContent == "flex-start" || justifyContent == "flex-end" ) {
      return <Point />
    }

    if (flexDirection == "column") {
      return (
        <div style={{ display: "flex", flexDirection: "column", justifyContent, height: "100%" }}>
          <Point />
          <Point />
          <Point />
        </div>
      )
    }

    if (flexDirection == "row") {
      return (
        <div style={{ display: "flex", flexDirection: "row", justifyContent, width: "100%" }}>
          <Point />
          <Point />
          <Point />
        </div>
      )
    }

    return <Point />
  }, [flexDirection, justifyContent, alignItems, flexItem])

  const handleMouseEnter = () => {
    setShowTip('')
    setTimeout(() => {
      setShowTip(getTitle({ flexItem, flexDirection }));
    }, 400);
    setHover(true)
  }

  const handleMouseLeave = () => {
    setShowTip('');
    setHover(false)
  }

  return (
    <FlexContext.Provider value={{ flexDirection, hover, active: isActive }}>
      <div
        style={{
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          cursor: "pointer"
        }}
        data-mybricks-tip={showTip}
        onMouseEnter={() => handleMouseEnter()}
        onMouseLeave={() => handleMouseLeave()}
        onClick={() => onSelected(flexItem)}
      >
        {isActive ? (
          <Bar flexItem={flexItem} flexDirection={flexDirection} />
        ) : hover ? (
          <Bar flexItem={flexItem} flexDirection={flexDirection} />
        ) : (
          dot
        )}
      </div>
    </FlexContext.Provider>
  );
};
