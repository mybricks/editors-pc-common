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
}: Omit<FlexItemProps, "flexItem" | "isCurrentPoint">) => {
  // 只记住本次面板操作的点位，重新聚焦后首次点击按具体位置选择。
  const [lastClicked, setLastClicked] = useState<{ direction: FlexItemProps["flexDirection"]; index: number }>();
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
            alignItems={alignItems ?? (extraJustifyContent.includes(item.justifyContent) ? "flex-start" : undefined)}
            flexItem={item}
            isCurrentPoint={lastClicked?.direction === flexDirection && lastClicked?.index === index}
            onSelected={next => {
              if (!extraJustifyContent.includes(item.justifyContent)) {
                setLastClicked({ direction: flexDirection, index });
              }
              onSelected(next);
            }}
          />
        ))}
      </div>
    </div>
  );
};
