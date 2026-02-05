import React, {
  useRef,
  useState,
  useEffect,
  ReactNode,
  useCallback,
} from "react";
import { createPortal } from "react-dom";

import ColorUtil from "color";
import Sketch, { ColorResult } from "@mybricks/color-picker";
import { useDebounceFn } from "../../../../hooks"
import { GradientEditor } from "../GradientEditor"
import { ImagePanel } from "../ImagePanel"

import css from "./index.less";
interface ColorpickerProps {
  context: any;
  value: string;
  onChange: (value: { key: string; value: string } | { key: string; value: string }[]) => void;
  children: ReactNode;
  disabled?: boolean;
  className?: string;
  showSubTabs?: boolean;
  onBindingChange?: (value: any) => void;
  /** 图片上传函数 */
  upload?: (files: Array<File>, args: any) => Promise<Array<string>>;
  /** 背景图片相关值 */
  imageValue?: {
    backgroundImage?: string;
    backgroundSize?: string;
    backgroundRepeat?: string;
    backgroundPosition?: string;
  };
  /** 禁用纯色背景 tab */
  disableBackgroundColor?: boolean;
  /** 禁用背景图片 tab */
  disableBackgroundImage?: boolean;
  /** 禁用渐变 tab */
  disableGradient?: boolean;
}

