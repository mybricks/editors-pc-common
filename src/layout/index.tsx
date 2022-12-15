import { EditorProps } from "@/interface";
import React, { CSSProperties, useEffect, useState } from "react";
import css from "./index.less";
import { useComputed, useObservable } from "@mybricks/rxui";
import IconRowDirection from "./icons/IconRowDirection";
import IconColumnDirection from "./icons/IconColumnDirection";
import IconRowPacked from "./icons/IconRowPacked";
import IconRawSpaceBetween from "./icons/IconRawSpaceBetween";
import IconColumnPacked from "./icons/IconColumnPacked";
import IconColumnSpaceBetween from "./icons/IconColumnSpaceBetween";
import IconFlexGap from "./icons/IconFlexGap";
import { Tooltip } from "antd";
import { getOptionsFromEditor } from "../utils";
import IconAbsolute from "./icons/IconAbsolute";

const FlexItem = ({
  flexDirection,
  justifyContent,
  alignItems,
  onSelected,
  flexItem,
}: {
  flexDirection: CSSProperties["flexDirection"];
  justifyContent: string;
  alignItems: string;
  flexItem: any;
  onSelected: any;
}) => {
  const [hover, setHover] = useState(false);

  const rowList = [
    { width: "4px", height: "10px" },
    { width: "4px", height: "6px" },
  ];

  const columnList = [
    { width: "10px", height: "4px" },
    { width: "6px", height: "4px" },
  ];

  if (justifyContent === "space-between") {
    rowList.splice(1, 0, { width: "4px", height: "12px" });
    columnList.splice(1, 0, { width: "12px", height: "4px" });
  }

  const active =
    flexItem.justifyContent === justifyContent &&
    flexItem.alignItems === alignItems;

  return (
    <div
      className={css["flex-item"]}
      style={{
        display: "flex",
        flexDirection,
        alignItems: flexItem.alignItems,
        justifyContent: "space-around",
        opacity: active || hover ? 1 : 0.1,
      }}
      onClick={() => onSelected(flexItem.alignItems, flexItem.justifyContent)}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
    >
      {(flexDirection === "row" ? rowList : columnList).map((item) => (
        <div
          style={{
            width: item.width,
            height: item.height,
            borderRadius: "0.6px",
            backgroundColor: "rgba(0, 0, 0, 0.9)",
          }}
        ></div>
      ))}
    </div>
  );
};

