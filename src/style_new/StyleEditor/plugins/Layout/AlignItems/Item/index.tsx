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
  pointIndex: number;
  activePointIndex?: number;
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
  if (justifyContent === undefined) {
    justifyContent = "unset";
  } else if (justifyContent !== "center") {
    justifyContent =
      flexDirection === "row"
        ? justifyContent?.split("-")[1] === "start"
          ? "left"
          : "right"
        : justifyContent?.split("-")[1] === "start"
        ? "top"
        : "bottom";
  }
  if (alignItems === undefined) {
    alignItems = "unset";
  } else if (alignItems !== "center") {
    alignItems =
      flexDirection === "row"
        ? alignItems?.split("-")[1] === "start"
          ? "top"
          : "bottom"
        : alignItems?.split("-")[1] === "start"
        ? "left"
        : "right";
  }
  return flexDirection === "row" ? `${alignItems} ${justifyContent}` : `${justifyContent} ${alignItems}`;
};

export default ({
  flexDirection,
  justifyContent,
  alignItems,
  flexItem,
  pointIndex,
  activePointIndex,
  onSelected,
}: FlexItemProps) => {
  const [hover, setHover] = useState<boolean>(false);
  const isNineGrid = !extraJustifyContent.includes(flexItem.justifyContent as string);
  const verticalKey = flexDirection === "row" ? "alignItems" : "justifyContent";
  const horizontalKey = flexDirection === "row" ? "justifyContent" : "alignItems";
  const currentItem = { justifyContent, alignItems };
  const vertical = currentItem[verticalKey];
  const horizontal = currentItem[horizontalKey];
  const isPartial = isNineGrid && (
    (vertical === flexItem[verticalKey] && horizontal === undefined) ||
    (vertical === undefined && horizontal === flexItem[horizontalKey])
  );
  // 重新选中后没有操作点记录，未设置轴只显示在中点，避免整行/列同时高亮。
  const showPartial = isPartial && (activePointIndex === undefined
    ? flexItem[vertical === undefined ? verticalKey : horizontalKey] === "center"
    : activePointIndex === pointIndex);
  const isActive = useMemo(() => {
    return (isPartial && activePointIndex === pointIndex) || (
      flexItem.justifyContent === justifyContent &&
      flexItem.alignItems === alignItems
    );
  }, [flexItem, justifyContent, alignItems, isPartial, activePointIndex, pointIndex]);
  const title = getTitle({ flexItem: showPartial ? currentItem : flexItem, flexDirection });


  const dot = useMemo(() => {
    if (justifyContent === undefined || justifyContent == "normal" || justifyContent == "center" || justifyContent == "flex-start" || justifyContent == "flex-end" ) {
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
    setHover(true)
  }

  const handleMouseLeave = () => {
    setHover(false)
  }

  return (
    <FlexContext.Provider value={{ flexDirection, hover, active: isActive || showPartial }}>
      <div
        key={isNineGrid ? title : undefined}
        ref={isNineGrid ? node => {
          // 宿主按 mouseover 目标缓存提示；状态变化后从新节点读取文案。
          if (node && hover) node.dispatchEvent(new MouseEvent("mouseover", { bubbles: true }));
        } : undefined}
        style={{
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          cursor: "pointer"
        }}
        data-mybricks-tip={title}
        onMouseEnter={() => handleMouseEnter()}
        onMouseLeave={() => handleMouseLeave()}
        onClick={() => {
          if (isNineGrid) {
            // 同一点按物理方向循环：纵 横 → 纵 unset → unset 横 → 纵 横；换点先完整赋值。
            const nextItem = { ...flexItem };
            if (isActive && vertical !== undefined) {
              nextItem[horizontal === undefined ? verticalKey : horizontalKey] = undefined;
            }
            onSelected(nextItem);
            return;
          }
          if (isActive) return;
          onSelected(flexItem);
        }}
      >
        {isActive || showPartial ? (
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
