import React, { useMemo, useState, useCallback, CSSProperties } from "react";

import {
  Panel,
  Select,
  ColorEditor,
  InputNumber,
  BorderAllOutlined,
  BorderSplitOutlined,
  BorderTopWidthOutlined,
  BorderLeftWidthOutlined,
  BorderRightWidthOutlined,
  BorderRadiusSplitOutlined,
  BorderBottomWidthOutlined,
  BorderTopLeftRadiusOutlined,
  BorderTopRightRadiusOutlined,
  BorderBottomLeftRadiusOutlined,
  BorderBottomRightRadiusOutlined,
} from "../../components";
import { allEqual } from "../../utils";
import { useUpdateEffect } from "../../hooks";

import type { ChangeEvent } from "../../type";

import css from "./index.less";

interface BorderProps {
  value: CSSProperties;
  onChange: ChangeEvent;
  config: {
    [key: string]: any;
  };
  showTitle: boolean;
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
  maxWidth: 71,
  marginLeft: 4,
};

const DEFAULT_STYLE_SMALL = {
  padding: 0,
  fontSize: 10,
  minWidth: 26,
  maxWidth: 26,
  marginLeft: 4,
};

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

export function Border({ value, onChange, config, showTitle }: BorderProps) {
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
  const [borderValue, setBorderValue] = useState(defaultBorderValue);
  const [splitRadiusIcon, setSplitRadiusIcon] = useState(
    <BorderTopLeftRadiusOutlined />
  );

  const handleChange = useCallback(
    (value: CSSProperties & Record<string, any>) => {
      setBorderValue((val) => {
        return {
          ...val,
          ...value,
        };
      });
      onChange(
        Object.keys(value).map((key) => {
          return {
            key,
            // TODO
            value: `${value[key]}${useImportant ? "!important" : ""}`,
          };
        })
      );
    },
    []
  );

  const isLengthNineAndEndsWithZeroes = (str: string) => {
    return /^.{7}00$/.test(str);
  };

  const borderConfig = useMemo(() => {
    if (disableBorderWidth && disableBorderColor && disableBorderStyle) {
      return null;
    }
    if (borderToggleValue === "all") {
      return (
        <div className={css.row}>
          <Panel.Content style={{ padding: 3 }}>
            <Panel.Item className={css.editArea} style={{ padding: "0px 8px" }}>
              <div className={css.icon} data-mybricks-tip={"边框宽度"}>
                <BorderAllOutlined />
              </div>
              {disableBorderWidth ? null : (
                <InputNumber
                  tip="边框宽度"
                  style={DEFAULT_STYLE_SMALL}
                  value={borderValue.borderTopWidth}
                  // suffix={'px'}
                  onChange={(value) => {
                    const borderStyle =
                      borderValue.borderTopStyle === "none"
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
                  style={{ padding: "0 0 0 1px", marginLeft: 5 }}
                  defaultValue={borderValue.borderTopColor}
                  onChange={(value: string) => {
                    setBorderValue((val) => {
                      let newValue: Record<string, any> = {
                        borderTopColor: value,
                        borderRightColor: value,
                        borderBottomColor: value,
                        borderLeftColor: value,
                      };
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

                      onChange(
                        Object.keys(newValue).map((key) => {
                          return {
                            key,
                            // TODO
                            value: `${newValue[key]}${
                              useImportant ? "!important" : ""
                            }`,
                          };
                        })
                      );

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
                    width: 30,
                    minWidth: 30,
                    marginLeft: 0,
                    textAlign: "right",
                  }}
                  labelClassName={css.label}
                  value={borderValue.borderTopStyle}
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
            data-mybricks-tip={`{content:'切换编辑方式',position:'left'}`}
            className={css.actionIcon}
            onClick={() =>
              handleToggleChange({ key: "borderToggleValue", value: "split" })
            }
          >
            <BorderAllOutlined />
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
            {!disableBorderTop && (
              <div className={css.row}>
                <Panel.Content style={{ padding: 3 }}>
                  <Panel.Item
                    className={css.editArea}
                    style={{ padding: "0px 8px" }}
                  >
                    <div className={css.icon} data-mybricks-tip={"上边框宽度"}>
                      <BorderTopWidthOutlined />
                    </div>
                    {disableBorderWidth ? null : (
                      <InputNumber
                        tip="上边框宽度"
                        style={DEFAULT_STYLE_SMALL}
                        value={borderValue.borderTopWidth}
                        // suffix={'px'}
                        onChange={(value) =>
                          handleChange({
                            borderTopWidth: value,
                            borderTopStyle:
                              borderValue.borderTopStyle === "none"
                                ? "solid"
                                : borderValue.borderTopStyle,
                          })
                        }
                      />
                    )}
                    {disableBorderColor ? null : (
                      <ColorEditor
                        // tip='上边框颜色'
                        style={{ padding: 0, marginLeft: 5 }}
                        defaultValue={borderValue.borderTopColor}
                        onChange={(value: string) => {
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
                          width: 30,
                          minWidth: 30,
                          marginLeft: 0,
                          textAlign: "right",
                        }}
                        labelClassName={css.label}
                        value={borderValue.borderTopStyle}
                        options={BORDER_STYLE_OPTIONS}
                        showIcon={false}
                        onChange={(value) =>
                          handleChange({ borderTopStyle: value })
                        }
                      />
                    )}
                  </Panel.Item>
                </Panel.Content>
                <div
                  data-mybricks-tip={`{content:'切换编辑方式',position:'left'}`}
                  className={css.actionIcon}
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

            {!disableBorderRight && (
              <div className={css.row}>
                <Panel.Content style={{ padding: 3 }}>
                  <Panel.Item
                    className={css.editArea}
                    style={{ padding: "0px 8px" }}
                  >
                    <div className={css.icon} data-mybricks-tip={"右边框宽度"}>
                      <BorderRightWidthOutlined />
                    </div>
                    {disableBorderWidth ? null : (
                      <InputNumber
                        tip="右边框宽度"
                        style={DEFAULT_STYLE_SMALL}
                        value={borderValue.borderRightWidth}
                        // suffix={'px'}
                        onChange={(value) =>
                          handleChange({
                            borderRightWidth: value,
                            borderRightStyle:
                              borderValue.borderRightStyle === "none"
                                ? "solid"
                                : borderValue.borderRightStyle,
                          })
                        }
                      />
                    )}
                    {disableBorderColor ? null : (
                      <ColorEditor
                        // tip='右边框颜色'
                        style={{ padding: 0, marginLeft: 5 }}
                        defaultValue={borderValue.borderRightColor}
                        onChange={(value: string) => {
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
                          width: 30,
                          minWidth: 30,
                          marginLeft: 0,
                          textAlign: "right",
                        }}
                        labelClassName={css.label}
                        value={borderValue.borderRightStyle}
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
                <Panel.Content style={{ padding: 3 }}>
                  <Panel.Item
                    className={css.editArea}
                    style={{ padding: "0px 8px" }}
                  >
                    <div className={css.icon} data-mybricks-tip={"下边框宽度"}>
                      <BorderBottomWidthOutlined />
                    </div>
                    {disableBorderWidth ? null : (
                      <InputNumber
                        tip="下边框宽度"
                        style={DEFAULT_STYLE_SMALL}
                        value={borderValue.borderBottomWidth}
                        // suffix={'px'}
                        onChange={(value) =>
                          handleChange({
                            borderBottomWidth: value,
                            borderBottomStyle:
                              borderValue.borderBottomStyle === "none"
                                ? "solid"
                                : borderValue.borderBottomStyle,
                          })
                        }
                      />
                    )}
                    {disableBorderColor ? null : (
                      <ColorEditor
                        // tip='下边框颜色'
                        style={{ padding: 0, marginLeft: 5 }}
                        defaultValue={borderValue.borderBottomColor}
                        onChange={(value: string) => {
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
                          width: 30,
                          minWidth: 30,
                          marginLeft: 0,
                          textAlign: "right",
                        }}
                        labelClassName={css.label}
                        value={borderValue.borderBottomStyle}
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

            {!disableBorderLeft && (
              <div className={css.row}>
                <Panel.Content style={{ padding: 3 }}>
                  <Panel.Item
                    className={css.editArea}
                    style={{ padding: "0px 8px" }}
                  >
                    <div className={css.icon} data-mybricks-tip={"左边框宽度"}>
                      <BorderLeftWidthOutlined />
                    </div>
                    {disableBorderWidth ? null : (
                      <InputNumber
                        tip="左边框宽度"
                        style={DEFAULT_STYLE_SMALL}
                        value={borderValue.borderLeftWidth}
                        // suffix={'px'}
                        onChange={(value) =>
                          handleChange({
                            borderLeftWidth: value,
                            borderLeftStyle:
                              borderValue.borderLeftStyle === "none"
                                ? "solid"
                                : borderValue.borderLeftStyle,
                          })
                        }
                      />
                    )}
                    {disableBorderColor ? null : (
                      <ColorEditor
                        // tip='左边框颜色'
                        style={{ padding: 0, marginLeft: 5 }}
                        defaultValue={borderValue.borderLeftColor}
                        onChange={(value: string) => {
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
                          width: 30,
                          minWidth: 30,
                          marginLeft: 0,
                          textAlign: "right",
                        }}
                        labelClassName={css.label}
                        value={borderValue.borderLeftStyle}
                        options={BORDER_STYLE_OPTIONS}
                        showIcon={false}
                        onChange={(value) =>
                          handleChange({ borderLeftStyle: value })
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
  }, [borderToggleValue, borderValue]);

  const radiusConfig = useMemo(() => {
    if (disableBorderRadius) {
      return null;
    }
    if (radiusToggleValue === "all") {
      return (
        <div className={css.row}>
          <Panel.Content style={{ padding: 3 }}>
            <Panel.Item className={css.editArea} style={{ padding: "0px 8px" }}>
              <div className={css.icon} data-mybricks-tip={"圆角半径"}>
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
            data-mybricks-tip={`{content:'切换编辑方式',position:'left'}`}
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
        <div className={css.row}>
          <Panel.Content style={{ padding: 3 }}>
            <Panel.Item className={css.editArea} style={{ padding: "0px 8px" }}>
              <div className={css.icon} data-mybricks-tip={"左上角半径"}>
                <BorderTopLeftRadiusOutlined />
              </div>
              <InputNumber
                tip="左上角半径"
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
              <div className={css.icon} data-mybricks-tip={"右上角半径"}>
                <BorderTopRightRadiusOutlined />
              </div>
              <InputNumber
                tip="右上角半径"
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
              <div className={css.icon} data-mybricks-tip={"右下角半径"}>
                <BorderBottomRightRadiusOutlined />
              </div>
              <InputNumber
                tip="右下角半径"
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
              <div className={css.icon} data-mybricks-tip={"左下角半径"}>
                <BorderBottomLeftRadiusOutlined />
              </div>
              <InputNumber
                tip="左下角半径"
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
          <div
            data-mybricks-tip={`{content:'切换编辑方式',position:'left'}`}
            className={css.actionIcon}
            onClick={() =>
              handleToggleChange({ key: "radiusToggleValue", value: "all" })
            }
          >
            <BorderTopLeftRadiusOutlined />
          </div>
        </div>
      );
    }
  }, [radiusToggleValue, splitRadiusIcon]);

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

  return (
    <Panel title="边框" showTitle={showTitle}>
      {borderConfig}
      {radiusConfig}
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
