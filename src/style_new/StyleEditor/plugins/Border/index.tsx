import React, { useMemo, useState, useCallback, useRef, useEffect, useLayoutEffect, CSSProperties } from "react";
import { createPortal } from "react-dom";
import {
  useEffectiveStyleValue,
  useStyleChange,
  useStyleEditorContext,
} from "../..";

import {
  Panel,
  Select,
  ColorEditor,
  BorderWeightOutlined,
  BorderSplitOutlined,
  BorderTopOutlined,
  BorderBottomOutlined,
  BorderLeftOutlined,
  BorderRightOutlined,
  MinusOutlined,
  VariableNumberInput,
  withApplyVariableOption,
  APPLY_VARIABLE_ACTION,
} from "../../components";
import { Setting as SettingIcon } from "../../icons/Setting";
import { allEqual } from "../../utils";
import { useDragNumber, useLengthVarBinding } from "../../hooks";
import {
  isGradientValue,
  toSolidBackgroundLayer,
  isTransparentSolidLayer,
} from "../../helper/gradient-border";
import {
  composeBackgroundStack,
  decomposeBackgroundStack,
} from "../../helper/paint-stack";
import { getColorEditorValue } from "../../helper/get-color-editor-value";
import { getCssVarColorOptions, resolveCssVarColor } from "../../../core/resolve-css-var-color";
import { buildBorderWidthChange, getBorderSideKeys, hasNoVisibleBorderLine } from "../../helper/border-value";

import type { ChangeEvent, PanelBaseProps, StyleChangeItem, StyleChangeResult } from "../../type";
import type { EffectiveStyleValue } from "../../../core/zone-tab";

import css from "./index.less";

interface BorderProps extends PanelBaseProps {
  value: CSSProperties;
  onChange: ChangeEvent;
}

const STROKE_STYLE_POPUP_OPTIONS = [
  { value: 'none', label: '无' },
  { value: 'solid', label: '实线' },
  { value: 'dashed', label: '虚线' },
];

const BORDER_WIDTH_KEYWORD_VALUES: Record<string, string> = {
  thin: '1px',
  medium: '3px',
  thick: '5px',
};

const isZeroBorderWidth = (value: unknown) => {
  const normalized = String(value ?? '').trim().toLowerCase();
  return normalized === '' || normalized === '0' || normalized === '0px' || normalized === '0%';
};

const normalizeBorderWidthValue = (value: unknown, style: unknown) => {
  const normalizedStyle = String(style ?? '').trim().toLowerCase();
  if (normalizedStyle === 'none' || normalizedStyle === 'hidden') return '0px';
  const normalizedWidth = String(value ?? '').trim().toLowerCase();
  return BORDER_WIDTH_KEYWORD_VALUES[normalizedWidth] ?? value;
};

type BorderPosition = "outside" | "center" | "inside";

const BORDER_POSITION_OPTIONS = [
  { label: "外部", value: "outside" },
  { label: "居中", value: "center" },
  { label: "内部", value: "inside" },
];
const DEFAULT_UNIT_OPTION = { label: '默认', value: 'default' };
const DEFAULT_UNIT_DIVIDER = { label: '', value: '__borderDefaultDivider__', type: 'divider' as const };

function withDefaultUnitOption<T extends { label: string; value: string }>(
  options: T[],
  clearable: boolean
) {
  return clearable
    ? [DEFAULT_UNIT_OPTION, DEFAULT_UNIT_DIVIDER, ...options]
    : options;
}
const BORDER_WIDTH_UNIT_OPTIONS = [{ label: 'px', value: 'px' }];
const CHIP_STYLE = { flex: '1 1 0', minWidth: 0, width: 0, marginLeft: 4 };
// 独立配置：颜色 flex:1，宽度列必须四边同宽，绑定胶囊和数字输入共用这一列，
// 否则未绑定 36/44、绑定 68，粗细图标和数值会对不齐。
const CHIP_STYLE_SPLIT = {
  flex: 'none',
  width: 40,
  minWidth: 40,
  maxWidth: 40,
  marginLeft: 0,
  background: 'transparent',
  height: '100%',
};
const WIDTH_STYLE_SPLIT = {
  padding: 0,
  fontSize: 10,
  flex: 'none',
  width: 40,
  minWidth: 40,
  maxWidth: 40,
  marginLeft: 0,
};

const DEFAULT_CONFIG = {
  disableBorderStyle: false,
  disableBorderWidth: false,
  disableBorderColor: false,
  disableBorderTop: false,
  disableBorderRight: false,
  disableBorderBottom: false,
  disableBorderLeft: false,
  useImportant: false,
};

const BORDER_LOGICAL_KEYS = [
  'borderTopWidth', 'borderRightWidth', 'borderBottomWidth', 'borderLeftWidth',
  'borderTopColor', 'borderRightColor', 'borderBottomColor', 'borderLeftColor',
  'borderTopStyle', 'borderRightStyle', 'borderBottomStyle', 'borderLeftStyle',
];

const BORDER_COLOR_KEYS = [
  'borderTopColor', 'borderRightColor', 'borderBottomColor', 'borderLeftColor',
];

const BORDER_WIDTH_KEYS = [
  'borderTopWidth', 'borderRightWidth', 'borderBottomWidth', 'borderLeftWidth',
];

const BORDER_STYLE_KEYS = [
  'borderTopStyle', 'borderRightStyle', 'borderBottomStyle', 'borderLeftStyle',
];

const BORDER_PAINT_KEYS = [
  'backgroundColor', 'backgroundImage', 'backgroundOrigin', 'backgroundClip',
  'WebkitBackgroundClip', 'webkitBackgroundClip',
  'backgroundSize', 'backgroundRepeat', 'backgroundPosition',
  'WebkitTextFillColor', 'webkitTextFillColor',
];

type BorderValue = CSSProperties & Record<string, any>;

function isEffectiveStyleConfigured(item?: EffectiveStyleValue): boolean {
  if (!item || item.type === 'computed') return false;
  return !(typeof item.value === 'string' && /^unset$/i.test(item.value.trim()));
}

function stripImportant(value: unknown): unknown {
  return typeof value === 'string'
    ? value.replace(/\s*!important\s*$/i, '')
    : value;
}

/**
 * Zone 模式只把逐属性的显式值放进编辑态；computed 值仅用于预览和提示，
 * 避免用户修改一个边框字段时把浏览器默认值一并写回。
 */
