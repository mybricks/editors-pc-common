import React, { CSSProperties } from "react";
import Icon from "@ant-design/icons";
import absolute from "./absolute.svg";
import rowDirection from "./row-direction.svg";
import columnDirection from "./column-direction.svg";
import spaceAroundColumn from "./space-around-column.svg";
import spaceAroundRow from "./space-around-row.svg";
import spaceBetweenColumn from "./space-between-column.svg";
import spaceBetweenRow from "./space-between-row.svg";
import wrap from "./wrap.svg";

const icons = {
  absolute: absolute,
  "row-direction": rowDirection,
  "column-direction": columnDirection,
  "space-around-column": spaceAroundColumn,
  "space-around-row": spaceAroundRow,
  "space-between-column": spaceBetweenColumn,
  "space-between-row": spaceBetweenRow,
  wrap: wrap,
};

export default ({
  name,
  style,
}: {
  name: keyof typeof icons;
  style?: CSSProperties;
}) => {
  return <Icon style={style} component={icons[name]} />;
};
