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

import css from "./index.less";
interface ColorpickerProps {
  context: any;
  value: string;
  onChange: (value: Record<string, any>) => void;
  children: ReactNode;
  disabled?: boolean;
  className?: string;
  onBindingChange: (value: any) => void;
}

export function Colorpicker({
  context,
  value,
  onChange,
  onBindingChange,
  children,
  disabled,
  className,
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

  const handleColorSketchChange = useCallback(
    (value: ColorResult, oldValue: ColorResult) => {
      // 点击面板选择颜色时不带透明度 这时就需要把后两位置FF
      if (
        value.hexa !== "#ffffff00" &&
        value.hexa?.length === 9 &&
        value?.hex !== oldValue?.hex // 判断是否只改变透明度
      ) {
        if (value.hexa[value.hexa.length - 1] === "0") {
          value.hexa = value.hexa.replace(/00$/, "FF");
        }
      }
      onChange(value);
    },
    []
  );

  const handleClick = useCallback((event: any) => {
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
            onChange={handleColorSketchChange}
            onBindingChange={onBindingChange}
            open={open}
            positionElement={containerRef.current!}
            childRef={childRef}
          />,
          document.body
        )}
    </>
  );
}
interface ColorSketchProps {
  value: string;
  onChange: (value: ColorResult, oldValue: ColorResult) => void;
  open: boolean;
  positionElement: HTMLDivElement;
  childRef: React.RefObject<HTMLDivElement>;
  onBindingChange: (value: {
    name: string;
    value: string;
    resetValue: string;
  }) => void;
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

  const sketchColor = useCallback(() => {
    try {
      // @ts-ignore
      const { color, valpha } = ColorUtil.rgb(value);
      return `rgba(${color[0]}, ${color[1]}, ${color[2]}, ${valpha.toFixed(
        2
      )})`;
    } catch {
      return "rgba(0, 0, 0, 1)";
    }
  }, [value]);

  const [selectTab, setSelectTab] = useState("custom")
  const [list, setList] = useState(window.MYBRICKS_THEME_PACKAGE_VARIABLES?.variables || [])
  const tabClick = (selectTab: string) => {
    setSelectTab(selectTab)
  }

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
        <div className={css.tabItem} style={{ zIndex: selectTab === "custom" ? 1 : 0 }}>
          <Sketch color={sketchColor()} onChange={onChange} />
        </div>
        {Array.isArray(list) && <div className={css.tabItem} style={{ zIndex: selectTab === "variable" ? 1 : 0 }}>
          <VariableList list={list} onBindingChange={onBindingChange} />
        </div>}
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
