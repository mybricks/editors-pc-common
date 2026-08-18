import React, { useState, useCallback, useMemo, useRef, useEffect, CSSProperties } from "react";
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
  Dropdown,
  DownOutlined,
  SketchPopup,
  VariableChip,
  VariableList,
} from "../../components";
import { splitValueAndUnit, formatLengthDisplay } from "../../utils";
import { isObject } from "../../../../util/lodash/isObject";
import { PanelBaseProps } from "../../type";
import { useDragNumber, useCanvasColorVariables, useCanvasLengthVariables } from "../../hooks";
import { Variable } from "../../icons/Variable";
import { FontSetting } from "../../icons/FontSetting";
import { FontSettingTruncation } from "../../icons/FontSettingTruncation";
import { isGradientValue } from "../../helper/gradient-border";
import { toStyleChangeItems } from "../../helper/paint-stack";
import {
  buildGradientTextFill,
  buildSolidTextFill,
  isTextFillActive,
  parseTextFillDisplayValue,
} from "../../helper/text-fill";
import { getColorEditorValue } from "../../helper/get-color-editor-value";
import { resolveCssVarColor } from "../../../core/resolve-css-var-color";
import { resolveCssVarLength } from "../../../core/resolve-css-var-length";
import css from "./index.less";

const APPLY_VARIABLE_ACTION = 'applyVariable';

/** 字号预置档位（对齐 Figma 的字号下拉） */
const FONT_SIZE_PRESETS = [10, 11, 12, 13, 14, 15, 16, 20, 24, 32, 36, 40, 48, 64, 96, 128];

/** 档位全展开，宽度不被长文案撑开（超出走省略号） */
const FONT_SIZE_MENU_STYLE: CSSProperties = { maxHeight: 'none', maxWidth: 132 };

/** 已绑定 CSS 变量：输入框换成变量胶囊，且不参与数值换算与联动 */
function isCssVarValue(val?: string | number | null): val is string {
  return typeof val === 'string' && val.trim().toLowerCase().startsWith('var(');
}

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

const FONT_WEIGHT_OPTIONS = [
  { label: "极细",  value: "100", suffix: "100" },
  { label: "特细",  value: "200", suffix: "200" },
  { label: "细体",  value: "300", suffix: "300" },
  { label: "标准",  value: "400", suffix: "400" },
  { label: "中等",  value: "500", suffix: "500" },
  { label: "中黑",  value: "600", suffix: "600" },
  { label: "粗体",  value: "700", suffix: "700" },
  { label: "特粗",  value: "800", suffix: "800" },
  { label: "极粗",  value: "900", suffix: "900" },
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
  { label: "默认", value: "default" },
  { label: "倍数", value: "" },
  { label: "px", value: "px" },
  { label: "%", value: "%" },
];
const LINEHEIGHT_UNIT_DISABLED_LIST = ["default"];
const LETTERSPACING_UNIT_OPTIONS = [
  { label: "px", value: "px" },
  // { label: "继承", value: "inherit" },
  // { label: "默认", value: "normal" },
];
const LETTERSPACING_UNIT_DISABLED_LIST = ["normal", "inherit"];

const TEXT_DECORATION_STYLE_OPTIONS = [
  { label: "实线", value: "solid" },
  { label: "点状", value: "dotted" },
  { label: "虚线", value: "dashed" },
  { label: "双线", value: "double" },
  { label: "波浪", value: "wavy" },
];

const TEXT_DECORATION_LENGTH_UNITS = [
  { label: "px", value: "px" },
  { label: "%", value: "%" },
];

const TEXT_DECORATION_STYLE_VALUES = ["solid", "dotted", "dashed", "double", "wavy"] as const;

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

const CSS_LENGTH_UNSET_KEYWORDS = ['unset', 'normal', 'inherit', 'initial'];

/** 是否为用户显式配置的长度类样式（非空、非关键字） */
function isConfiguredCssLength(value: unknown): boolean {
  if (value == null || value === '') return false;
  return !CSS_LENGTH_UNSET_KEYWORDS.includes(String(value));
}

/** 读取 DOM 计算值（px），用于未配置时的 placeholder / tip */
function getComputedCssLengthPx(
  dom: HTMLElement | null | undefined,
  prop: 'fontSize' | 'lineHeight' | 'letterSpacing'
): number | null {
  if (!dom) return null;
  const raw = window.getComputedStyle(dom)[prop];
  // letter-spacing: normal → 0
  if (prop === 'letterSpacing' && (!raw || raw === 'normal')) return 0;
  const n = parseFloat(raw);
  if (isNaN(n)) return null;
  return Math.round(n);
}

function buildDefaultLengthPlaceholder(px: number | null): string {
  return px != null ? `默认(${px})` : '默认';
}

function buildDefaultLengthTip(label: string, px: number | null): string {
  return px != null ? `当前未配置${label}值，${px}为计算值` : label;
}

