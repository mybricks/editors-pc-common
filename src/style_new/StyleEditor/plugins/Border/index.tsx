import React, { useMemo, useState, useCallback, useRef, CSSProperties } from "react";

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
} from "../../components";
import { allEqual } from "../../utils";
import { useUpdateEffect, useDragNumber } from "../../hooks";
import {
  GRADIENT_BORDER_BOX_VALUE,
  isGradientValue,
  splitBackgroundLayers,
  toSolidBackgroundLayer,
  isTransparentSolidLayer,
  isDefaultWhiteGradientLayer,
  getEffectiveGradientBorderLayer,
} from "../../helper/gradient-border";

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

const hasGradientBorderBackground = (value: CSSProperties & Record<string, any>) => {
  const layers = splitBackgroundLayers(value.backgroundImage);
  return (
    layers.length > 1 &&
    !!getEffectiveGradientBorderLayer(layers) &&
    value.backgroundOrigin === GRADIENT_BORDER_BOX_VALUE &&
    value.backgroundClip === GRADIENT_BORDER_BOX_VALUE
  );
};

const getGradientBorderValue = (value: CSSProperties & Record<string, any>) => {
  if (!hasGradientBorderBackground(value)) {
    return;
  }
  const layers = splitBackgroundLayers(value.backgroundImage);
  return getEffectiveGradientBorderLayer(layers);
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
  const layers = splitBackgroundLayers(value.backgroundImage);
  if (hasGradientBorderBackground(value)) {
    const contentLayers = layers.slice(0, -1);
    if (contentLayers.length === 1 && isInvisibleBackgroundLayer(contentLayers[0])) {
      return [toSolidBackgroundLayer(value.backgroundColor || 'transparent')];
    }
    return contentLayers.length ? [contentLayers[0]] : [toSolidBackgroundLayer(value.backgroundColor || "transparent")];
  }
  if (layers.length > 1) {
    return isTransparentSolidLayer(layers[0]) && value.backgroundColor
      ? [toSolidBackgroundLayer(value.backgroundColor)]
      : [layers[0]];
  }
  if (layers.length === 1) {
    return isTransparentSolidLayer(layers[0]) && value.backgroundColor
      ? [toSolidBackgroundLayer(value.backgroundColor)]
      : layers;
  }
  const backgroundColor = value.backgroundColor || "transparent";
  return [toSolidBackgroundLayer(backgroundColor)];
};

const buildGradientBorderValue = (
  gradient: string,
  currentValue: CSSProperties & Record<string, any>,
  contentLayers?: string[] | null
) => {
  const normalizedContentLayers = getContentBackgroundLayers(currentValue, contentLayers);
  return {
    borderTopColor: "transparent",
    borderRightColor: "transparent",
    borderBottomColor: "transparent",
    borderLeftColor: "transparent",
    backgroundImage: [...normalizedContentLayers, gradient].join(", "),
    backgroundOrigin: GRADIENT_BORDER_BOX_VALUE,
    backgroundClip: GRADIENT_BORDER_BOX_VALUE,
  };
};

const buildClearGradientBorderValue = (
  currentValue: CSSProperties & Record<string, any>,
  contentLayers?: string[] | null
) => {
  if (!hasGradientBorderBackground(currentValue)) {
    return {};
  }
  const normalizedContentLayers = getContentBackgroundLayers(currentValue, contentLayers);
  const fallbackLayer = toSolidBackgroundLayer(currentValue.backgroundColor || "transparent");
  const shouldClearBackgroundImage = normalizedContentLayers.length === 1 && normalizedContentLayers[0] === fallbackLayer;
  return {
    backgroundImage: shouldClearBackgroundImage ? null : normalizedContentLayers.join(", "),
    backgroundOrigin: null,
    backgroundClip: null,
  };
};

