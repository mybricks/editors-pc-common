import React, { useMemo, useCallback, useEffect, useState } from "react";

import {
  Font,
  Size,
  Appearance,
  Cursor,
  Border,
  Margin,
  Padding,
  Effects,
  Background,
  OverFlow,
  Opacity,
  Radius,
  Layout,
  Flex,
  ZIndex,
  Rotation,
  Position,
} from "./plugins";

import type { StyleEditorProps, Option } from "./type";

import css from "./StyleEditor.less";

// 排序顺序 需要调整顺序只要改下面就行
const PLUGINS_MAP: Record<string, (value: any) => React.ReactNode> = {
  LAYOUT: Layout,
  FLEX: Flex,
  SIZE: Size,
  POSITION: Position,
  FONT: Font,
  BACKGROUND: Background,
  BORDER: Border,
  RADIUS: Radius,
  MARGIN: Margin,
  PADDING: Padding,
  OVERFLOW: OverFlow,
  OPACITY: Opacity,
  APPEARANCE: Appearance,
  EFFECTS: Effects,
  ROTATION: Rotation,
  CURSOR: Cursor,
  ZINDEX: ZIndex,
};

export default function ({
  defaultValue,
  options,
  collapsedOptions,
  readonlyExpandedOptions,
  finnalExcludeOptions,
  onChange,
}: StyleEditorProps) {
  const [positionForOrder, setPositionForOrder] = useState(defaultValue?.position);

  useEffect(() => {
    setPositionForOrder(defaultValue?.position);
  }, [defaultValue?.position]);

  const handleValueChange: StyleEditorProps["onChange"] = useCallback(
    (value) => {
      const changes = Array.isArray(value) ? value : [value];
      const positionChange = changes.find((change) => change.key === 'position');
      if (positionChange) {
        setPositionForOrder(positionChange.value);
      }
      onChange(value);
    },
    [onChange]
  );

  const fixedOrderKeys = useMemo(() => {
    const keys = Object.keys(PLUGINS_MAP); // 获取 PLUGINS_MAP 的键并用作固定顺序
    if (String(positionForOrder).toLowerCase() !== 'absolute') {
      return keys;
    }

    return ['ZINDEX', ...keys.filter((key) => key !== 'ZINDEX')];
  }, [positionForOrder]);
  // 使用 Set 存储已经处理过的 options 键
  const processedOptions = new Set<string>();
  const getOptionType = (option: Option) => {
    return typeof option === "string"
      ? option.toUpperCase()
      : option.type.toUpperCase();
  };

  const editors = useMemo(() => {
    const keyToOption: any = {};
    const filterEditorKeys = fixedOrderKeys.filter((pluginKey) => {
      // 查找 options 中匹配的项，但只处理没有被处理过的项
      const option = options.find((option) => {
        const key = getOptionType(option);
        return key === pluginKey && !processedOptions.has(key);
      });

      // 如果找到匹配项，标记为已处理
      if (option) {
        processedOptions.add(getOptionType(option));
      } else if (!option || !PLUGINS_MAP[pluginKey]) {
        return false;
      }

      // 新增配置 exclude 属性，黑名单逻辑
      if (Array.isArray(finnalExcludeOptions)) {
        const isExclude = finnalExcludeOptions.some(t => t?.toUpperCase?.() === pluginKey);
        if (isExclude) {
          return false
        }
      }

      keyToOption[pluginKey] = option;

      return true;
    });

    // const showTitle = filterEditorKeys.length > 1;
    const showTitle = true;

    return filterEditorKeys.map((pluginKey) => {
      const JSX = PLUGINS_MAP[pluginKey];
      const option = keyToOption[pluginKey];
      const config = typeof option === "string" ? {} : option?.config || {}; // 使用选项中的配置或空对象
      const autoExpandZIndex =
        pluginKey === 'ZINDEX' &&
        String(positionForOrder).toLowerCase() === 'absolute' &&
        defaultValue?.zIndex == null;
      let panelCollapse: boolean | 'inherited' = false;
      if (!autoExpandZIndex) {
        if (collapsedOptions.includes(pluginKey.toLowerCase())) {
          panelCollapse = true;
        } else if (readonlyExpandedOptions?.includes(pluginKey.toLowerCase())) {
          panelCollapse = 'inherited';
        }
      }

      return JSX ? (
        <JSX
          key={pluginKey}
          value={defaultValue}
          onChange={handleValueChange}
          config={config}
          collapse={panelCollapse}
          showTitle={showTitle}
        />
      ) : null;
    });

    // 固定位置排序
    return fixedOrderKeys.map((pluginKey) => {
      // 查找 options 中匹配的项，但只处理没有被处理过的项
      const option = options.find((option) => {
        const key = getOptionType(option);
        return key === pluginKey && !processedOptions.has(key);
      });

      // 如果找到匹配项，标记为已处理
      if (option) {
        processedOptions.add(getOptionType(option));
      } else if (!option || !PLUGINS_MAP[pluginKey]) {
        return null;
      }

      const JSX = PLUGINS_MAP[pluginKey];
      const config = typeof option === "string" ? {} : option?.config || {}; // 使用选项中的配置或空对象

      return JSX ? (
        <JSX
          key={pluginKey}
          value={defaultValue}
          onChange={handleValueChange}
          config={config}
        />
      ) : null;
    });
    // 按照options顺序排序
    // return options.map((option, index) => {
    //   let JSX;
    //   let config = {};

    //   if (typeof option === "string") {
    //     JSX = PLUGINS_MAP[option.toUpperCase() as keyof typeof PLUGINS_MAP];
    //   } else {
    //     JSX =
    //       PLUGINS_MAP[option.type.toUpperCase() as keyof typeof PLUGINS_MAP];
    //     config = option.config || config;
    //   }

    //   return (
    //     JSX && (
    //       <JSX
    //         key={index}
    //         value={defaultValue}
    //         onChange={handleValueChange}
    //         config={config}
    //       />
    //     )
    //   );
    // });
  }, [options, finnalExcludeOptions, defaultValue, handleValueChange, collapsedOptions, readonlyExpandedOptions, positionForOrder]);

  return <div className={css.style}>{editors}</div>;
}
