import { EditorProps } from "@/interface";
import { useObservable } from "@mybricks/rxui";
import { Popover } from "antd";
import React, { useRef, useState } from "react";
import css from "./index.less";

const rowList = [
  {
    title: "左对齐",
    key: "left",
    value: "left",
    url: "./mfs/editor_assets/align/left.defc4a63ebe8ea7d.svg",
  },
  {
    title: "左右居中对齐",
    key: "row-center",
    value: "center",
    url: "./mfs/editor_assets/align/center.c284343a9ff9672a.svg",
  },
  {
    title: "右对齐",
    key: "right",
    value: "right",
    url: "./mfs/editor_assets/align/right.a7763b38b84b5894.svg",
  },
];

const columnList = [
  {
    title: "顶部对齐",
    key: "top",
    value: "top",
    url: "./mfs/editor_assets/align/top.98906024d52b69de.svg",
  },
  {
    title: "上下居中对齐",
    key: "column-center",
    value: "center",
    url: "./mfs/editor_assets/align/center.100376f4ade480cd.svg",
  },
  {
    title: "底部对齐",
    key: "bottom",
    value: "bottom",
    url: "./mfs/editor_assets/align/bottom.6ee532067ed440ca.svg",
  },
];

const spaceBetweenList = [
  {
    title: "垂直间距等分",
    key: "column",
    value: ["column", "space-between"],
    url: "./mfs/editor_assets/align/column-space-between.31d560c0e611198f.svg",
  },
  {
    title: "水平间距等分",
    key: "row",
    value: ["row", "space-between"],
    url: "./mfs/editor_assets/align/row-space-between.ead5cd660c0f1c33.svg",
  },
];

const AlignItem = ({ item, align, onChange }: any) => {
  return (
    <Popover content={item.title}>
      <div
        className={`${css.item} ${align[1] === item.value ? css.active : ""}`}
      >
        <img src={item.url} onClick={() => onChange(item.value)} />
      </div>
    </Popover>
  );
};

export default function ({ editConfig }: EditorProps): JSX.Element {
  const { value, options } = editConfig;

  const model = useObservable({
    val: value.get(),
    value,
  });

  const [align, setAlign] = useState(
    model.val?.split(" ") || ["center", "center"]
  );

  const onRowAlignChange = (value: string) => {
    if (align[1] === "space-between") {
      setAlign(() => [value, "center"]);
      model.value.set(`${value} center`);
    } else {
      setAlign(() => [value, align[1]]);
      model.value.set(`${value} ${align[1]}`);
    }
  };

  const onColumnAlignChange = (value: string) => {
    if (align[1] === "space-between") {
      setAlign(() => ["center", value]);
      model.value.set(`center ${value}`);
    } else {
      setAlign(() => [align[0], value]);
      model.value.set(`${align[0]} ${value}`);
    }
  };

  const onSpaceBetweenChange = (value: string[]) => {
    setAlign(() => [value[0], value[1]]);
    model.value.set(`${value[0]} ${value[1]}`);
  };

  return (
    <>
      <div className={css.align}>
        {rowList.map((item) => (
          <Popover content={item.title}>
            <div
              className={`${css.item} ${
                align[0] === item.value ? css.active : ""
              }`}
            >
              <img
                src={item.url}
                onClick={() => onRowAlignChange(item.value)}
              />
            </div>
          </Popover>
        ))}
        {columnList.map((item) => (
          <Popover content={item.title}>
            <div
              className={`${css.item} ${
                align[1] === item.value ? css.active : ""
              }`}
            >
              <img
                src={item.url}
                onClick={() => onColumnAlignChange(item.value)}
              />
            </div>
          </Popover>
        ))}
        {/* {spaceBetweenList.map((item) => (
          <Popover content={item.title}>
            <div
              className={`${css.item} ${
                align[0] === item.value[0] ? css.active : ""
              }`}
            >
              <img
                src={item.url}
                onClick={() => onSpaceBetweenChange(item.value)}
              />
            </div>
          </Popover>
        ))} */}
      </div>
    </>
  );
}
