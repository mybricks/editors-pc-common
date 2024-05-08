import React from "react";
import { CSSProperties, useCallback, useMemo, useState } from "react";

import { allEqual } from "../../style_new/StyleEditor/utils";
import { useUpdateEffect } from "../../style_new/StyleEditor/hooks";
import { ChangeEvent } from "../../style_new/StyleEditor/type";

import css from "./index.less";

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
} from "../../style_new/StyleEditor/components";

interface BorderProps {
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
  minWidth: 41,
  maxWidth: 41,
  marginLeft: 4,
};
const DEFAULT_STYLE__NEW = {
  padding: 0,
  fontSize: 10,
};

export default function Border({ value, onChange }: BorderProps) {
  const [{ borderToggleValue, radiusToggleValue }, setToggleValue] = useState(
    getToggleDefaultValue(value)
  );
  const defaultBorderValue = useMemo(() => {
    const defaultValue = Object.assign({}, value);
    Object.entries(defaultValue).forEach(([key, value]) => {
      if (typeof value === "string") {
        // @ts-ignore
        defaultValue[key] = value.replace(/!.*$/, "");
      }
    });
    console.log('%c [ defaultValue ]-60', 'font-size:13px; background:pink; color:#bf2c9f;', defaultValue)
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
            value: `${value[key]}`,
          };
        })
      );
    },
    []
  );

  const borderConfig = useMemo(() => {
    if (borderToggleValue === "all") {
      return (
        <div className={css.row}>
          <Panel.Content style={{ padding: 3 }}>
            <Panel.Item className={css.editArea} style={{ padding: "0px 8px" }}>
              <div className={css.icon} data-mybricks-tip={"边框宽度"}>
                <BorderAllOutlined />
              </div>
              <InputNumber
                tip="边框宽度"
                style={DEFAULT_STYLE}
                defaultValue={borderValue.borderTopWidth}
                defaultUnitValue="px"
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
              <ColorEditor
                style={{ padding: 0, marginLeft: 5 }}
                defaultValue={borderValue.borderTopColor}
                onChange={(value) =>
                  handleChange({
                    borderTopColor: value,
                    borderRightColor: value,
                    borderBottomColor: value,
                    borderLeftColor: value,
                  })
                }
              />
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
            </Panel.Item>
          </Panel.Content>
          <div
            data-mybricks-tip={`{content:'四条边同时配置',position:'left'}`}
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
      return (
        <div className={css.row}>
          <div className={css.col}>
            <div className={css.row}>
              <Panel.Content style={{ padding: 3 }}>
                <Panel.Item
                  className={css.editArea}
                  style={{ padding: "0px 8px" }}
                >
                  <div className={css.icon} data-mybricks-tip={"上边框宽度"}>
                    <BorderTopWidthOutlined />
                  </div>
                  <InputNumber
                    tip="上边框宽度"
                    style={DEFAULT_STYLE}
                    defaultUnitValue="px"
                    defaultValue={borderValue.borderTopWidth}
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
                  )
                  <ColorEditor
                    style={{ padding: 0, marginLeft: 5 }}
                    defaultValue={borderValue.borderTopColor}
                    onChange={(value) =>
                      handleChange({ borderTopColor: value })
                    }
                  />
                  )
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
                </Panel.Item>
              </Panel.Content>
              <div
                data-mybricks-tip={`{content:'四条边单独配置',position:'left'}`}
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

            <div className={css.row}>
              <Panel.Content style={{ padding: 3 }}>
                <Panel.Item
                  className={css.editArea}
                  style={{ padding: "0px 8px" }}
                >
                  <div className={css.icon} data-mybricks-tip={"右边框宽度"}>
                    <BorderRightWidthOutlined />
                  </div>
                  <InputNumber
                    tip="右边框宽度"
                    style={DEFAULT_STYLE}
                    defaultUnitValue="px"
                    defaultValue={borderValue.borderRightWidth}
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

                  <ColorEditor
                    style={{ padding: 0, marginLeft: 5 }}
                    defaultValue={borderValue.borderRightColor}
                    onChange={(value) =>
                      handleChange({ borderRightColor: value })
                    }
                  />
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
                </Panel.Item>
              </Panel.Content>
              <div className={css.actionIcon} />
            </div>

            <div className={css.row}>
              <Panel.Content style={{ padding: 3 }}>
                <Panel.Item
                  className={css.editArea}
                  style={{ padding: "0px 8px" }}
                >
                  <div className={css.icon} data-mybricks-tip={"下边框宽度"}>
                    <BorderBottomWidthOutlined />
                  </div>
                  <InputNumber
                    tip="下边框宽度"
                    style={DEFAULT_STYLE}
                    defaultUnitValue="px"
                    defaultValue={borderValue.borderBottomWidth}
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
                  <ColorEditor
                    style={{ padding: 0, marginLeft: 5 }}
                    defaultValue={borderValue.borderBottomColor}
                    onChange={(value) =>
                      handleChange({ borderBottomColor: value })
                    }
                  />
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
                </Panel.Item>
              </Panel.Content>
              <div className={css.actionIcon} />
            </div>

            <div className={css.row}>
              <Panel.Content style={{ padding: 3 }}>
                <Panel.Item
                  className={css.editArea}
                  style={{ padding: "0px 8px" }}
                >
                  <div className={css.icon} data-mybricks-tip={"左边框宽度"}>
                    <BorderLeftWidthOutlined />
                  </div>
                  <InputNumber
                    tip="左边框宽度"
                    style={DEFAULT_STYLE}
                    defaultUnitValue="px"
                    defaultValue={borderValue.borderLeftWidth}
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
                  <ColorEditor
                    style={{ padding: 0, marginLeft: 5 }}
                    defaultValue={borderValue.borderLeftColor}
                    onChange={(value) =>
                      handleChange({ borderLeftColor: value })
                    }
                  />
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
                </Panel.Item>
              </Panel.Content>
              <div className={css.actionIcon} />
            </div>
          </div>
        </div>
      );
    }
  }, [borderToggleValue, borderValue]);

  const radiusConfig = useMemo(() => {
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
                defaultUnitValue="px"
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
            data-mybricks-tip={`{content:'四角同时配置',position:'left'}`}
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
                defaultUnitValue="px"
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
                defaultUnitValue="px"
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
                defaultUnitValue="px"
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
                defaultUnitValue="px"
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
            data-mybricks-tip={`{content:'四角单独配置',position:'left'}`}
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
    <Panel title="描边">
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