function getBorderEditorValue(
  value: CSSProperties,
  effectiveStyle?: Record<string, EffectiveStyleValue>
): BorderValue {
  const source = value as BorderValue;
  const next: BorderValue = {};

  if (!effectiveStyle) {
    Object.assign(next, source);
  } else {
    [
      ...BORDER_LOGICAL_KEYS,
      'outline', 'outlineOffset', 'boxShadow',
      ...BORDER_PAINT_KEYS,
    ].forEach((key) => {
      // paint stack 需要完整 EffectiveStyleValue 才能在渐变边框写入时保留背景/文字层；
      // 这些值只参与复合计算，不决定边框字段是否已配置。
      if (BORDER_PAINT_KEYS.includes(key) || isEffectiveStyleConfigured(effectiveStyle[key])) {
        if (source[key] != null && source[key] !== '') next[key] = source[key];
      }
    });
  }

  Object.entries(next).forEach(([key, current]) => {
    next[key] = stripImportant(current);
  });
  (['Top', 'Right', 'Bottom', 'Left'] as const).forEach((side) => {
    const widthKey = `border${side}Width`;
    const styleKey = `border${side}Style`;
    if (next[widthKey] != null) {
      next[widthKey] = normalizeBorderWidthValue(next[widthKey], next[styleKey]);
    }
  });

  // outside / inside 是 outline / box-shadow 的虚拟编辑形态，仅在对应属性有显式来源时还原。
  const pos = detectPositionFromCSS(next);
  if (pos === 'outside' && next.outline) {
    const virtual = parseOutlineToVirtual(String(next.outline));
    BORDER_LOGICAL_KEYS.forEach((key) => {
      if (key.endsWith('Width')) next[key] = virtual.width;
      else if (key.endsWith('Style')) next[key] = virtual.style;
      else if (key.endsWith('Color')) next[key] = virtual.color;
    });
  } else if (pos === 'inside' && next.boxShadow) {
    const virtual = parseInsetShadowToVirtual(String(next.boxShadow));
    BORDER_LOGICAL_KEYS.forEach((key) => {
      if (key.endsWith('Width')) next[key] = virtual.width;
      else if (key.endsWith('Style')) next[key] = 'solid';
      else if (key.endsWith('Color')) next[key] = virtual.color;
    });
  }
  return next;
}

function buildComputedTip(
  label: string,
  item?: EffectiveStyleValue,
  previewValue?: string
): string {
  const computedValue = previewValue ?? item?.computedValue;
  return computedValue
    ? `当前未配置${label}，${computedValue}为计算值`
    : label;
}

function mutationFailed(result: StyleChangeResult | void): boolean {
  return !!result?.clearUnsupported && !result.clearApplied;
}

const NEW_BORDER_EDITOR_VALUE: CSSProperties & Record<string, any> = {
  borderTopWidth: '1px',
  borderRightWidth: '1px',
  borderBottomWidth: '1px',
  borderLeftWidth: '1px',
  borderTopColor: '#000000',
  borderRightColor: '#000000',
  borderBottomColor: '#000000',
  borderLeftColor: '#000000',
  borderTopStyle: 'solid',
  borderRightStyle: 'solid',
  borderBottomStyle: 'solid',
  borderLeftStyle: 'solid',
};

const detectPositionFromCSS = (cssValue: CSSProperties & Record<string, any>): BorderPosition => {
  const outline = String(cssValue.outline || '');
  const boxShadow = String(cssValue.boxShadow || '');
  if (outline && outline !== 'none' && outline !== 'initial') return 'outside';
  if (boxShadow && boxShadow.includes('inset')) return 'inside';
  return 'center';
};

const parseOutlineToVirtual = (outline: string) => {
  const clean = outline.trim();
  const m4 = clean.match(/^([\d.]+px)\s+(solid|dashed|dotted)\s+(.+)$/);
  if (m4) return { width: m4[1], style: m4[2], color: m4[3] };
  const m3 = clean.match(/^([\d.]+px)\s+(.+)$/);
  return { width: m3?.[1] ?? '1px', style: 'solid', color: m3?.[2] ?? '#000000' };
};

const parseInsetShadowToVirtual = (boxShadow: string) => {
  const m = boxShadow.match(/inset\s+[\d.]+(?:px)?\s+[\d.]+(?:px)?\s+[\d.]+(?:px)?\s+([\d.]+px)\s+(.+)/);
  return { width: m?.[1] ?? '1px', style: 'solid', color: m?.[2]?.trim() ?? '#000000' };
};

const hasGradientBorderBackground = (value: CSSProperties & Record<string, any>) => {
  const { borderLayer } = decomposeBackgroundStack(value);
  return !!borderLayer;
};

const getGradientBorderValue = (value: CSSProperties & Record<string, any>) => {
  const { borderLayer } = decomposeBackgroundStack(value);
  return borderLayer;
};

const isInvisibleBackgroundLayer = (layer: string): boolean =>
  layer === 'initial' || layer === 'none' || isTransparentSolidLayer(layer);

const getContentBackgroundLayers = (
  value: CSSProperties & Record<string, any>,
  fallbackLayers?: string[] | null
) => {
  if (fallbackLayers?.length) {
    // "initial" / "none" 不是有效的多层 background-image 层值（CSS 全局关键字不能用于列表单项），
    // 将其替换为 backgroundColor 对应的实色渐变层，否则会导致整条 background-image 声明无效。
    const normalized = fallbackLayers.map((l) =>
      isInvisibleBackgroundLayer(l)
        ? toSolidBackgroundLayer((value as any).backgroundColor || 'transparent')
        : l
    );
    return normalized;
  }
  const { contentLayers } = decomposeBackgroundStack(value);
  if (contentLayers.length === 1 && isInvisibleBackgroundLayer(contentLayers[0])) {
    return [toSolidBackgroundLayer(value.backgroundColor || 'transparent')];
  }
  if (contentLayers.length) {
    return contentLayers;
  }
  const backgroundColor = value.backgroundColor || "transparent";
  return [toSolidBackgroundLayer(backgroundColor)];
};

const buildGradientBorderValue = (
  gradient: string,
  currentValue: CSSProperties & Record<string, any>,
  contentLayers?: string[] | null
) => {
  const {
    textLayer,
    contentSizes,
    contentRepeats,
    contentPositions,
  } = decomposeBackgroundStack(currentValue);
  const normalizedContentLayers = getContentBackgroundLayers(currentValue, contentLayers);
  const stack = composeBackgroundStack({
    textLayer,
    contentLayers: normalizedContentLayers,
    borderLayer: gradient,
    backgroundColor: currentValue.backgroundColor,
    contentSizes,
    contentRepeats,
    contentPositions,
  });
  return {
    borderTopColor: "transparent",
    borderRightColor: "transparent",
    borderBottomColor: "transparent",
    borderLeftColor: "transparent",
    ...stack,
  };
};

const buildClearGradientBorderValue = (
  currentValue: CSSProperties & Record<string, any>,
  contentLayers?: string[] | null
) => {
  if (!hasGradientBorderBackground(currentValue)) {
    return {};
  }
  const {
    textLayer,
    contentSizes,
    contentRepeats,
    contentPositions,
  } = decomposeBackgroundStack(currentValue);
  const normalizedContentLayers = getContentBackgroundLayers(currentValue, contentLayers);
  const fallbackLayer = toSolidBackgroundLayer(currentValue.backgroundColor || "transparent");
  const shouldClearContent =
    !textLayer &&
    normalizedContentLayers.length === 1 &&
    normalizedContentLayers[0] === fallbackLayer;
  return composeBackgroundStack({
    textLayer,
    contentLayers: shouldClearContent ? [] : normalizedContentLayers,
    borderLayer: undefined,
    backgroundColor: currentValue.backgroundColor,
    contentSizes: shouldClearContent ? [] : contentSizes,
    contentRepeats: shouldClearContent ? [] : contentRepeats,
    contentPositions: shouldClearContent ? [] : contentPositions,
  });
};

