import React, { useMemo, useState, useCallback, CSSProperties } from "react";

import {
  Panel,
  InputNumber,
  BorderRadiusSplitOutlined,
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
}
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

const DEFAULT_STYLE__NEW = {
  padding: 0,
  fontSize: 10,
  marginLeft: 0,
};

const DEFAULT_CONFIG = {
  useImportant: false,
};

export function Radius({ value, onChange, config }: BorderProps) {
  const [{ useImportant }] = useState({
    ...DEFAULT_CONFIG,
    ...config,
  });
  const [{ radiusToggleValue }, setToggleValue] = useState(
    getToggleDefaultValue(value)
  );
  const defaultValue = useMemo(() => {
    const defaultValue = Object.assign({}, value);
    Object.entries(defaultValue).forEach(([key, value]) => {
      if (typeof value === "string") {
        // @ts-ignore
        defaultValue[key] = value.replace(/!.*$/, "");
      }
    });
    return defaultValue;
  }, []);
  const [borderValue, setBorderValue] = useState(defaultValue);

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
            value: `${value[key]}${useImportant ? "!important" : ""}`,
          };
        })
      );
    },
    []
  );

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
      borderTopLeftRadius: borderValue.borderTopLeftRadius,
      borderTopRightRadius: borderValue.borderTopLeftRadius,
      borderBottomLeftRadius: borderValue.borderTopLeftRadius,
      borderBottomRightRadius: borderValue.borderTopLeftRadius,
    });
  }, [radiusToggleValue]);

  return <Panel title="圆角">{radiusConfig}</Panel>;
}

function getToggleDefaultValue(value: CSSProperties) {
  return {
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
