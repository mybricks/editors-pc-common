import React, { CSSProperties, useCallback, useMemo, useState } from "react";
import {
  Panel,
  Select,
  Toggle,
  ColorEditor,
  InputNumber,
  FontSizeOutlined,
  FontFamilyOutlined,
  FontWeightOutlined,
  TextAlignLeftOutlined,
  TextAlignCenterOutlined,
  TextAlignRightOutlined,
  LetterSpacingOutlined,
  LineHeightOutlined,
  UnderLineOutlined,
} from "../../style_new/StyleEditor/components";
import { Ctx } from "../Style";
// import RenderSelect from "./select";
import { SelectOptions } from "../types";
// import GreyContainer from "./greyContainer";
// import FontLayout from "./fontLayout";
import { FontFamilyOptions, OptionsMap } from "../const";
import { initValues } from "../utils";
import { observe, useObservable } from "@mybricks/rxui";

// import css from "./index.less";
import { splitValueAndUnit } from "../../style_new/StyleEditor/utils";

const fontFamilyRegex =
  /font-family\s*?:(([^";<>]*?"[^";<>]*?")|(\s*[^";<>\s]*))*;?/g;

class EditCtx {
  color!: string;
  fontSize!: string;
  fontStyle!: string;
  fontWeight!: string;
  fontFamily!: string;
  lineHeight!: string;
  textDecoration!: string;
  letterSpacing!: string;
  fontFamilyOptions!: SelectOptions;

  /** 布局相关 */
  textAlign: CSSProperties["textAlign"];
  display: CSSProperties["display"];
  flexDirection: CSSProperties["flexDirection"];
  alignItems: CSSProperties["alignItems"];
  justifyContent: CSSProperties["justifyContent"];

  projectData: any;
}

const FONT_SIZE_OPTIONS = [
  { label: "px", value: "px" },
  { label: "继承", value: "inherit" },
];

const FONT_SIZE_DISABLED_LIST = ["inherit"];

const LINEHEIGHT_UNIT_OPTIONS = [
  { label: "倍数", value: "" },
  { label: "px", value: "px" },
  { label: "%", value: "%" },
  { label: "继承", value: "inherit" },
  { label: "默认", value: "normal" },
];
const LINEHEIGHT_UNIT_DISABLED_LIST = ["normal", "inherit"];
const LETTERSPACING_UNIT_OPTIONS = [
  { label: "px", value: "px" },
  { label: "继承", value: "inherit" },
  { label: "默认", value: "normal" },
];
const LETTERSPACING_UNIT_DISABLED_LIST = ["normal", "inherit"];

export const Font = function ({ hasLetterSpace = false }) {
  const ctx: Ctx = observe(Ctx, { from: "parents" });
  const editCtx: EditCtx = useObservable(EditCtx, (next) => {
    // const pubFontFamily = decodeURIComponent(ctx.projectData.pubFontFamily);
    // const fontFamilyAry = pubFontFamily.match(fontFamilyRegex);
    const otherOptions: SelectOptions = (ctx.projectData.fontfaces || []).map(
      (item: any) => {
        const { label } = item;
        return {
          label,
          value: label,
        };
      }
    );

    const defaultOptions: SelectOptions = (
      ctx.projectData.defaultFontfaces || []
    ).map((item: any) => {
      const { label } = item;
      return {
        label,
        value: label,
      };
    });

    // if (Array.isArray(fontFamilyAry)) {
    //   fontFamilyAry.forEach((item) => {
    //     const matchRes = item.match(/(\"(.*?)\")|\'(.*?)\'/gi);

    //     if (matchRes) {
    //       const value = matchRes[0];
    //       otherOptions.push({ label: value, value });
    //     }
    //   });
    // }

    const nextValue = initValues(
      {
        lineHeight: "14px",
        letterSpacing: "0px",
        fontSize: "14px",
        fontWeight: "400",
        color: "#222222",
        fontStyle: "normal",
        fontFamily: "",
        textDecoration: "normal",
      },
      ctx.val
    );

    next({
      color: nextValue.color,
      fontSize: nextValue.fontSize,
      fontStyle: nextValue.fontStyle,
      textDecoration: nextValue.textDecoration,
      fontWeight: nextValue.fontWeight,
      fontFamily: nextValue.fontFamily,
      lineHeight: nextValue.lineHeight,
      letterSpacing: nextValue.letterSpacing,
      fontFamilyOptions: otherOptions
        .concat(FontFamilyOptions)
        .concat(defaultOptions),

      textAlign: ctx.val.textAlign,
      display: ctx.val.display,
      flexDirection: ctx.val.flexDirection,
      alignItems: ctx.val.alignItems,
      justifyContent: ctx.val.justifyContent,
    });
  });

  const getTextAlignOptions = useCallback(() => {
    const useStart = ["start", "end"].includes(editCtx.textAlign as any);

    return [
      {
        label: <TextAlignLeftOutlined />,
        value: useStart ? "start" : "left",
        tip: "居左对齐",
      },
      { label: <TextAlignCenterOutlined />, value: "center", tip: "居中对齐" },
      {
        label: <TextAlignRightOutlined />,
        value: useStart ? "end" : "right",
        tip: "居右对齐",
      },
    ];
  }, []);

  const [lineHeight, setLineHeight] = useState<string | number>(
    editCtx.lineHeight!
  );

  const onLineHeightChange = useCallback(
    (lineHeight: string | number) => {
      ctx.set({ lineHeight });
      setLineHeight(lineHeight);
    },
    [lineHeight]
  );

  const onFontSizeChange = useCallback(
    (fontSize: string | number) => {
      const [fontSizeValue, fontSizeUnit] = splitValueAndUnit(fontSize);
      const [_, lineHeightUnit] = splitValueAndUnit(lineHeight);

      ctx.set({ fontSize });

      if (fontSizeUnit === "px") {
        const fontSizeNumber = Number(fontSizeValue);
        const lineHeightNumber = fontSizeNumber + 8; // 根据fontSizeNumber需设置的行高
        if (lineHeightUnit === "px") {
          onLineHeightChange(`${lineHeightNumber}px`);
        } else if (lineHeightUnit === "%") {
          onLineHeightChange(
            `${parseFloat(
              ((lineHeightNumber * 100) / fontSizeNumber).toFixed(4)
            )}%`
          );
        } else if (!isNaN(Number(lineHeight))) {
          // parseFloat和toFixed保留四位小数并去除尾0 防止上下键无法增减
          onLineHeightChange(
            `${parseFloat((lineHeightNumber / fontSizeNumber).toFixed(4))}`
          );
        }
      }
    },
    [lineHeight]
  );

  const Render: JSX.Element = useMemo(() => {
    return (
      <Panel title="字体">
        {ctx?.fontProps && ctx?.fontProps?.fontFamily !== false && (
          <Panel.Content>
            <Select
              tip={"字体"}
              prefix={<FontFamilyOutlined />}
              style={{ flexBasis: `100%`, padding: 0, overflow: "hidden" }}
              defaultValue={editCtx.fontFamily}
              options={editCtx.fontFamilyOptions}
              onChange={(fontFamily: string) => ctx.set({ fontFamily })}
            />
          </Panel.Content>
        )}
        <Panel.Content>
          <ColorEditor
            defaultValue={editCtx.color}
            onChange={(color: string) => ctx.set({ color })}
            style={{
              flexBasis: `calc(66% - 3px)`,
              padding: 0,
              overflow: "hidden",
              paddingLeft: 6,
            }}
          />
          <Select
            tip="粗细"
            prefix={<FontWeightOutlined />}
            style={{
              flexBasis: `calc(33% - 3px)`,
              padding: 0,
              overflow: "hidden",
            }}
            defaultValue={
              editCtx.fontWeight === "normal" ? "400" : editCtx.fontWeight
            }
            options={OptionsMap["fontWeight"]}
            onChange={(fontWeight) => ctx.set({ fontWeight })}
          />
          {
            // TODO 加上斜体会因为 ColorEditor 太长导致变挤
          }
          {/* <Select
              tip="斜体"
              prefix={<FontWeightOutlined />}
              style={{
                flexBasis: `calc(33% - 3px)`,
                padding: 0,
                overflow: "hidden",
              }}
              defaultValue={String(editCtx.fontStyle)}
              options={OptionsMap["fontStyle"]}
              onChange={(fontStyle) => ctx.set({ fontStyle })}
            /> */}
        </Panel.Content>
        <Panel.Content>
          <InputNumber
            tip="大小"
            style={{ flexBasis: `calc(33% - 3px)` }}
            prefix={<FontSizeOutlined />}
            defaultValue={editCtx.fontSize}
            defaultUnitValue="px"
            unitOptions={FONT_SIZE_OPTIONS}
            unitDisabledList={FONT_SIZE_DISABLED_LIST}
            onChange={onFontSizeChange}
          />
          <InputNumber
            tip="行高"
            style={{ flexBasis: `calc(33% - 3px)` }}
            prefix={<LineHeightOutlined />}
            value={editCtx.lineHeight}
            defaultUnitValue="inherit"
            unitOptions={LINEHEIGHT_UNIT_OPTIONS}
            unitDisabledList={LINEHEIGHT_UNIT_DISABLED_LIST}
            onChange={onLineHeightChange}
          />
          <Select
            tip="下划线"
            prefix={<UnderLineOutlined />}
            style={{
              flexBasis: `calc(33% - 3px)`,
              padding: 0,
              overflow: "hidden",
            }}
            defaultValue={editCtx.textDecoration}
            options={OptionsMap["textDecoration"]}
            onChange={(textDecoration) => ctx.set({ textDecoration })}
          />
        </Panel.Content>
        {hasLetterSpace && (
          <Panel.Content>
            <InputNumber
              tip="间距"
              style={{ flexBasis: `calc(33% - 3px)` }}
              prefix={<LetterSpacingOutlined />}
              defaultValue={editCtx.letterSpacing}
              unitOptions={LETTERSPACING_UNIT_OPTIONS}
              unitDisabledList={LETTERSPACING_UNIT_DISABLED_LIST}
              onChange={(letterSpacing) => ctx.set({ letterSpacing })}
            />
          </Panel.Content>
        )}
        <Panel.Content>
          <Toggle
            defaultValue={editCtx.textAlign}
            options={getTextAlignOptions()}
            onChange={(textAlign) => {
              ctx.set({ textAlign });
            }}
          />
        </Panel.Content>
        {
          // TODO 垂直相关
        }
        {/* <FontLayout
            verticalAlign={ctx.fontProps?.verticalAlign ?? true}
            horizontalAlign={ctx.fontProps.horizontalAlign ?? true}
            value={{
              textAlign: editCtx.textAlign,
              display: editCtx.display,
              flexDirection: editCtx.flexDirection,
              alignItems: editCtx.alignItems,
              justifyContent: editCtx.justifyContent
            }}
            onChange={(nextVal) => {
              ctx.set({ ...(nextVal ?? {}) });
            }}
          /> */}
      </Panel>
    );
  }, [hasLetterSpace]);

  return Render;
};

export default () => <Font hasLetterSpace={false} />;
