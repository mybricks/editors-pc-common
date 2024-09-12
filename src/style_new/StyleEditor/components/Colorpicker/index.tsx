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

import css from "./index.less";
interface ColorpickerProps {
  value: string;
  onChange: (value: Record<string, any>) => void;
  children: ReactNode;
  disabled?: boolean;
  className?: string;
}

export function Colorpicker({
  value,
  onChange,
  children,
  disabled,
  className,
}: ColorpickerProps) {
  const ref = useRef<HTMLDivElement>(null);
  const childRef = useRef<HTMLDivElement>(null);
  const [show, setShow] = useState(false);
  const [open, setOpen] = useState(false);

  const handleColorpickerClick = useCallback(() => {
    if (disabled) {
      return;
    }
    setShow(!show);
    setOpen(!open);
  }, [disabled, show, open]);

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
    if (!childRef.current!.contains(event.target)) {
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
      <div ref={ref} className={className} onClick={handleColorpickerClick}>
        {children}
      </div>
      {show &&
        createPortal(
          <ColorSketch
            value={value}
            onChange={handleColorSketchChange}
            open={open}
            positionElement={ref.current!}
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
}

function ColorSketch({
  open,
  positionElement,
  onChange,
  value,
  childRef,
}: ColorSketchProps) {
  const ref = childRef;

  useEffect(() => {
    const menusContainer = ref.current!;
    if (open) {
      const positionElementBct = positionElement.getBoundingClientRect();
      const menusContainerBct = ref.current!.getBoundingClientRect();
      const totalHeight =
        window.innerHeight || document.documentElement.clientHeight;
      const top = positionElementBct.top + positionElementBct.height;
      const right = positionElementBct.left + positionElementBct.width;
      const left = right - menusContainerBct.width;
      const bottom = top + menusContainerBct.height;

      if (bottom > totalHeight) {
        // 目前判断下方是否超出即可
        // 向上
        menusContainer.style.top =
          positionElementBct.top - menusContainerBct.height + "px";
      } else {
        menusContainer.style.top = top + "px";
      }

      // menusContainer.style.width = positionElementBct.width + 'px'
      menusContainer.style.left = left + "px";
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

  return (
    <div ref={ref} className={css.colorSketch}>
      <Sketch color={sketchColor()} onChange={onChange} />
    </div>
  );
}
