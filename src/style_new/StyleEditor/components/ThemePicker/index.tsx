import React, { useCallback, useMemo, useRef, useEffect } from "react";
import { EditorProps } from "@/interface";
import css from "./style.less";

interface ThemePickerProps {
  color: string;
  onChangeComplete: (color: string) => void;
  open: boolean;
  onRequestClose: () => void;
  positionElement: React.RefObject<HTMLDivElement>;
}

export default function ({
  color,
  onChangeComplete,
  open,
  onRequestClose,
  positionElement,
}: ThemePickerProps) {
  // const THEME_LIST: any[] = (window as any)['fangzhou-themes'] || [];
  const handleClickOutside = (event:MouseEvent) => {
    if (pickerRef.current && !pickerRef.current.contains(event.target as Node)) {
      onRequestClose();
    }
  };

  useEffect(() => {
    if (open) {
      document.addEventListener("mousedown", handleClickOutside);
    } else {
      document.removeEventListener("mousedown", handleClickOutside);
    }

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [open]);

  //mock的数据
  const THEME_LIST: any[] = window.getTheme?.() || [];

  const pickerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (open && pickerRef.current && positionElement.current) {
      const menusContainer = pickerRef.current;
      const positionElementBct =
        positionElement.current.getBoundingClientRect();
      const menusContainerBct = menusContainer.getBoundingClientRect();
      const totalHeight =
        window.innerHeight || document.documentElement.clientHeight;
      const top = positionElementBct.top + positionElementBct.height;
      const right = positionElementBct.left + positionElementBct.width;
      const letf = right - menusContainerBct.width;
      const bottom = top + menusContainerBct.height;

      if (bottom > totalHeight) {
        menusContainer.style.top =
          positionElementBct.top - menusContainerBct.height + "px";
      } else {
        menusContainer.style.top = top + "px";
      }

      menusContainer.style.left = letf + "px";
      menusContainer.style.visibility = "visible";
    } else {
      if (pickerRef.current) {
        pickerRef.current.style.visibility = "hidden";
      }
    }
  }, [open, positionElement]);

  //判断主题列表是否为空
  if (!THEME_LIST.length) {
    return null;
  }
  const themeList = useMemo(() => {
    return THEME_LIST.map(({ id, name, description }) => {
      return (
        <div
          className={`
            ${css.themeItem} 
            ${`var(${id})` === color ? css.selected : ""}
          `}
          onClick={() => onChangeComplete(`var(${id})`)}
        >
          <div
            className={css.dot}
            style={{ background: `var(${id}, rgba(0, 0, 0, 0.25))` }}
          ></div>
          <div className={css.right}>
            <div className={css.text}>{name}</div>
            <div className={css.desc}>{description}</div>
          </div>
        </div>
      );
    });
  }, [color]);
  return (
    <>
      {open && (
        <div ref={pickerRef} className={css.themePicker}>
          {themeList}
        </div>
      )}
    </>
  );
}
