import { EditorProps } from "@/interface";
import { useObservable } from "@mybricks/rxui";
import React, { useMemo, useState } from "react";
import css from "./index.less";
import { Row, Column } from "./icons";

interface ListItem {
  title: string;
  key: string;
  value: string;
  url: string;
  render: () => React.JSX.Element;
}

const getSpaceBetweenList = (
  CDN: Record<string, string>
): Array<Omit<ListItem, "value"> & { value: string[] }> => [
  {
    title: "水平间距等分",
    key: "row",
    render: () => <Row />,
    value: ["row", "space-between"],
    url:
      CDN.row ||
      "https://ali-ec.static.yximgs.com/udata/pkg/eshop/fangzhou/icons/row-space-between.ead5cd660c0f1c33.svg",
  },
  {
    title: "垂直间距等分",
    key: "column",
    render: () => <Column />,
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

  const [between, setBetween] = useState(model.val || "row");

  const onSpaceBetweenChange = (value: string) => {
    setBetween(value);
    model.value.set(value);
  };

  return (
    <>
      <div className={css.align}>
        {getSpaceBetweenList(CDN).map((item) => (
          <div
            id={item.title}
            data-mybricks-tip={item.title}
            onClick={() => onSpaceBetweenChange(item.value[0])}
            className={`${css.item} ${
              between === item.value[0] ? css.active : ""
            }`}
          >
            {/* <img src={item.url} /> */}
            {item.render()}
          </div>
        ))}
      </div>
    </>
  );
}