/** 行高单位互转：先归一到 px，再转到目标单位；无效时用 defaultPx */
function convertLineHeightValue(
  num: number,
  fromUnit: string,
  toUnit: string,
  fontSizePx: number,
  defaultPx: number
): string {
  const fs = fontSizePx > 0 ? fontSizePx : 14;
  let px: number;
  if (fromUnit === 'px') px = num;
  else if (fromUnit === '%') px = (num / 100) * fs;
  else px = num * fs; // 倍数（unit === ''）

  if (!px || isNaN(px)) px = defaultPx;

  if (toUnit === 'px') return `${Math.round(px)}px`;
  if (toUnit === '%') return `${parseFloat(((px / fs) * 100).toFixed(2))}%`;
  return `${parseFloat((px / fs).toFixed(2))}`;
}

/** 行高单位 key：仅单位变化时重挂载，避免拖拽改数字导致输入框失焦 */
function getLineHeightUnitKey(val: string | number | null | undefined): string {
  if (val == null || val === '' || !isConfiguredCssLength(val)) return 'default';
  const [, unit] = splitValueAndUnit(String(val));
  return unit || 'ratio';
}

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

type FontFamilyOption = { label: string; value: string; style?: CSSProperties };
type ExternalFontface = {
  label?: string;
  value?: string;
  /** 字体文件 URL，供导出到 Figma 时加载字形数据使用 */
  url?: string;
};

/** 为字体选项附加 fontFamily，供下拉列表项样式回显 */
function withFontFamilyPreview(option: FontFamilyOption): FontFamilyOption {
  return {
    ...option,
    style: { fontFamily: quoteIfNeeded(option.value) },
  };
}

