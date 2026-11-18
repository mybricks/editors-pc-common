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
  
  return (
    <div className={styles.container}>
      <div className={styles.grid} style={gridStyle}>
        {gridItems.map((item, index) => (
          <FlexItem
            key={`${item.justifyContent}-${item.alignItems}`}
            flexDirection={flexDirection}
            justifyContent={justifyContent}
            alignItems={alignItems}
            flexItem={item}
            pointIndex={index}
            activePointIndex={activePointIndex}
            onSelected={next => {
              if (!extraJustifyContent.includes(item.justifyContent)) {
                setActivePoint({ direction: flexDirection, index });
              }
              onSelected(next);
            }}
          />
        ))}
      </div>
    </div>
  );
};
