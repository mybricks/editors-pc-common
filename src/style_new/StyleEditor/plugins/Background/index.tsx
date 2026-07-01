import React, { useMemo, useState, CSSProperties, useCallback, useEffect, useRef } from "react";
import { getRealKey } from "../../utils";
import { useStyleEditorContext } from "../..";
import { useUpdateEffect } from "../../hooks";
import { PanelBaseProps } from "./../../type";
import { Panel, Image, ColorEditor, Gradient } from "../../components";
import { DeleteOutlined, ReloadOutlined } from "@ant-design/icons";
import css from "./index.less";
import {
  GRADIENT_BORDER_BOX_VALUE,
  splitBackgroundLayers,
  isTransparentSolidLayer,
  isSolidColorGradient,
} from "../../helper/gradient-border";

/** 判断一个 backgroundImage 值是否携带图片/渐变这类需要交给 ColorEditor 展示的实际内容 */
const isImageOrGradientValue = (value: any): boolean =>
  typeof value === "string" && /url\(|gradient/.test(value);

interface BackgroundProps extends PanelBaseProps {
  value: CSSProperties;
  onChange: (
    value: { key: string; value: any } | { key: string; value: any }[]
  ) => void;
}

const DEFAULT_CONFIG = {
  disableBackgroundColor: false,
  disableBackgroundImage: false,
  disableGradient: false,
  keyMap: {},
  useImportant: false,
};

// 背景图片相关的 CSS 属性
const IMAGE_KEYS = ['backgroundImage', 'backgroundRepeat', 'backgroundPosition', 'backgroundSize'] as const;
// 所有背景相关的 CSS 属性
const ALL_BACKGROUND_KEYS = ['backgroundColor', ...IMAGE_KEYS] as const;
const getBackgroundEditorImage = (value: CSSProperties & Record<string, any>) => {
  const bgImage = value.backgroundImage;
  if (
    typeof bgImage === 'string' &&
    value.backgroundOrigin === GRADIENT_BORDER_BOX_VALUE &&
    value.backgroundClip === GRADIENT_BORDER_BOX_VALUE
  ) {
    return splitBackgroundLayers(bgImage)[0];
  }
  return bgImage;
};

export function Background({
  value,
  onChange,
  config,
  showTitle,
  collapse,
}: BackgroundProps) {
  const context = useStyleEditorContext();
  const [
    {
      keyMap,
      useImportant,
      disableBackgroundColor,
      disableBackgroundImage,
      disableGradient,
    },
  ] = useState({ ...DEFAULT_CONFIG, ...config });
  const [forceRenderKey, setForceRenderKey] = useState<number>(Math.random()); // 用于点击重置按钮重新渲染获取新value

  const [isReset, setIsReset] = useState(false);

  const defaultBackgroundValue: CSSProperties & Record<string, any> =
    useMemo(() => {
      if (isReset) {
        return {};
      }
      const defaultValue = Object.assign({}, value);
      Object.entries(defaultValue).forEach(([key, value]) => {
        if (typeof value === "string") {
          // TODO: 全局处理
          // @ts-ignore
          defaultValue[key] = value.replace(/!.*$/, "");
        }
      });

      return defaultValue;
    }, [value, isReset]);

  const refresh = useCallback(() => {
    onChange(ALL_BACKGROUND_KEYS.map(key => ({ 
      key, 
      value: null 
    })));
    setIsReset(true);
    setForceRenderKey(prev => prev + 1);
    // 重置后重新允许一次追赶，避免重置瞬间又碰上 value 快照滞后
    hasCaughtUpRef.current = false;
    hasUserEditedRef.current = false;
    mountedColorEditorValueRef.current = undefined;
  }, [onChange]);

  // 当外部 value 有实际值时，取消重置状态
  useEffect(() => {
    if (isReset && value && Object.keys(value).length > 0) {
      const hasValue = Object.values(value).some(v => v !== undefined && v !== '' && v !== 'none');
      if (hasValue) {
        setIsReset(false);
      }
    }
  }, [value, isReset]);

  // 计算 ColorEditor 的 defaultValue，优先使用 backgroundImage（图片或渐变）
  const colorEditorDefaultValue = useMemo(() => {
    const bgImage = getBackgroundEditorImage({
      ...defaultBackgroundValue,
      backgroundImage: defaultBackgroundValue[getRealKey(keyMap, "backgroundImage")] 
        || defaultBackgroundValue.backgroundImage,
    });
    const bgColor = defaultBackgroundValue[getRealKey(keyMap, "backgroundColor")] 
      || defaultBackgroundValue.backgroundColor;
    if (bgImage && typeof bgImage === 'string' && /url\(|gradient/.test(bgImage)) {
      // 过滤渐变边框产生的透明/纯色内容层占位符，直接回退到 backgroundColor
      if (isTransparentSolidLayer(bgImage) || isSolidColorGradient(bgImage)) {
        return bgColor;
      }
      return bgImage;
    }
    return bgColor;
  }, [defaultBackgroundValue, keyMap]);

  const imageValue = useMemo(() => 
    Object.fromEntries(
      IMAGE_KEYS.map(key => [key, defaultBackgroundValue[key] as string | undefined])
    ) as Record<typeof IMAGE_KEYS[number], string | undefined>,
  [defaultBackgroundValue]);

  // ColorEditor（以及内部懒挂载的 GradientEditor）只在自己挂载那一刻用 defaultValue
  // 初始化内部状态，之后不会再跟随 defaultValue 变化重新同步。
  // 而面板挂载的瞬间，DOM computedStyle 有时还没跟上最新的背景渐变/图片信息，
  // 导致 colorEditorDefaultValue 的初始快照缺失渐变（表现为渐变角度被复位成默认的 90°、
  // 或渐变/图片直接显示不出来）。这里做一次性追赶：一旦发现挂载后 value 补上了
  // 渐变/图片信息而挂载时没有，就 bump key 让 ColorEditor 用正确的值重新挂载。
  // 一旦用户开始编辑，则永久停用追赶，避免被滞后的外部 value 覆盖用户的操作。
  const [colorEditorKey, setColorEditorKey] = useState(0);
  const mountedColorEditorValueRef = useRef(colorEditorDefaultValue);
  const hasCaughtUpRef = useRef(false);
  const hasUserEditedRef = useRef(false);
  useUpdateEffect(() => {
    if (hasCaughtUpRef.current || hasUserEditedRef.current) {
      return;
    }
    const prevHasContent = isImageOrGradientValue(mountedColorEditorValueRef.current);
    const nextHasContent = isImageOrGradientValue(colorEditorDefaultValue);
    hasCaughtUpRef.current = true;
    if (!prevHasContent && nextHasContent) {
      mountedColorEditorValueRef.current = colorEditorDefaultValue;
      setColorEditorKey((k) => k + 1);
    }
  }, [colorEditorDefaultValue]);

  const handleColorEditorChange = useCallback(
    (value: any) => {
      hasUserEditedRef.current = true;
      (onChange as any)(value);
    },
    [onChange]
  );

  return (
    <Panel
      title="背景"
      showTitle={showTitle}
      showReset={true}
      collapse={collapse}
      resetFunction={refresh}
    >
      <React.Fragment key={forceRenderKey}>
        <Panel.Content>
            <ColorEditor
              key={colorEditorKey}
              style={{ flex: 2 }}
              defaultValue={colorEditorDefaultValue}
              onChange={handleColorEditorChange as (value: { key: string; value: string } | { key: string; value: string }[] | string) => void}
              keyMap={keyMap}
              useImportant={useImportant}
              upload={context?.editConfig?.upload as any}
              imageValue={imageValue}
              disableBackgroundColor={disableBackgroundColor}
              disableBackgroundImage={disableBackgroundImage}
              disableGradient={disableGradient}
            />
        </Panel.Content>
      </React.Fragment>
    </Panel>
  );
}
