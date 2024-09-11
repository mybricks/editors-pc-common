import React, {
  useRef,
  useMemo,
  useState,
  useEffect,
  useCallback,
  CSSProperties,
} from "react";
import { createPortal } from "react-dom";

import { Panel, GradientEditor } from "../";

import css from "./index.less";
import { ParseGradient } from "../GradientEditor/constants";

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

  const [backgroundImage, setBackgroundImage] = useState(defaultValue);

  const onGradientChange = (value: string) => {
    onChange && onChange(value);
    setBackgroundImage(value);
  };

  const [gradientType, setGradientType] = useState<string>("Linear");
  const onTypeChange = (type: string) => {
    return setGradientType(capitalizeFirstLetter(type) || "Linear");
  };
  return (
    <Panel.Item style={style} className={css.container}>
      <div className={css.color} onClick={onPresetClick}>
        <div
          ref={presetRef}
          className={css.block}
          style={{ backgroundImage: backgroundImage }}
        />
        <span>{gradientType}</span>
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
      const left = right - positionElementBct.width;
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

const capitalizeFirstLetter = (string: string) => {
  if (!string) return string; // 如果字符串为空或未定义，则直接返回
  return string.charAt(0).toUpperCase() + string.slice(1);
};
