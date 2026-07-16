import React, { useMemo, useState, useCallback, useRef, useEffect, CSSProperties } from "react";
import { createPortal } from "react-dom";

import {
  Panel,
  Select,
  ColorEditor,
  InputNumber,
  BorderRadiusSplitOutlined,
  BorderTopLeftRadiusOutlined,
  BorderTopRightRadiusOutlined,
  BorderBottomLeftRadiusOutlined,
  BorderBottomRightRadiusOutlined,
  BorderWeightOutlined,
  BorderSplitOutlined,
  BorderTopOutlined,
  BorderBottomOutlined,
  BorderLeftOutlined,
  BorderRightOutlined,
  MinusOutlined,
} from "../../components";
import { Setting as SettingIcon } from "../../icons/Setting";
import { allEqual } from "../../utils";
import { useUpdateEffect, useDragNumber } from "../../hooks";
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

import type { ChangeEvent, PanelBaseProps } from "../../type";

import css from "./index.less";

interface BorderProps extends PanelBaseProps {
  value: CSSProperties;
  onChange: ChangeEvent;
}

const BORDER_STYLE_OPTIONS = [
  { label: "无", value: "none" },
  { label: "实线", value: "solid" },
  { label: "虚线", value: "dashed" },
];

const STROKE_STYLE_POPUP_OPTIONS = [
  { value: 'solid', label: '实线' },
  { value: 'dashed', label: '虚线' },
];

type BorderPosition = "outside" | "center" | "inside";

const BORDER_POSITION_OPTIONS = [
  { label: "外部", value: "outside" },
  { label: "居中", value: "center" },
  { label: "内部", value: "inside" },
];
const UNIT_OPTIONS = [
  { label: "px", value: "px" },
  { label: "%", value: "%" },
];
const DEFAULT_STYLE = {
  padding: 0,
  fontSize: 10,
  minWidth: 71,
  //maxWidth: 71,
  marginLeft: 4,
};

const DEFAULT_STYLE_SMALL = {
  padding: 0,
  fontSize: 10,
  minWidth: 26,
  maxWidth: 26,
  marginLeft: 4,
};

const DEFAULT_STYLE_MINI = {
  padding: 0,
  fontSize: 10,
  minWidth: 18,
  maxWidth: 18,
  marginLeft: 2,
}

const DEFAULT_STYLE__NEW = {
  padding: 0,
  fontSize: 10,
  marginLeft: 0,
};

const DEFAULT_CONFIG = {
  disableBorderStyle: false,
  disableBorderWidth: false,
  disableBorderColor: false,
  disableBorderRadius: false,
  disableBorderTop: false,
  disableBorderRight: false,
  disableBorderBottom: false,
  disableBorderLeft: false,
  useImportant: false,
};

const GRADIENT_BORDER_KEYS = ["backgroundImage", "backgroundOrigin", "backgroundClip"];

const BORDER_LOGICAL_KEYS = [
  'borderTopWidth', 'borderRightWidth', 'borderBottomWidth', 'borderLeftWidth',
  'borderTopColor', 'borderRightColor', 'borderBottomColor', 'borderLeftColor',
  'borderTopStyle', 'borderRightStyle', 'borderBottomStyle', 'borderLeftStyle',
];

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

