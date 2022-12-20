import React from "react";
import FlexItem, { FlexItemProps } from "./Item";
import styles from "./index.less";

const rowItems = [
  {
    justifyContent: "flex-start",
    alignItems: "flex-start",
  },
  {
    justifyContent: "center",
    alignItems: "flex-start",
  },
  {
    justifyContent: "flex-end",
    alignItems: "flex-start",
  },
  {
    justifyContent: "flex-start",
    alignItems: "center",
  },
  {
    justifyContent: "center",
    alignItems: "center",
  },
  {
    justifyContent: "flex-end",
    alignItems: "center",
  },
  {
    justifyContent: "flex-start",
    alignItems: "flex-end",
  },
  {
    justifyContent: "center",
    alignItems: "flex-end",
  },
  {
    justifyContent: "flex-end",
    alignItems: "flex-end",
  },
];

const columnItems = [
  {
    justifyContent: "flex-start",
    alignItems: "flex-start",
  },
  {
    justifyContent: "flex-start",
    alignItems: "center",
  },
  {
    justifyContent: "flex-start",
    alignItems: "flex-end",
  },
  {
    justifyContent: "center",
    alignItems: "flex-start",
  },
  {
    justifyContent: "center",
    alignItems: "center",
  },
  {
    justifyContent: "center",
    alignItems: "flex-end",
  },
  {
    justifyContent: "flex-end",
    alignItems: "flex-start",
  },
  {
    justifyContent: "flex-end",
    alignItems: "center",
  },
  {
    justifyContent: "flex-end",
    alignItems: "flex-end",
  },
];

export default ({
  flexDirection,
  justifyContent,
  alignItems,
  onSelected,
}: Omit<FlexItemProps, "flexItem">) => {
  const activeItems = flexDirection === "row" ? rowItems : columnItems;
  return (
    <div className={styles.container}>
      <div className={styles.grid}>
        {activeItems.map((item, index) => (
          <FlexItem
            key={index}
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
