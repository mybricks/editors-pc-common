import React, { useState, useCallback, useRef, useEffect, CSSProperties } from "react";
import { createPortal } from "react-dom";

import { useStyleEditorContext } from "../..";

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
  TruncateTextOutlined,
} from "../../components";
import { splitValueAndUnit } from "../../utils";
import { isObject } from "../../../../util/lodash/isObject";
import { PanelBaseProps } from "../../type";
import { useDragNumber } from "../../hooks";
import { FontSetting } from "../../icons/FontSetting";
import { FontSettingNoTruncation } from "../../icons/FontSettingNoTruncation";
import { FontSettingTruncation } from "../../icons/FontSettingTruncation";
import css from "./index.less";

interface FontProps extends PanelBaseProps {
  value: CSSProperties;
  onChange: (value: { key: string; value: any } | Array<{ key: string; value: any }>) => void;
}

/** CSS 通用族名及关键字，无需加引号 */
const CSS_FONT_KEYWORDS = new Set([
  'inherit', 'initial', 'unset', 'revert',
  'serif', 'sans-serif', 'monospace', 'cursive', 'fantasy',
  'system-ui', 'ui-serif', 'ui-sans-serif', 'ui-monospace', 'ui-rounded',
  'emoji', 'math', 'fangsong',
]);

/**
 * 对需要引号的字体名加双引号：
 * - 含非 ASCII 字符（如 微软雅黑）
 * - 含空格（如 Microsoft YaHei、PingFang SC）
 * - CSS 关键字、以 - 开头的系统字体（-apple-system）不加引号
 */
function quoteIfNeeded(fontName: string): string {
  const trimmed = fontName.trim();
  if (CSS_FONT_KEYWORDS.has(trimmed)) return trimmed;
  if (trimmed.startsWith('-')) return trimmed;
  if (/[^\x00-\x7F]/.test(trimmed) || trimmed.includes(' ')) {
    return `"${trimmed}"`;
  }
  return trimmed;
}

/** 字体选项 */
const FONT_FAMILY_OPTIONS = [
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
  disableTruncateText: false,
  /** flex/inline-flex 容器时为 'flex'，此时对齐按钮映射到 justify-content */
  textAlignMode: '' as '' | 'flex',

  fontfaces: [],
};

/** justify-content 值 → 对齐按钮显示值 */
function justifyContentToAlign(jc?: string): string {
  if (jc === 'center') return 'center';
  if (jc === 'flex-end' || jc === 'end' || jc === 'right') return 'right';
  return 'left';
}

/** 对齐按钮值 → justify-content 值 */
function alignToJustifyContent(align: string): string {
  if (align === 'center') return 'center';
  if (align === 'right' || align === 'end') return 'flex-end';
  return 'flex-start';
}

type FontFamilyOption = { label: string; value: string };
type ExternalFontface = {
  label?: string;
  value?: string;
  /** 字体文件 URL，供导出到 Figma 时加载字形数据使用 */
  url?: string;
};

function normalizeFontfaceOptions(fontfaces: ExternalFontface[] = []): FontFamilyOption[] {
  return fontfaces
    .map((item) => {
      const value = item?.value;
      const label = item?.label;
      if (!value || !label) {
        return null;
      }
      return { label, value };
    })
    .filter(Boolean) as FontFamilyOption[];
}

function mergeFontOptionsByValue(...optionGroups: FontFamilyOption[][]): FontFamilyOption[] {
  const map = new Map<string, FontFamilyOption>();
  optionGroups
    .flat()
    .forEach((item) => {
      if (!item?.value) return;
      if (!map.has(item.value)) {
        map.set(item.value, item);
      }
    });
  return Array.from(map.values());
}

const FONT_MULTI_MAX = 4;

