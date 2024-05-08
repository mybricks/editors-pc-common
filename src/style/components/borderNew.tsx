import React from "react";
import { CSSProperties, useCallback, useMemo, useState } from "react";

import { allEqual } from "../../style_new/StyleEditor/utils";
import { useUpdateEffect } from "../../style_new/StyleEditor/hooks";

import { observe } from "@mybricks/rxui";

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
import { Ctx } from "../Style";

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

const createBorders = () => {
  const borders: Record<string, any> = {};
  const sides = ["", "Top", "Right", "Bottom", "Left"];
  const properties = {
    Width: "0px",
    Radius: "0px",
    Style: "solid",
    Color: "#ffffff",
  };
  sides.forEach((side) => {
    const prefix = side === "" ? "" : "border" + side;
    for (const [prop, value] of Object.entries(properties)) {
      borders[`${prefix}${prop}`] = value;
    }
  });
  return borders;
};

export default function Border() {
  const ctx: Ctx = observe(Ctx, { from: "parents" });
  const defalutValue: Record<string, any> = { ...createBorders(), ...ctx.val };
  const [{ borderToggleValue, radiusToggleValue }, setToggleValue] = useState(
    getToggleDefaultValue(defalutValue)
  );
  const defaultBorderValue = useMemo(() => {
    const defaultValue = Object.assign({}, defalutValue);
    Object.entries(defaultValue).forEach(([key, value]) => {
      if (typeof value === "string") {
        defaultValue[key] = value.replace(/!.*$/, "");
      }
    });
    return defaultValue;
  }, []);

  const [borderValue, setBorderValue] = useState<
    React.CSSProperties & Record<string, any>
  >(defaultBorderValue);

  const handleChange = useCallback(
    (value: CSSProperties & Record<string, any>) => {
      setBorderValue((val) => {
        return {
          ...val,
          ...value,
        };
      });
      ctx.set(value);
    },
    []
  );

  const isLengthNineAndEndsWithZeroes = useCallback((str: string) => {
    return /^.{7}00$/.test(str);
  }, []);

  const onBorderColorChange = useCallback(
    (value: string, position: string) => {
      const color = `border${position}Color`;
      const width = `border${position}Width`;
      const newValue: Record<string, any> = {
        [color]: value,
      };
      if (
        !isLengthNineAndEndsWithZeroes(value) &&
        borderValue[width] === "0px"
      ) {
        newValue[width] = "1px";
      }
      handleChange(newValue);
    },
    [borderValue]
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
                value={borderValue.borderTopWidth}
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
                onChange={(value) => {
                  let newValue: Record<string, any> = {
                    borderTopColor: value,
                    borderRightColor: value,
                    borderBottomColor: value,
                    borderLeftColor: value,
                  };
                  if (
                    !isLengthNineAndEndsWithZeroes(value) &&
                    borderValue.borderTopWidth === "0px"
                  ) {
                    newValue = {
                      ...newValue,
                      borderTopWidth: "1px",
                      borderRightWidth: "1px",
                      borderBottomWidth: "1px",
                      borderLeftWidth: "1px",
                    };
                  }
                  handleChange(newValue);
                }}
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
                    value={borderValue.borderTopWidth}
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
                  <ColorEditor
                    style={{ padding: 0, marginLeft: 5 }}
                    defaultValue={borderValue.borderTopColor}
                    onChange={(value) => onBorderColorChange(value, "Top")}
                  />
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
                    value={borderValue.borderRightWidth}
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
                    onChange={(value) => onBorderColorChange(value, "Right")}
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
                    value={borderValue.borderBottomWidth}
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
                    onChange={(value) => onBorderColorChange(value, "Bottom")}
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
                    value={borderValue.borderLeftWidth}
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
                    onChange={(value) => onBorderColorChange(value, "Left")}
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
  }, [radiusToggleValue]);

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
      <div className={css.border}>
        {borderConfig}
        {radiusConfig}
      </div>
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
