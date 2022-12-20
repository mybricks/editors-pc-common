import React, { useMemo } from "react";
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
  flexDirection,
  justifyContent,
  alignItems,
  onSelected,
}: Omit<FlexItemProps, "flexItem">) => {
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
        {gridItems.map((item) => (
          <FlexItem
            key={`${item.justifyContent}-${item.alignItems}`}
            flexDirection={flexDirection}
            justifyContent={justifyContent}
            alignItems={alignItems}
            flexItem={item}
            onSelected={onSelected}
          />
        ))}
      </div>
    </div>
  );
};