export function Colorpicker({
  context,
  value,
  onChange,
  onBindingChange,
  children,
  disabled,
  className,
  showSubTabs = true,
  upload,
  imageValue,
  disableBackgroundColor,
  disableBackgroundImage,
  disableGradient,
}: ColorpickerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const childRef = useRef<HTMLDivElement>(null);
  const [show, setShow] = useState(false);
  const [open, setOpen] = useState(false);

  const handleColorpickerClick = useCallback(() => {
    if (disabled) {
      return;
    }
    setShow(true);
    setOpen((open) => !open);
  }, [disabled, open]);

  context.open = handleColorpickerClick

  const handleClick = useCallback((event: any) => {
    if (event.target?.closest?.('[data-dropdown-portal="true"]')) {
      return; 
    }
    
    if (!childRef.current?.contains(event.target)) {
      setOpen(false);
    }
  }, []);

  useEffect(() => {
    if (open) {
      setTimeout(() => {
        // TODO
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

  return (
    <>
      <div ref={containerRef} className={className} onClick={handleColorpickerClick}>
        {children}
      </div>
      {show &&
        createPortal(
          <ColorSketch
            value={value}
            onChange={onChange}
            onBindingChange={onBindingChange}
            open={open}
            positionElement={containerRef.current!}
            childRef={childRef}
            showSubTabs={showSubTabs}
            upload={upload}
            imageValue={imageValue}
            disableBackgroundColor={disableBackgroundColor}
            disableBackgroundImage={disableBackgroundImage}
            disableGradient={disableGradient}
          />,
          document.body
        )}
    </>
  );
}
interface ColorSketchProps {
  value: string;
  onChange: (value: { key: string; value: string } | { key: string; value: string }[]) => void;
  open: boolean;
  showSubTabs?: boolean;
  positionElement: HTMLDivElement;
  upload?: (files: Array<File>, args: any) => Promise<Array<string>>;
  imageValue?: {
    backgroundImage?: string;
    backgroundSize?: string;
    backgroundRepeat?: string;
    backgroundPosition?: string;
  };
  childRef: React.RefObject<HTMLDivElement>;
  onBindingChange?: (value: {
    name: string;
    value: string;
    resetValue: string;
  }) => void;
  /** 禁用纯色背景 tab */
  disableBackgroundColor?: boolean;
  /** 禁用背景图片 tab */
  disableBackgroundImage?: boolean;
  /** 禁用渐变 tab */
  disableGradient?: boolean;
}

const TAB_LIST = [
  {
    key: "custom",
    title: "自定义"
  },
  {
    key: "variable",
    title: "变量"
  }
]

function ColorSketch({
  open,
  positionElement,
  onChange,
  onBindingChange,
  value,
  childRef,
  showSubTabs = true,
  upload,
  imageValue = {},
  disableBackgroundColor = false,
  disableBackgroundImage = false,
  disableGradient = false,
}: ColorSketchProps) {
  useEffect(() => {
    const menusContainer = childRef.current!;
    if (open) {
      const positionElementBct = positionElement.getBoundingClientRect();
      const menusContainerBct = childRef.current!.getBoundingClientRect();
      const top = positionElementBct.bottom - positionElementBct.height;

      if (top + menusContainerBct.height > window.innerHeight) {
        menusContainer.style.top = (top - menusContainerBct.height + positionElementBct.height) + "px"
      } else {
        menusContainer.style.top = top + "px"
      }

      menusContainer.style.right = (window.innerWidth - positionElementBct.left) + "px"
      menusContainer.style.visibility = "visible";
    } else {
      menusContainer.style.visibility = "hidden";
    }
  }, [open]);

  const [selectTab, setSelectTab] = useState("custom")
  const [list, setList] = useState(window.MYBRICKS_THEME_PACKAGE_VARIABLES?.variables || [])
  
  // 默认纯色和渐变值
  const defaultColor = "rgba(255,255,255,1)"
  const defaultGradient = "linear-gradient(90deg, rgba(255,255,255,1) 0%, rgba(255,255,255,1) 100%)"
  
  // 根据 value 判断初始 subTab（优先检查图片），同时考虑禁用配置
  const isImage = value?.includes?.("url(")
  const isGradient = value?.includes?.("gradient")
  const getInitialSubTab = () => {
    // 优先根据 value 选择
    if (isImage && !disableBackgroundImage) return "image"
    if (isGradient && !disableGradient) return "gradient"
    if (!disableBackgroundColor) return "background"
    // 如果背景色被禁用，选择第一个可用的 tab
    if (!disableGradient) return "gradient"
    if (!disableBackgroundImage) return "image"
    return "background"
  }
  const [subTab, setSubTab] = useState(getInitialSubTab())
  
  // 保存纯色和渐变值，切换 tab 时使用
  const [colorValue, setColorValue] = useState<string>(
    (isGradient || isImage) ? defaultColor : (value || defaultColor)
  )
  const [gradientValue, setGradientValue] = useState<string>(
    (isGradient && !isImage) ? value : defaultGradient
  )
  
  // 使用 colorValue 计算 Sketch 的颜色
  const sketchColor = useCallback(() => {
    try {
      // @ts-ignore
      const { color, valpha } = ColorUtil.rgb(colorValue);
      return `rgba(${color[0]}, ${color[1]}, ${color[2]}, ${valpha.toFixed(
        2
      )})`;
    } catch {
      return "rgba(0, 0, 0, 1)";
    }
  }, [colorValue]);
  
  useEffect(() => {
    if (value?.includes?.("url(")) {
      setSubTab("image")
    } else if (value?.includes?.("gradient")) {
      setGradientValue(value)
      setSubTab("gradient")
    } else if (value) {
      setColorValue(value)
      setSubTab("background")
    }
  }, [value])
  
  const tabClick = (tab: string) => {
    setSelectTab(tab)
  }
  
  const subTabClick = (tab: string) => {
    setSubTab(tab)
    if (tab === "background") {
      onChange([
        { key: 'backgroundColor', value: colorValue },
        { key: 'backgroundImage', value: 'none' }
      ])
    } else if (tab === "gradient") {
      onChange({ key: 'backgroundImage', value: gradientValue })
    } else if (tab === "image") {
      const bgImage = imageValue.backgroundImage
      if (bgImage && bgImage !== 'none') {
        onChange([
          { key: 'backgroundImage', value: bgImage },
          { key: 'backgroundSize', value: imageValue.backgroundSize || 'auto' },
          { key: 'backgroundRepeat', value: imageValue.backgroundRepeat || 'no-repeat' },
          { key: 'backgroundPosition', value: imageValue.backgroundPosition || 'center center' }
        ])
      }
    }
  }

  const handleGradientChange = useCallback((newGradientValue: string) => {
    setGradientValue(newGradientValue);
    onChange({ key: 'backgroundImage', value: newGradientValue });
  }, [onChange]);

  const handleImagePanelChange = useCallback((key: string, value: string) => {
    onChange({ key, value });
  }, [onChange]);

  const search = useDebounceFn((e: any) => {
    const searchValue = e.target.value

    if (!searchValue) {
      setList(window.MYBRICKS_THEME_PACKAGE_VARIABLES.variables)
      return
    }

    const newList: any = [];

    window.MYBRICKS_THEME_PACKAGE_VARIABLES.variables.forEach((variable: any) => {
      const configs = variable.configs.filter(({ key, name }: any) => {
        return key.toLowerCase().indexOf(searchValue) !== -1 || name.toLowerCase().indexOf(searchValue) !== -1
      })

      if (configs.length) {
        newList.push({
          ...variable,
          configs
        })
      }
    })

    setList(newList);
  }, 300)

  return (
    <div ref={childRef} className={css.colorSketch} onFocus={(e) => e.stopPropagation()}>
      <div className={css.header}>
        <div className={css.tabs}>
          {TAB_LIST.slice(0, window.MYBRICKS_THEME_PACKAGE_VARIABLES ? 2 : 1).map(({ key, title }) => {
            return (
              <button
                data-active={selectTab === key}
                onClick={() => {
                  tabClick(key)
                }}
              >
                {title}
              </button>
            )
          })}
        </div>
        {selectTab === "variable" && <div className={css.search}>
          <svg viewBox='0 0 1057 1024' version='1.1' xmlns='http://www.w3.org/2000/svg' p-id='6542' width='16'
            height='16'>
            <path
              d='M835.847314 455.613421c0-212.727502-171.486774-385.271307-383.107696-385.271307C241.135212 70.35863 69.648437 242.869403 69.648437 455.613421c0 212.760534 171.486774 385.271307 383.091181 385.271307 109.666973 0 211.769567-46.525883 283.961486-126.645534a384.891436 384.891436 0 0 0 99.14621-258.625773zM1045.634948 962.757107c33.560736 32.421125-14.583725 83.257712-48.144461 50.853103L763.176429 787.28995a449.79975 449.79975 0 0 1-310.436811 123.953408C202.735255 911.243358 0 707.269395 0 455.613421S202.735255 0 452.739618 0C702.760497 0 905.495752 203.957447 905.495752 455.613421a455.662969 455.662969 0 0 1-95.330989 279.716846l235.486702 227.42684z'
              p-id='6543'></path>
          </svg>
          <input
            placeholder='搜索'
            onChange={search}
            autoFocus
          />
        </div>}
      </div>
      <div className={css.content}>
        {selectTab === "custom" && showSubTabs && (
          <div className={css.tabItem}>
            <div className={css.subTabs}>
              {!disableBackgroundColor && (
                <button
                  data-active={subTab === "background"}
                  onClick={() => subTabClick("background")}
                >
                  填充
                </button>
              )}
              {!disableGradient && (
                <button
                  data-active={subTab === "gradient"}
                  onClick={() => subTabClick("gradient")}
                >
                  渐变
                </button>
              )}
              {!disableBackgroundImage && (
                <button
                  data-active={subTab === "image"}
                  onClick={() => subTabClick("image")}
                >
                  图片
                </button>
              )}
            </div>
            <div className={css.subContent}>
              {subTab === "background" && (
                <Sketch color={sketchColor()} onChange={(colorResult: ColorResult, oldValue: ColorResult) => {
                  if (
                    colorResult.hexa !== "#ffffff00" &&
                    colorResult.hexa?.length === 9 &&
                    colorResult?.hex !== oldValue?.hex
                  ) {
                    if (colorResult.hexa[colorResult.hexa.length - 1] === "0") {
                      colorResult.hexa = colorResult.hexa.replace(/00$/, "FF");
                    }
                  }
                  setColorValue(colorResult.hexa);
                  onChange([
                    { key: 'backgroundColor', value: colorResult.hexa },
                    { key: 'backgroundImage', value: 'none' }
                  ]);
                }} />
              )}
              {subTab === "gradient" && (
                <GradientEditor
                  defaultValue={gradientValue}
                  onChange={handleGradientChange}
                />
              )}
              {subTab === "image" && (
                <ImagePanel
                  value={imageValue}
                  onChange={handleImagePanelChange}
                  upload={upload}
                />
              )}
            </div>
          </div>
        )}

        {selectTab === "custom" && !showSubTabs && (
          <div className={css.tabItem}>
            <div className={css.subContent}>
            <Sketch color={sketchColor()} onChange={(colorResult: ColorResult, oldValue: ColorResult) => {
                  if (
                    colorResult.hexa !== "#ffffff00" &&
                    colorResult.hexa?.length === 9 &&
                    colorResult?.hex !== oldValue?.hex
                  ) {
                    if (colorResult.hexa[colorResult.hexa.length - 1] === "0") {
                      colorResult.hexa = colorResult.hexa.replace(/00$/, "FF");
                    }
                  }
                  onChange({ key: 'backgroundColor', value: colorResult.hexa });
                }} />
            </div>
          </div>
        )}
        {selectTab === "variable" && Array.isArray(list) && (
          <div className={css.tabItem}>
            <VariableList list={list} onBindingChange={onBindingChange} />
          </div>
        )}
      </div>
    </div>
  );
}
const VariableList = (props: any) => {
  return (
    <div className={css.variableListContainer}>
      <div className={css.variableList}>
        {props.list.map((variable: any) => {
          return (
            <>
              <div className={css.title}>
                {variable.title}
              </div>
              {variable.configs.map((config: any) => {
                return (
                  <div
                    className={css.value}
                    onClick={(e) => {
                      props.onBindingChange({
                        name: config.name,
                        value: `var(${config.key})`,
                        resetValue: config.value
                      })
                    }}
                  >
                    <div className={css.block} style={{ backgroundColor: config.value }} />
                    <span>{config.name}</span>
                  </div>
                )
              })}
            </>
          )
        })}
      </div>
    </div>
  )
}