function parseFontFamily(fontFamily: any): string[] {
  if (!fontFamily || fontFamily === 'inherit') return [];
  const arr = Array.isArray(fontFamily)
    ? fontFamily
    : (fontFamily as string)
        .split(',')
        .filter(Boolean)
        .map((item: string) => item.trim().replace(/^["']|["']$/g, ''));
  return arr.slice(0, FONT_MULTI_MAX);
}

export function Font({ value, onChange, config, showTitle, collapse }: FontProps) {
  const context = useStyleEditorContext();
  const editConfig = context?.editConfig;
  const outterFontFamilyOptions = normalizeFontfaceOptions(editConfig?.fontfaces || []);

  // 重置脏数据
  if (isObject(value.fontFamily)) {
    value.fontFamily = "inherit";
    onChange({ key: "fontFamily", value: "inherit" });
  }

  const [cfg] = useState({ ...DEFAULT_CONFIG, ...config });

  const [innerFontFamily, setInnerFontFamily] = useState<string[] | undefined>(
    parseFontFamily(value.fontFamily)
  );

  const [isMultiMode, setIsMultiMode] = useState(false);
  const getDragPropsFontSize = useDragNumber({ continuous: true });
  const getDragPropsLineHeight = useDragNumber({ continuous: true });
  const getDragPropsLetterSpacing = useDragNumber({ continuous: true });

  const fontFamilyOptions = useCallback(() => {
    const configFontfaces = normalizeFontfaceOptions(cfg.fontfaces as ExternalFontface[]);
    // 固定顺序：预设 → config注入 → context注入，不受当前选中值影响
    const baseOptions = mergeFontOptionsByValue(
      FONT_FAMILY_OPTIONS as FontFamilyOption[],
      configFontfaces,
      outterFontFamilyOptions,
    );
    // 兼容旧数据：当前选中字体不在任何列表中时，追加到末尾（inherit 不作为字体项追加）
    const extraOptions = (innerFontFamily || [])
      .filter((f) => f && f !== 'inherit' && !baseOptions.some((o) => o.value === f))
      .map((f) => ({ label: f, value: f }));
    return extraOptions.length > 0
      ? mergeFontOptionsByValue(baseOptions, extraOptions)
      : baseOptions;
  }, [cfg.fontfaces, innerFontFamily, outterFontFamilyOptions]);

  const getTextAlignOptions = useCallback(() => {
    // flex 模式下固定用 left/right，与 justifyContentToAlign 的返回值保持一致
    if (cfg.textAlignMode === 'flex') {
      return [
        { label: <TextAlignLeftOutlined />, value: "left", tip: "居左对齐" },
        { label: <TextAlignCenterOutlined />, value: "center", tip: "居中对齐" },
        { label: <TextAlignRightOutlined />, value: "right", tip: "居右对齐" },
      ];
    }
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

  const [truncateLines, setTruncateLines] = useState<number>(() => {
    const clamp = (value as any).webkitLineClamp;
    return clamp && clamp !== 'none' ? Math.max(1, Number(clamp)) : 1;
  });

  const [isTruncated, setIsTruncated] = useState(() => {
    const v = value as any;
    return v.textOverflow === 'ellipsis' || (v.webkitLineClamp && v.webkitLineClamp !== 'none');
  });

  const [popoverOpen, setPopoverOpen] = useState(false);
  const popoverBtnRef = useRef<HTMLDivElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);

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

  useEffect(() => {
    if (!popoverOpen) return;

    const positionPopover = () => {
      if (!popoverBtnRef.current || !popoverRef.current) return;
      const btnRect = popoverBtnRef.current.getBoundingClientRect();
      const popRect = popoverRef.current.getBoundingClientRect();
      const windowH = window.innerHeight;

      const left = btnRect.right - popRect.width;
      let top = btnRect.bottom + 4;
      if (top + popRect.height > windowH) {
        top = btnRect.top - popRect.height - 4;
      }

      popoverRef.current.style.left = Math.max(8, left) + 'px';
      popoverRef.current.style.top = top + 'px';
      popoverRef.current.style.visibility = 'visible';
    };

    const timer = setTimeout(positionPopover, 0);

    const handleClickOutside = (e: MouseEvent) => {
      if (
        popoverRef.current && !popoverRef.current.contains(e.target as Node) &&
        popoverBtnRef.current && !popoverBtnRef.current.contains(e.target as Node)
      ) {
        setPopoverOpen(false);
      }
    };

    document.addEventListener('click', handleClickOutside);
    return () => {
      clearTimeout(timer);
      document.removeEventListener('click', handleClickOutside);
    };
  }, [popoverOpen]);

  const applyTruncate = useCallback((lines: number) => {
    if (isNaN(lines) || lines < 1) return;
    if (lines <= 1) {
      // 单行：white-space: nowrap + text-overflow: ellipsis 方案
      onChange([
        { key: 'textOverflow', value: 'ellipsis' },
        { key: 'overflow', value: 'hidden' },
        { key: 'whiteSpace', value: 'nowrap' },
        { key: 'display', value: null },
        { key: 'WebkitLineClamp', value: null },
        { key: 'WebkitBoxOrient', value: null },
        { key: 'overflowClipMargin', value: null },
        { key: 'maxHeight', value: null },
      ]);
    } else {
      // 多行：display:-webkit-box + -webkit-line-clamp，兼容性最佳。
      // 使用 overflow:clip + overflow-clip-margin:content-box，
      // 裁剪边界从 border-box 收窄到 content-box，
      // 无论 padding 多大都不会有多余行"漏"到 padding 区域。
      onChange([
        { key: 'overflow', value: 'clip' },
        { key: 'overflowClipMargin', value: 'content-box' },
        { key: 'whiteSpace', value: 'normal' },
        { key: 'display', value: '-webkit-box' },
        { key: 'WebkitLineClamp', value: String(lines) },
        { key: 'WebkitBoxOrient', value: 'vertical' },
        { key: 'textOverflow', value: null },
        { key: 'height', value: null },
        { key: 'maxHeight', value: null },
      ]);
    }
  }, [onChange]);

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
      { key: 'textOverflow', value: null },
      { key: 'overflow', value: null },
      { key: 'overflowClipMargin', value: null },
      { key: 'display', value: null },
      { key: 'WebkitLineClamp', value: null },
      { key: 'WebkitBoxOrient', value: null },
      { key: 'maxHeight', value: null },
      ...(cfg.textAlignMode === 'flex' ? [{ key: 'justifyContent', value: null }] : []),
    ]);
  }, [onChange, cfg.textAlignMode]);

  return (
    <Panel title="字体" showTitle={showTitle} showReset={true} resetFunction={refresh} collapse={collapse}>

      {cfg.disableFontFamily ? null : (
        <Panel.Content>
          {(() => {
            const modeFooter = (
              <div className={css.modeTabBar}>
                <span
                  className={`${css.modeTab} ${!isMultiMode ? css.modeTabActive : ''}`}
                  onClick={(e) => {
                    e.stopPropagation();
                    if (!isMultiMode) return;
                    const first = innerFontFamily?.[0] && innerFontFamily[0] !== 'inherit' ? [innerFontFamily[0]] : [];
                    setInnerFontFamily(first);
                    onChange({ key: 'fontFamily', value: first.length ? quoteIfNeeded(first[0]) : null });
                    setIsMultiMode(false);
                  }}
                >
                  单字体
                </span>
                <span
                  className={`${css.modeTab} ${isMultiMode ? css.modeTabActive : ''}`}
                  onClick={(e) => {
                    e.stopPropagation();
                    if (isMultiMode) return;
                    setIsMultiMode(true);
                  }}
                >
                  多字体
                </span>
              </div>
            );

            return isMultiMode ? (
              // 多字体模式：多选 + 拖拽排序 + 序号徽标
              <Select
                tip={
                  "字体" +
                  (innerFontFamily?.length && innerFontFamily[0] !== "inherit"
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
                style={{ padding: "0 8px", overflow: "hidden" }}
                options={fontFamilyOptions()}
                multiple={true}
                value={innerFontFamily}
                clearable={!!(innerFontFamily?.length && innerFontFamily[0] !== 'inherit')}
                onClear={() => {
                  setInnerFontFamily([]);
                  onChange({ key: 'fontFamily', value: null });
                }}
                onChange={(newValue: string[]) => {
                  let nextValue = newValue.filter((item) => item !== "inherit");
                  // 新增的字体插到第一位
                  const prev = innerFontFamily ?? [];
                  const added = nextValue.find(v => !prev.includes(v));
                  if (added) {
                    nextValue = [added, ...nextValue.filter(v => v !== added)];
                  }
                  // 最多保留 FONT_MULTI_MAX 个
                  nextValue = nextValue.slice(0, FONT_MULTI_MAX);
                  onChange({ key: "fontFamily", value: nextValue.length ? nextValue.map(quoteIfNeeded).join(", ") : null });
                  setInnerFontFamily(nextValue);
                }}
                onReorder={(newOrder: string[]) => {
                  setInnerFontFamily(newOrder);
                  onChange({ key: "fontFamily", value: newOrder.map(quoteIfNeeded).join(", ") });
                }}
                footer={modeFooter}
                placeholder="未配置字体"
              />
            ) : (
              // 单字体模式：简洁单选
              <Select
                tip={
                  "字体" +
                  (innerFontFamily?.[0] && innerFontFamily[0] !== "inherit"
                    ? "：" + (fontFamilyOptions().find(o => o.value === innerFontFamily[0])?.label ?? innerFontFamily[0])
                    : "")
                }
                prefix={<FontFamilyOutlined />}
                style={{ padding: "0 8px", overflow: "hidden" }}
                options={fontFamilyOptions()}
                value={innerFontFamily?.[0] && innerFontFamily[0] !== 'inherit' ? innerFontFamily[0] : undefined}
                clearable={!!(innerFontFamily?.[0] && innerFontFamily[0] !== 'inherit')}
                onClear={() => {
                  setInnerFontFamily([]);
                  onChange({ key: 'fontFamily', value: null });
                }}
                onChange={(newValue: string) => {
                  setInnerFontFamily([newValue]);
                  onChange({ key: 'fontFamily', value: quoteIfNeeded(newValue) });
                }}
                footer={modeFooter}
                placeholder="未配置字体"
              />
            );
          })()}
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

      {cfg.disableFontWeight && cfg.disableColor && cfg.disableFontSize ? null : (
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
      {cfg.disableLineHeight && cfg.disableLetterSpacing ? null : (
        <Panel.Content style={cfg.disableTextAlign && !cfg.disableTruncateText ? { position: 'relative' } : undefined}>
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
          {cfg.disableTextAlign && !cfg.disableTruncateText ? (
            <div
              ref={popoverBtnRef}
              className={`${css.truncateBtn}${popoverOpen ? ` ${css.active}` : ''}`}
              style={{ position: 'absolute', right: -22, top: '50%', transform: 'translateY(-50%)' }}
              onClick={() => setPopoverOpen(v => !v)}
              data-mybricks-tip="截断文字"
            >
              <FontSetting />
            </div>
          ) : null}
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
      {cfg.disableTextAlign ? (
        // 无对齐行时，按钮已合并进行高/字间距行；若那行也不显示，才单独兜底
        (!cfg.disableTruncateText && cfg.disableLineHeight && cfg.disableLetterSpacing) ? (
          <Panel.Content style={{ justifyContent: 'flex-end' }}>
            <div
              ref={popoverBtnRef}
              className={`${css.truncateBtn}${popoverOpen ? ` ${css.active}` : ''}`}
              style={{ marginRight: -25 }}
              onClick={() => setPopoverOpen(v => !v)}
              data-mybricks-tip="截断文字"
            >
              <FontSetting />
            </div>
          </Panel.Content>
        ) : null
      ) : (
        <Panel.Content style={{ position: 'relative' }}>
          <Toggle
            key={cfg.textAlignMode === 'flex'
              ? `flex-${value.justifyContent || ''}`
              : `text-${value.textAlign || ''}`}
            defaultValue={
              cfg.textAlignMode === 'flex'
                ? justifyContentToAlign(value.justifyContent as string)
                : value.textAlign
            }
            options={getTextAlignOptions()}
            onChange={(v) => {
              if (cfg.textAlignMode === 'flex') {
                onChange([
                  { key: 'justifyContent', value: alignToJustifyContent(v) },
                  { key: 'textAlign', value: null },
                ]);
              } else {
                onChange({ key: 'textAlign', value: v });
              }
            }}
          />
          {cfg.disableTruncateText ? null : (
            <div
              ref={popoverBtnRef}
              className={`${css.truncateBtn}${popoverOpen ? ` ${css.active}` : ''}`}
              style={{ position: 'absolute', right: -22, top: '50%', transform: 'translateY(-50%)' }}
              onClick={() => setPopoverOpen(v => !v)}
              data-mybricks-tip="截断文字"
            >
              <FontSetting />
            </div>
          )}
        </Panel.Content>
      )}
      {(!cfg.disableTruncateText && popoverOpen && createPortal(
      <div
        ref={popoverRef}
        className={css.truncatePopover}
        onClick={e => e.stopPropagation()}
      >
        <div className={css.popoverLabel}>截断文字</div>
        <Toggle
          key={`truncate-${(value as any).textOverflow || ''}-${(value as any).webkitLineClamp || ''}`}
          defaultValue={
            (value as any).textOverflow === 'ellipsis' ||
            ((value as any).webkitLineClamp && (value as any).webkitLineClamp !== 'none')
              ? 'ellipsis'
              : 'clip'
          }
          options={[
            { label: <FontSettingNoTruncation />, value: 'clip', tip: '不截断' },
            { label: <FontSettingTruncation />, value: 'ellipsis', tip: '省略号截断' },
          ]}
          onChange={(v) => {
            if (v === 'ellipsis') {
              setIsTruncated(true);
              applyTruncate(truncateLines);
            } else {
              setIsTruncated(false);
              onChange([
                { key: 'textOverflow', value: null },
                { key: 'overflow', value: null },
                { key: 'overflowClipMargin', value: null },
                { key: 'whiteSpace', value: null },
                { key: 'WebkitLineClamp', value: null },
                { key: 'display', value: null },
                { key: 'WebkitBoxOrient', value: null },
                { key: 'height', value: null },
                { key: 'maxHeight', value: null },
              ]);
            }
          }}
        />
        {isTruncated && (
          <div className={css.popoverRow}>
            <span className={css.maxLinesLabel}>最大行数</span>
            <InputNumber
              tip="最大行数"
              type="number"
              style={{ flex: 1, maxWidth: 120 }}
              defaultUnitValue=""
              value={String(truncateLines)}
              onChange={(lines) => {
                const parsed = parseInt(String(lines), 10);
                if (isNaN(parsed)) return;
                const n = Math.max(1, parsed);
                setTruncateLines(n);
                applyTruncate(n);
              }}
            />
          </div>
        )}
      </div>,
      document.body
    )) as React.ReactNode}
    </Panel>
  );
}
