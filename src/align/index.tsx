import { EditorProps } from "@/interface";
import { useObservable } from "@mybricks/rxui";
import React, { useCallback, useMemo, useState } from "react";
import css from "./index.less";
import { Left, Right, RowCenter, Top, Bottom, ColumnCenter } from "./icons";

interface ListItem {
  title: string;
  key: string;
  value: string;
  url: string;
  render: () => React.JSX.Element;
}

const getRowList = (CDN: Record<string, string>): ListItem[] => [
  {
    title: "左对齐",
    key: "left",
    value: "left",
    render: () => <Left />,
    url:
      CDN.left ||
      "https://ali-ec.static.yximgs.com/udata/pkg/eshop/fangzhou/icons/left.defc4a63ebe8ea7d.svg",
  },
  {
    title: "左右居中对齐",
    key: "row-center",
    value: "center",
    render: () => <RowCenter />,
    url:
      CDN.rowCenter ||
      "https://ali-ec.static.yximgs.com/udata/pkg/eshop/fangzhou/icons/center.c284343a9ff9672a.svg",
  },
  {
    title: "右对齐",
    key: "right",
    value: "right",
    render: () => <Right />,
    url:
      CDN.right ||
      "https://ali-ec.static.yximgs.com/udata/pkg/eshop/fangzhou/icons/right.a7763b38b84b5894.svg",
  },
];

const getColumnList = (CDN: Record<string, string>): ListItem[] => [
  {
    title: "顶部对齐",
    key: "top",
    value: "top",
    render: () => <Top />,
    url:
      CDN.top ||
      "https://ali-ec.static.yximgs.com/udata/pkg/eshop/fangzhou/icons/top.98906024d52b69de.svg",
  },
  {
    title: "上下居中对齐",
    key: "column-center",
    value: "center",
    render: () => <ColumnCenter />,
    url:
      CDN.columnCenter ||
      "https://ali-ec.static.yximgs.com/udata/pkg/eshop/fangzhou/icons/center.100376f4ade480cd.svg",
  },
  {
    title: "底部对齐",
    key: "bottom",
    value: "bottom",
    render: () => <Bottom />,
    url:
      CDN.bottom ||
      "https://ali-ec.static.yximgs.com/udata/pkg/eshop/fangzhou/icons/bottom.6ee532067ed440ca.svg",
  },
];

const getSpaceBetweenList = (
  CDN: Record<string, string>
): Array<Omit<ListItem, "value" | "render"> & { value: string[] }> => [
  {
    title: "水平间距等分",
    key: "row",
    value: ["row", "space-between"],
    url:
      CDN.row ||
      "https://ali-ec.static.yximgs.com/udata/pkg/eshop/fangzhou/icons/row-space-between.ead5cd660c0f1c33.svg",
  },
  {
    title: "垂直间距等分",
    key: "column",
    value: ["column", "space-between"],
    url:
      CDN.column ||
      "https://ali-ec.static.yximgs.com/udata/pkg/eshop/fangzhou/icons/column-space-between.31d560c0e611198f.svg",
  },
];

export default function ({ editConfig }: EditorProps): JSX.Element {
  const { value, options, getDefaultOptions } = editConfig;
  const CDN = useMemo(() => getDefaultOptions?.("align")?.CDN ?? {}, []);

  const model = useObservable({
    val: value.get(),
    value,
  });

  const [align, setAlign] = useState(
    model.val?.split(" ") || ["center", "center"]
  );

  const onAlignChange = (index: number, value: string) => {
    const newAlign = [...align];
    newAlign[index] = value;
    setAlign(newAlign);
    model.value.set(newAlign.join(" "));
  };

  const onRowAlignChange = (value: string) => onAlignChange(0, value);

  const onColumnAlignChange = (value: string) => onAlignChange(1, value);

  const onSpaceBetweenChange = (value: string) => onAlignChange(2, value);

  const renderAlignItems = useCallback(
    (
      items: ListItem[],
      changeHandler: (value: string) => void,
      alignIndex: number
    ) =>
      items.map((item) => (
        <div
          key={item.title}
          data-mybricks-tip={item.title}
          className={`${css.item} ${
            align[alignIndex] === item.value ? css.active : ""
          }`}
          onClick={() => changeHandler(item.value)}
        >
          {/* <img src={item.url} /> */}
          {item.render()}
        </div>
      )),
    [align]
  );

  return (
    <>
      <div className={css.align}>
        {renderAlignItems(getRowList(CDN), onRowAlignChange, 0)}
        {renderAlignItems(getColumnList(CDN), onColumnAlignChange, 1)}
        {/*
            需求是先做成两个编辑器
          */}
        {/* {getSpaceBetweenList(CDN).map((item) => (
          <div
            data-mybricks-tip={item.title}
            className={`${css.item} ${
              align[2] === item.value[0] ? css.active : ""
            }`}
          >
            <img
              src={item.url}
              onClick={() => onSpaceBetweenChange(item.value[0])}
            />
          </div>
        ))} */}
      </div>
    </>
  );
}