const getColorEditorValue = (input: any) => {
  if (typeof input === "string") {
    return input;
  }
  if (Array.isArray(input)) {
    const backgroundImage = input.find((item) => item.key === "backgroundImage" && item.value !== "none");
    const backgroundColor = input.find((item) => item.key === "backgroundColor");
    return backgroundImage?.value || backgroundColor?.value;
  }
  return input?.value;
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
    const defaultValue = Object.assign({}, value);
    Object.entries(defaultValue).forEach(([key, value]) => {
      if (typeof value === "string") {
        // TODO: 全局处理
        // @ts-ignore
        defaultValue[key] = value.replace(/!.*$/, "");
      }
    });
    return defaultValue;
  }, []);
  const contentBackgroundLayersRef = useRef<string[] | null>(getContentBackgroundLayers(defaultBorderValue));
  const borderGradientRef = useRef<string | undefined>(getGradientBorderValue(defaultBorderValue));
  const [borderValue, setBorderValue] = useState(defaultBorderValue);
  const [forceRenderKey, setForceRenderKey] = useState<number>(Math.random());
  const [splitRadiusIcon, setSplitRadiusIcon] = useState(
    <BorderTopLeftRadiusOutlined />
  );
  const getDragPropsRadius = useDragNumber({ continuous: true });
  const getDragPropsBorder = useDragNumber({ continuous: true });

  const handleChange = useCallback(
    (value: CSSProperties & Record<string, any>) => {
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

  const borderConfig = useMemo(() => {
    if (disableBorderWidth && disableBorderColor && disableBorderStyle) {
      return null;
    }
    if (borderToggleValue === "all") {
      return (
        <div className={css.row}>
          <Panel.Content style={{ padding: 3, flex: 1, minWidth: 0 }}>
            <Panel.Item className={css.editArea} style={{ padding: "0px 8px" }}>
              <div className={css.icon} {...getDragPropsBorder(borderValue.borderTopWidth, '拖拽调整边框宽度')}>
                <BorderWeightOutlined />
              </div>
              {disableBorderWidth ? null : (
                <InputNumber
                  tip="边框宽度"
                  style={{ ...shouldShowMiniLayout ? DEFAULT_STYLE_MINI : DEFAULT_STYLE_SMALL, flexShrink: 0 }}
                  defaultValue={borderValue.borderTopWidth}
                  defaultUnitValue="px"
                  // suffix={'px'}
                  onChange={(value) => {
                    const borderStyle =
                      !borderValue.borderTopStyle || borderValue.borderTopStyle === "none"
                        ? "solid"
                        : borderValue.borderTopStyle;
                    handleChange({
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
              {disableBorderColor ? null : (
                <ColorEditor
                  // tip='边框颜色'
                  style={{ padding: "0 0 0 1px", marginLeft: shouldShowMiniLayout ? 0 : 2, flex: 1, minWidth: 26 }}
                  defaultValue={getGradientBorderValue(borderValue) || borderValue.borderTopColor}
                  showSubTabs={true}
                  disableBackgroundImage={true}
                  onChange={(input: any) => {
                    const value = getColorEditorValue(input);
                    if (!value) {
                      return;
                    }
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

                      if (
                        !isLengthNineAndEndsWithZeroes(value) &&
                        val.borderTopWidth === "0px"
                      ) {
                        newValue = {
                          ...newValue,
                          borderTopWidth: "1px",
                          borderRightWidth: "1px",
                          borderBottomWidth: "1px",
                          borderLeftWidth: "1px",
                        };
                      }

                      handleChange(newValue)

                      return {
                        ...val,
                        ...newValue,
                      };
                    });
                  }}
                />
              )}
              {disableBorderStyle ? null : (
                <Select
                  tip="边框线条样式"
                  style={{
                    padding: 0,
                    width: 26,
                    minWidth: 20,
                    marginLeft: 0,
                    textAlign: "right",
                    flexShrink: 0,
                  }}
                  labelClassName={css.label}
                  value={borderValue.borderTopStyle ?? 'none'}
                  options={BORDER_STYLE_OPTIONS}
                  showIcon={false}
                  onChange={(value) =>
                    handleChange({
                      borderTopStyle: value,
                      borderRightStyle: value,
                      borderBottomStyle: value,
                      borderLeftStyle: value,
                    })
                  }
                />
              )}
            </Panel.Item>
          </Panel.Content>
          <div
            data-mybricks-tip={`{content:'切换为单独配置',position:'left'}`}
            className={css.actionIcon}
            onClick={() =>
              handleToggleChange({ key: "borderToggleValue", value: "split" })
            }
          >
            <BorderSplitOutlined />
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
        <div className={css.row}>
          <div className={css.col}>
          {!disableBorderLeft && (
              <div className={css.row}>
                <Panel.Content style={{ padding: 3, flex: 1, minWidth: 0 }}>
                  <Panel.Item
                    className={css.editArea}
                    style={{ padding: "0px 8px" }}
                  >
                    <div className={css.icon} {...getDragPropsBorder(borderValue.borderLeftWidth, '拖拽调整左边框宽度')}>
                      <BorderLeftOutlined />
                    </div>
                    {disableBorderWidth ? null : (
                      <InputNumber
                        tip="左边框宽度"
                        style={{ ...shouldShowMiniLayout ? DEFAULT_STYLE_MINI : DEFAULT_STYLE_SMALL, flexShrink: 0 }}
                        defaultValue={borderValue.borderLeftWidth}
                        defaultUnitValue="px"
                        // suffix={'px'}
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
                    {disableBorderColor ? null : (
                      <ColorEditor
                        // tip='左边框颜色'
                        style={{ padding: 0, marginLeft: 2, flex: 1, minWidth: 26 }}
                        defaultValue={borderValue.borderLeftColor}
                        showSubTabs={false}
                        onChange={(input: any) => {
                          const value = getColorEditorValue(input);
                          if (!value) {
                            return;
                          }
                          const newValue: Record<string, any> = {
                            borderLeftColor: value,
                          };
                          if (
                            !isLengthNineAndEndsWithZeroes(value) &&
                            borderValue.borderLeftWidth === "0px"
                          ) {
                            newValue.borderLeftWidth = "1px";
                          }
                          handleChange(newValue);
                        }}
                      />
                    )}
                    {disableBorderStyle ? null : (
                      <Select
                        tip="左边框线条样式"
                        style={{
                          padding: 0,
                          width: 26,
                          minWidth: 20,
                          marginLeft: 0,
                          textAlign: "right",
                          flexShrink: 0,
                        }}
                        labelClassName={css.label}
                        value={borderValue.borderLeftStyle ?? 'none'}
                        options={BORDER_STYLE_OPTIONS}
                        showIcon={false}
                        onChange={(value) =>
                          handleChange({ borderLeftStyle: value })
                        }
                      />
                    )}
                  </Panel.Item>
                </Panel.Content>
                <div
                  data-mybricks-tip={`{content:'切换为统一配置',position:'left'}`}
                  className={css.independentActionIcon}
                  style={{ marginTop: 0 }}
                  onClick={() =>
                    handleToggleChange({
                      key: "borderToggleValue",
                      value: "all",
                    })
                  }
                >
                  <BorderSplitOutlined />
                </div>
              </div>
            )}
            {!disableBorderTop && (
              <div className={css.row}>
                <Panel.Content style={{ padding: 3, flex: 1, minWidth: 0 }}>
                  <Panel.Item
                    className={css.editArea}
                    style={{ padding: "0px 8px" }}
                  >
                    <div className={css.icon} {...getDragPropsBorder(borderValue.borderTopWidth, '拖拽调整上边框宽度')}>
                      <BorderTopOutlined />
                    </div>
                    {disableBorderWidth ? null : (
                      <InputNumber
                        tip="上边框宽度"
                        style={{ ...shouldShowMiniLayout ? DEFAULT_STYLE_MINI : DEFAULT_STYLE_SMALL, flexShrink: 0 }}
                        defaultValue={borderValue.borderTopWidth}
                        defaultUnitValue="px"
                        // suffix={'px'}
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
                    {disableBorderColor ? null : (
                      <ColorEditor
                        // tip='上边框颜色'
                        style={{ padding: 0, marginLeft: 2, flex: 1, minWidth: 26 }}
                        defaultValue={borderValue.borderTopColor}
                        showSubTabs={false}
                        onChange={(input: any) => {
                          const value = getColorEditorValue(input);
                          if (!value) {
                            return;
                          }
                          const newValue: Record<string, any> = {
                            borderTopColor: value,
                          };
                          if (
                            !isLengthNineAndEndsWithZeroes(value) &&
                            borderValue.borderTopWidth === "0px"
                          ) {
                            newValue.borderTopWidth = "1px";
                          }
                          handleChange(newValue);
                        }}
                      />
                    )}
                    {disableBorderStyle ? null : (
                      <Select
                        tip="上边框线条样式"
                        style={{
                          padding: 0,
                          width: 26,
                          minWidth: 20,
                          marginLeft: 0,
                          textAlign: "right",
                          flexShrink: 0,
                        }}
                        labelClassName={css.label}
                        value={borderValue.borderTopStyle ?? 'none'}
                        options={BORDER_STYLE_OPTIONS}
                        showIcon={false}
                        onChange={(value) =>
                          handleChange({ borderTopStyle: value })
                        }
                      />
                    )}
                  </Panel.Item>
                </Panel.Content>
                <div className={css.actionIcon} />
              </div>
            )}

            {!disableBorderRight && (
              <div className={css.row}>
                <Panel.Content style={{ padding: 3, flex: 1, minWidth: 0 }}>
                  <Panel.Item
                    className={css.editArea}
                    style={{ padding: "0px 8px" }}
                  >
                    <div className={css.icon} {...getDragPropsBorder(borderValue.borderRightWidth, '拖拽调整右边框宽度')}>
                      <BorderRightOutlined />
                    </div>
                    {disableBorderWidth ? null : (
                      <InputNumber
                        tip="右边框宽度"
                        style={{ ...shouldShowMiniLayout ? DEFAULT_STYLE_MINI : DEFAULT_STYLE_SMALL, flexShrink: 0 }}
                        defaultValue={borderValue.borderRightWidth}
                        defaultUnitValue="px"
                        // suffix={'px'}
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
                    {disableBorderColor ? null : (
                      <ColorEditor
                        // tip='右边框颜色'
                        style={{ padding: 0, marginLeft: 2, flex: 1, minWidth: 26 }}
                        defaultValue={borderValue.borderRightColor}
                        showSubTabs={false}
                        onChange={(input: any) => {
                          const value = getColorEditorValue(input);
                          if (!value) {
                            return;
                          }
                          const newValue: Record<string, any> = {
                            borderRightColor: value,
                          };
                          if (
                            !isLengthNineAndEndsWithZeroes(value) &&
                            borderValue.borderRightWidth === "0px"
                          ) {
                            newValue.borderRightWidth = "1px";
                          }
                          handleChange(newValue);
                        }}
                      />
                    )}
                    {disableBorderStyle ? null : (
                      <Select
                        tip="右边框线条样式"
                        style={{
                          padding: 0,
                          width: 26,
                          minWidth: 20,
                          marginLeft: 0,
                          textAlign: "right",
                          flexShrink: 0,
                        }}
                        labelClassName={css.label}
                        value={borderValue.borderRightStyle ?? 'none'}
                        options={BORDER_STYLE_OPTIONS}
                        showIcon={false}
                        onChange={(value) =>
                          handleChange({ borderRightStyle: value })
                        }
                      />
                    )}
                  </Panel.Item>
                </Panel.Content>
                <div className={css.actionIcon} />
              </div>
            )}

            {!disableBorderBottom && (
              <div className={css.row}>
                <Panel.Content style={{ padding: 3, flex: 1, minWidth: 0 }}>
                  <Panel.Item
                    className={css.editArea}
                    style={{ padding: "0px 8px" }}
                  >
                    <div className={css.icon} {...getDragPropsBorder(borderValue.borderBottomWidth, '拖拽调整下边框宽度')}>
                      <BorderBottomOutlined />
                    </div>
                    {disableBorderWidth ? null : (
                      <InputNumber
                        tip="下边框宽度"
                        style={{ ...shouldShowMiniLayout ? DEFAULT_STYLE_MINI : DEFAULT_STYLE_SMALL, flexShrink: 0 }}
                        defaultValue={borderValue.borderBottomWidth}
                        defaultUnitValue="px"
                        // suffix={'px'}
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
                    {disableBorderColor ? null : (
                      <ColorEditor
                        // tip='下边框颜色'
                        style={{ padding: 0, marginLeft: 2, flex: 1, minWidth: 26 }}
                        defaultValue={borderValue.borderBottomColor}
                        showSubTabs={false}
                        onChange={(input: any) => {
                          const value = getColorEditorValue(input);
                          if (!value) {
                            return;
                          }
                          const newValue: Record<string, any> = {
                            borderBottomColor: value,
                          };
                          if (
                            !isLengthNineAndEndsWithZeroes(value) &&
                            borderValue.borderBottomWidth === "0px"
                          ) {
                            newValue.borderBottomWidth = "1px";
                          }
                          handleChange(newValue);
                        }}
                      />
                    )}
                    {disableBorderStyle ? null : (
                      <Select
                        tip="下边框线条样式"
                        style={{
                          padding: 0,
                          width: 26,
                          minWidth: 20,
                          marginLeft: 0,
                          textAlign: "right",
                          flexShrink: 0,
                        }}
                        labelClassName={css.label}
                        value={borderValue.borderBottomStyle ?? 'none'}
                        options={BORDER_STYLE_OPTIONS}
                        showIcon={false}
                        onChange={(value) =>
                          handleChange({ borderBottomStyle: value })
                        }
                      />
                    )}
                  </Panel.Item>
                </Panel.Content>
                <div className={css.actionIcon} />
              </div>
            )}
            
          </div>
        </div>
      );
    }
  }, [borderToggleValue, borderValue, getDragPropsBorder]);

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

  const refresh = useCallback(() => {
    const borderKeys = [
      'borderTopWidth', 'borderRightWidth', 'borderBottomWidth', 'borderLeftWidth',
      'borderTopColor', 'borderRightColor', 'borderBottomColor', 'borderLeftColor',
      'borderTopStyle', 'borderRightStyle', 'borderBottomStyle', 'borderLeftStyle',
      'borderTopLeftRadius', 'borderTopRightRadius', 'borderBottomLeftRadius', 'borderBottomRightRadius',
      // mergeCSSProperties 可能生成的简写属性
      'border', 'borderTop', 'borderRight', 'borderBottom', 'borderLeft',
      'borderRadius', 'borderWidth', 'borderStyle', 'borderColor',
      ...GRADIENT_BORDER_KEYS,
    ];
    onChange(borderKeys.map(key => ({ key, value: null })));
    setBorderValue({} as any);
    setForceRenderKey(prev => prev + 1);
  }, [onChange]);

  return (
    <Panel title="边框" showTitle={showTitle} showReset={true} resetFunction={refresh} collapse={collapse}>
      <React.Fragment key={forceRenderKey}>
        {borderConfig}
        {radiusConfig}
      </React.Fragment>
    </Panel>
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
