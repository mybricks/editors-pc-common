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
  isCurrentPoint?: boolean;
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
  return `${justifyContent} ${alignItems}`;
};

export default ({
  flexDirection,
  justifyContent,
  alignItems,
  flexItem,
  isCurrentPoint,
  onSelected,
}: FlexItemProps) => {
  const [hover, setHover] = useState<boolean>(false);
  // 普通九宫格模式；space-between / space-around 分布模式沿用原交互。
  const isNineGrid = !extraJustifyContent.includes(flexItem.justifyContent as string);
  // 当前点是否匹配单轴 unset 状态：只比较已设置的轴，同一行/列的三个点均命中。
  const isPartial = isNineGrid && (
    (justifyContent === undefined && flexItem.alignItems === alignItems) ||
    (alignItems === undefined && flexItem.justifyContent === justifyContent)
  );
  // 当前点是否高亮：默认左上角、单轴 unset 命中的三个点，或两轴完全匹配的点。
  // 高亮不代表重复点击原点，循环判断另由 isCurrentPoint 区分。
  const isActive = useMemo(() => {
    // 两轴都未配置时沿用左上角默认高亮，打开面板不写入样式。
    return (justifyContent === undefined && alignItems === undefined &&
      flexItem.justifyContent === "flex-start" && flexItem.alignItems === "flex-start") || isPartial || (
      flexItem.justifyContent === justifyContent &&
      flexItem.alignItems === alignItems
    );
  }, [flexItem, justifyContent, alignItems, isPartial]);
  const title = getTitle({ flexItem: isPartial ? { justifyContent, alignItems } : flexItem, flexDirection });


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
    <FlexContext.Provider value={{ flexDirection, hover, active: isActive }}>
      <div
        key={isNineGrid ? title : undefined}
        ref={isNineGrid ? node => {
          // 宿主缓存 mouseover 目标，循环切换后从新节点读取提示文案。
          if (node && hover) node.dispatchEvent(new MouseEvent("mouseover", { bubbles: true }));
        } : undefined}
        style={{
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          cursor: "pointer",
          opacity: isPartial ? 0.6 : undefined,
        }}
        data-mybricks-tip={title}
        onMouseEnter={() => handleMouseEnter()}
        onMouseLeave={() => handleMouseLeave()}
        onClick={() => {
          if (isNineGrid) {
            // 沿用提示顺序：justify align → justify unset → unset align → justify align。
            const nextItem = { ...flexItem };
            if (isActive && justifyContent === undefined && alignItems === undefined) {
              nextItem.alignItems = undefined;
            } else if (isActive && justifyContent !== undefined && (!isPartial || isCurrentPoint)) {
              nextItem[alignItems === undefined ? "justifyContent" : "alignItems"] = undefined;
            }
            onSelected(nextItem);
            return;
          }
          if (isActive) return;
          onSelected(flexItem);
        }}
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
