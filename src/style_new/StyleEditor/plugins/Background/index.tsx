import React, {
  useMemo,
  useState,
  CSSProperties,
  useCallback,
  useRef,
  useEffect,
} from "react";
import { useStyleEditorContext } from "../..";
import {
  Panel,
  TransparentColorOutlined,
  GradientEditor,
  ImageEditor,
  ProcessColor,
  getBackgroundImage,
  colorSketchChange,
} from "../../components";
import CSS from "./index.less";
import { createPortal } from "react-dom";
import { ReloadOutlined } from "@ant-design/icons";
import { GradientIcon, ImgIcon, SoldIcon } from "./Icon";
import Sketch from "@mybricks/color-picker";
import { Background1 } from "./Old";
import { ExtractBackground } from "../../components/Image/ExtractBackground";

interface BackgroundProps {
  value: CSSProperties;
  onChange: (
    value: { key: string; value: any } | { key: string; value: any }[]
  ) => void;
  config: {
    [key: string]: any;
  };
  showTitle: boolean;
  upload?: (files: Array<File>) => Array<string>;
}

const DEFAULT_CONFIG = {
  disableBackgroundColor: false,
  disableBackgroundImage: false,
  disableGradient: false,
  keyMap: {},
  useImportant: false,
};

export function Background({
  value,
  onChange,
  config,
  showTitle,
  upload,
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

  const defaultBackgroundValue: CSSProperties & Record<string, any> =
    useMemo(() => {
      const defaultValue = Object.assign({}, value);
      Object.entries(defaultValue).forEach(([key, value]) => {
        if (typeof value === "string") {
          // TODO: 全局处理
          // @ts-ignore
          defaultValue[key] = value.replace(/!.*$/, "");
        }
      });

      return defaultValue;
    }, [forceRenderKey]);

  const refresh = useCallback(() => {
    onChange([
      { key: "backgroundColor", value: void 0 },
      { key: "backgroundImage", value: void 0 },
      { key: "backgroundRepeat", value: void 0 },
      { key: "backgroundPosition", value: void 0 },
      { key: "backgroundSize", value: void 0 },
    ]);
    setForceRenderKey(forceRenderKey + 1);
  }, [forceRenderKey]);

  const presetRef = useRef<HTMLDivElement>(null);
  const [show, setShow] = useState(false);
  const [open, setOpen] = useState(false);

  const onPresetClick = useCallback(() => {
    setShow(true);
    setOpen(true);
  }, []);

  const handleClick = useCallback(() => {
    setOpen(false);
  }, []);

  useEffect(() => {
    if (open) {
      setTimeout(() => {
        document.addEventListener("click", handleClick);
      });
    } else {
      document.removeEventListener("click", handleClick);
    }
  }, [open]);

  useEffect(() => {
    return () => {
      document.removeEventListener("click", handleClick);
    };
  }, []);

  const [backgroundImage, setBackgroundImage] = useState(
    defaultBackgroundValue.backgroundImage
  );
  const [backgroundColor, setBackgroundColor] = useState(
    defaultBackgroundValue.backgroundColor
  );
  // const [background, setBackground] = useState(
  //   defaultBackgroundValue?.background ||
  //     defaultBackgroundValue?.backgroundImage
  // );

  const [defaultBackground, setDefaultBackground] = useState<CSSProperties>(
    defaultBackgroundValue
  );

  const NewPanel = useCallback(
    ({ open, positionElement }: { open: boolean; [k: string]: any }) => {
      const ref = useRef<HTMLDivElement>(null);

      const [backgroundImageNew, setBackgroundImageNew] =
        useState(backgroundImage);
      const [backgroundColorNew, setBackgroundColorNew] =
        useState(backgroundColor);
      const [defaultBackgroundNew, setDefaultBackgroundNew] =
        useState<CSSProperties>(defaultBackgroundValue);

      useEffect(() => {
        const menusContainer = ref.current!;
        if (open) {
          const positionElementBct = positionElement.getBoundingClientRect();
          const menusContainerBct = ref.current!.getBoundingClientRect();
          const totalHeight =
            window.innerHeight || document.documentElement.clientHeight;
          const top = positionElementBct.top + positionElementBct.height;
          const right = positionElementBct.left + positionElementBct.width;
          const left = right - positionElementBct.width - 20;
          const bottom = top + menusContainerBct.height;

          if (bottom > totalHeight) {
            // 目前判断下方是否超出即可
            // 向上
            menusContainer.style.top =
              positionElementBct.top - menusContainerBct.height + "px";
          } else {
            menusContainer.style.top = top + "px";
          }

          // 保证完全展示
          if (menusContainerBct.width > positionElementBct.width) {
            menusContainer.style.left =
              left - menusContainerBct.width + positionElementBct.width + "px";
          } else {
            menusContainer.style.width = positionElementBct.width + "px";
            menusContainer.style.left = left + "px";
          }

          menusContainer.style.visibility = "visible";
        } else {
          menusContainer.style.visibility = "hidden";
        }
      }, [open]);

      const [activeKey, setActiveKey] = useState(
        backgroundImage !== "none" &&
          (backgroundColor === "transparent" ||
            backgroundColor === "rgba(255, 255, 255, 0)")
          ? ExtractBackground(backgroundImage || "", "gradient")?.length > 0
            ? 1
            : 2
          : 0
      );
      const isActive = (key: number) => activeKey === key;
      const handleItemClick = useCallback(
        (key: number) => {
          setActiveKey(key);
          switch (key) {
            case 0:
              // onChange({ key: "backgroundColor", value: backgroundColor });
              break;
            case 1:
              // onChange({ key: "backgroundImage", value: backgroundImage });
              break;
            case 2:
              // @ts-ignore
              // onChange(defaultBackground);
              break;
            default:
              return;
          }
        },
        [backgroundColor, backgroundImage, defaultBackground]
      );
      const TopBar = useCallback(() => {
        return (
          <div className={CSS.topBar}>
            {[<SoldIcon />, <GradientIcon />, <ImgIcon />].map((icon, index) =>
              (index === 2 && disableBackgroundImage) ||
              (index === 1 && disableGradient) ||
              (index === 0 && disableBackgroundColor) ? null : (
                <div
                  key={index}
                  className={`${CSS.topBarItem} ${
                    isActive(index) ? CSS.activeItem : ""
                  }`}
                  onClick={() => handleItemClick(index)}
                >
                  {icon}
                </div>
              )
            )}
          </div>
        );
      }, [activeKey]);

      const ColorPicker = useCallback(
        () => (
          <div className={CSS.ColorPicker}>
            <Sketch
              color={backgroundColorNew}
              onChange={(color, oldColor) => {
                const value = ProcessColor(colorSketchChange(color, oldColor));
                onChange({ key: "backgroundColor", value });
                setBackgroundColorNew(value);
                setBackgroundColor(value);
              }}
              style={{
                backgroundColor: "white",
                borderRadius: 6,
                margin: "auto",
              }}
            />
          </div>
        ),
        [backgroundColorNew]
      );

      const GradientPiker = useCallback(
        () => (
          <div className={CSS.GradientPiker}>
            <div style={{ marginTop: 30 }} />
            <GradientEditor
              defaultValue={backgroundImageNew}
              // onTypeChange={onTypeChange}
              onChange={(value) => {
                onChange({ key: "backgroundImage", value });
                setBackgroundImageNew(value);
                setBackgroundImage(value);
                setDefaultBackgroundNew({...defaultBackgroundNew, backgroundImage: value})
              }}
              // onDegChange={onDegChange}
              // onShapeChange={onShapeChange}
            />
          </div>
        ),
        [backgroundImageNew]
      );

      const ImgPicker = useCallback(() => {
        return (
          <div className={CSS.ImgPicker}>
            <ImageEditor
              upload={upload}
              value={defaultBackgroundNew}
              onChange={(value) => {
                onChange(value);
                setDefaultBackground((val) => {
                  return {
                    ...val,
                    [value.key]: value.value,
                  };
                });
                setDefaultBackgroundNew((val) => {
                  return {
                    ...val,
                    [value.key]: value.value,
                  };
                });
                if (value?.key === "backgroundImage") {
                  setBackgroundImage(value.value);
                  setBackgroundImageNew(value.value);
                }
              }}
            />
          </div>
        );
      }, [backgroundImageNew]);

      const ContentRender = useMemo(() => {
        switch (activeKey) {
          case 0:
            return <ColorPicker />;
          case 1:
            return <GradientPiker />;
          case 2:
            return <ImgPicker />;
          default:
            return null;
        }
      }, [activeKey]);

      return (
        <div
          ref={ref}
          className={CSS.panel}
          onClick={(e) => e.stopPropagation()}
        >
          <TopBar />
          {ContentRender}
        </div>
      );
    },
    []
  );

  const ColorBlock = useCallback(() => {
    const src = getBackgroundImage(backgroundImage);
    return (
      <div className={CSS.color} data-mybricks-tip={"背景"}>
        <div
          className={CSS.colorPickerContainer}
          onClick={onPresetClick}
          ref={presetRef}
        >
          {!src && (
            <div
              className={CSS.block}
              style={{
                backgroundColor,
                backgroundImage,
              }}
            />
          )}
          {backgroundImage && src ? <img src={src} /> : null}
          {!backgroundColor ||
            ((!backgroundImage || backgroundImage === "none") && (
              <div className={CSS.icon}>
                <TransparentColorOutlined />
              </div>
            ))}
        </div>
        <div className={CSS.text}></div>
      </div>
    );
  }, [presetRef, backgroundColor, backgroundImage, defaultBackground]);

  return (
    <>
      <Panel
        title="背景"
        showTitle={showTitle}
        key={forceRenderKey}
        showReset={true}
        resetFunction={refresh}
      >
        <Panel.Content>
          <Panel.Item className={CSS.container}>
            <ColorBlock />
            <div
              className={CSS.svgDiv}
              onClick={refresh}
              data-mybricks-tip={"重置"}
            >
              <ReloadOutlined />
            </div>
            {show &&
              createPortal(
                <NewPanel
                  // defaultValue={defaultValue}
                  positionElement={presetRef.current!}
                  open={open}
                  upload={upload}
                  // onChange={onGradientChange}
                  // onTypeChange={onTypeChange}
                  // onDegChange={onDegChange}
                  // onShapeChange={onShapeChange}
                />,
                document.body
              )}
          </Panel.Item>
        </Panel.Content>
      </Panel>
      <Background1
        value={value}
        onChange={onChange}
        config={config}
        showTitle={showTitle}
      />
    </>
  );
}