export function Border({ value, onChange: fallbackOnChange, config, showTitle, collapse }: BorderProps) {
  const context = useStyleEditorContext();
  const effectiveStyle = context?.effectiveStyle;
  const effectiveValue = useEffectiveStyleValue();
  const onChange = useStyleChange(fallbackOnChange);
  const targetDom = context?.targetDom ?? null;
  const canvasColorVariables = getCssVarColorOptions(targetDom);
  const [
    {
      disableBorderWidth,
      disableBorderColor,
      disableBorderStyle,
      disableBorderTop,
      disableBorderRight,
      disableBorderBottom,
      disableBorderLeft,
      useImportant,
    },
  ] = useState({ ...DEFAULT_CONFIG, ...config });
  const externalStyleSource = effectiveStyle ?? value;
  const defaultBorderValue = useMemo(
    () => getBorderEditorValue(effectiveStyle ? effectiveValue : value, effectiveStyle),
    [externalStyleSource, effectiveValue]
  );
  const [borderToggleValue, setBorderToggleValue] = useState<'all' | 'split'>(
    getBorderToggleDefaultValue(defaultBorderValue)
  );
  const contentBackgroundLayersRef = useRef<string[] | null>(getContentBackgroundLayers(defaultBorderValue));
  const [borderValue, setBorderValue] = useState(defaultBorderValue);
  const [previewValues, setPreviewValues] = useState<Record<string, string | undefined>>({});
  const [forceRenderKey, setForceRenderKey] = useState<number>(Math.random());
  const [borderColorEditorKey, setBorderColorEditorKey] = useState(0);
  const getDragPropsBorder = useDragNumber({ continuous: true });

  // ── 边框宽度 CSS 变量绑定 ────────────────────────────────────────────────────
  const widthAllVar = useLengthVarBinding({
    value: borderValue.borderTopWidth,
    onChange: (next) => handleWidthChange(BORDER_WIDTH_KEYS, next, true),
    computedProp: 'borderTopWidth',
  });
  const topWidthVar = useLengthVarBinding({
    value: borderValue.borderTopWidth,
    onChange: (next) => handleWidthChange(['borderTopWidth'], next),
    computedProp: 'borderTopWidth',
  });
  const rightWidthVar = useLengthVarBinding({
    value: borderValue.borderRightWidth,
    onChange: (next) => handleWidthChange(['borderRightWidth'], next),
    computedProp: 'borderRightWidth',
  });
  const bottomWidthVar = useLengthVarBinding({
    value: borderValue.borderBottomWidth,
    onChange: (next) => handleWidthChange(['borderBottomWidth'], next),
    computedProp: 'borderBottomWidth',
  });
  const leftWidthVar = useLengthVarBinding({
    value: borderValue.borderLeftWidth,
    onChange: (next) => handleWidthChange(['borderLeftWidth'], next),
    computedProp: 'borderLeftWidth',
  });

  const borderWidthUnitOptions = useMemo(
    () => withApplyVariableOption(BORDER_WIDTH_UNIT_OPTIONS, widthAllVar.hasVariables),
    [widthAllVar.hasVariables]
  );

  const [showStyleSettings, setShowStyleSettings] = useState(false);
  const styleSettingsBtnRef = useRef<HTMLDivElement>(null);
  const styleSettingsPopoverRef = useRef<HTMLDivElement>(null);
  const panelDeleteRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    if (!showStyleSettings) return;

    const positionPopover = () => {
      if (!styleSettingsBtnRef.current || !styleSettingsPopoverRef.current) return;
      const btnRect = styleSettingsBtnRef.current.getBoundingClientRect();
      const popRect = styleSettingsPopoverRef.current.getBoundingClientRect();
      const windowH = window.innerHeight;
      const left = btnRect.right - popRect.width;
      let top = btnRect.bottom + 4;
      if (top + popRect.height > windowH) {
        top = btnRect.top - popRect.height - 4;
      }
      styleSettingsPopoverRef.current.style.left = Math.max(8, left) + 'px';
      styleSettingsPopoverRef.current.style.top = top + 'px';
      styleSettingsPopoverRef.current.style.visibility = 'visible';
    };

    const timer = setTimeout(positionPopover, 0);

    const handleClickOutside = (e: MouseEvent) => {
      if (
        styleSettingsPopoverRef.current && !styleSettingsPopoverRef.current.contains(e.target as Node) &&
        styleSettingsBtnRef.current && !styleSettingsBtnRef.current.contains(e.target as Node)
      ) {
        setShowStyleSettings(false);
      }
    };

    document.addEventListener('click', handleClickOutside);
    return () => {
      clearTimeout(timer);
      document.removeEventListener('click', handleClickOutside);
    };
  }, [showStyleSettings]);

  const commitStyleChanges = useCallback(
    (changes: BorderValue, borderMode: 'all' | 'split' = borderToggleValue) => {
      const unifiedWidthSet = borderMode === 'all' && BORDER_WIDTH_KEYS.every(key => changes[key] != null);
      const items: StyleChangeItem[] = Object.entries(changes).map(([key, nextValue]) => ({
        key,
        value: nextValue == null
          ? null
          : `${nextValue}${useImportant ? '!important' : ''}`,
        ...(BORDER_LOGICAL_KEYS.includes(key) ? {
          borderMode,
          ...(unifiedWidthSet && nextValue != null ? { target: 'current-rule' as const } : {}),
        } : {}),
      }));
      return onChange(items);
    },
    [onChange, useImportant, borderToggleValue]
  );

  const handleChange = useCallback(
    (changes: BorderValue, borderMode?: 'all' | 'split') => {
      const result = commitStyleChanges(changes, borderMode);
      if (mutationFailed(result)) return result;

      const next = { ...borderValueRef.current };
      Object.entries(changes).forEach(([key, nextValue]) => {
        if (nextValue == null) delete next[key];
        else next[key] = stripImportant(nextValue);
      });
      borderValueRef.current = next;
      setBorderValue(next);
      setPreviewValues((current) => {
        const preview = { ...current };
        Object.entries(changes).forEach(([key, nextValue]) => {
          preview[key] = nextValue == null
            ? context?.getStylePreview?.(key, true)?.trim() || undefined
            : undefined;
        });
        return preview;
      });
      return result;
    },
    [commitStyleChanges, context?.getStylePreview]
  );

  const isLengthNineAndEndsWithZeroes = (str: string) => {
    return /^.{7}00$/.test(str);
  };


  const shouldShowMiniLayout = useMemo(() => {
    const colorOptions = Array.isArray(window.MYBRICKS_CSS_VARIABLE_LIST)
      ? window.MYBRICKS_CSS_VARIABLE_LIST
      : [];
    const showPreset = !!colorOptions.length;
    return showPreset
  }, [])

  const [borderPosition, setBorderPosition] = useState<BorderPosition>(
    () => detectPositionFromCSS(defaultBorderValue)
  );

  const borderPositionRef = useRef<BorderPosition>(borderPosition);
  borderPositionRef.current = borderPosition;

  const borderValueRef = useRef(borderValue);
  borderValueRef.current = borderValue;

  // 选中元素、Zone Tab 或 EffectiveStyleValue 更新时，按逐属性来源同步编辑态。
  // 本地写入只触发 styleRevision，不会改变 effectiveStyle 对象，因此不会被旧数据回滚。
  useLayoutEffect(() => {
    const next = defaultBorderValue;
    const nextPosition = detectPositionFromCSS(next);
    borderValueRef.current = next;
    borderPositionRef.current = nextPosition;
    contentBackgroundLayersRef.current = getContentBackgroundLayers(next);
    setBorderValue(next);
    setPreviewValues({});
    setBorderPosition(nextPosition);
    setBorderToggleValue(getBorderToggleDefaultValue(next));
    setBorderColorEditorKey((key) => key + 1);
  }, [targetDom, defaultBorderValue]);

  const refresh = useCallback(() => {
    const current = borderValueRef.current;
    const hasBorderGradientLayer = !!decomposeBackgroundStack(current).borderLayer;
    const pos = borderPositionRef.current;
    const keys = Array.from(new Set([
      ...BORDER_LOGICAL_KEYS,
      ...(pos === 'outside' ? ['outline', 'outlineOffset'] : []),
      ...(pos === 'inside' ? ['boxShadow'] : []),
    ]));
    const changes: BorderValue = Object.fromEntries(keys.map((key) => [key, null]));
    if (hasBorderGradientLayer) {
      Object.assign(
        changes,
        buildClearGradientBorderValue(current, contentBackgroundLayersRef.current)
      );
    }
    const result = handleChange(changes);
    if (mutationFailed(result)) return;

    contentBackgroundLayersRef.current = null;
    setShowStyleSettings(false);
    borderPositionRef.current = 'center';
    setBorderPosition('center');
    setForceRenderKey(prev => prev + 1);
  }, [handleChange]);

  const handleExpand = useCallback(() => {
    const next = {...NEW_BORDER_EDITOR_VALUE};
    const result = handleChange(next, 'all');
    if (mutationFailed(result)) return;
    contentBackgroundLayersRef.current = null;
    setShowStyleSettings(false);
    setBorderToggleValue('all');
    borderPositionRef.current = 'center';
    setBorderPosition('center');
    setForceRenderKey(prev => prev + 1);
  }, [handleChange]);

  // 构建 outside/inside 模式的 CSS 输出
  const emitPositionCSS = useCallback((
    pos: BorderPosition,
    w: string,
    c: string,
    s: string,
  ) => {
    const wNum = parseFloat(String(w)) || 1;
    const borderClears = Object.fromEntries(BORDER_LOGICAL_KEYS.map((key) => [key, null]));
    if (pos === 'outside') {
      return commitStyleChanges({
        outline: `${wNum}px ${s || 'solid'} ${c || '#000000'}`,
        outlineOffset: '0px',
        boxShadow: null,
        ...borderClears,
      });
    } else if (pos === 'inside') {
      return commitStyleChanges({
        boxShadow: `inset 0 0 0 ${wNum}px ${c || '#000000'}`,
        outline: null,
        outlineOffset: null,
        ...borderClears,
      });
    }
  }, [commitStyleChanges]);

  // all 模式下感知 position 的变更处理（outside/inside 时转换为 outline/boxShadow 输出）
  const handleAllModeChange = useCallback((changes: Record<string, any>) => {
    const pos = borderPositionRef.current;
    if (pos === 'center') {
      return handleChange(changes, 'all');
    }
    const currentVal = borderValueRef.current;
    const newVal = { ...currentVal, ...changes };
    const w = newVal.borderTopWidth || '1px';
    const c = newVal.borderTopColor || '#000000';
    const s = newVal.borderTopStyle || 'solid';
    const result = emitPositionCSS(pos, w, c, s);
    if (mutationFailed(result)) return result;
    borderValueRef.current = newVal;
    setBorderValue(newVal);
    setPreviewValues((current) => {
      const next = { ...current };
      Object.keys(changes).forEach((key) => { next[key] = undefined; });
      return next;
    });
    return result;
  }, [handleChange, emitPositionCSS]);

  const handleWidthChange = useCallback((keys: string[], next: any, all = false) => {
    const mutation = buildBorderWidthChange(
      borderValueRef.current, keys, next,
      key => context?.getStylePreview?.(key) || effectiveStyle?.[key]?.computedValue
    );
    return all ? handleAllModeChange(mutation.changes) : handleChange(mutation.changes);
  }, [handleChange, handleAllModeChange, context?.getStylePreview, effectiveStyle]);

  // Position 下拉切换时，将当前 borderValue 转换为新的 CSS 位置输出
  const handlePositionChange = useCallback((newPos: BorderPosition) => {
    const oldPos = borderPositionRef.current;
    if (oldPos === newPos) return;
    const val = borderValueRef.current;
    const w = val.borderTopWidth || '1px';
    const c = val.borderTopColor || '#000000';
    const s = val.borderTopStyle || 'solid';
    let result;
    if (newPos === 'outside') {
      result = emitPositionCSS('outside', w, c, s);
    } else if (newPos === 'inside') {
      result = emitPositionCSS('inside', w, c, s);
    } else {
      // center: 恢复为标准 border
      result = commitStyleChanges({
        ...Object.fromEntries(BORDER_WIDTH_KEYS.map((key) => [key, w])),
        ...Object.fromEntries(BORDER_COLOR_KEYS.map((key) => [key, c])),
        ...Object.fromEntries(BORDER_STYLE_KEYS.map((key) => [key, s])),
        outline: null,
        outlineOffset: null,
        boxShadow: null,
      }, 'all');
    }
    if (mutationFailed(result)) return;
    borderPositionRef.current = newPos;
    setBorderPosition(newPos);
  }, [commitStyleChanges, emitPositionCSS]);

  const hasBorderSection = !(disableBorderWidth && disableBorderColor && disableBorderStyle);
  const isInherited = collapse === 'inherited';

  const getPreviewValue = (key: string) =>
    context?.getStylePreview?.(key) || previewValues[key] || effectiveStyle?.[key]?.computedValue;
  const currentBorderStyle = borderValue.borderTopStyle ?? getPreviewValue('borderTopStyle') ?? 'none';
  const borderHasNoVisibleLine = hasNoVisibleBorderLine(
    currentBorderStyle, borderValue.borderTopWidth ?? getPreviewValue('borderTopWidth')
  );

  // 线型按自己的配置回显，不因宽度缺失或为零而把已配置线型显示成“无”。
  const popupStyleValue = borderValue.borderTopStyle ?? (borderHasNoVisibleLine ? 'none' : currentBorderStyle);
  const borderGradientValue = getGradientBorderValue(borderValue);
  const standalone = !context?.getStyleProperty;
  const isConfiguredKey = (key: string) => {
    const current = borderValue[key];
    if (current == null || current === '') return false;
    if (effectiveStyle || borderToggleValue === 'all' || !key.endsWith('Color')) return true;
    const side = key.slice('border'.length, -'Color'.length);
    return !hasNoVisibleBorderLine(
      borderValue[`border${side}Style`],
      borderValue[`border${side}Width`]
    ) && String(current).trim().toLowerCase() !== 'currentcolor';
  };
  const borderColorIsDefault = !borderGradientValue && !isConfiguredKey('borderTopColor');
  const borderColorValue = borderColorIsDefault
    ? ''
    : borderGradientValue || borderValue.borderTopColor;

  const canClearKeys = (keys: string[]) => {
    if (standalone) return keys.some((key) => borderValue[key] != null);
    const plans = context?.getStyleClearPlans?.(keys) ??
      keys.map((key) => context?.getStyleProperty?.(key)?.clearPlan).filter(Boolean);
    return !plans.some((plan) => plan?.action === 'unsupported') &&
      plans.some((plan) => plan?.action === 'delete' || plan?.action === 'write-unset');
  };
  const positionClearKeys = borderPosition === 'outside'
    ? ['outline', 'outlineOffset']
    : borderPosition === 'inside'
      ? ['boxShadow']
      : [];
  const gradientClearValue = borderGradientValue
    ? buildClearGradientBorderValue(borderValue, contentBackgroundLayersRef.current)
    : {};
  const gradientMutationClearKeys = Object.entries(gradientClearValue)
    .filter(([, nextValue]) => nextValue == null)
    .map(([key]) => key);
  const allColorClearKeys = borderPosition === 'center'
    ? [...BORDER_COLOR_KEYS, ...gradientMutationClearKeys]
    : positionClearKeys;
  const allColorCanClear = canClearKeys(allColorClearKeys);
  const fieldCanClear = Object.fromEntries(
    BORDER_LOGICAL_KEYS.map((key) => [key, canClearKeys(key.endsWith('Width') ? getBorderSideKeys(key) : [key])])
  ) as Record<string, boolean>;
  const resetKeys = [
    ...BORDER_LOGICAL_KEYS,
    ...positionClearKeys,
    ...(borderGradientValue ? gradientMutationClearKeys : []),
  ];
  const canReset = canClearKeys(resetKeys);
  const allWidthCanClear = borderPosition === 'center' ? canClearKeys(BORDER_WIDTH_KEYS) : canReset;

  // useEffect(() => {
  //   const plans = standalone
  //     ? []
  //     : context?.getStyleClearPlans?.(resetKeys) ??
  //       resetKeys.map((key) => context?.getStyleProperty?.(key)?.clearPlan).filter(Boolean);
  //   const planSnapshot = plans.map((plan) => ({
  //     key: plan?.key,
  //     action: plan?.action,
  //     selector: plan && 'selector' in plan ? plan.selector : undefined,
  //     reason: plan && 'reason' in plan ? plan.reason : undefined,
  //     winner: plan?.winner ? {
  //       value: plan.winner.value,
  //       property: plan.winner.property,
  //       source: plan.winner.label,
  //       currentState: plan.winner.currentState,
  //       important: plan.winner.important,
  //     } : null,
  //     candidates: plan?.candidates.length,
  //   }));

  //   console.log('[边框删除预检]', {
  //     canReset,
  //     showMinus: !isInherited && canReset,
  //     standalone,
  //     isInherited,
  //     borderPosition,
  //     borderToggleValue,
  //     resetKeys: [...resetKeys],
  //     plans: planSnapshot,
  //   });
  //   console.table(resetKeys.map((key) => {
  //     const property = context?.getStyleProperty?.(key);
  //     const winner = property?.winner;
  //     const clearPlan = property?.clearPlan;
  //     return {
  //       key,
  //       面板值: borderValue[key],
  //       显示值: effectiveStyle?.[key]?.value,
  //       显示来源: effectiveStyle?.[key]?.sourceSelector,
  //       索引值: winner?.value,
  //       索引属性: winner?.property,
  //       索引来源: winner?.label,
  //       属于当前状态: winner?.currentState,
  //       候选数量: property?.candidates.length,
  //       单属性清空动作: clearPlan?.action,
  //       不可清空原因: clearPlan && 'reason' in clearPlan ? clearPlan.reason : undefined,
  //     };
  //   }));
  // }, [
  //   canReset,
  //   standalone,
  //   isInherited,
  //   borderPosition,
  //   borderToggleValue,
  //   context,
  //   effectiveStyle,
  //   borderValue,
  // ]);

  const handlePositionBorderClear = useCallback(() => {
    const pos = borderPositionRef.current;
    const changes: BorderValue = Object.fromEntries(
      BORDER_LOGICAL_KEYS.map((key) => [key, null])
    );
    if (pos === 'outside') {
      changes.outline = null;
      changes.outlineOffset = null;
    } else if (pos === 'inside') {
      changes.boxShadow = null;
    }
    return handleChange(changes);
  }, [handleChange]);

  const handleAllColorClear = useCallback(() => {
    if (borderPositionRef.current !== 'center') return handlePositionBorderClear();
    const current = borderValueRef.current;
    const clearGradient = buildClearGradientBorderValue(
      current,
      contentBackgroundLayersRef.current
    );
    console.log("clearGradient",clearGradient)
    const result = handleChange({
      ...Object.fromEntries(BORDER_COLOR_KEYS.map((key) => [key, null])),
      ...clearGradient,
    });
    if (!mutationFailed(result)) {
      contentBackgroundLayersRef.current = null;
      setBorderColorEditorKey((key) => key + 1);
    }
    return result;
  }, [handleChange, handlePositionBorderClear]);

  // 普通 border 的宽度“默认”只撤销宽度；整组删除仍由面板减号负责。
  const handleAllWidthClear = useCallback(() => {
    if (borderPositionRef.current !== 'center') return refresh();
    return handleWidthChange(['borderWidth'], 0, true);
  }, [handleWidthChange, refresh]);

  const borderConfig = useMemo(() => {
    if (disableBorderWidth && disableBorderColor && disableBorderStyle) {
      return null;
    }
    if (borderToggleValue === "all") {
      return (
        <div>
          {/* 行1：颜色 + 删除按钮 */}
          <div className={css.row}>
            <Panel.Content style={{ padding: 3, flex: 1, minWidth: 0 }}>
              <Panel.Item className={css.editArea} style={{ padding: 0 }}>
                {disableBorderColor ? null : (
                  <ColorEditor
                    key={borderColorEditorKey}
                    style={{ padding: 0, flex: 1, minWidth: 26 }}
                    defaultValue={borderColorValue}
                    emptyValueLabel="默认"
                    resolvedColor={resolveCssVarColor(
                      borderValue.borderTopColor || getPreviewValue('borderTopColor') || "",
                      targetDom
                    ) ?? undefined}
                    variableOptions={canvasColorVariables}
                    scopeEl={targetDom}
                    showSubTabs={borderPosition === 'center'}
                    disableBackgroundImage={true}
                    clearable={allColorCanClear}
                    onClear={handleAllColorClear}
                    onChange={(input: any) => {
                      const value = getColorEditorValue(input);
                      if (!value) return;
                      const pos = borderPositionRef.current;
                      if (pos === 'center') {
                        // 居中模式：保留完整渐变/纯色逻辑
                        const current = borderValueRef.current;
                        let newValue: Record<string, any>;
                        if (isGradientValue(value)) {
                          const contentLayers = contentBackgroundLayersRef.current?.length
                            ? contentBackgroundLayersRef.current
                            : getContentBackgroundLayers(current);
                          newValue = buildGradientBorderValue(value, current, contentLayers);
                          if (!isLengthNineAndEndsWithZeroes(value) && isZeroBorderWidth(current.borderTopWidth)) {
                            const autoStyle = !current.borderTopStyle || current.borderTopStyle === 'none'
                              ? 'solid'
                              : current.borderTopStyle;
                            Object.assign(newValue, {
                              ...Object.fromEntries(BORDER_WIDTH_KEYS.map((key) => [key, '1px'])),
                              ...Object.fromEntries(BORDER_STYLE_KEYS.map((key) => [key, autoStyle])),
                            });
                          }
                          const result = handleChange(newValue);
                          if (!mutationFailed(result)) {
                            contentBackgroundLayersRef.current = contentLayers;
                          }
                        } else {
                          newValue = {
                            ...Object.fromEntries(BORDER_COLOR_KEYS.map((key) => [key, value])),
                            ...buildClearGradientBorderValue(current, contentBackgroundLayersRef.current),
                          };
                          if (!isLengthNineAndEndsWithZeroes(value) && isZeroBorderWidth(current.borderTopWidth)) {
                            const autoStyle = !current.borderTopStyle || current.borderTopStyle === "none"
                              ? "solid"
                              : current.borderTopStyle;
                            Object.assign(newValue, {
                              ...Object.fromEntries(BORDER_WIDTH_KEYS.map((key) => [key, '1px'])),
                              ...Object.fromEntries(BORDER_STYLE_KEYS.map((key) => [key, autoStyle])),
                            });
                          }
                          const result = handleChange(newValue);
                          if (!mutationFailed(result)) {
                            contentBackgroundLayersRef.current = null;
                          }
                        }
                      } else {
                        // 外部/内部模式：仅支持纯色，输出 outline/boxShadow
                        if (isLengthNineAndEndsWithZeroes(value)) return;
                        const currentVal = borderValueRef.current;
                        const autoWidth = isZeroBorderWidth(currentVal.borderTopWidth);
                        const autoStyle = !currentVal.borderTopStyle || currentVal.borderTopStyle === "none" ? "solid" : currentVal.borderTopStyle;
                        handleAllModeChange({
                          borderTopColor: value, borderRightColor: value,
                          borderBottomColor: value, borderLeftColor: value,
                          ...(autoWidth ? {
                            borderTopWidth: "1px", borderRightWidth: "1px",
                            borderBottomWidth: "1px", borderLeftWidth: "1px",
                            borderTopStyle: autoStyle, borderRightStyle: autoStyle,
                            borderBottomStyle: autoStyle, borderLeftStyle: autoStyle,
                          } : {}),
                        });
                      }
                    }}
                  />
                )}
              </Panel.Item>
            </Panel.Content>
          </div>

          {/* 行2：[线条样式下拉] [≡ Weight 输入 + 位置设置] */}
          <div className={css.row}>
            <Panel.Content style={{ padding: 3, flex: 1, minWidth: 0 }}>
              <Panel.Item className={css.editArea} style={{ padding: "0px 8px" }}>
                <Select
                  tip="线条样式"
                  style={{ padding: 0, flex: 1 }}
                  value={popupStyleValue}
                  options={STROKE_STYLE_POPUP_OPTIONS}
                  onChange={(val) => {
                    const nextStyle = String(val);
                    const currentWidth = borderValue.borderTopWidth || '0px';
                    const nextWidth = nextStyle === 'none'
                      ? '0px'
                      : currentBorderStyle === 'none' || isZeroBorderWidth(currentWidth)
                        ? '1px'
                        : currentWidth;
                    handleAllModeChange({
                      borderTopStyle: val,
                      borderRightStyle: val,
                      borderBottomStyle: val,
                      borderLeftStyle: val,
                      ...(nextWidth !== borderValue.borderTopWidth ? {
                        borderTopWidth: nextWidth,
                        borderRightWidth: nextWidth,
                        borderBottomWidth: nextWidth,
                        borderLeftWidth: nextWidth,
                      } : {}),
                    });
                  }}
                />
              </Panel.Item>
            </Panel.Content>
            <Panel.Content style={{ padding: 3, flex: 1, minWidth: 0 }}>
              <Panel.Item className={css.editArea} style={{ padding: "0px 8px" }}>
                <div className={css.weightGroup} style={{ flex: 1, minWidth: 0 }}>
                  <div
                    className={css.icon}
                    ref={widthAllVar.anchorRef}
                    {...(widthAllVar.varRef
                      ? widthAllVar.dragProps('拖拽调整边框宽度（将解除变量绑定）')
                      : getDragPropsBorder(borderValue.borderTopWidth, '拖拽调整边框宽度'))}
                  >
                    <BorderWeightOutlined />
                  </div>
                  {disableBorderWidth ? null : (
                    <VariableNumberInput
                      binding={widthAllVar}
                      chipStyle={CHIP_STYLE}
                      inputProps={{
                        tip: borderValue.borderTopWidth == null
                          ? buildComputedTip('边框宽度', effectiveStyle?.borderTopWidth, getPreviewValue('borderTopWidth'))
                          : '边框宽度',
                        style: { padding: 0, fontSize: 10, marginLeft: shouldShowMiniLayout ? 2 : 4, flex: 1, minWidth: 0 },
                        defaultValue: borderValue.borderTopWidth,
                        value: borderValue.borderTopWidth,
                        defaultUnitValue: 'px',
                        unitOptions: withDefaultUnitOption(borderWidthUnitOptions, allWidthCanClear),
                        unitDisabledList: ['default'],
                        unitHideLabelList: ['px', '%'],
                        showIcon: true,
                        showIconOnHover: true,
                        fallbackValue: 0,
                        clearable: allWidthCanClear,
                        onClear: handleAllWidthClear,
                        onChange: (value) => {
                          if (value === 'default') {
                            handleAllWidthClear();
                            return;
                          }
                          handleWidthChange(BORDER_WIDTH_KEYS, value, true);
                        },
                        onAction: (action) => {
                          if (action === APPLY_VARIABLE_ACTION) widthAllVar.openPicker();
                        },
                      }}
                    />
                  )}
                </div>
              </Panel.Item>
            </Panel.Content>
            {disableBorderStyle ? null : (
              <div
                ref={styleSettingsBtnRef}
                className={css.styleSettingsBtn}
                data-mybricks-tip="边框位置设置"
                    onClick={() => setShowStyleSettings(v => !v)}
              >
                    <SettingIcon size={22} />
                  </div>
            )}
          </div>
        </div>
      );
    } else {
      if (
        disableBorderTop &&
        disableBorderRight &&
        disableBorderBottom &&
        disableBorderLeft
      ) {
        return null;
      }
      return (
        <div className={css.col}>
          {!disableBorderLeft && (
            <div className={css.row}>
              <Panel.Content style={{ padding: '3px 0 3px 3px', flex: 1, minWidth: 0 }}>
                <Panel.Item className={`${css.editArea} ${css.editAreaSplit}`}>
                  <div className={css.icon}>
                    <BorderLeftOutlined />
                  </div>
                  {disableBorderColor ? null : (
                    <ColorEditor
                      key={`left-${borderColorEditorKey}`}
                      style={{ padding: 0, marginLeft: 2, flex: 1, minWidth: 26 }}
                      defaultValue={isConfiguredKey('borderLeftColor') ? borderValue.borderLeftColor : ''}
                      emptyValueLabel="默认"
                      resolvedColor={resolveCssVarColor(borderValue.borderLeftColor || getPreviewValue('borderLeftColor') || "", targetDom) ?? undefined}
                      variableOptions={canvasColorVariables}
                      scopeEl={targetDom}
                      showSubTabs={false}
                      clearable={fieldCanClear.borderLeftColor}
                      onClear={() => handleChange({ borderLeftColor: null })}
                      onChange={(input: any) => {
                        const value = getColorEditorValue(input);
                        if (!value) return;
                        const newValue: Record<string, any> = { borderLeftColor: value };
                        if (!isLengthNineAndEndsWithZeroes(value) && isZeroBorderWidth(borderValue.borderLeftWidth)) {
                          newValue.borderLeftWidth = "1px";
                          if (!borderValue.borderLeftStyle || borderValue.borderLeftStyle === "none") {
                            newValue.borderLeftStyle = "solid";
                          }
                        }
                        handleChange(newValue);
                      }}
                    />
                  )}
                  <div
                    className={`${css.weightGroup} ${css.weightGroupSplit}`}
                    ref={leftWidthVar.anchorRef}
                  >
                    {disableBorderWidth ? null : (
                      <VariableNumberInput
                        binding={leftWidthVar}
                        chipStyle={CHIP_STYLE_SPLIT}
                        compact
                        inputProps={{
                          tip: borderValue.borderLeftWidth == null
                            ? buildComputedTip('左边框宽度', effectiveStyle?.borderLeftWidth, getPreviewValue('borderLeftWidth'))
                            : '左边框宽度',
                          style: WIDTH_STYLE_SPLIT,
                          defaultValue: borderValue.borderLeftWidth,
                          value: borderValue.borderLeftWidth,
                          defaultUnitValue: 'px',
                          unitOptions: withDefaultUnitOption(borderWidthUnitOptions, fieldCanClear.borderLeftWidth),
                          unitDisabledList: ['default'],
                          unitHideLabelList: ['px', '%'],
                          showIcon: true,
                          showIconOnHover: true,
                          clearable: fieldCanClear.borderLeftWidth,
                          onClear: () => handleWidthChange(['borderLeftWidth'], 0),
                          fallbackValue: 0,
                          onChange: (value) => {
                            if (value === 'default') {
                              handleWidthChange(['borderLeftWidth'], 0);
                              return;
                            }
                            handleWidthChange(['borderLeftWidth'], value);
                          },
                          onAction: (action) => {
                            if (action === APPLY_VARIABLE_ACTION) leftWidthVar.openPicker();
                          },
                        }}
                      />
                    )}
                  </div>
                </Panel.Item>
              </Panel.Content>
            </div>
          )}
          {!disableBorderTop && (
            <div className={css.row}>
              <Panel.Content style={{ padding: '3px 0 3px 3px', flex: 1, minWidth: 0 }}>
                <Panel.Item className={`${css.editArea} ${css.editAreaSplit}`}>
                  <div className={css.icon}>
                    <BorderTopOutlined />
                  </div>
                  {disableBorderColor ? null : (
                    <ColorEditor
                      key={`top-${borderColorEditorKey}`}
                      style={{ padding: 0, marginLeft: 2, flex: 1, minWidth: 26 }}
                      defaultValue={isConfiguredKey('borderTopColor') ? borderValue.borderTopColor : ''}
                      emptyValueLabel="默认"
                      resolvedColor={resolveCssVarColor(borderValue.borderTopColor || getPreviewValue('borderTopColor') || "", targetDom) ?? undefined}
                      variableOptions={canvasColorVariables}
                      scopeEl={targetDom}
                      showSubTabs={false}
                      clearable={fieldCanClear.borderTopColor}
                      onClear={() => handleChange({ borderTopColor: null })}
                      onChange={(input: any) => {
                        const value = getColorEditorValue(input);
                        if (!value) return;
                        const newValue: Record<string, any> = { borderTopColor: value };
                        if (!isLengthNineAndEndsWithZeroes(value) && isZeroBorderWidth(borderValue.borderTopWidth)) {
                          newValue.borderTopWidth = "1px";
                          if (!borderValue.borderTopStyle || borderValue.borderTopStyle === "none") {
                            newValue.borderTopStyle = "solid";
                          }
                        }
                        handleChange(newValue);
                      }}
                    />
                  )}
                  <div
                    className={`${css.weightGroup} ${css.weightGroupSplit}`}
                    ref={topWidthVar.anchorRef}
                  >
                    {disableBorderWidth ? null : (
                      <VariableNumberInput
                        binding={topWidthVar}
                        chipStyle={CHIP_STYLE_SPLIT}
                        compact
                        inputProps={{
                          tip: borderValue.borderTopWidth == null
                            ? buildComputedTip('上边框宽度', effectiveStyle?.borderTopWidth, getPreviewValue('borderTopWidth'))
                            : '上边框宽度',
                          style: WIDTH_STYLE_SPLIT,
                          defaultValue: borderValue.borderTopWidth,
                          value: borderValue.borderTopWidth,
                          defaultUnitValue: 'px',
                          unitOptions: withDefaultUnitOption(borderWidthUnitOptions, fieldCanClear.borderTopWidth),
                          unitDisabledList: ['default'],
                          unitHideLabelList: ['px', '%'],
                          showIcon: true,
                          showIconOnHover: true,
                          clearable: fieldCanClear.borderTopWidth,
                          onClear: () => handleWidthChange(['borderTopWidth'], 0),
                          fallbackValue: 0,
                          onChange: (value) => {
                            if (value === 'default') {
                              handleWidthChange(['borderTopWidth'], 0);
                              return;
                            }
                            handleWidthChange(['borderTopWidth'], value);
                          },
                          onAction: (action) => {
                            if (action === APPLY_VARIABLE_ACTION) topWidthVar.openPicker();
                          },
                        }}
                      />
                    )}
                  </div>
                </Panel.Item>
              </Panel.Content>
            </div>
          )}

          {!disableBorderRight && (
            <div className={css.row}>
              <Panel.Content style={{ padding: '3px 0 3px 3px', flex: 1, minWidth: 0 }}>
                <Panel.Item className={`${css.editArea} ${css.editAreaSplit}`}>
                  <div className={css.icon}>
                    <BorderRightOutlined />
                  </div>
                  {disableBorderColor ? null : (
                    <ColorEditor
                      key={`right-${borderColorEditorKey}`}
                      style={{ padding: 0, marginLeft: 2, flex: 1, minWidth: 26 }}
                      defaultValue={isConfiguredKey('borderRightColor') ? borderValue.borderRightColor : ''}
                      emptyValueLabel="默认"
                      resolvedColor={resolveCssVarColor(borderValue.borderRightColor || getPreviewValue('borderRightColor') || "", targetDom) ?? undefined}
                      variableOptions={canvasColorVariables}
                      scopeEl={targetDom}
                      showSubTabs={false}
                      clearable={fieldCanClear.borderRightColor}
                      onClear={() => handleChange({ borderRightColor: null })}
                      onChange={(input: any) => {
                        const value = getColorEditorValue(input);
                        if (!value) return;
                        const newValue: Record<string, any> = { borderRightColor: value };
                        if (!isLengthNineAndEndsWithZeroes(value) && isZeroBorderWidth(borderValue.borderRightWidth)) {
                          newValue.borderRightWidth = "1px";
                          if (!borderValue.borderRightStyle || borderValue.borderRightStyle === "none") {
                            newValue.borderRightStyle = "solid";
                          }
                        }
                        handleChange(newValue);
                      }}
                    />
                  )}
                  <div
                    className={`${css.weightGroup} ${css.weightGroupSplit}`}
                    ref={rightWidthVar.anchorRef}
                  >
                    {disableBorderWidth ? null : (
                      <VariableNumberInput
                        binding={rightWidthVar}
                        chipStyle={CHIP_STYLE_SPLIT}
                        compact
                        inputProps={{
                          tip: borderValue.borderRightWidth == null
                            ? buildComputedTip('右边框宽度', effectiveStyle?.borderRightWidth, getPreviewValue('borderRightWidth'))
                            : '右边框宽度',
                          style: WIDTH_STYLE_SPLIT,
                          defaultValue: borderValue.borderRightWidth,
                          value: borderValue.borderRightWidth,
                          defaultUnitValue: 'px',
                          unitOptions: withDefaultUnitOption(borderWidthUnitOptions, fieldCanClear.borderRightWidth),
                          unitDisabledList: ['default'],
                          unitHideLabelList: ['px', '%'],
                          showIcon: true,
                          showIconOnHover: true,
                          clearable: fieldCanClear.borderRightWidth,
                          onClear: () => handleWidthChange(['borderRightWidth'], 0),
                          fallbackValue: 0,
                          onChange: (value) => {
                            if (value === 'default') {
                              handleWidthChange(['borderRightWidth'], 0);
                              return;
                            }
                            handleWidthChange(['borderRightWidth'], value);
                          },
                          onAction: (action) => {
                            if (action === APPLY_VARIABLE_ACTION) rightWidthVar.openPicker();
                          },
                        }}
                      />
                    )}
                  </div>
                </Panel.Item>
              </Panel.Content>
            </div>
          )}

          {!disableBorderBottom && (
            <div className={css.row}>
              <Panel.Content style={{ padding: '3px 0 3px 3px', flex: 1, minWidth: 0 }}>
                <Panel.Item className={`${css.editArea} ${css.editAreaSplit}`}>
                  <div className={css.icon}>
                    <BorderBottomOutlined />
                  </div>
                  {disableBorderColor ? null : (
                    <ColorEditor
                      key={`bottom-${borderColorEditorKey}`}
                      style={{ padding: 0, marginLeft: 2, flex: 1, minWidth: 26 }}
                      defaultValue={isConfiguredKey('borderBottomColor') ? borderValue.borderBottomColor : ''}
                      emptyValueLabel="默认"
                      resolvedColor={resolveCssVarColor(borderValue.borderBottomColor || getPreviewValue('borderBottomColor') || "", targetDom) ?? undefined}
                      variableOptions={canvasColorVariables}
                      scopeEl={targetDom}
                      showSubTabs={false}
                      clearable={fieldCanClear.borderBottomColor}
                      onClear={() => handleChange({ borderBottomColor: null })}
                      onChange={(input: any) => {
                        const value = getColorEditorValue(input);
                        if (!value) return;
                        const newValue: Record<string, any> = { borderBottomColor: value };
                        if (!isLengthNineAndEndsWithZeroes(value) && isZeroBorderWidth(borderValue.borderBottomWidth)) {
                          newValue.borderBottomWidth = "1px";
                          if (!borderValue.borderBottomStyle || borderValue.borderBottomStyle === "none") {
                            newValue.borderBottomStyle = "solid";
                          }
                        }
                        handleChange(newValue);
                      }}
                    />
                  )}
                  <div
                    className={`${css.weightGroup} ${css.weightGroupSplit}`}
                    ref={bottomWidthVar.anchorRef}
                  >
                    {disableBorderWidth ? null : (
                      <VariableNumberInput
                        binding={bottomWidthVar}
                        chipStyle={CHIP_STYLE_SPLIT}
                        compact
                        inputProps={{
                          tip: borderValue.borderBottomWidth == null
                            ? buildComputedTip('下边框宽度', effectiveStyle?.borderBottomWidth, getPreviewValue('borderBottomWidth'))
                            : '下边框宽度',
                          style: WIDTH_STYLE_SPLIT,
                          defaultValue: borderValue.borderBottomWidth,
                          value: borderValue.borderBottomWidth,
                          defaultUnitValue: 'px',
                          unitOptions: withDefaultUnitOption(borderWidthUnitOptions, fieldCanClear.borderBottomWidth),
                          unitDisabledList: ['default'],
                          unitHideLabelList: ['px', '%'],
                          showIcon: true,
                          showIconOnHover: true,
                          clearable: fieldCanClear.borderBottomWidth,
                          onClear: () => handleWidthChange(['borderBottomWidth'], 0),
                          fallbackValue: 0,
                          onChange: (value) => {
                            if (value === 'default') {
                              handleWidthChange(['borderBottomWidth'], 0);
                              return;
                            }
                            handleWidthChange(['borderBottomWidth'], value);
                          },
                          onAction: (action) => {
                            if (action === APPLY_VARIABLE_ACTION) bottomWidthVar.openPicker();
                          },
                        }}
                      />
                    )}
                  </div>
                </Panel.Item>
              </Panel.Content>
            </div>
          )}
        </div>
      );
    }
  }, [
    borderToggleValue, popupStyleValue, borderValue, previewValues,
    getDragPropsBorder, borderColorEditorKey, borderPosition,
    handleAllModeChange, handlePositionChange, handleAllColorClear, handleAllWidthClear,
    handleChange, handleWidthChange, allColorCanClear, allWidthCanClear, fieldCanClear,
    context?.getStylePreview,
    effectiveStyle, targetDom, canvasColorVariables,
    widthAllVar, topWidthVar, rightWidthVar, bottomWidthVar, leftWidthVar,
    borderWidthUnitOptions, shouldShowMiniLayout,
  ]);

  const handleToggleChange = useCallback(
    (value: 'all' | 'split') => {
      if (value === 'all' && borderToggleValue !== 'all') {
        const current = borderValueRef.current;
        const result = handleAllModeChange({
          ...Object.fromEntries(BORDER_COLOR_KEYS.map((name) => [name, current.borderTopColor])),
          ...Object.fromEntries(BORDER_STYLE_KEYS.map((name) => [name, current.borderTopStyle])),
          ...Object.fromEntries(BORDER_WIDTH_KEYS.map((name) => [name, current.borderTopWidth])),
        });
        if (mutationFailed(result)) return;
      }
      setBorderToggleValue(value);
    },
    [borderToggleValue, handleAllModeChange]
  );

  const styleSettingsPortal = !disableBorderStyle && showStyleSettings
    ? createPortal(
        <div
          ref={styleSettingsPopoverRef}
          className={css.styleSettingsPopover}
        >
          <div className={css.strokePopoverTitle}>边框位置</div>
          <div className={css.strokePopoverRow}>
            <span className={css.strokePopoverLabel}>位置</span>
            <Select
              style={{ flex: 1, padding: '0 8px' }}
              value={borderPosition}
              options={BORDER_POSITION_OPTIONS}
              onChange={(val) => handlePositionChange(val as BorderPosition)}
            />
          </div>
        </div>,
        document.body
      )
    : null;

  return (
    <>
    {styleSettingsPortal as React.ReactNode}
    <Panel
      title="边框"
      showTitle={showTitle}
      collapse={collapse}
      onExpand={handleExpand}
      resetFunction={refresh}
      deleteRef={panelDeleteRef}
      rightColumn={
        <div className={css.rightColumn}>
          {!isInherited && canReset && (
            <div
              data-mybricks-tip={`{content:'删除边框',position:'left'}`}
              className={css.rightColumnBtn}
              onClick={() => panelDeleteRef.current?.()}
            >
              <MinusOutlined />
            </div>
          )}
          {(isInherited || !canReset) && (
            <div className={css.rightColumnPlaceholder} aria-hidden="true" />
          )}
          {hasBorderSection && (
            <div
              data-mybricks-tip={borderToggleValue === 'all'
                ? `{content:'切换为单独配置',position:'left'}`
                : `{content:'切换为统一配置',position:'left'}`}
              className={`${css.rightColumnBtn} ${css.rightColumnBtnSmall}`}
              onClick={() => {
                setShowStyleSettings(false);
                handleToggleChange(borderToggleValue === 'all' ? "split" : "all");
              }}
            >
              <BorderSplitOutlined />
            </div>
          )}
        </div>
      }
    >
      <React.Fragment key={forceRenderKey}>
        {borderConfig}
      </React.Fragment>
    </Panel>
    </>
  );
}

function getBorderToggleDefaultValue(value: CSSProperties): 'all' | 'split' {
  return allEqual([
    value.borderTopWidth,
    value.borderRightWidth,
    value.borderBottomWidth,
    value.borderLeftWidth,
  ]) &&
    allEqual([
      value.borderTopStyle,
      value.borderRightStyle,
      value.borderBottomStyle,
      value.borderLeftStyle,
    ]) &&
    allEqual([
      value.borderTopColor,
      value.borderRightColor,
      value.borderBottomColor,
      value.borderLeftColor,
    ])
    ? "all"
    : "split";
}
