import React, { useState, CSSProperties, useMemo } from "react";
import FlexContext from "./ItemContext";
import { Bar, Point } from "./Bar";

type FlexItem = Pick<CSSProperties, "justifyContent" | "alignItems">;

export interface FlexItemProps
  extends Pick<
    CSSProperties,
    "flexDirection" | "justifyContent" | "alignItems"
  > {
  flexItem: FlexItem;
  onSelected: (p: FlexItem) => void;
}

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

  return (
    <FlexContext.Provider value={{ flexDirection, hover, active: isActive }}>
      <div
        style={{
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          cursor: "pointer"
        }}
        onMouseOver={() => setHover(true)}
        onMouseLeave={() => setHover(false)}
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
