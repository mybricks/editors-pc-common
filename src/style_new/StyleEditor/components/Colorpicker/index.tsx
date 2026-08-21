import React, {
  useRef,
  useState,
  useEffect,
  ReactNode,
  useCallback,
  useMemo,
} from "react";
import { createPortal } from "react-dom";

import ColorUtil from "color";
import Sketch, { ColorResult } from "@mybricks/color-picker";
import { GradientEditor } from "../GradientEditor"
import { ImagePanel } from "../ImagePanel"

import { isDefaultWhiteGradientLayer, isGradientValue } from "../../helper/gradient-border";
import { CssVarColorOption } from "../../../core/resolve-css-var-color";
import { VariableColorPreview, VariableList } from "../VariableList";

import css from "./index.less";

const DEFAULT_SOLID = "rgba(0,0,0,1)";
const DEFAULT_GRADIENT =
  "linear-gradient(90deg, rgba(255,255,255,1) 0%, rgba(0,0,0,1) 100%)";

interface ColorpickerProps {
  context: any;
  value: string;
  onChange: (value: { key: string; value: string } | { key: string; value: string }[]) => void;
  children: ReactNode;
  disabled?: boolean;
  className?: string;
  /** 禁用变量 tab（如主题色编辑入口，不应允许绑定变量） */
  disableVariable?: boolean;
  /** 弹层打开时优先展示的类型 */
  defaultTab?: "custom" | "variable";
  /** 当前画布可选的 CSS 颜色变量 */
  canvasVariableOptions?: CssVarColorOption[];
  /** 画布目标节点：解析渐变色标中的 CSS 变量 */
  scopeEl?: Element | null;
  /** 当前已绑定的 CSS 变量名 */
  selectedVariableName?: string;
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

export function Colorpicker(props:ColorpickerProps) {

  const {
    context,
    value,
    onChange,
    onBindingChange,
    children,
    disabled,
    className,
    showSubTabs = true,
    disableVariable = false,
    defaultTab = "custom",
    canvasVariableOptions = [],
    scopeEl = null,
    selectedVariableName,
    upload,
    imageValue,
    disableBackgroundColor,
    disableBackgroundImage,
    disableGradient,
  } = props;
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
            disableVariable={disableVariable}
            defaultTab={defaultTab}
            canvasVariableOptions={canvasVariableOptions}
            scopeEl={scopeEl}
            selectedVariableName={selectedVariableName}
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
  showSubTabs?: boolean; //显示纯色/渐变/图片 tab
  /** 禁用变量 tab */
  disableVariable?: boolean;
  /** 弹层打开时优先展示的类型 */
  defaultTab?: "custom" | "variable";
  /** 当前画布可选的 CSS 颜色变量 */
  canvasVariableOptions?: CssVarColorOption[];
  /** 画布目标节点：解析渐变色标中的 CSS 变量 */
  scopeEl?: Element | null;
  /** 当前已绑定的 CSS 变量名 */
  selectedVariableName?: string;
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

function ColorSketch({
  open,
  positionElement,
  onChange,
  onBindingChange,
  value,
  childRef,
  showSubTabs = true,
  disableVariable = false,
  defaultTab = "custom",
  canvasVariableOptions = [],
  scopeEl = null,
  selectedVariableName,
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

  const variableOptions = useMemo<CssVarColorOption[]>(() => {
    if (disableVariable) return [];

    // 仅展示当前画布节点计算样式中实际生效的颜色变量。
    return canvasVariableOptions;
  }, [canvasVariableOptions, disableVariable]);
  const hasVariableOptions = variableOptions.length > 0;
  
  const defaultColor = DEFAULT_SOLID
  const defaultGradient = DEFAULT_GRADIENT
  
  // 根据 value 判断初始 subTab（优先检查图片），同时考虑禁用配置
  const getSubTabByValue = useCallback((currentValue?: string) => {
    if (defaultTab === "variable" && hasVariableOptions) return "variable"
    const isImage = currentValue?.includes?.("url(")
    const isGradient = isGradientValue(currentValue)
    if (showSubTabs && isImage && !disableBackgroundImage) return "image"
    if (showSubTabs && isGradient && !disableGradient) return "gradient"
    if (!disableBackgroundColor) return "background"
    // 如果背景色被禁用，选择第一个可用的 tab
    if (showSubTabs && !disableGradient) return "gradient"
    if (showSubTabs && !disableBackgroundImage) return "image"
    return hasVariableOptions ? "variable" : "background"
  }, [defaultTab, disableBackgroundColor, disableBackgroundImage, disableGradient, hasVariableOptions, showSubTabs])
  const [subTab, setSubTab] = useState(() => getSubTabByValue(value))
  
  // 保存纯色和渐变值，切换 tab 时使用
  const [colorValue, setColorValue] = useState<string>(() => {
    if (isGradientValue(value) || value?.includes?.("url(")) {
      return defaultColor
    }
    return value || defaultColor
  })
  const [gradientValue, setGradientValue] = useState<string>(() => {
    if (isGradientValue(value) && !value?.includes?.("url(")) {
      // 历史双白占位换成默认可见渐变
      return isDefaultWhiteGradientLayer(value) ? defaultGradient : value
    }
    return defaultGradient
  })
  
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
    // value 只同步数据，不驱动 tab；避免回写时把用户选中的 tab 抢走
    if (value?.includes?.("gradient")) {
      setGradientValue(value)
    } else if (value && !value.includes("url(")) {
      setColorValue(value)
    }
  }, [value])

  useEffect(() => {
    // 只在弹层“打开瞬间”初始化一次，打开后不再被 value 回写影响
    if (open) {
      setSubTab(getSubTabByValue(value))
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])
  
  const subTabClick = (tab: string) => {
    setSubTab(tab)
    if (tab === "background") {
      if (showSubTabs) {
        onChange([
          { key: 'backgroundColor', value: colorValue },
          { key: 'backgroundImage', value: 'none' }
        ])
      } else {
        onChange({ key: 'backgroundColor', value: colorValue })
      }
    } else if (tab === "gradient") {
      let nextGradient = gradientValue
      if (!nextGradient || isDefaultWhiteGradientLayer(nextGradient)) {
        nextGradient = defaultGradient
        setGradientValue(nextGradient)
      }
      onChange({ key: 'backgroundImage', value: nextGradient })
    } else if (tab === "image") {
      const bgImage = imageValue.backgroundImage
      if (bgImage && bgImage !== 'none') {
        onChange([
          { key: 'backgroundColor', value: '' },
          { key: 'backgroundImage', value: bgImage },
          { key: 'backgroundSize', value: imageValue.backgroundSize || 'auto' },
          { key: 'backgroundRepeat', value: imageValue.backgroundRepeat || 'no-repeat' },
          { key: 'backgroundPosition', value: imageValue.backgroundPosition || 'center center' }
        ])
      } else {
        onChange([
          { key: 'backgroundColor', value: '' },
          { key: 'backgroundImage', value: 'none' },
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

  const handleSolidChange = useCallback((colorResult: ColorResult, oldValue: ColorResult) => {
    if (
      colorResult.hexa !== "#ffffff00" &&
      colorResult.hexa?.length === 9 &&
      colorResult?.hex !== oldValue?.hex &&
      colorResult.hexa[colorResult.hexa.length - 1] === "0"
    ) {
      colorResult.hexa = colorResult.hexa.replace(/00$/, "FF");
    }

    setColorValue(colorResult.hexa);
    if (showSubTabs) {
      onChange([
        { key: 'backgroundColor', value: colorResult.hexa },
        { key: 'backgroundImage', value: 'none' }
      ]);
    } else {
      onChange({ key: 'backgroundColor', value: colorResult.hexa });
    }
  }, [onChange, showSubTabs]);


  return (
    <div ref={childRef} className={css.colorSketch} data-dropdown-portal="true" onFocus={(e) => e.stopPropagation()}>
      <div className={css.content}>
        <div className={css.tabItem}>
          {(showSubTabs || hasVariableOptions) && (
            <div className={css.subTabs}>
              {!disableBackgroundColor && (
                <button data-active={subTab === "background"} onClick={() => subTabClick("background")}>
                  填充
                </button>
              )}
              {showSubTabs && !disableGradient && (
                <button data-active={subTab === "gradient"} onClick={() => subTabClick("gradient")}>
                  渐变
                </button>
              )}
              {showSubTabs && !disableBackgroundImage && (
                <button data-active={subTab === "image"} onClick={() => subTabClick("image")}>
                  图片
                </button>
              )}
              {hasVariableOptions && (
                <button data-active={subTab === "variable"} onClick={() => subTabClick("variable")}>
                  变量
                </button>
              )}
            </div>
          )}
          <div className={css.subContent}>
            {subTab === "background" && <Sketch color={sketchColor()} onChange={handleSolidChange} />}
            {subTab === "gradient" && (
              <GradientEditor
                defaultValue={gradientValue}
                onChange={handleGradientChange}
                variableOptions={variableOptions}
                scopeEl={scopeEl}
              />
            )}
            {subTab === "image" && (
              <ImagePanel value={imageValue} onChange={handleImagePanelChange} upload={upload} />
            )}
            {subTab === "variable" && (
              <ColorVariableList
                list={variableOptions}
                selectedName={selectedVariableName}
                open={open}
                onBindingChange={onBindingChange}
              />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
const ColorVariableList = ({
  list,
  selectedName,
  open,
  onBindingChange,
}: {
  list: CssVarColorOption[];
  selectedName?: string;
  open: boolean;
  onBindingChange?: (value: any) => void;
}) => {
  return (
    <VariableList
      list={list}
      selectedName={selectedName}
      open={open}
      renderIcon={(item) => <VariableColorPreview color={item.value} />}
      renderValue={() => null}
      onSelect={(item) => onBindingChange?.({
        name: item.name,
        value: `var(${item.name})`,
        resetValue: item.value,
      })}
      emptyText="当前画布没有可用的颜色变量"
    />
  )
}
