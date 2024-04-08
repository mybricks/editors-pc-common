import React, { useState, useCallback, CSSProperties } from "react";

import {
  Panel,
  Select,
  Toggle,
  ColorEditor,
  InputNumber,
  FontSizeOutlined,
  WhiteSpaceOutlined,
  FontWeightOutlined,
  LineHeightOutlined,
  FontFamilyOutlined,
  LetterSpacingOutlined,
  TextAlignLeftOutlined,
  TextAlignRightOutlined,
  TextAlignCenterOutlined,
} from "../../components";
import { splitValueAndUnit } from "../../utils";

interface FontProps {
  value: CSSProperties;
  onChange: (value: { key: string; value: any }) => void;
  config: {
    [key: string]: any;
  };
}

/** 字体选项 */
const FONT_FAMILY_OPTIONS = [
  { label: "继承", value: "inherit" },
  { label: "PingFang SC", value: "PingFang SC" },
  { label: "Microsoft YaHei", value: "Microsoft YaHei" },
  { label: "微软雅黑", value: "微软雅黑" },
  { label: "Arial", value: "Arial" },
  { label: "sans-serif", value: "sans-serif" },
  { label: "Helvetica Neue", value: "Helvetica Neue" },
  { label: "Helvetica", value: "Helvetica" },
  { label: "Hiragino Sans GB", value: "Hiragino Sans GB" },
  { label: "-apple-system", value: "-apple-system" },
  { label: "BlinkMacSystemFont", value: "BlinkMacSystemFont" },
  { label: "Segoe UI", value: "Segoe UI" },
  { label: "Roboto", value: "Roboto" },
  { label: "Noto Sans", value: "Noto Sans" },
  { label: "Apple Color Emoji", value: "Apple Color Emoji" },
  { label: "Segoe UI Emoji", value: "Segoe UI Emoji" },
  { label: "Segoe UI Symbol", value: "Segoe UI Symbol" },
  { label: "Noto Color Emoji", value: "Noto Color Emoji" },
];

/** 字体加粗(原先的需求对标的某个app，忘了) */
const FONT_WEIGHT_OPTIONS = [
  { label: "极细", value: "100" },
  { label: "特细", value: "200" },
  { label: "细", value: "300" },
  { label: "标准", value: "400" },
  { label: "中黑", value: "500" },
  { label: "中粗", value: "700" },
  { label: "特粗", value: "900" },
  { label: "继承", value: "inherit" },
];

const WHITE_SPACE_OPTIONS = [
  { label: "normal", value: "normal" },
  { label: "nowrap", value: "nowrap" },
  { label: "pre", value: "pre" },
  { label: "pre-wrap", value: "pre-wrap" },
  { label: "pre-line", value: "pre-line" },
  { label: "break-spaces", value: "break-spaces" },
];

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

const DEFAULT_CONFIG = {
  disableTextAlign: false,
  disableFontFamily: false,
  disableColor: false,
  disableFontWeight: false,
  disableFontSize: false,
  disableLineHeight: false,
  disableLetterSpacing: false,
  disableWhiteSpace: false,

  fontfaces: [],
};

