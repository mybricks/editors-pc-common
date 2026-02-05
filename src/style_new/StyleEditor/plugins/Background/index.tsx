import React, { useMemo, useState, CSSProperties, useCallback, useEffect } from "react";
import { getRealKey } from "../../utils";
import { useStyleEditorContext } from "../..";
import { PanelBaseProps } from "./../../type";
import { Panel, Image, ColorEditor, Gradient } from "../../components";
import { DeleteOutlined, ReloadOutlined } from "@ant-design/icons";
import css from "./index.less";

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
    onChange(ALL_BACKGROUND_KEYS.map(key => ({ key, value: void 0 })));
    setIsReset(true);
    setForceRenderKey(prev => prev + 1);
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
    const bgImage = defaultBackgroundValue[getRealKey(keyMap, "backgroundImage")] 
      || defaultBackgroundValue.backgroundImage;
    const bgColor = defaultBackgroundValue[getRealKey(keyMap, "backgroundColor")] 
      || defaultBackgroundValue.backgroundColor;
    if (bgImage && typeof bgImage === 'string' && /url\(|gradient/.test(bgImage)) {
      return bgImage;
    }
    return bgColor;
  }, [defaultBackgroundValue, keyMap]);

  const imageValue = useMemo(() => 
    Object.fromEntries(
      IMAGE_KEYS.map(key => [key, defaultBackgroundValue[key] as string | undefined])
    ) as Record<typeof IMAGE_KEYS[number], string | undefined>,
  [defaultBackgroundValue]);

  return (
    <Panel
      title="背景"
      showTitle={showTitle}
      key={forceRenderKey}
      showReset={true}
      collapse={collapse}
      resetFunction={refresh}
    >
      <Panel.Content>
          <ColorEditor
            style={{ flex: 2 }}
            defaultValue={colorEditorDefaultValue}
            onChange={onChange as (value: { key: string; value: string } | { key: string; value: string }[] | string) => void}
            keyMap={keyMap}
            useImportant={useImportant}
            upload={context?.editConfig?.upload as any}
            imageValue={imageValue}
            disableBackgroundColor={disableBackgroundColor}
            disableBackgroundImage={disableBackgroundImage}
            disableGradient={disableGradient}
          />
        
        {/* {disableBackgroundImage ? null : (
          <Image
            style={{ flex: 1 }}
            tip="背景图"
            defaultValue={{
              backgroundImage: defaultBackgroundValue.backgroundImage,
              backgroundRepeat: defaultBackgroundValue.backgroundRepeat,
              backgroundPosition: defaultBackgroundValue.backgroundPosition,
              backgroundSize: defaultBackgroundValue.backgroundSize,
            }}
            onChange={(value: { key: string; value: string }) => {
              onChange({
                key: getRealKey(keyMap, value.key),
                value: `${value.value}${useImportant ? "!important" : ""}`,
              });
            }}
            upload={context?.editConfig?.upload}
          />
        )} */}

        {<div
          className={css.unbind}
          data-mybricks-tip="重置"
          onClick={refresh}
        ><DeleteOutlined /></div>}
      </Panel.Content>
      {/* <Panel.Content>
        {!disableGradient ? (
          <Gradient
            defaultValue={
              defaultBackgroundValue?.backgroundImage ||
              (defaultBackgroundValue?.backgroundImage === "none" &&
                defaultBackgroundValue?.background &&
                defaultBackgroundValue?.background) ||
              ""
            }
            onChange={(value) => onChange({ key: "backgroundImage", value })}
          />
        ) : null}
      </Panel.Content> */}
    </Panel>
  );
}
