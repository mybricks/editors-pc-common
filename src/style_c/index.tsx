import React, { useMemo, useState, useCallback, CSSProperties, useDebugValue } from "react";
import { StyleEditorProvider } from "../style_new/StyleEditor";
import type { EditorProps, GetDefaultConfigurationProps } from "./type";
import { Font, Size, Cursor, Border, Padding, BoxShadow, Background } from "../style_new/StyleEditor/plugins";

const DEFAULT_CONFIG = {
  border: {
    disableBorderStyle: true,
  },
  font: {},
  background: {},
  padding: {},
  size: {},
  cursor: {},
  boxshadow: {},
};

export const DEFAULT_C_OPTIONS = ["font", "border", "background", "padding", "size"] as const;

export default function ({ editConfig }: EditorProps) {
  const options = useMemo(() => {
    return getOptions(editConfig);
  }, []);

  const defaultValue = useMemo(() => {
    console.log("defaultValue: ", editConfig.value.get());
    return {
      borderStyle: "solid",
      borderTopWidth: "0px",
      borderBottomWidth: "0px",
      borderLeftWidth: "0px",
      borderRightWidth: "0px",
      borderTopRightRadius: "0px",
      borderTopLeftRadius: "0px",
      borderBottomRightRadius: "0px",
      borderBottomLeftRadius: "0px",
      paddingTop: "0px",
      paddingBottom: "0px",
      paddingLeft: "0px",
      paddingRight: "0px",
      fontFamily: "inherit",
      fontWeight: "400",
      fontSize: "12px",
      letterSpacing: '0px',
      lineHeight: "normal",
      backgroundPosition: "center center",
      backgroundRepeat: "no-repeat",
      backgroundSize: "100% auto",
      width: '100%',
      height: '100%',
      ...editConfig.value.get(),
    };
  }, []);

  const onChange = useCallback((val, type) => {
    let presetValue = {};
    // 更新值时，进行一些预设赋值
    switch (type) {
      case "font": {
        presetValue = {
          // borderStyle: "solid",
        };
        break;
      }
      case "border": {
        presetValue = {
          borderTopWidth: "0px",
          borderBottomWidth: "0px",
          borderLeftWidth: "0px",
          borderRightWidth: "0px",
          borderStyle: "solid",
        };
        break;
      }
      case "background": {
        presetValue = {
          backgroundRepeat: "no-repeat",
          backgroundPosition: "center center",
          backgroundSize: "100% auto",
        };
        break;
      }
      case "padding": {
        break;
      }
      case "size": {
        break;
      }
    }

    let newValue: any = { ...presetValue, ...editConfig.value.get() };

    if (Array.isArray(val)) {
      val.map((item) => {
        newValue[item.key] = item.value;
      });
    } else {
      newValue[val.key] = val.value;
    }
    console.log("newValue: ", newValue);
    editConfig.value.set(newValue);
  }, []);

  return (
    <StyleEditorProvider value={editConfig}>
      {options.font ? (
        <Font value={defaultValue} onChange={(val) => onChange(val, "font")} config={{...options.font, fontfaces: editConfig.fontfaces}} />
      ) : null}
      {options.border ? (
        <Border value={defaultValue} onChange={(val) => onChange(val, "border")} config={options.border} />
      ) : null}
      {options.background ? (
        <Background value={defaultValue} onChange={(val) => onChange(val, "background")} config={options.background} />
      ) : null}
      {options.padding ? (
        <Padding value={defaultValue} onChange={(val) => onChange(val, "padding")} config={options.padding} />
      ) : null}
      {options.size ? (
        <Size value={defaultValue} onChange={(val) => onChange(val, "size")} config={options.size} />
      ) : null}
    </StyleEditorProvider>
  );
}

/**
 * 获取默认的配置项和样式
 */
function getOptions({ options }: GetDefaultConfigurationProps) {
  let comboOptions;
  const finalOptions: any = {};
  if (!options) {
    // 没有options，普通编辑器配置使用，直接使用默认的配置，展示全部
    comboOptions = DEFAULT_C_OPTIONS;
  } else if (Array.isArray(options)) {
    // options是一个数组，直接使用
    comboOptions = options;
  } else {
    const { plugins, selector, targetDom } = options;
    // 这里还要再处理一下
    comboOptions = plugins || DEFAULT_C_OPTIONS;
  }

  comboOptions.map((item) => {
    if (typeof item === "string") {
      finalOptions[item] = { isC: true, ...DEFAULT_CONFIG[item] };
    } else {
      finalOptions[item.type] = { isC: true, ...DEFAULT_CONFIG[item.type], ...item.config };
    }
  });

  return finalOptions as Record<string, any>;
}