export function Font({ value, onChange, config }: FontProps) {
  const [cfg] = useState({ ...DEFAULT_CONFIG, ...config });
  const [innerFontFamily, setInnerFontFamily] = useState<string | string[] | undefined>(value.fontFamily);

  const fontFamilyOptions = useCallback(() => {
    const fontfaces = (cfg.fontfaces as typeof FONT_FAMILY_OPTIONS).filter((item) => item.label && item.value);
    return [...FONT_FAMILY_OPTIONS, ...fontfaces];
  }, []);

  const getTextAlignOptions = useCallback(() => {
    const useStart = ["start", "end"].includes(value.textAlign as any);

    return [
      { label: <TextAlignLeftOutlined />, value: useStart ? "start" : "left", tip: "居左对齐" },
      { label: <TextAlignCenterOutlined />, value: "center", tip: "居中对齐" },
      { label: <TextAlignRightOutlined />, value: useStart ? "end" : "right", tip: "居右对齐" },
    ];
  }, []);

  const [lineHeight, setLineHeight] = useState<string | number>(value.lineHeight!);

  const onFontSizeChange = useCallback(
    (fontSize) => {
      const [fontSizeValue, fontSizeUnit] = splitValueAndUnit(fontSize);
      const [lineHeightValue, lineHeightUnit] = splitValueAndUnit(lineHeight);

      onChange({ key: "fontSize", value: fontSize });

      if (fontSizeUnit === lineHeightUnit && lineHeightUnit === "px") {
        const fontSizeNumber = Number(fontSizeValue);
        const lineHeightNumber = Number(lineHeightValue);
        if (!isNaN(lineHeightNumber) && !isNaN(fontSizeNumber) && lineHeightNumber < fontSizeNumber) {
          onLineHeightChange(fontSize);
        }
      }
    },
    [lineHeight]
  );

  const onLineHeightChange = useCallback((lineHeight) => {
    onChange({ key: "lineHeight", value: lineHeight });
    setLineHeight(lineHeight);
  }, []);

  return (
    <Panel title="字体">
      {cfg.disableFontFamily && cfg.disableColor ? null : (
        <Panel.Content>
          {cfg.disableFontFamily ? null : (
            <Select
              tip="字体"
              prefix={<FontFamilyOutlined />}
              style={{ flexBasis: `100%`, padding: 0, overflow: "hidden" }}
              defaultValue={value.fontFamily}
              options={fontFamilyOptions()}
              multiple={true}
              value={
                Array.isArray(innerFontFamily)
                  ? innerFontFamily
                  : innerFontFamily?.split(",").map((item) => item.trim())
              }
              onChange={(newValue) => {
                if (Array.isArray(newValue) && newValue[newValue.length - 1] === "inherit") {
                  onChange({ key: "fontFamily", value: ["inherit"] });
                  setInnerFontFamily(["inherit"]);
                } else {
                  const nextValue = newValue.filter((item) => item !== "inherit");
                  onChange({ key: "fontFamily", value });
                  setInnerFontFamily(nextValue);
                }
              }}
            />
          )}
        </Panel.Content>
      )}
      {cfg.disableFontWeight && cfg.disableFontSize ? null : (
        <Panel.Content>
          {cfg.disableColor ? null : (
            <ColorEditor
              style={{ flexBasis: `calc(66% - 3px)`, padding: 0, overflow: "hidden", paddingLeft: 6 }}
              defaultValue={value.color}
              onChange={(value) => onChange({ key: "color", value })}
            />
          )}
          {cfg.disableFontWeight ? null : (
            <Select
              tip="粗细"
              prefix={<FontWeightOutlined />}
              style={{ flexBasis: `calc(33% - 3px)`, padding: 0, overflow: "hidden" }}
              defaultValue={value.fontWeight}
              options={FONT_WEIGHT_OPTIONS}
              onChange={(value) => onChange({ key: "fontWeight", value })}
            />
          )}
        </Panel.Content>
      )}
      {cfg.disableLineHeight && cfg.disableLetterSpacing ? null : (
        <Panel.Content>
          {cfg.disableFontSize ? null : (
            <InputNumber
              tip="大小"
              style={{ flexBasis: `calc(33% - 3px)` }}
              prefix={<FontSizeOutlined />}
              defaultValue={value.fontSize}
              unitOptions={FONT_SIZE_OPTIONS}
              unitDisabledList={FONT_SIZE_DISABLED_LIST}
              onChange={onFontSizeChange}
            />
          )}
          {cfg.disableLineHeight ? null : (
            <InputNumber
              tip="行高"
              style={{ flexBasis: `calc(33% - 3px)` }}
              prefix={<LineHeightOutlined />}
              value={lineHeight}
              defaultUnitValue="inherit"
              unitOptions={LINEHEIGHT_UNIT_OPTIONS}
              unitDisabledList={LINEHEIGHT_UNIT_DISABLED_LIST}
              onChange={onLineHeightChange}
            />
          )}
          {cfg.disableLetterSpacing ? null : (
            <InputNumber
              tip="间距"
              style={{ flexBasis: `calc(33% - 3px)` }}
              prefix={<LetterSpacingOutlined />}
              defaultValue={value.letterSpacing}
              unitOptions={LETTERSPACING_UNIT_OPTIONS}
              unitDisabledList={LETTERSPACING_UNIT_DISABLED_LIST}
              onChange={(value) => onChange({ key: "letterSpacing", value })}
            />
          )}
        </Panel.Content>
      )}
      {cfg.disableWhiteSpace ? null : (
        <Panel.Content>
          <Select
            tip="空白字符合并、换行"
            prefix={<WhiteSpaceOutlined />}
            style={{ padding: 0, overflow: "hidden" }}
            defaultValue={value.whiteSpace}
            options={WHITE_SPACE_OPTIONS}
            onChange={(value) => onChange({ key: "whiteSpace", value })}
          />
        </Panel.Content>
      )}
      {cfg.disableTextAlign ? null : (
        <Panel.Content>
          <Toggle
            defaultValue={value.textAlign}
            options={getTextAlignOptions()}
            onChange={(value) => onChange({ key: "textAlign", value })}
          />
        </Panel.Content>
      )}
    </Panel>
  );
}
