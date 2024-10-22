import React, {
  useRef,
  useState,
  useEffect,
  useCallback,
  CSSProperties,
  useMemo,
} from "react";
import { createPortal } from "react-dom";

import { Panel, GradientEditor, TransparentColorOutlined } from "../";

import { ReloadOutlined } from "@ant-design/icons";

import css from "./index.less";
import { gradientOptions, shapeOptions } from "../GradientEditor/constants";
import { ExtractBackground } from "../Image/ExtractBackground";
// import { Angle, Circle, Ellipse, Linear, Radial } from "../GradientEditor/Icon";

interface GradientEditorProps {
  defaultValue: any;
  style?: CSSProperties;
  onChange: (value: any) => void;
}

export function Gradient({
  defaultValue,
  style = {},
  onChange,
}: GradientEditorProps) {
  const presetRef = useRef<HTMLDivElement>(null);
  const [show, setShow] = useState(false);
  const [open, setOpen] = useState(false);

  const onPresetClick = useCallback(() => {
    setShow(true);
    setOpen((prevOpen) => !prevOpen);
  }, [open]);

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

  const [backgroundImage, setBackgroundImage] = useState(defaultValue);

  const onGradientChange = useCallback(
    (value: string) => {
      if (value && backgroundImage !== value) {
        onChange && onChange(value);
        setBackgroundImage(value);
      }
    },
    [onChange, backgroundImage]
  );

  const [gradientType, setGradientType] = useState<string>(
    /radial-gradient\(/.test(defaultValue) ? "径向" : "线性"
  );
  const onTypeChange = (type: string) => {
    return setGradientType(mapGradientOptions(type, gradientOptions) || "线性");
  };
  const onlyGradient = useMemo(
    () => ExtractBackground(backgroundImage, "gradient"),
    [backgroundImage]
  );
  return (
    <Panel.Item style={style} className={css.container}>
      <div className={css.color} data-mybricks-tip={"渐变色"}>
        <div className={css.colorPickerContainer} onClick={onPresetClick}>
          <div
            ref={presetRef}
            className={css.block}
            style={{
              backgroundImage: onlyGradient?.[0] || void 0,
            }}
          />
          {(!backgroundImage ||
            backgroundImage === "none" ||
            backgroundImage === "initial" ||
            onlyGradient?.length === 0) && (
            <div className={css.icon}>
              <TransparentColorOutlined />
            </div>
          )}
        </div>
        <div className={css.text}>
          <span>{gradientType}颜色渐变</span>
        </div>
      </div>
      <div
        className={css.svgDiv}
        onClick={() => {
          onGradientChange("none");
          setShow(false);
        }}
        data-mybricks-tip={"重置渐变色"}
      >
        <ReloadOutlined />
      </div>
      {show &&
        createPortal(
          <GradientPanel
            defaultValue={defaultValue}
            positionElement={presetRef.current!}
            open={open}
            onChange={onGradientChange}
            onTypeChange={onTypeChange}
          />,
          document.body
        )}
    </Panel.Item>
  );
}

const GradientPanel = ({
  open,
  positionElement,
  onChange,
  defaultValue,
  onTypeChange,
}: {
  defaultValue: string;
  open: boolean;
  onChange: (value: string) => void;
  onTypeChange?: (value: string) => void;
  [k: string]: any;
}) => {
  const ref = useRef<HTMLDivElement>(null);

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

  return (
    <div ref={ref} className={css.panel} onClick={(e) => e.stopPropagation()}>
      <div style={{ marginTop: 30 }} />
      <GradientEditor
        defaultValue={defaultValue}
        onTypeChange={onTypeChange}
        onChange={(backgroundImage) => onChange(backgroundImage)}
      />
    </div>
  );
};

const mapGradientOptions = (string: string, options: any[]) => {
  if (!string) return string; // 如果字符串为空或未定义，则直接返回
  for (const item of options) {
    if (item.value === string) {
      return item.label;
    }
  }

  return "";
};