function normalizeFontfaceOptions(fontfaces: ExternalFontface[] = []): FontFamilyOption[] {
  return fontfaces
    .map((item) => {
      const value = item?.value;
      const label = item?.label;
      if (!value || !label) {
        return null;
      }
      return withFontFamilyPreview({ label, value });
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

/** 解析当前 textDecoration，返回 'underline' | 'line-through' | 'none' */
function parseTextDecoration(td: string | undefined): 'underline' | 'line-through' | 'none' {
  if (!td || td === 'none') return 'none';
  if (String(td).includes('line-through')) return 'line-through';
  if (String(td).includes('underline')) return 'underline';
  return 'none';
}

function parseTextDecorationStyle(style: string | undefined, shorthand?: string): string {
  if (style && TEXT_DECORATION_STYLE_VALUES.includes(style as any)) return style;
  if (shorthand) {
    const raw = String(shorthand);
    for (const token of ['wavy', 'double', 'dotted', 'dashed', 'solid'] as const) {
      if (raw.includes(token)) return token;
    }
  }
  return 'solid';
}

function parseDecorationLength(value: string | undefined): string | null {
  if (!value || ['auto', 'from-font', 'inherit', 'initial', 'unset', 'none'].includes(value)) {
    return null;
  }
  return value;
}

export function Font({ value, onChange, config, showTitle }: FontProps) {
  const context = useStyleEditorContext();
  const editConfig = context?.editConfig;
  const { targetDom, variableOptions: canvasColorVariables } = useCanvasColorVariables();
  const outterFontFamilyOptions = normalizeFontfaceOptions(editConfig?.fontfaces || []);
  const valueRef = useRef(value);
  valueRef.current = value;

  // 重置脏数据
  if (isObject(value.fontFamily)) {
    value.fontFamily = "inherit";
    onChange({ key: "fontFamily", value: "inherit" });
  }

  const [cfg] = useState({ ...DEFAULT_CONFIG, ...config });

  const handleTextFillChange = useCallback(
    (input: any) => {
      const next = getColorEditorValue(input);
      if (!next) return;
      const current = valueRef.current as Record<string, any>;
      if (isGradientValue(next)) {
        onChange(toStyleChangeItems(buildGradientTextFill(next, current)));
      } else {
        onChange(toStyleChangeItems(buildSolidTextFill(next, current)));
      }
    },
    [onChange]
  );

  const textFillValue = parseTextFillDisplayValue(value as Record<string, any>);
  const textFillResolvedColor = resolveCssVarColor(textFillValue, targetDom);
  const textFillEditorKey = `${isTextFillActive(value as Record<string, any>)
    ? "text-fill-gradient"
    : "text-fill-solid"}-${textFillValue}-${textFillResolvedColor ?? ""}`;

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
      (FONT_FAMILY_OPTIONS as FontFamilyOption[]).map(withFontFamilyPreview),
      configFontfaces,
      outterFontFamilyOptions,
    );
    // 兼容旧数据：当前选中字体不在任何列表中时，追加到末尾（inherit 不作为字体项追加）
    const extraOptions = (innerFontFamily || [])
      .filter((f) => f && f !== 'inherit' && !baseOptions.some((o) => o.value === f))
      .map((f) => withFontFamilyPreview({ label: f, value: f }));
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

  const [fontSize, setFontSize] = useState<string | number | null>(() =>
    isConfiguredCssLength(value.fontSize) ? (value.fontSize as string | number) : null
  );
  const [lineHeight, setLineHeight] = useState<string | number | null>(() =>
    isConfiguredCssLength(value.lineHeight) ? (value.lineHeight as string | number) : null
  );
  const [letterSpacing, setLetterSpacing] = useState<string | number | null>(() =>
    isConfiguredCssLength(value.letterSpacing) ? (value.letterSpacing as string | number) : null
  );

  // 切换选中元素时按规则重算；同元素内以本地 onChange 为准，避免与乐观更新互相覆盖
  useEffect(() => {
    setFontSize(isConfiguredCssLength(value.fontSize) ? (value.fontSize as string | number) : null);
    setLineHeight(isConfiguredCssLength(value.lineHeight) ? (value.lineHeight as string | number) : null);
    setLetterSpacing(
      isConfiguredCssLength(value.letterSpacing) ? (value.letterSpacing as string | number) : null
    );
  }, [targetDom]);

  const { variableOptions: lengthVariables } = useCanvasLengthVariables();
  const hasLengthVariables = lengthVariables.length > 0;
  const [fontSizePickerOpen, setFontSizePickerOpen] = useState(false);
  const [fontSizePickerMounted, setFontSizePickerMounted] = useState(false);
  const fontSizeAnchorRef = useRef<HTMLDivElement>(null);

  const defaultFontSizePx = getComputedCssLengthPx(targetDom, 'fontSize');
  /** 字号绑定的变量引用，及其解析出的具体长度 */
  const fontSizeVarRef = isCssVarValue(fontSize) ? fontSize : undefined;
  const resolvedFontSizeVar = useMemo(
    () => (fontSizeVarRef ? resolveCssVarLength(fontSizeVarRef, targetDom) : null),
    [fontSizeVarRef, targetDom]
  );
  const fontSizeFallback = resolvedFontSizeVar || `${defaultFontSizePx ?? 14}px`;
  const fontSizeUnconfigured = !isConfiguredCssLength(fontSize);
  const fontSizePlaceholder = fontSizeUnconfigured
    ? buildDefaultLengthPlaceholder(defaultFontSizePx)
    : '默认';
  const fontSizeTip = fontSizeUnconfigured
    ? buildDefaultLengthTip('字号', defaultFontSizePx)
    : '字号';

  const defaultLineHeightPx = getComputedCssLengthPx(targetDom, 'lineHeight');
  const lineHeightUnconfigured = !isConfiguredCssLength(lineHeight);
  const lineHeightPlaceholder = lineHeightUnconfigured
    ? buildDefaultLengthPlaceholder(defaultLineHeightPx)
    : '默认';
  const lineHeightTip = lineHeightUnconfigured
    ? buildDefaultLengthTip('行高', defaultLineHeightPx)
    : '行高';

  const defaultLetterSpacingPx = getComputedCssLengthPx(targetDom, 'letterSpacing');
  const letterSpacingUnconfigured = !isConfiguredCssLength(letterSpacing);
  const letterSpacingPlaceholder = letterSpacingUnconfigured
    ? buildDefaultLengthPlaceholder(defaultLetterSpacingPx)
    : '默认';
  const letterSpacingTip = letterSpacingUnconfigured
    ? buildDefaultLengthTip('字间距', defaultLetterSpacingPx)
    : '字间距';

  const [truncateLines, setTruncateLines] = useState<number>(() => {
    const clamp = (value as any).webkitLineClamp;
    return clamp && clamp !== 'none' ? Math.max(1, Number(clamp)) : 1;
  });

  const [isTruncated, setIsTruncated] = useState(() => {
    const v = value as any;
    return v.textOverflow === 'ellipsis' || (v.webkitLineClamp && v.webkitLineClamp !== 'none');
  });

  const [textDecorationValue, setTextDecorationValue] = useState<'none' | 'underline' | 'line-through'>(
    () => parseTextDecoration(value.textDecoration as string)
  );
  const [textDecorationStyleValue, setTextDecorationStyleValue] = useState(
    () => parseTextDecorationStyle(
      (value as any).textDecorationStyle,
      value.textDecoration as string
    )
  );
  const [textUnderlineOffsetValue, setTextUnderlineOffsetValue] = useState<string | null>(
    () => parseDecorationLength((value as any).textUnderlineOffset)
  );
  const [textDecorationThicknessValue, setTextDecorationThicknessValue] = useState<string | null>(
    () => parseDecorationLength((value as any).textDecorationThickness)
  );

  const [isFontStyleItalic, setIsFontStyleItalic] = useState<boolean>(
    () => (value as any).fontStyle === 'italic'
  );

  const [textTransformValue, setTextTransformValue] = useState<string>(
    () => (value as any).textTransform || 'none'
  );

  const [popoverOpen, setPopoverOpen] = useState(false);
  const popoverBtnRef = useRef<HTMLDivElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);

  const throttleTimerRef = useRef<NodeJS.Timeout | null>(null);
  const lastUpdateTimeRef = useRef<number>(0);

  const onFontSizeChange = useCallback(
    (nextFontSize: string | number | null) => {
      if (nextFontSize == null || nextFontSize === '') {
        setFontSize(null);
        onChange({ key: "fontSize", value: null });
        return;
      }

      // 变量值无法参与数值计算，直接落盘并跳过行高联动
      if (isCssVarValue(nextFontSize)) {
        setFontSize(nextFontSize);
        onChange({ key: "fontSize", value: nextFontSize });
        return;
      }

      setFontSize(nextFontSize);

      const [fontSizeValue, fontSizeUnit] = splitValueAndUnit(nextFontSize);
      const [, lineHeightUnit] = splitValueAndUnit(lineHeight as any);

      if (fontSizeUnit === "px") {
        // 行高已清空时只改字号，避免 Number(null)===0 误写回 lineHeight
        if (lineHeight == null || lineHeight === '') {
          onChange({ key: "fontSize", value: nextFontSize });
          return;
        }

        const fontSizeNumber = Number(fontSizeValue);
        const lineHeightNumber = fontSizeNumber + 8; // 根据fontSizeNumber需设置的行高
        
        const executeUpdate = () => {
          if (lineHeightUnit === "px") {
            onLineHeightChange(`${lineHeightNumber}px`, nextFontSize);
          } else if (lineHeightUnit === "%") {
            onLineHeightChange(
              `${parseFloat(
                ((lineHeightNumber * 100) / fontSizeNumber).toFixed(4)
              )}%`,
              nextFontSize
            );
          } else if (!isNaN(Number(lineHeight))) {
            // 计算倍数并保留一位小数，避免拖拽时出现过多小数位
            const ratio = lineHeightNumber / fontSizeNumber;
            const roundedRatio = Math.round(ratio * 10) / 10;
            onLineHeightChange(`${roundedRatio}`, nextFontSize);
          } else {
            // 计算倍数并保留一位小数，避免拖拽时出现过多小数位
            const ratio = lineHeightNumber / fontSizeNumber;
            const roundedRatio = Math.round(ratio * 10) / 10;
            onLineHeightChange(`${roundedRatio}`, nextFontSize);
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
          onChange({ key: "fontSize", value: nextFontSize });
          return;
        }
        
        lastUpdateTimeRef.current = now;
        executeUpdate();
      } else {
        // 需要修改lineHeight就合并，不需要就单独修改
        onChange({ key: "fontSize", value: nextFontSize });
      }
    },
    [lineHeight]
  );

  const onLineHeightChange = useCallback(
    (next: string | number | null, nextFontSize?: string | number) => {
      let value = next;
      // 下拉选择「默认」：清除行高，回到未配置态
      if (value === 'default' || value === 'normal') {
        value = null;
      } else if (value != null && value !== '') {
        const fsSource = String(nextFontSize ?? fontSize ?? '');
        // 字号绑定变量时用解析出的长度做基准，否则 var(--x) 会让换算退化到兜底值
        const fsRaw = isCssVarValue(fsSource)
          ? splitValueAndUnit(String(resolvedFontSizeVar ?? ''))[0]
          : splitValueAndUnit(fsSource)[0];
        const fontSizePx = Number(fsRaw || defaultFontSizePx || 14) || 14;
        const defaultPx = defaultLineHeightPx ?? Math.round(fontSizePx + 8);
        const [newNumStr, newUnitRaw] = splitValueAndUnit(String(value));
        const newUnit = newUnitRaw ?? '';
        const newNum = parseFloat(String(newNumStr));

        if (isConfiguredCssLength(lineHeight)) {
          const [oldNumStr, oldUnitRaw] = splitValueAndUnit(String(lineHeight));
          const oldUnit = oldUnitRaw ?? '';
          const oldNum = parseFloat(String(oldNumStr));
          // InputNumber 切单位时数字不变，在此做单位换算；原值为 0 时回退到计算默认值
          if (!isNaN(oldNum) && oldNum === newNum && oldUnit !== newUnit) {
            value = convertLineHeightValue(oldNum, oldUnit, newUnit, fontSizePx, defaultPx);
          }
        } else {
          // 未配置时切到具体单位：按计算默认值填充（对齐尺寸编辑器）
          value = convertLineHeightValue(defaultPx, 'px', newUnit, fontSizePx, defaultPx);
        }
      }

      const res = [];
      if (nextFontSize) {
        res.push({ key: "fontSize", value: nextFontSize });
        setFontSize(nextFontSize);
      }
      if (lineHeight !== value) {
        res.push({ key: "lineHeight", value });
        setLineHeight(value);
      }
      if (res.length > 0) {
        onChange(res);
      }
    },
    [lineHeight, fontSize, resolvedFontSizeVar, defaultFontSizePx, defaultLineHeightPx, onChange]
  );

  const openFontSizeVariablePicker = useCallback(() => {
    if (!hasLengthVariables) return;
    setFontSizePickerMounted(true);
    setFontSizePickerOpen(true);
  }, [hasLengthVariables]);

  const closeFontSizeVariablePicker = useCallback(() => setFontSizePickerOpen(false), []);

  /** 解绑变量：落成变量当前解析值，解析不到时退回计算值 */
  const detachFontSizeVariable = useCallback(() => {
    onFontSizeChange(fontSizeFallback);
  }, [onFontSizeChange, fontSizeFallback]);

  /**
   * 变量态的拖拽：从变量当前值起步，一动就落成 px（即自动解绑），与尺寸编辑器一致。
   * 只点击不拖动时值没变，保持绑定不动。
   */
  const fontSizeVarDragStartRef = useRef(0);
  const getDragPropsFontSizeVariable = useDragNumber({
    onDragStart: (currentValue) => {
      const parsed = parseFloat(currentValue);
      const startValue = isNaN(parsed) ? (defaultFontSizePx ?? 14) : Math.round(parsed);
      fontSizeVarDragStartRef.current = startValue;
      return startValue;
    },
    onDragChange: (val) => {
      if (val !== fontSizeVarDragStartRef.current) onFontSizeChange(`${val}px`);
    },
    onDragEnd: (finalValue) => {
      if (finalValue !== fontSizeVarDragStartRef.current) onFontSizeChange(`${finalValue}px`);
    },
  });

  const fontSizePresetItems = useMemo(
    () => FONT_SIZE_PRESETS.map((size) => ({ label: String(size), value: String(size) })),
    []
  );

  /** 字号预置列表 + 底部变量入口 */
  const fontSizePresetOptions = useMemo(() => ([
    ...fontSizePresetItems,
    { label: '', value: '__fontSizeVariableDivider__', type: 'divider' as const },
    {
      label: '',
      value: APPLY_VARIABLE_ACTION,
      type: 'action' as const,
      icon: <Variable />,
      disabled: !hasLengthVariables,
      tip: hasLengthVariables ? '应用变量...' : '当前画布没有可用的尺寸变量',
    },
  ]), [fontSizePresetItems, hasLengthVariables]);

  /** 预置列表的勾选项：取当前字号的 px 数值，不在档位里则不勾 */
  const fontSizePresetValue = useMemo(() => {
    if (fontSizeVarRef) return '';
    const [num, unit] = splitValueAndUnit(String(fontSize ?? ''));
    if (unit && unit !== 'px') return '';
    const parsed = parseFloat(String(num));
    return isNaN(parsed) ? '' : String(parsed);
  }, [fontSize, fontSizeVarRef]);

  const onLetterSpacingChange = useCallback(
    (value: string | number | null) => {
      setLetterSpacing(value);
      onChange({ key: "letterSpacing", value });
    },
    [onChange]
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
      const target = e.target as HTMLElement | null;
      // Select/单位下拉 portal 挂在 body 上，不能当成点到弹层外
      if (target?.closest?.('[data-dropdown-portal="true"]')) {
        return;
      }
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
  }, [popoverOpen, textDecorationValue, isTruncated]);

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
    const items: Array<{ key: string; value: any }> = [
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
      { key: 'textDecoration', value: null },
      { key: 'textDecorationStyle', value: null },
      { key: 'textDecorationThickness', value: null },
      { key: 'textUnderlineOffset', value: null },
      // 触发 preservePaintRoles 清除文字渐变栈（仅 null color 不会拆 background-clip:text）
      { key: 'WebkitTextFillColor', value: null },
      ...(cfg.textAlignMode === 'flex' ? [{ key: 'justifyContent', value: null }] : []),
    ];

    // 主动拆掉 text 层，保留 content / border，避免只靠拦截器猜意图
    if (isTextFillActive(valueRef.current as Record<string, any>)) {
      const cleared = buildSolidTextFill('', valueRef.current as Record<string, any>);
      items.push(
        ...toStyleChangeItems({
          ...cleared,
          color: null,
          WebkitTextFillColor: null,
        })
      );
    }

    onChange(items);
  }, [onChange, cfg.textAlignMode]);


  // 截断按钮附着位置计算：依次寻找第一个有实际内容的可见行
  const needTruncateFallback = !cfg.disableTruncateText && cfg.disableTextAlign;
  const lineHeightRowVisible = !(cfg.disableLineHeight && cfg.disableLetterSpacing);
  const weightSizeRowHasContent = !cfg.disableFontWeight || !cfg.disableFontSize;
  const truncateBtnInWeightRow = needTruncateFallback && !lineHeightRowVisible && weightSizeRowHasContent;
  const truncateBtnInColorRow = needTruncateFallback && !lineHeightRowVisible && !weightSizeRowHasContent && !cfg.disableColor;
  const truncateBtnInFamilyRow = needTruncateFallback && !lineHeightRowVisible && !weightSizeRowHasContent && cfg.disableColor && !cfg.disableFontFamily;

  const truncateBtnNode = (
    <div
      ref={popoverBtnRef}
      className={`${css.truncateBtn}${popoverOpen ? ` ${css.active}` : ''}`}
      style={{ position: 'absolute', right: -22, top: '50%', transform: 'translateY(-50%)' }}
      onClick={() => setPopoverOpen(v => !v)}
      data-mybricks-tip={`{content:'文字设置',position:'left'}`}
    >
      <FontSetting />
    </div>
  );

  return (
    <Panel title="字体" showTitle={showTitle} showReset={true} showDelete={false} resetFunction={refresh} collapse={false}>

      {cfg.disableFontFamily ? null : (
        <Panel.Content style={truncateBtnInFamilyRow ? { position: 'relative' } : undefined}>
          {truncateBtnInFamilyRow ? truncateBtnNode : null}
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
                labelStyle={{
                  textAlign: "left",
                  ...(innerFontFamily?.[0] && innerFontFamily[0] !== "inherit"
                    ? { fontFamily: quoteIfNeeded(innerFontFamily[0]) }
                    : {}),
                }}
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
                labelStyle={{
                  textAlign: "left",
                  ...(innerFontFamily?.[0] && innerFontFamily[0] !== "inherit"
                    ? { fontFamily: quoteIfNeeded(innerFontFamily[0]) }
                    : {}),
                }}
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
        <Panel.Content style={truncateBtnInColorRow ? { position: 'relative' } : undefined}>
          {truncateBtnInColorRow ? truncateBtnNode : null}
          <ColorEditor
            key={textFillEditorKey}
            style={{
              flex: 2,
              padding: 6,
              overflow: "hidden",
              paddingLeft: 8,
            }}
            defaultValue={textFillValue}
            resolvedColor={textFillResolvedColor ?? undefined}
            variableOptions={canvasColorVariables}
            showSubTabs={true}
            disableBackgroundImage={true}
            onChange={handleTextFillChange}
          />
        </Panel.Content>
      )}

      {cfg.disableFontWeight && cfg.disableFontSize ? null : (
        <Panel.Content style={truncateBtnInWeightRow ? { position: 'relative' } : undefined}>

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
            <Panel.Item className={css.fontSizeItem} style={{ display: "flex", alignItems: "center", flex: 1, padding: "0 8px", minWidth: 0 }}>
              <div 
                ref={fontSizeAnchorRef}
                {...(fontSizeVarRef
                  ? getDragPropsFontSizeVariable(fontSizeFallback, '拖拽调整字号（将解除变量绑定）')
                  : getDragPropsFontSize(
                      fontSizeUnconfigured
                        ? (defaultFontSizePx != null ? `${defaultFontSizePx}px` : '14px')
                        : fontSize,
                      '拖拽调整字号'
                    ))}
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
              {fontSizeVarRef ? (
                <VariableChip
                  value={fontSizeVarRef}
                  resolvedValue={resolvedFontSizeVar}
                  display={formatLengthDisplay(resolvedFontSizeVar)}
                  onRequestPicker={openFontSizeVariablePicker}
                  // 绑定态也给出完整档位列表：顶部单列当前变量，点档位即解绑成固定值
                  menuLayout="presetList"
                  menuOptions={fontSizePresetItems}
                  menuStyle={FONT_SIZE_MENU_STYLE}
                  onMenuSelect={(size) => onFontSizeChange(`${size}px`)}
                  onInputValue={onFontSizeChange}
                  onDetach={detachFontSizeVariable}
                  // flex-basis 显式为 0：胶囊与输入区都不能把列宽撑开
                  style={{ flex: '1 1 0', minWidth: 0, width: 0, marginLeft: 4 }}
                />
              ) : (
                <InputNumber
                  tip={fontSizeTip}
                  type="number"
                  style={{ flex: 1, minWidth: 0, marginLeft: 4 }}
                  value={fontSizeUnconfigured ? null : fontSize}
                  placeholder={fontSizePlaceholder}
                  unitOptions={FONT_SIZE_OPTIONS}
                  // unitDisabledList={FONT_SIZE_DISABLED_LIST}
                  onChange={onFontSizeChange}
                  suffix={
                    <Dropdown
                      className={css.fontSizeArrowWrap}
                      // 档位不多，全展开避免底部的变量入口被滚动区藏住
                      menuStyle={FONT_SIZE_MENU_STYLE}
                      value={fontSizePresetValue}
                      options={fontSizePresetOptions}
                      onClick={(size) => onFontSizeChange(`${size}px`)}
                      onAction={(action) => {
                        if (action === APPLY_VARIABLE_ACTION) openFontSizeVariablePicker();
                      }}
                    >
                      <span className={css.fontSizeArrow} data-mybricks-tip="字号档位">
                        <DownOutlined />
                      </span>
                    </Dropdown>
                  }
                />
              )}
              <SketchPopup
                open={fontSizePickerOpen}
                mounted={fontSizePickerMounted}
                anchorRef={fontSizeAnchorRef}
                onClose={closeFontSizeVariablePicker}
                className={css.variablePopup}
              >
                <VariableList
                  list={lengthVariables}
                  open={fontSizePickerOpen}
                  selectedName={fontSizeVarRef}
                  onClose={closeFontSizeVariablePicker}
                  onSelect={(item) => {
                    onFontSizeChange(`var(${item.name})`);
                    closeFontSizeVariablePicker();
                  }}
                  emptyText="当前画布没有可用的尺寸变量"
                />
              </SketchPopup>
            </Panel.Item>
          )}
          {truncateBtnInWeightRow ? truncateBtnNode : null}
        </Panel.Content>
      )}
      {cfg.disableLineHeight && cfg.disableLetterSpacing ? null : (
        <Panel.Content style={cfg.disableTextAlign && !cfg.disableTruncateText ? { position: 'relative' } : undefined}>
          {cfg.disableLineHeight ? null : (
            <Panel.Item style={{ display: "flex", alignItems: "center", flex: 1, padding: "0 8px" }}>
              <div 
                {...getDragPropsLineHeight(
                  lineHeight == null || lineHeight === '' || ['unset', 'normal', 'inherit'].includes(lineHeight as string)
                    ? '1'
                    : lineHeight,
                  '拖拽调整行高'
                )}
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
                key={`lineHeight-${getLineHeightUnitKey(lineHeight)}`}
                tip={lineHeightTip}
                type="number"
                style={{ flex: 1, marginLeft: 4 }}
                value={lineHeightUnconfigured ? null : lineHeight}
                placeholder={lineHeightPlaceholder}
                defaultUnitValue="default"
                unitOptions={LINEHEIGHT_UNIT_OPTIONS}
                unitDisabledList={LINEHEIGHT_UNIT_DISABLED_LIST}
                hideUnitWhenEmpty
                showIcon
                showIconOnHover
                onChange={onLineHeightChange}
              />
            </Panel.Item>
          )}
          {cfg.disableLetterSpacing ? null : (
            <Panel.Item style={{ display: "flex", alignItems: "center", flex: 1, padding: "0 8px" }}>
              <div 
                {...getDragPropsLetterSpacing(
                  letterSpacingUnconfigured
                    ? `${defaultLetterSpacingPx ?? 0}px`
                    : letterSpacing,
                  '拖拽调整字间距'
                )}
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
                tip={letterSpacingTip}
                type="number"
                style={{ flex: 1, marginLeft: 4 }}
                value={letterSpacingUnconfigured ? null : letterSpacing}
                placeholder={letterSpacingPlaceholder}
                defaultUnitValue="px"
                unitOptions={LETTERSPACING_UNIT_OPTIONS}
                // unitDisabledList={LETTERSPACING_UNIT_DISABLED_LIST}
                onChange={onLetterSpacingChange}
              />
            </Panel.Item>
          )}
          {cfg.disableTextAlign && !cfg.disableTruncateText ? (
            <div
              ref={popoverBtnRef}
              className={`${css.truncateBtn}${popoverOpen ? ` ${css.active}` : ''}`}
              style={{ position: 'absolute', right: -22, top: '50%', transform: 'translateY(-50%)' }}
              onClick={() => setPopoverOpen(v => !v)}
              data-mybricks-tip={`{content:'文字设置',position:'left'}`}
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
        // 无对齐行时，按钮已合并进行高/字间距行或字重/字号行，无需单独兜底
        null
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
              data-mybricks-tip={`{content:'文字设置',position:'left'}`}
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
        <div className={css.popoverInlineRow}>
          <div className={css.popoverLabel} style={{ marginBottom: 0 }}>装饰</div>
          <Panel.Item style={{ padding: 2 }}>
            <div className={css.decoGroup}>
              {([
                { label: <span style={{ fontWeight: 500, fontSize: 13 }}>—</span>, value: 'none', tip: '无装饰' },
                { label: <span style={{ textDecoration: 'underline', fontWeight: 500, fontSize: 13 }}>U</span>, value: 'underline', tip: '下划线' },
                { label: <span style={{ textDecoration: 'line-through', fontWeight: 500, fontSize: 13 }}>S</span>, value: 'line-through', tip: '删除线' },
              ] as const).map(({ label, value: v, tip }) => (
                <div
                  key={v}
                  className={`${css.decoBtn}${textDecorationValue === v ? ` ${css.decoBtnActive}` : ''}`}
                  data-mybricks-tip={tip}
                  onClick={() => {
                    setTextDecorationValue(v);
                    if (v === 'none') {
                      setTextDecorationStyleValue('solid');
                      setTextUnderlineOffsetValue(null);
                      setTextDecorationThicknessValue(null);
                      onChange([
                        { key: 'textDecoration', value: null },
                        { key: 'textDecorationStyle', value: null },
                        { key: 'textDecorationThickness', value: null },
                        { key: 'textUnderlineOffset', value: null },
                      ]);
                      return;
                    }
                    onChange({ key: 'textDecoration', value: v });
                  }}
                >
                  {label}
                </div>
              ))}
            </div>
          </Panel.Item>
        </div>
        {textDecorationValue !== 'none' && (
          <>
            <div className={css.popoverInlineRow}>
              <div className={css.popoverLabel} style={{ marginBottom: 0 }}>样式</div>
              <Select
                key={`deco-style-${textDecorationStyleValue}`}
                tip="装饰线样式"
                style={{ flex: 1, maxWidth: 120, padding: '0 8px' }}
                value={textDecorationStyleValue}
                options={TEXT_DECORATION_STYLE_OPTIONS}
                onChange={(next) => {
                  setTextDecorationStyleValue(next);
                  onChange({ key: 'textDecorationStyle', value: next === 'solid' ? null : next });
                }}
              />
            </div>
            {textDecorationValue === 'underline' && (
              <div className={css.popoverInlineRow}>
                <div className={css.popoverLabel} style={{ marginBottom: 0 }}>偏移</div>
                <InputNumber
                  tip="下划线偏移"
                  type="number"
                  style={{ flex: 1, maxWidth: 120, padding: '0 8px' }}
                  defaultUnitValue="px"
                  unitOptions={TEXT_DECORATION_LENGTH_UNITS}
                  value={textUnderlineOffsetValue}
                  placeholder=""
                  allowNegative
                  showIcon
                  showIconOnHover
                  onChange={(next) => {
                    setTextUnderlineOffsetValue(next);
                    onChange({ key: 'textUnderlineOffset', value: next });
                  }}
                />
              </div>
            )}
            <div className={css.popoverInlineRow}>
              <div className={css.popoverLabel} style={{ marginBottom: 0 }}>粗细</div>
              <InputNumber
                tip="装饰线粗细"
                type="number"
                style={{ flex: 1, maxWidth: 120, padding: '0 8px' }}
                defaultUnitValue="px"
                unitOptions={TEXT_DECORATION_LENGTH_UNITS}
                value={textDecorationThicknessValue}
                placeholder=""
                showIcon
                showIconOnHover
                onChange={(next) => {
                  setTextDecorationThicknessValue(next);
                  onChange({ key: 'textDecorationThickness', value: next });
                }}
              />
            </div>
          </>
        )}
        <div className={css.popoverInlineRow}>
          <div className={css.popoverLabel} style={{ marginBottom: 0 }}>斜体</div>
          <Panel.Item style={{ padding: 2 }}>
            <div className={css.decoGroup}>
              {([
                { label: <span style={{ fontWeight: 500, fontSize: 13 }}>—</span>, value: false, tip: '无斜体' },
                { label: <span style={{ fontStyle: 'italic', fontWeight: 500, fontSize: 13 }}>I</span>, value: true, tip: '斜体' },
              ] as const).map(({ label, value: v, tip }) => (
                <div
                  key={String(v)}
                  className={`${css.decoBtn}${isFontStyleItalic === v ? ` ${css.decoBtnActive}` : ''}`}
                  data-mybricks-tip={tip}
                  onClick={() => {
                    setIsFontStyleItalic(v);
                    onChange({ key: 'fontStyle', value: v ? 'italic' : null });
                  }}
                >
                  {label}
                </div>
              ))}
            </div>
          </Panel.Item>
        </div>
        <div className={css.popoverInlineRow}>
          <div className={css.popoverLabel} style={{ marginBottom: 0 }}>大小写</div>
          <Toggle
            key={`textTransform-${textTransformValue}`}
            defaultValue={textTransformValue}
            options={[
              { label: <span style={{ fontWeight: 500, fontSize: 12 }}>Ag</span>, value: 'none', tip: '默认' },
              { label: <span style={{ fontWeight: 700, fontSize: 12 }}>AG</span>, value: 'uppercase', tip: '全大写' },
              { label: <span style={{ fontWeight: 500, fontSize: 12 }}>ag</span>, value: 'lowercase', tip: '全小写' },
              { label: <span style={{ fontWeight: 500, fontSize: 12, textTransform: 'capitalize' }}>ab</span>, value: 'capitalize', tip: '首字母大写' },
            ]}
            onChange={(v) => {
              const next = v as string;
              setTextTransformValue(next);
              onChange({ key: 'textTransform', value: next === 'none' ? null : next });
            }}
          />
        </div>
        <div className={css.popoverInlineRow}>
          <div className={css.popoverLabel} style={{ marginBottom: 0 }}>截断文字</div>
          <Toggle
            key={`truncate-${(value as any).textOverflow || ''}-${(value as any).webkitLineClamp || ''}`}
            defaultValue={
              (value as any).textOverflow === 'ellipsis' ||
              ((value as any).webkitLineClamp && (value as any).webkitLineClamp !== 'none')
                ? 'ellipsis'
                : 'clip'
            }
            options={[
              { label: <span style={{ fontWeight: 500, fontSize: 13 }}>—</span>, value: 'clip', tip: '不截断' },
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
        </div>
        {isTruncated && (
          <div className={css.popoverInlineRow}>
            <div className={css.popoverLabel} style={{ marginBottom: 0 }}>最大行数</div>
            <InputNumber
              tip="最大行数"
              type="number"
              style={{ flex: 1, maxWidth: 120, padding: '0 8px' }}
              defaultUnitValue=""
              value={String(truncateLines)}
              fallbackValue={1}
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