export function Border({ value, onChange, config, showTitle, collapse }: BorderProps) {
  const [
    {
      disableBorderWidth,
      disableBorderColor,
      disableBorderStyle,
      disableBorderRadius,
      disableBorderTop,
      disableBorderRight,
      disableBorderBottom,
      disableBorderLeft,
      useImportant,
    },
  ] = useState({ ...DEFAULT_CONFIG, ...config });
  const [{ borderToggleValue, radiusToggleValue }, setToggleValue] = useState(
    getToggleDefaultValue(value)
  );
  const defaultBorderValue = useMemo(() => {
    const defaultValue = Object.assign({}, value) as CSSProperties & Record<string, any>;
    Object.entries(defaultValue).forEach(([key, val]) => {
      if (typeof val === "string") {
        // @ts-ignore
        defaultValue[key] = val.replace(/!.*$/, "");
      }
    });
    // 对于 outside/inside 模式，从 outline/boxShadow 还原虚拟 border* 值供编辑器显示
    const pos = detectPositionFromCSS(defaultValue);
    if (pos === 'outside' && defaultValue.outline) {
      const v = parseOutlineToVirtual(String(defaultValue.outline));
      BORDER_LOGICAL_KEYS.forEach(k => {
        if (k.endsWith('Width')) defaultValue[k] = v.width;
        else if (k.endsWith('Style')) defaultValue[k] = v.style;
        else if (k.endsWith('Color')) defaultValue[k] = v.color;
      });
    } else if (pos === 'inside' && defaultValue.boxShadow) {
      const v = parseInsetShadowToVirtual(String(defaultValue.boxShadow));
      BORDER_LOGICAL_KEYS.forEach(k => {
        if (k.endsWith('Width')) defaultValue[k] = v.width;
        else if (k.endsWith('Style')) defaultValue[k] = 'solid';
        else if (k.endsWith('Color')) defaultValue[k] = v.color;
      });
    }
    return defaultValue;
  }, []);
  const contentBackgroundLayersRef = useRef<string[] | null>(getContentBackgroundLayers(defaultBorderValue));
  const borderGradientRef = useRef<string | undefined>(getGradientBorderValue(defaultBorderValue));
  const [borderValue, setBorderValue] = useState(defaultBorderValue);
  const [forceRenderKey, setForceRenderKey] = useState<number>(Math.random());
  // 面板切换重挂载的瞬间，value（DOM computedStyle）有时还没同步到最新的渐变边框信息，
  // 导致 defaultBorderValue 快照缺失渐变边框；borderValue 挂载后不会再跟随 value 更新，
  // 于是渐变颜色编辑器会一直显示成默认的 90° 白色渐变。这里做一次性补偿：
  // 一旦发现外部 value 补上了渐变边框数据而内部状态还没有，就同步过来，
  // 并 bump ColorEditor 的 key 让它用正确的初始值重新挂载。
  // 只在挂载后"追一次"，避免用户主动清除渐变边框后，被滞后的外部 value 错误地复原。
  const [borderColorEditorKey, setBorderColorEditorKey] = useState(0);
  const hasCaughtUpGradientRef = useRef(false);
  const hasUserEditedRef = useRef(false);
  useUpdateEffect(() => {
    if (hasCaughtUpGradientRef.current || hasUserEditedRef.current) {
      return;
    }
    if (hasGradientBorderBackground(borderValue)) {
      hasCaughtUpGradientRef.current = true;
      return;
    }
    const incomingValue: CSSProperties & Record<string, any> = Object.assign({}, value);
    Object.entries(incomingValue).forEach(([key, v]) => {
      if (typeof v === "string") {
        // @ts-ignore
        incomingValue[key] = v.replace(/!.*$/, "");
      }
    });
    if (!hasGradientBorderBackground(incomingValue)) {
      return;
    }
    const gradientLayer = getGradientBorderValue(incomingValue);
    if (!gradientLayer) {
      return;
    }
    hasCaughtUpGradientRef.current = true;
    contentBackgroundLayersRef.current = getContentBackgroundLayers(incomingValue);
    borderGradientRef.current = gradientLayer;
    setBorderValue((val) => ({
      ...val,
      backgroundImage: incomingValue.backgroundImage,
      backgroundOrigin: incomingValue.backgroundOrigin,
      backgroundClip: incomingValue.backgroundClip,
    }));
    setBorderColorEditorKey((k) => k + 1);
  }, [value]);
  const [splitRadiusIcon, setSplitRadiusIcon] = useState(
    <BorderTopLeftRadiusOutlined />
  );
  const getDragPropsRadius = useDragNumber({ continuous: true });
  const getDragPropsBorder = useDragNumber({ continuous: true });

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

  const handleChange = useCallback(
    (value: CSSProperties & Record<string, any>) => {
      hasUserEditedRef.current = true;
      setBorderValue((val) => {
        const {
          backgroundImage,
          backgroundOrigin,
          backgroundClip,
          borderTopWidth,
          borderRightWidth,
          borderBottomWidth,
          borderLeftWidth,
          borderTopColor,
          borderRightColor,
          borderBottomColor,
          borderLeftColor,
          borderTopStyle,
          borderRightStyle,
          borderBottomStyle,
          borderLeftStyle,
          borderTopLeftRadius,
          borderBottomLeftRadius,
          borderBottomRightRadius,
          borderTopRightRadius,
        } = val ?? {};

        const newValues: Record<string, any> = {
          // 仅当 backgroundImage 代表实际的渐变边框（非 none/空）时才携带背景属性，
          // 否则普通边框宽度/样式/圆角操作会把 "none" 写入，覆盖用户的背景渐变图片。
          ...(backgroundImage && backgroundImage !== 'none' ? {
            backgroundImage,
            backgroundOrigin,
            backgroundClip,
          } : {}),
          borderTopWidth,
          borderRightWidth,
          borderBottomWidth,
          borderLeftWidth,
          borderTopColor,
          borderRightColor,
          borderBottomColor,
          borderLeftColor,
          borderTopStyle,
          borderRightStyle,
          borderBottomStyle,
          borderLeftStyle,
          borderTopLeftRadius,
          borderBottomLeftRadius,
          borderBottomRightRadius,
          borderTopRightRadius,
          ...value,
        }
        const deletedKeys = Object.keys(value).filter((key) => value[key] === null);

        onChange(
          Array.from(new Set([...Object.keys(newValues), ...deletedKeys]))
            .filter((key) => newValues[key] != null || deletedKeys.includes(key))
            .map((key) => {
              return {
                key,
                // TODO
                value: newValues[key] === null ? null : `${newValues[key]}${useImportant ? "!important" : ""}`,
              };
            })
        );
        return newValues;
      });
    },
    [onChange, useImportant]
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

  const refresh = useCallback(() => {
    const pos = borderPositionRef.current;
    const items: Array<{ key: string; value: any }> = [];

    // 显式写入 'none'/'0px'，确保覆盖组件自身 CSS 中定义的 border（无法通过 null 删除）
    if (pos === 'outside') {
      items.push({ key: 'outline', value: 'none' });
      items.push({ key: 'outlineOffset', value: '0px' });
    } else if (pos === 'inside') {
      items.push({ key: 'boxShadow', value: 'none' });
    } else {
      // center（默认）：逐侧显式清零
      items.push(
        { key: 'borderTopStyle', value: 'none' },
        { key: 'borderRightStyle', value: 'none' },
        { key: 'borderBottomStyle', value: 'none' },
        { key: 'borderLeftStyle', value: 'none' },
        { key: 'borderTopWidth', value: '0px' },
        { key: 'borderRightWidth', value: '0px' },
        { key: 'borderBottomWidth', value: '0px' },
        { key: 'borderLeftWidth', value: '0px' },
      );
    }

    // 其余属性以 null 删除（走 handleChange 正常删除流程）
    // 非 null 项已使 activePanelsInBatch 包含 'border'，绕过删除守卫
    const nullKeys = [
      'borderTopColor', 'borderRightColor', 'borderBottomColor', 'borderLeftColor',
      'borderTopLeftRadius', 'borderTopRightRadius', 'borderBottomLeftRadius', 'borderBottomRightRadius',
      'border', 'borderTop', 'borderRight', 'borderBottom', 'borderLeft',
      'borderRadius', 'borderWidth', 'borderStyle', 'borderColor',
      'outline', 'outlineOffset', 'boxShadow',
      ...GRADIENT_BORDER_KEYS,
    ];
    items.push(...nullKeys.map(key => ({ key, value: null })));

    onChange(items);
    setBorderValue({} as any);
    setBorderPosition('center');
    setForceRenderKey(prev => prev + 1);
  }, [onChange]);

  const borderPositionRef = useRef<BorderPosition>(borderPosition);
  borderPositionRef.current = borderPosition;

  const borderValueRef = useRef(borderValue);
  borderValueRef.current = borderValue;

  // 构建 outside/inside 模式的 CSS 输出
  const emitPositionCSS = useCallback((
    pos: BorderPosition,
    w: string,
    c: string,
    s: string,
  ) => {
    const wNum = parseFloat(String(w)) || 1;
    const borderNullEntries = BORDER_LOGICAL_KEYS.map(k => ({ key: k, value: null as any }));
    if (pos === 'outside') {
      onChange([
        { key: 'outline', value: `${wNum}px ${s || 'solid'} ${c || '#000000'}` },
        { key: 'outlineOffset', value: '0px' },
        { key: 'boxShadow', value: null },
        ...borderNullEntries,
      ]);
    } else if (pos === 'inside') {
      onChange([
        { key: 'boxShadow', value: `inset 0 0 0 ${wNum}px ${c || '#000000'}` },
        { key: 'outline', value: null },
        { key: 'outlineOffset', value: null },
        ...borderNullEntries,
      ]);
    }
  }, [onChange]);

  // all 模式下感知 position 的变更处理（outside/inside 时转换为 outline/boxShadow 输出）
  const handleAllModeChange = useCallback((changes: Record<string, any>) => {
    const pos = borderPositionRef.current;
    if (pos === 'center') {
      handleChange(changes);
      return;
    }
    hasUserEditedRef.current = true;
    const currentVal = borderValueRef.current;
    const newVal = { ...currentVal, ...changes };
    setBorderValue(newVal);
    const w = newVal.borderTopWidth || '1px';
    const c = newVal.borderTopColor || '#000000';
    const s = newVal.borderTopStyle || 'solid';
    emitPositionCSS(pos, w, c, s);
  }, [handleChange, emitPositionCSS]);

  // Position 下拉切换时，将当前 borderValue 转换为新的 CSS 位置输出
  const handlePositionChange = useCallback((newPos: BorderPosition) => {
    const oldPos = borderPositionRef.current;
    if (oldPos === newPos) return;
    setBorderPosition(newPos);
    hasUserEditedRef.current = true;
    const val = borderValueRef.current;
    const w = val.borderTopWidth || '1px';
    const c = val.borderTopColor || '#000000';
    const s = val.borderTopStyle || 'solid';
    const wNum = parseFloat(String(w)) || 1;
    const borderNullEntries = BORDER_LOGICAL_KEYS.map(k => ({ key: k, value: null as any }));
    if (newPos === 'outside') {
      onChange([
        { key: 'outline', value: `${wNum}px ${s} ${c}` },
        { key: 'outlineOffset', value: '0px' },
        { key: 'boxShadow', value: null },
        ...borderNullEntries,
      ]);
    } else if (newPos === 'inside') {
      onChange([
        { key: 'boxShadow', value: `inset 0 0 0 ${wNum}px ${c}` },
        { key: 'outline', value: null },
        { key: 'outlineOffset', value: null },
        ...borderNullEntries,
      ]);
    } else {
      // center: 恢复为标准 border
      onChange([
        ...BORDER_LOGICAL_KEYS.filter(k => k.endsWith('Width')).map(k => ({ key: k, value: w })),
        ...BORDER_LOGICAL_KEYS.filter(k => k.endsWith('Color')).map(k => ({ key: k, value: c })),
        ...BORDER_LOGICAL_KEYS.filter(k => k.endsWith('Style')).map(k => ({ key: k, value: s })),
        { key: 'outline', value: null },
        { key: 'outlineOffset', value: null },
        { key: 'boxShadow', value: null },
      ]);
    }
  }, [onChange]);

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
              <Panel.Item className={css.editArea} style={{ padding: "0px 8px" }}>
                {disableBorderColor ? null : (
                  <ColorEditor
                    key={borderColorEditorKey}
                    style={{ padding: "0 0 0 1px", flex: 1, minWidth: 26 }}
                    defaultValue={getGradientBorderValue(borderValue) || borderValue.borderTopColor}
                    showSubTabs={borderPosition === 'center'}
                    disableBackgroundImage={true}
                    onChange={(input: any) => {
                      const value = getColorEditorValue(input);
                      if (!value) return;
                      const pos = borderPositionRef.current;
                      if (pos === 'center') {
                        // 居中模式：保留完整渐变/纯色逻辑
                        setBorderValue((val) => {
                          let newValue: Record<string, any>;
                          if (isGradientValue(value)) {
                            if (!contentBackgroundLayersRef.current?.length) {
                              contentBackgroundLayersRef.current = getContentBackgroundLayers(val);
                            }
                            newValue = buildGradientBorderValue(value, val, contentBackgroundLayersRef.current);
                            borderGradientRef.current = value;
                          } else {
                            newValue = {
                              borderTopColor: value,
                              borderRightColor: value,
                              borderBottomColor: value,
                              borderLeftColor: value,
                              ...buildClearGradientBorderValue(val, contentBackgroundLayersRef.current),
                            };
                            borderGradientRef.current = undefined;
                            contentBackgroundLayersRef.current = null;
                          }
                          if (!isLengthNineAndEndsWithZeroes(value) && val.borderTopWidth === "0px") {
                            newValue = {
                              ...newValue,
                              borderTopWidth: "1px",
                              borderRightWidth: "1px",
                              borderBottomWidth: "1px",
                              borderLeftWidth: "1px",
                            };
                          }
                          handleChange(newValue);
                          return { ...val, ...newValue };
                        });
                      } else {
                        // 外部/内部模式：仅支持纯色，输出 outline/boxShadow
                        if (isLengthNineAndEndsWithZeroes(value)) return;
                        const autoWidth = borderValueRef.current.borderTopWidth === "0px";
                        handleAllModeChange({
                          borderTopColor: value, borderRightColor: value,
                          borderBottomColor: value, borderLeftColor: value,
                          ...(autoWidth ? {
                            borderTopWidth: "1px", borderRightWidth: "1px",
                            borderBottomWidth: "1px", borderLeftWidth: "1px",
                          } : {}),
                        });
                      }
                    }}
                  />
                )}
              </Panel.Item>
            </Panel.Content>
          </div>

          {/* 行2：[Position 下拉] [≡ Weight 输入 + 线型] */}
          <div className={css.row}>
            <Panel.Content style={{ padding: 3, flex: 1, minWidth: 0 }}>
              <Panel.Item className={css.editArea} style={{ padding: "0px 8px" }}>
                <Select
                  tip="边框位置"
                  style={{ padding: 0, flex: 1 }}
                  value={borderPosition}
                  options={BORDER_POSITION_OPTIONS}
                  onChange={(val) => handlePositionChange(val as BorderPosition)}
                />
              </Panel.Item>
            </Panel.Content>
            <Panel.Content style={{ padding: 3, flex: 1, minWidth: 0 }}>
              <Panel.Item className={css.editArea} style={{ padding: "0px 8px" }}>
                <div className={css.weightGroup}>
                  <div className={css.icon} {...getDragPropsBorder(borderValue.borderTopWidth, '拖拽调整边框宽度')}>
                    <BorderWeightOutlined />
                  </div>
                  {disableBorderWidth ? null : (
                    <InputNumber
                      tip="边框宽度"
                      style={{ ...shouldShowMiniLayout ? DEFAULT_STYLE_MINI : DEFAULT_STYLE_SMALL, flex: 1 }}
                      defaultValue={borderValue.borderTopWidth}
                      defaultUnitValue="px"
                      fallbackValue={0}
                      onChange={(value) => {
                        const borderStyle =
                          !borderValue.borderTopStyle || borderValue.borderTopStyle === "none"
                            ? "solid"
                            : borderValue.borderTopStyle;
                        handleAllModeChange({
                          borderTopWidth: value,
                          borderRightWidth: value,
                          borderBottomWidth: value,
                          borderLeftWidth: value,
                          borderTopStyle: borderStyle,
                          borderRightStyle: borderStyle,
                          borderBottomStyle: borderStyle,
                          borderLeftStyle: borderStyle,
                        });
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
                data-mybricks-tip="线条样式设置"
                    onClick={() => setShowStyleSettings(v => !v)}
              >
                    <SettingIcon />
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
              <Panel.Content style={{ padding: 3, flex: 1, minWidth: 0 }}>
                <Panel.Item className={css.editArea} style={{ padding: "0px 8px" }}>
                  <div className={css.icon}>
                    <BorderLeftOutlined />
                  </div>
                  {disableBorderColor ? null : (
                    <ColorEditor
                      style={{ padding: 0, marginLeft: 2, flex: 1, minWidth: 26 }}
                      defaultValue={borderValue.borderLeftColor}
                      showSubTabs={false}
                      onChange={(input: any) => {
                        const value = getColorEditorValue(input);
                        if (!value) return;
                        const newValue: Record<string, any> = { borderLeftColor: value };
                        if (!isLengthNineAndEndsWithZeroes(value) && borderValue.borderLeftWidth === "0px") {
                          newValue.borderLeftWidth = "1px";
                        }
                        handleChange(newValue);
                      }}
                    />
                  )}
                  <div className={css.weightGroup}>
                    <div className={css.icon} {...getDragPropsBorder(borderValue.borderLeftWidth, '拖拽调整左边框宽度')}>
                      <BorderWeightOutlined />
                    </div>
                    {disableBorderWidth ? null : (
                      <InputNumber
                        tip="左边框宽度"
                        style={{ ...shouldShowMiniLayout ? DEFAULT_STYLE_MINI : DEFAULT_STYLE_SMALL, flexShrink: 0 }}
                        defaultValue={borderValue.borderLeftWidth}
                        defaultUnitValue="px"
                        fallbackValue={0}
                        onChange={(value) =>
                          handleChange({
                            borderLeftWidth: value,
                            borderLeftStyle:
                              !borderValue.borderLeftStyle || borderValue.borderLeftStyle === "none"
                                ? "solid"
                                : borderValue.borderLeftStyle,
                          })
                        }
                      />
                    )}
                  </div>
                </Panel.Item>
              </Panel.Content>
            </div>
          )}
          {!disableBorderTop && (
            <div className={css.row}>
              <Panel.Content style={{ padding: 3, flex: 1, minWidth: 0 }}>
                <Panel.Item className={css.editArea} style={{ padding: "0px 8px" }}>
                  <div className={css.icon}>
                    <BorderTopOutlined />
                  </div>
                  {disableBorderColor ? null : (
                    <ColorEditor
                      style={{ padding: 0, marginLeft: 2, flex: 1, minWidth: 26 }}
                      defaultValue={borderValue.borderTopColor}
                      showSubTabs={false}
                      onChange={(input: any) => {
                        const value = getColorEditorValue(input);
                        if (!value) return;
                        const newValue: Record<string, any> = { borderTopColor: value };
                        if (!isLengthNineAndEndsWithZeroes(value) && borderValue.borderTopWidth === "0px") {
                          newValue.borderTopWidth = "1px";
                        }
                        handleChange(newValue);
                      }}
                    />
                  )}
                  <div className={css.weightGroup}>
                    <div className={css.icon} {...getDragPropsBorder(borderValue.borderTopWidth, '拖拽调整上边框宽度')}>
                      <BorderWeightOutlined />
                    </div>
                    {disableBorderWidth ? null : (
                      <InputNumber
                        tip="上边框宽度"
                        style={{ ...shouldShowMiniLayout ? DEFAULT_STYLE_MINI : DEFAULT_STYLE_SMALL, flexShrink: 0 }}
                        defaultValue={borderValue.borderTopWidth}
                        defaultUnitValue="px"
                        fallbackValue={0}
                        onChange={(value) =>
                          handleChange({
                            borderTopWidth: value,
                            borderTopStyle:
                              !borderValue.borderTopStyle || borderValue.borderTopStyle === "none"
                                ? "solid"
                                : borderValue.borderTopStyle,
                          })
                        }
                      />
                    )}
                  </div>
                </Panel.Item>
              </Panel.Content>
            </div>
          )}

          {!disableBorderRight && (
            <div className={css.row}>
              <Panel.Content style={{ padding: 3, flex: 1, minWidth: 0 }}>
                <Panel.Item className={css.editArea} style={{ padding: "0px 8px" }}>
                  <div className={css.icon}>
                    <BorderRightOutlined />
                  </div>
                  {disableBorderColor ? null : (
                    <ColorEditor
                      style={{ padding: 0, marginLeft: 2, flex: 1, minWidth: 26 }}
                      defaultValue={borderValue.borderRightColor}
                      showSubTabs={false}
                      onChange={(input: any) => {
                        const value = getColorEditorValue(input);
                        if (!value) return;
                        const newValue: Record<string, any> = { borderRightColor: value };
                        if (!isLengthNineAndEndsWithZeroes(value) && borderValue.borderRightWidth === "0px") {
                          newValue.borderRightWidth = "1px";
                        }
                        handleChange(newValue);
                      }}
                    />
                  )}
                  <div className={css.weightGroup}>
                    <div className={css.icon} {...getDragPropsBorder(borderValue.borderRightWidth, '拖拽调整右边框宽度')}>
                      <BorderWeightOutlined />
                    </div>
                    {disableBorderWidth ? null : (
                      <InputNumber
                        tip="右边框宽度"
                        style={{ ...shouldShowMiniLayout ? DEFAULT_STYLE_MINI : DEFAULT_STYLE_SMALL, flexShrink: 0 }}
                        defaultValue={borderValue.borderRightWidth}
                        defaultUnitValue="px"
                        fallbackValue={0}
                        onChange={(value) =>
                          handleChange({
                            borderRightWidth: value,
                            borderRightStyle:
                              !borderValue.borderRightStyle || borderValue.borderRightStyle === "none"
                                ? "solid"
                                : borderValue.borderRightStyle,
                          })
                        }
                      />
                    )}
                  </div>
                </Panel.Item>
              </Panel.Content>
            </div>
          )}

          {!disableBorderBottom && (
            <div className={css.row}>
              <Panel.Content style={{ padding: 3, flex: 1, minWidth: 0 }}>
                <Panel.Item className={css.editArea} style={{ padding: "0px 8px" }}>
                  <div className={css.icon}>
                    <BorderBottomOutlined />
                  </div>
                  {disableBorderColor ? null : (
                    <ColorEditor
                      style={{ padding: 0, marginLeft: 2, flex: 1, minWidth: 26 }}
                      defaultValue={borderValue.borderBottomColor}
                      showSubTabs={false}
                      onChange={(input: any) => {
                        const value = getColorEditorValue(input);
                        if (!value) return;
                        const newValue: Record<string, any> = { borderBottomColor: value };
                        if (!isLengthNineAndEndsWithZeroes(value) && borderValue.borderBottomWidth === "0px") {
                          newValue.borderBottomWidth = "1px";
                        }
                        handleChange(newValue);
                      }}
                    />
                  )}
                  <div className={css.weightGroup}>
                    <div className={css.icon} {...getDragPropsBorder(borderValue.borderBottomWidth, '拖拽调整下边框宽度')}>
                      <BorderWeightOutlined />
                    </div>
                    {disableBorderWidth ? null : (
                      <InputNumber
                        tip="下边框宽度"
                        style={{ ...shouldShowMiniLayout ? DEFAULT_STYLE_MINI : DEFAULT_STYLE_SMALL, flexShrink: 0 }}
                        defaultValue={borderValue.borderBottomWidth}
                        defaultUnitValue="px"
                        fallbackValue={0}
                        onChange={(value) =>
                          handleChange({
                            borderBottomWidth: value,
                            borderBottomStyle:
                              !borderValue.borderBottomStyle || borderValue.borderBottomStyle === "none"
                                ? "solid"
                                : borderValue.borderBottomStyle,
                          })
                        }
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
  }, [borderToggleValue, borderValue, getDragPropsBorder, borderColorEditorKey, borderPosition, refresh, handleAllModeChange, handlePositionChange]);

  const radiusConfig = useMemo(() => {
    if (disableBorderRadius) {
      return null;
    }
    if (radiusToggleValue === "all") {
      return (
        <div className={css.row}>
          <Panel.Content style={{ padding: 3 }}>
            <Panel.Item className={css.editArea} style={{ padding: "0px 8px" }}>
              <div className={css.icon} {...getDragPropsRadius(borderValue.borderTopLeftRadius, '拖拽调整圆角半径')}>
                <BorderRadiusSplitOutlined />
              </div>
              <InputNumber
                tip="圆角半径"
                style={DEFAULT_STYLE}
                // suffix={'px'}
                defaultValue={borderValue.borderTopLeftRadius}
                unitOptions={UNIT_OPTIONS}
                fallbackValue={0}
                onChange={(value) =>
                  handleChange({
                    borderTopLeftRadius: value,
                    borderBottomLeftRadius: value,
                    borderBottomRightRadius: value,
                    borderTopRightRadius: value,
                  })
                }
              />
            </Panel.Item>
          </Panel.Content>
          <div
            data-mybricks-tip={`{content:'切换为单独配置',position:'left'}`}
            className={css.actionIcon}
            onClick={() =>
              handleToggleChange({ key: "radiusToggleValue", value: "split" })
            }
          >
            <BorderRadiusSplitOutlined />
          </div>
        </div>
      );
    } else {
      return (
        <div className={css.independentBox}>
          <div style={{ minWidth: "120px", flex: 1 }}>
            <div className={css.row} style={{ paddingRight: 0 }}>
              <Panel.Content style={{ padding: 3 }}>
                <Panel.Item className={css.editArea} style={{ padding: "0px 8px" }}>
                  <div className={css.icon} {...getDragPropsRadius(borderValue.borderTopLeftRadius, '拖拽调整左上圆角')}>
                    <BorderTopLeftRadiusOutlined />
                  </div>
                  <InputNumber
                    //tip="左上"
                    style={DEFAULT_STYLE__NEW}
                    defaultValue={borderValue.borderTopLeftRadius}
                    unitOptions={UNIT_OPTIONS}
                    fallbackValue={0}
                    onChange={(value) =>
                      handleChange({ borderTopLeftRadius: value })
                    }
                    onFocus={() =>
                      setSplitRadiusIcon(<BorderTopLeftRadiusOutlined />)
                    }
                  />
                </Panel.Item>
              </Panel.Content>
              <Panel.Content style={{ padding: 3 }}>
                <Panel.Item className={css.editArea} style={{ padding: "0px 8px" }}>
                  <InputNumber
                    //tip="右上角半径"
                    align="right"
                    style={DEFAULT_STYLE__NEW}
                    defaultValue={borderValue.borderTopRightRadius}
                    unitOptions={UNIT_OPTIONS}
                    fallbackValue={0}
                    onChange={(value) =>
                      handleChange({ borderTopRightRadius: value })
                    }
                    onFocus={() =>
                      setSplitRadiusIcon(<BorderTopRightRadiusOutlined />)
                    }
                  />
                  <div className={css.icon} {...getDragPropsRadius(borderValue.borderTopRightRadius, '拖拽调整右上圆角')}>
                    <BorderTopRightRadiusOutlined />
                  </div>
                </Panel.Item>

              </Panel.Content>
            </div>
            <div className={css.row} style={{ paddingRight: 0 }}>
              <Panel.Content style={{ padding: 3 }}>

                <Panel.Item className={css.editArea} style={{ padding: "0px 8px" }}>
                  <div className={css.icon} {...getDragPropsRadius(borderValue.borderBottomLeftRadius, '拖拽调整左下圆角')}>
                    <BorderBottomLeftRadiusOutlined />
                  </div>
                  <InputNumber
                    //tip="左下角半径"
                    style={DEFAULT_STYLE__NEW}
                    defaultValue={borderValue.borderBottomLeftRadius}
                    unitOptions={UNIT_OPTIONS}
                    fallbackValue={0}
                    onChange={(value) =>
                      handleChange({ borderBottomLeftRadius: value })
                    }
                    onFocus={() =>
                      setSplitRadiusIcon(<BorderBottomLeftRadiusOutlined />)
                    }
                  />
                </Panel.Item>
              </Panel.Content>
              <Panel.Content style={{ padding: 3 }}>
                <Panel.Item className={css.editArea} style={{ padding: "0px 8px" }}>
                  <InputNumber
                    //tip="右下角半径"
                    align="right"
                    style={DEFAULT_STYLE__NEW}
                    defaultValue={borderValue.borderBottomRightRadius}
                    unitOptions={UNIT_OPTIONS}
                    fallbackValue={0}
                    onChange={(value) =>
                      handleChange({ borderBottomRightRadius: value })
                    }
                    onFocus={() =>
                      setSplitRadiusIcon(<BorderBottomRightRadiusOutlined />)
                    }
                  />
                  <div className={css.icon} {...getDragPropsRadius(borderValue.borderBottomRightRadius, '拖拽调整右下圆角')}>
                    <BorderBottomRightRadiusOutlined />
                  </div>
                </Panel.Item>
              </Panel.Content>
            </div>
          </div>

          <div
            data-mybricks-tip={`{content:'切换为统一配置',position:'left'}`}
            className={css.independentActionIcon}
            onClick={() =>
              handleToggleChange({ key: "radiusToggleValue", value: "all" })
            }
          >
            <BorderRadiusSplitOutlined />
          </div>
        </div>
      );
    }
  }, [radiusToggleValue, splitRadiusIcon, borderValue, getDragPropsRadius]);

  const handleToggleChange = useCallback(
    ({ key, value }: { key: string; value: string }) => {
      setToggleValue((val) => {
        return {
          ...val,
          [key]: value,
        };
      });
    },
    [borderValue]
  );

  useUpdateEffect(() => {
    handleChange({
      borderTopColor: borderValue.borderTopColor,
      borderRightColor: borderValue.borderTopColor,
      borderBottomColor: borderValue.borderTopColor,
      borderLeftColor: borderValue.borderTopColor,
      borderTopStyle: borderValue.borderTopStyle,
      borderRightStyle: borderValue.borderTopStyle,
      borderBottomStyle: borderValue.borderTopStyle,
      borderLeftStyle: borderValue.borderTopStyle,
      borderTopWidth: borderValue.borderTopWidth,
      borderRightWidth: borderValue.borderTopWidth,
      borderBottomWidth: borderValue.borderTopWidth,
      borderLeftWidth: borderValue.borderTopWidth,
    });
  }, [borderToggleValue]);

  useUpdateEffect(() => {
    handleChange({
      borderTopLeftRadius: borderValue.borderTopLeftRadius,
      borderTopRightRadius: borderValue.borderTopLeftRadius,
      borderBottomLeftRadius: borderValue.borderTopLeftRadius,
      borderBottomRightRadius: borderValue.borderTopLeftRadius,
    });
  }, [radiusToggleValue]);

  const hasBorderSection = !(disableBorderWidth && disableBorderColor && disableBorderStyle);

  const currentBorderStyle = borderValue.borderTopStyle ?? 'none';

  const popupStyleValue = currentBorderStyle === 'none' ? 'solid' : currentBorderStyle;

  const styleSettingsPortal = !disableBorderStyle && showStyleSettings
    ? createPortal(
        <div
          ref={styleSettingsPopoverRef}
          className={css.styleSettingsPopover}
        >
          <div className={css.strokePopoverTitle}>线条设置</div>
          <div className={css.strokePopoverRow}>
            <span className={css.strokePopoverLabel}>样式</span>
            <Select
              style={{ flex: 1, padding: '0 8px' }}
              value={popupStyleValue}
              options={STROKE_STYLE_POPUP_OPTIONS}
              onChange={(val) => {
                handleAllModeChange({
                  borderTopStyle: val,
                  borderRightStyle: val,
                  borderBottomStyle: val,
                  borderLeftStyle: val,
                });
              }}
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
      resetFunction={refresh}
      deleteRef={panelDeleteRef}
      rightColumn={
        <div className={css.rightColumn}>
          <div
            data-mybricks-tip={`{content:'删除边框',position:'left'}`}
            className={css.rightColumnBtn}
            onClick={() => panelDeleteRef.current?.()}
          >
            <MinusOutlined />
          </div>
          {hasBorderSection && (
            <div
              data-mybricks-tip={borderToggleValue === 'all'
                ? `{content:'切换为单独配置',position:'left'}`
                : `{content:'切换为统一配置',position:'left'}`}
              className={`${css.rightColumnBtn} ${css.rightColumnBtnSmall}`}
              onClick={() => handleToggleChange({
                key: "borderToggleValue",
                value: borderToggleValue === 'all' ? "split" : "all",
              })}
            >
              <BorderSplitOutlined />
            </div>
          )}
        </div>
      }
    >
      <React.Fragment key={forceRenderKey}>
        {borderConfig}
        {radiusConfig}
      </React.Fragment>
    </Panel>
    </>
  );
}

function getToggleDefaultValue(value: CSSProperties) {
  return {
    borderToggleValue:
      allEqual([
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
        : "split",
    radiusToggleValue: allEqual([
      value.borderTopLeftRadius,
      value.borderTopRightRadius,
      value.borderBottomRightRadius,
      value.borderBottomLeftRadius,
    ])
      ? "all"
      : "split",
  };
}
