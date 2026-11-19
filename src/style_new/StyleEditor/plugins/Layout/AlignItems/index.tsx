import React, { useMemo, useState } from "react";
import FlexItem, { FlexItemProps } from "./Item";
import {
  rowItems,
  columnItems,
  spaceAroundItems,
  spaceBetweenItems,
  normalGridStyle,
  rowExtraStyle,
  columnExtraStyle,
  extraJustifyContent,
} from "./constant";
import styles from "./index.less";

export default ({
  flexDirection = "column",
  justifyContent,
  alignItems,
  onSelected,
}: Omit<FlexItemProps, "flexItem" | "pointIndex" | "activePointIndex">) => {
  // 半设置状态无法从 CSS 唯一定位点位，只在本次操作中记住用户点击的位置。
  const [activePoint, setActivePoint] = useState<{ direction: FlexItemProps["flexDirection"]; index: number }>();
  const activePointIndex = activePoint?.direction === flexDirection ? activePoint.index : undefined;
  const gridItems = useMemo(() => {
    if (justifyContent === "space-around") {
      return spaceAroundItems;
    }
    if (justifyContent === "space-between") {
      return spaceBetweenItems;
    }
    return flexDirection === "row" ? rowItems : columnItems;
  }, [justifyContent, flexDirection]);

  const gridStyle = useMemo(() => {
    if (extraJustifyContent.includes(justifyContent as string)) {
      if (flexDirection === "row") {
        return rowExtraStyle;
      } else {
        return columnExtraStyle;
      }
    } else {
      return normalGridStyle;
    }
  }, [justifyContent, flexDirection]);

  // 单轴未设置时按实际对齐值绘制整行/列，回显不依赖本次点击的位置。
  const partialIndex = gridStyle === normalGridStyle ? gridItems.findIndex(item =>
    (justifyContent === undefined && item.alignItems === alignItems) ||
    (alignItems === undefined && item.justifyContent === justifyContent)
  ) : -1;
  const horizontalLine = flexDirection === "row" ? justifyContent === undefined : alignItems === undefined;
  const partialPosition = horizontalLine ? Math.floor(partialIndex / 3) : partialIndex % 3;
  // 线条只保留一个交互区域，继续用原操作点承接当前线的循环；重新聚焦时沿用中点。
  const anchorIndex = activePointIndex ?? 4;
  const displayItems = partialIndex !== -1 ? [0, 1, 2].map(index => gridItems[
    horizontalLine ? index * 3 + anchorIndex % 3 : Math.floor(anchorIndex / 3) * 3 + index
  ]) : gridItems;

  return (
    <div className={styles.container}>
      <div className={styles.grid} style={gridStyle}>
        {displayItems.map((item, lineIndex) => {
          const index = gridItems.indexOf(item);
          return (
            <FlexItem
              key={`${item.justifyContent}-${item.alignItems}`}
              flexDirection={flexDirection}
              justifyContent={justifyContent}
              alignItems={alignItems}
              flexItem={item}
              pointIndex={index}
              activePointIndex={activePointIndex}
              lineItem={partialIndex !== -1 ? {
                justifyContent: justifyContent === undefined ? undefined : item.justifyContent,
                alignItems: alignItems === undefined ? undefined : item.alignItems,
              } : undefined}
              className={partialIndex !== -1
                ? `${styles.partialLine} ${horizontalLine ? styles.horizontalLine : styles.verticalLine} ${lineIndex === partialPosition ? styles.selectedLine : ""}`
                : undefined}
              style={partialIndex !== -1 ? {
                gridRow: horizontalLine ? `${lineIndex + 1} / ${lineIndex + 2}` : "1 / -1",
                gridColumn: horizontalLine ? "1 / -1" : `${lineIndex + 1} / ${lineIndex + 2}`,
              } : undefined}
              onSelected={next => {
                if (!extraJustifyContent.includes(item.justifyContent)) {
                  setActivePoint({ direction: flexDirection, index });
                }
                onSelected(next);
              }}
            />
          );
        })}
      </div>
    </div>
  );
};