const FlexBox = ({
  flexDirection,
  justifyContent,
  alignItems,
  onSelected,
}: any) => {
  const packedStyle: CSSProperties = {
    gridTemplateColumns: "1fr 1fr 1fr",
    gridTemplateRows: "1fr 1fr 1fr",
  };

  const rowSpaceBetweenStyle = {
    gridTemplateRows: "1fr 1fr 1fr",
  };

  const columnSpaceBetweenStyle = {
    gridTemplateColumns: "1fr 1fr 1fr",
  };

  const rowPackedItems = [
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

  const columnPackedItems = [
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

  const spaceBetweenItems = [
    {
      justifyContent: "space-between",
      alignItems: "flex-start",
    },
    {
      justifyContent: "space-between",
      alignItems: "center",
    },
    {
      justifyContent: "space-between",
      alignItems: "flex-end",
    },
  ];

  const activeStyle =
    justifyContent !== "space-between"
      ? packedStyle
      : flexDirection === "row"
        ? rowSpaceBetweenStyle
        : columnSpaceBetweenStyle;

  const activeItems =
    justifyContent === "space-between"
      ? spaceBetweenItems
      : flexDirection === "row"
        ? rowPackedItems
        : columnPackedItems;

  return (
    <div className={css["grid-container"]}>
      <div className={css["container"]}>
        <div className={css["single"]} style={activeStyle}>
          {activeItems.map((item) => (
            <FlexItem
              key={`${item.alignItems}_${item.justifyContent}`}
              flexDirection={flexDirection}
              justifyContent={justifyContent}
              alignItems={alignItems}
              flexItem={item}
              onSelected={onSelected}
            />
          ))}
        </div>
      </div>
    </div>
  );
};

interface Layout {
  layout: "flex-row" | "flex-column" | "absolute";
  flexDirection: CSSProperties["flexDirection"];
  layoutAlignItems: CSSProperties["alignItems"];
  layoutJustifyContent: CSSProperties["justifyContent"];
}


type LayoutOption = "absolute" | "flex-row" | "flex-column"

type LayoutOptions = LayoutOption[];

export default function ({ editConfig }: EditorProps): JSX.Element {
  const { value, options } = editConfig;

  const { options: layoutOptions } = getOptionsFromEditor(options) as { options: LayoutOptions };

  let layoutProps: any = {}

  if (layoutOptions && Array.isArray(layoutOptions) && layoutOptions.length !== 0) {
    layoutProps = layoutOptions.reduce((map, item) => ({ ...map, [item]: true }),
      {
        'absolute': false,
        'flex-column': false,
        'flex-row': false
      }
    ) as any;
  }

  // const flexDirection =
  //   value.get() !== "absolute" ? "" : value.get().split("-")[1];


  const model = useObservable<Layout>({
    layout: value.get()?.layout || "absolute",
    flexDirection: "row",
    layoutAlignItems: value.get()?.layoutAlignItems || "flex-start",
    layoutJustifyContent: value.get()?.layoutJustifyContent || "flex-start",
  });

  useComputed(() => {
    model.layout = value.get().layout || "absolute";
    model.layoutAlignItems = value.get()?.layoutAlignItems || "flex-start";
    model.layoutJustifyContent =
      value.get()?.layoutJustifyContent || "flex-start";
  });

  const onClickAbsoluteLayout = () => {
    const layout = "absolute";
    model.layout = layout;
    value.set({
      ...model,
      layout,
    });
  };

  const onClickFlexColumn = () => {
    model.layout = "flex-column";
    model.flexDirection = "column";
    value.set({
      ...model,
      layout: "flex-column",
    });
  };

  const onClickFlexRow = () => {
    model.layout = "flex-row";
    model.flexDirection = "row";
    value.set({
      ...model,
      layout: "flex-row",
    });
  };

  const onSelectFlexItem = (alignItems: string, justifyContent: string) => {
    model.layoutAlignItems = alignItems;
    model.layoutJustifyContent = justifyContent;
    value.set({
      ...model,
      layoutAlignItems: alignItems,
      layoutJustifyContent: justifyContent,
    });
  };

  const onToggleSpaceBetween = () => {
    const layoutJustifyContent =
      model.layoutJustifyContent === "space-between"
        ? "flex-start"
        : "space-between";
    model.layoutJustifyContent = layoutJustifyContent;
    value.set({
      ...model,
      layoutJustifyContent,
    });
  };

  useEffect(() => {
    model.flexDirection =
      value.get().layout === "flex-row" || value.get().layout === "flex-column" ? value.get()?.layout?.split("-")[1] : "row";
  }, []);

  return (
    <div className={css.layout}>
      <div className={css.basics}>
        <div className={css["flex-direction"]}>
          {
            layoutProps && layoutProps['absolute'] !== false ? <Tooltip
              title="自由排列"
              placement="bottom"
              overlayInnerStyle={{ fontSize: "12px" }}
            >
              <div
                className={`${css["direction"]} ${model.layout === "absolute" ? css["direction-active"] : ""
                  }`}
                onClick={onClickAbsoluteLayout}
              >
                <IconAbsolute />
              </div>
            </Tooltip> : null
          }
          {layoutProps && layoutProps['flex-column'] !== false ? <Tooltip
            title="纵向排列"
            placement="bottom"
            overlayInnerStyle={{ fontSize: "12px" }}
          >
            <div
              className={`${css["direction"]} ${model.layout === "flex-column" ? css["direction-active"] : ""
                }`}
              onClick={onClickFlexColumn}
            >
              <IconColumnDirection />
            </div>
          </Tooltip> : null}
          {
            layoutProps && layoutProps['flex-row'] !== false ? <Tooltip
              title="横向排列"
              placement="bottom"
              overlayInnerStyle={{ fontSize: "12px" }}
            >
              <div
                className={`${css["direction"]} ${model.layout === "flex-row" ? css["direction-active"] : ""
                  }`}
                onClick={onClickFlexRow}
              >
                <IconRowDirection />
              </div>
            </Tooltip> : null
          }
        </div>
        {/* <div className={css["flex-gap"]}>
          <div className={css["gap-icon"]}>
            <IconFlexGap />
          </div>
          <input className={css["gap-input"]} value={"Auto"} />
        </div> */}
      </div>
      {model.layout !== "absolute" ? (
        <>
          <FlexBox
            flexDirection={model?.flexDirection}
            justifyContent={model.layoutJustifyContent}
            alignItems={model.layoutAlignItems}
            onSelected={onSelectFlexItem}
          />
          <div className={css.advanced}>
            <div
              className={`${css.extra} ${model.layoutJustifyContent === "space-between"
                ? css["extra-active"]
                : ""
                }`}
              onClick={onToggleSpaceBetween}
            >
              {model.flexDirection === "row" ? (
                <>
                  {model.layoutJustifyContent !== "space-between" ? (
                    <Tooltip
                      title="堆叠"
                      placement="bottom"
                      overlayInnerStyle={{ fontSize: "12px" }}
                    >
                      <div className={css.svgWrapper}>
                        <IconRowPacked />
                      </div>
                    </Tooltip>
                  ) : (
                    <Tooltip
                      title="等距"
                      placement="bottom"
                      overlayInnerStyle={{ fontSize: "12px" }}
                    >
                      <div className={css.svgWrapper}>
                        <IconRawSpaceBetween />
                      </div>
                    </Tooltip>
                  )}
                </>
              ) : (
                <>
                  {model.layoutJustifyContent !== "space-between" ? (
                    <Tooltip
                      title="堆叠"
                      placement="bottom"
                      overlayInnerStyle={{ fontSize: "12px" }}
                    >
                      <div className={css.svgWrapper}>
                        <IconColumnPacked />
                      </div>
                    </Tooltip>
                  ) : (
                    <Tooltip
                      title="等距"
                      placement="bottom"
                      overlayInnerStyle={{ fontSize: "12px" }}
                    >
                      <div className={css.svgWrapper}>
                        <IconColumnSpaceBetween />
                      </div>
                    </Tooltip>
                  )}
                </>
              )}
            </div>
          </div>
        </>
      ) : null}
    </div>
  );
}
