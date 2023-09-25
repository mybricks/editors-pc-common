import { EditorProps } from "@/interface";
import { useObservable } from "@mybricks/rxui";
import { Popover } from "antd";
import React, { useMemo, useState } from "react";
import css from "./index.less";

const getRowList = (CDN: Record<string, unknown>) => [
  {
    title: "左对齐",
    key: "left",
    value: "left",
    url: CDN.left || "https://ali-ec.static.yximgs.com/udata/pkg/eshop/fangzhou/icons/left.defc4a63ebe8ea7d.svg",
  },
  {
    title: "左右居中对齐",
    key: "row-center",
    value: "center",
    url: CDN.rowCenter || "https://ali-ec.static.yximgs.com/udata/pkg/eshop/fangzhou/icons/center.c284343a9ff9672a.svg",
  },
  {
    title: "右对齐",
    key: "right",
    value: "right",
    url: CDN.right || "https://ali-ec.static.yximgs.com/udata/pkg/eshop/fangzhou/icons/right.a7763b38b84b5894.svg",
  },
];

const getColumnList = (CDN: Record<string, unknown>) => [
  {
    title: "顶部对齐",
    key: "top",
    value: "top",
    url: CDN.top || "https://ali-ec.static.yximgs.com/udata/pkg/eshop/fangzhou/icons/top.98906024d52b69de.svg",
  },
  {
    title: "上下居中对齐",
    key: "column-center",
    value: "center",
    url: CDN.columnCenter || "https://ali-ec.static.yximgs.com/udata/pkg/eshop/fangzhou/icons/center.100376f4ade480cd.svg",
  },
  {
    title: "底部对齐",
    key: "bottom",
    value: "bottom",
    url: CDN.bottom || "https://ali-ec.static.yximgs.com/udata/pkg/eshop/fangzhou/icons/bottom.6ee532067ed440ca.svg",
  },
];

const getSpaceBetweenList = (CDN: Record<string, unknown>) => [
  {
    title: "垂直间距等分",
    key: "column",
    value: ["column", "space-between"],
    url: CDN.column || "https://ali-ec.static.yximgs.com/udata/pkg/eshop/fangzhou/icons/column-space-between.31d560c0e611198f.svg",
  },
  {
    title: "水平间距等分",
    key: "row",
    value: ["row", "space-between"],
    url: CDN.row || "https://ali-ec.static.yximgs.com/udata/pkg/eshop/fangzhou/icons/row-space-between.ead5cd660c0f1c33.svg",
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
  const { value, options, getDefaultOptions } = editConfig;
  const CDN = useMemo(() => getDefaultOptions?.('align')?.CDN ?? {}, []);

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
        {getRowList(CDN).map((item) => (
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
        {getColumnList(CDN).map((item) => (
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
