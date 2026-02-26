import React, { useState, useCallback, useRef, CSSProperties } from "react";

import {
  Panel,
  Select,
  Toggle,
  ColorEditor,
  InputNumber,
  FontSizeOutlined,
  FontWeightOutlined,
  LineHeightOutlined,
  FontFamilyOutlined,
  LetterSpacingOutlined,
  TextAlignLeftOutlined,
  TextAlignRightOutlined,
  TextAlignCenterOutlined,
} from "../../components";
import { splitValueAndUnit } from "../../utils";
import { isObject } from "../../../../util/lodash/isObject";
import { PanelBaseProps } from "../../type";
import { useDragNumber } from "../../hooks";
import uniq from "lodash/uniq";

interface FontProps extends PanelBaseProps {
  value: CSSProperties;
  onChange: (value: { key: string; value: any } | Array<{ key: string; value: any }>) => void;
}

/** 字体选项 */
const FONT_FAMILY_OPTIONS = [
  { label: "默认", value: "inherit" },
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
  // { label: "默认", value: "inherit" },
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
  // { label: "默认", value: "inherit" },
];
const FONT_SIZE_DISABLED_LIST = ["inherit"];

const LINEHEIGHT_UNIT_OPTIONS = [
  { label: "倍数", value: "" },
  { label: "px", value: "px" },
  { label: "%", value: "%" },
  // { label: "继承", value: "inherit" },
  // { label: "默认", value: "normal" },
];
const LINEHEIGHT_UNIT_DISABLED_LIST = ["normal", "inherit"];
const LETTERSPACING_UNIT_OPTIONS = [
  { label: "px", value: "px" },
  // { label: "继承", value: "inherit" },
  // { label: "默认", value: "normal" },
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

export function Font({ value, onChange, config, showTitle, collapse }: FontProps) {
  // 重置脏数据
  if (isObject(value.fontFamily)) {
    value.fontFamily = "inherit";
    onChange({ key: "fontFamily", value: "inherit" });
  }

  const [cfg] = useState({ ...DEFAULT_CONFIG, ...config });
  const [innerFontFamily, setInnerFontFamily] = useState<string[] | undefined>(
    Array.isArray(value.fontFamily)
      ? value.fontFamily
      : value.fontFamily
        ?.split(",")
        .filter(Boolean)
        .map((item) => item.trim().replace(/^"|"$/g, ""))
  );
  const getDragPropsFontSize = useDragNumber({ continuous: true });
  const getDragPropsLineHeight = useDragNumber({ continuous: true });
  const getDragPropsLetterSpacing = useDragNumber({ continuous: true });

  function mergeFonts(additionalFonts: string[]) {
    // 去除空格去重
    const fonts = uniq(additionalFonts);
    // 如果遇到预设没有的字体就直接加到选项中
    const newOptions = fonts.map((font) => {
      const replaceFont = font.replace(/^"|"$/g, "");
      const existingOption = FONT_FAMILY_OPTIONS.find(
        (option) => option.value === replaceFont
      );
      if (existingOption) {
        return existingOption;
      } else {
        // 如果不存在，可以添加一个新的对象，这里假设label和value相同
        return { label: replaceFont, value: replaceFont };
      }
    });

    // 合并新的选项到原有的 FONT_FAMILY_OPTIONS
    return uniq([...FONT_FAMILY_OPTIONS, ...newOptions]);
  }

  const fontFamilyOptions = useCallback(() => {
    const updatedOptions = mergeFonts(innerFontFamily || []);
    const fontfaces = (cfg.fontfaces as typeof updatedOptions).filter(
      (item) => item.label && item.value
    );

    return uniq([...updatedOptions, ...fontfaces]);
  }, [innerFontFamily]);

  const getTextAlignOptions = useCallback(() => {
    const useStart = ["start", "end"].includes(value.textAlign as any);

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
    value.lineHeight!
  );
  
  const throttleTimerRef = useRef<NodeJS.Timeout | null>(null);
  const lastUpdateTimeRef = useRef<number>(0);

  const onFontSizeChange = useCallback(
    (fontSize: string | number) => {
      const [fontSizeValue, fontSizeUnit] = splitValueAndUnit(fontSize);
      const [lineHeightValue, lineHeightUnit] = splitValueAndUnit(lineHeight);

      if (fontSizeUnit === "px") {
        const fontSizeNumber = Number(fontSizeValue);
        const lineHeightNumber = fontSizeNumber + 8; // 根据fontSizeNumber需设置的行高
        
        const executeUpdate = () => {
          if (lineHeightUnit === "px") {
            onLineHeightChange(`${lineHeightNumber}px`, fontSize);
          } else if (lineHeightUnit === "%") {
            onLineHeightChange(
              `${parseFloat(
                ((lineHeightNumber * 100) / fontSizeNumber).toFixed(4)
              )}%`,
              fontSize
            );
          } else if (!isNaN(Number(lineHeight))) {
            // 计算倍数并保留一位小数，避免拖拽时出现过多小数位
            const ratio = lineHeightNumber / fontSizeNumber;
            const roundedRatio = Math.round(ratio * 10) / 10;
            onLineHeightChange(`${roundedRatio}`, fontSize);
          } else {
            // 计算倍数并保留一位小数，避免拖拽时出现过多小数位
            const ratio = lineHeightNumber / fontSizeNumber;
            const roundedRatio = Math.round(ratio * 10) / 10;
            onLineHeightChange(`${roundedRatio}`, fontSize);
          }
        };
        
        // 使用节流控制更新频率，每200ms最多更新一次
        const now = Date.now();
        if (now - lastUpdateTimeRef.current < 200) {
          // 清除之前的定时器
          if (throttleTimerRef.current) {
            clearTimeout(throttleTimerRef.current);
          }
          // 设置新的定时器，确保最后一次更新能执行
          throttleTimerRef.current = setTimeout(() => {
            lastUpdateTimeRef.current = Date.now();
            executeUpdate();
          }, 200);
          // 先只更新字体大小
          onChange({ key: "fontSize", value: fontSize });
          return;
        }
        
        lastUpdateTimeRef.current = now;
        executeUpdate();
      } else {
        // 需要修改lineHeight就合并，不需要就单独修改
        onChange({ key: "fontSize", value: fontSize });
      }

      // if (fontSizeUnit === lineHeightUnit && lineHeightUnit === "px") {
      //   const fontSizeNumber = Number(fontSizeValue);
      //   const lineHeightNumber = Number(lineHeightValue);
      //   if (!isNaN(lineHeightNumber) && !isNaN(fontSizeNumber) && lineHeightNumber < fontSizeNumber) {
      //     onLineHeightChange(fontSize);
      //   }
      // }
    },
    [lineHeight]
  );

  const onLineHeightChange = useCallback(
    (value: string | number, fontSize?: string | number) => {
      const res = [];
      if (fontSize) {
        res.push({ key: "fontSize", value: fontSize });
      }
      if (lineHeight !== value) {
        res.push({ key: "lineHeight", value });
        setLineHeight(value);
      }
      if (res.length > 0) {
        onChange(res);
      }
    },
    [lineHeight]
  );

  const refresh = useCallback(() => {
    onChange([
      { key: 'color', value: null },
      { key: 'fontSize', value: null },
      { key: 'fontWeight', value: null },
      { key: 'fontFamily', value: null },
      { key: 'lineHeight', value: null },
      { key: 'letterSpacing', value: null },
      { key: 'textAlign', value: null },
      { key: 'whiteSpace', value: null },
    ]);
  }, [onChange]);

  return (
    <Panel title="字体" showTitle={showTitle} showReset={true} resetFunction={refresh} collapse={collapse}>

      {cfg.disableFontFamily ? null : (
        <Panel.Content>
          {cfg.disableFontFamily ? null : (
            <Select
              tip={
                "字体" +
                (innerFontFamily?.[0] !== "inherit"
                  ? "：" +
                  innerFontFamily
                    ?.map?.(
                      (item) =>
                        fontFamilyOptions().find(
                          (option) => option.value === item
                        )?.label ?? item
                    )
                    .filter(Boolean)
                    .join("，")
                  : "")
              }
              prefix={<FontFamilyOutlined />}
              style={{ flexBasis: `100%`,padding: "0 8px", overflow: "hidden" }}
              defaultValue={value.fontFamily}
              options={fontFamilyOptions()}
              multiple={true}
              value={innerFontFamily}
              onChange={(newValue: string[]) => {
                if (
                  Array.isArray(newValue) &&
                  newValue[newValue.length - 1] === "inherit"
                ) {
                  onChange({ key: "fontFamily", value: "inherit" });
                  setInnerFontFamily(["inherit"]);
                } else {
                  let nextValue = newValue.filter((item) => item !== "inherit");
                  if (nextValue.length === 0) {
                    nextValue = ["inherit"];
                  }
                  onChange({ key: "fontFamily", value: nextValue.join(", ") });
                  setInnerFontFamily(nextValue);
                }
              }}
            />
          )}
        </Panel.Content>
      )}
      {cfg.disableColor ? null : (
        <Panel.Content>
          <ColorEditor
            style={{
              flex: 2,
              padding: 6,
              overflow: "hidden",
              paddingLeft: 8,
            }}
            defaultValue={value.color}
            showSubTabs={false}
            onChange={(value) => onChange({ key: "color", value })}
          />
        </Panel.Content>
      )}

      {cfg.disableFontWeight && cfg.disableColor ? null : (
        <Panel.Content>

          {cfg.disableFontWeight ? null : (
            <Select
              tip="粗体"
              prefix={<FontWeightOutlined />}
              style={{
                flex: 1,
                padding: "0 8px",
                overflow: "hidden",
              }}
              labelStyle={{
                textAlign:"left"
              }}
              defaultValue={value.fontWeight}
              options={FONT_WEIGHT_OPTIONS}
              onChange={(value) => onChange({ key: "fontWeight", value })}
            />
          )}

          {cfg.disableFontSize ? null : (
            <Panel.Item style={{ display: "flex", alignItems: "center", flex: 1, padding: "0 8px" }}>
              <div 
                {...getDragPropsFontSize(value.fontSize, '拖拽调整字号')}
                style={{ 
                  height: "100%", 
                  display: "flex", 
                  alignItems: "center", 
                  justifyContent: "center", 
                  minWidth: 15,
                  cursor: "ew-resize"
                }}
              >
                <FontSizeOutlined />
              </div>
              <InputNumber
                tip="字号"
                type="number"
                style={{ flex: 1, marginLeft: 4 }}
                defaultValue={value.fontSize}
                unitOptions={FONT_SIZE_OPTIONS}
                // unitDisabledList={FONT_SIZE_DISABLED_LIST}
                onChange={onFontSizeChange}
              />
            </Panel.Item>
          )}
        </Panel.Content>
      )}
      {cfg.disableLineHeight &&
        cfg.disableLetterSpacing &&
        cfg.disableFontSize ? null : (
        <Panel.Content>
          {cfg.disableLineHeight ? null : (
            <Panel.Item style={{ display: "flex", alignItems: "center", flex: 1, padding: "0 8px" }}>
              <div 
                {...getDragPropsLineHeight(lineHeight, '拖拽调整行高')}
                style={{ 
                  height: "100%", 
                  display: "flex", 
                  alignItems: "center", 
                  justifyContent: "center", 
                  minWidth: 15,
                  cursor: "ew-resize"
                }}
              >
                <LineHeightOutlined />
              </div>
              <InputNumber
                tip="行高"
                type="number"
                style={{ flex: 1, marginLeft: 4 }}
                value={['unset', 'normal', 'inherit'].includes(lineHeight as string) ? '1' : lineHeight}
                unitOptions={LINEHEIGHT_UNIT_OPTIONS}
                // unitDisabledList={LINEHEIGHT_UNIT_DISABLED_LIST}
                onChange={onLineHeightChange}
              />
            </Panel.Item>
          )}
          {cfg.disableLetterSpacing ? null : (
            <Panel.Item style={{ display: "flex", alignItems: "center", flex: 1, padding: "0 8px" }}>
              <div 
                {...getDragPropsLetterSpacing(value.letterSpacing, '拖拽调整字间距')}
                style={{ 
                  height: "100%", 
                  display: "flex", 
                  alignItems: "center", 
                  justifyContent: "center", 
                  minWidth: 15,
                  cursor: "ew-resize"
                }}
              >
                <LetterSpacingOutlined />
              </div>
              <InputNumber
                tip="字间距"
                type="number"
                style={{ flex: 1, marginLeft: 4 }}
                defaultValue={value.letterSpacing}
                unitOptions={LETTERSPACING_UNIT_OPTIONS}
                // unitDisabledList={LETTERSPACING_UNIT_DISABLED_LIST}
                onChange={(value) => onChange({ key: "letterSpacing", value })}
              />
            </Panel.Item>
          )}
        </Panel.Content>
      )}
      {/* {cfg.disableWhiteSpace ? null : (
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
      )} */}
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
