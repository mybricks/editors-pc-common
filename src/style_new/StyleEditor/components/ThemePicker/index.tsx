import React, { useCallback, useMemo, useRef, useEffect } from "react";
import { EditorProps } from "@/interface";
import css from "./style.less";

interface ThemePickerProps {
  color: string;
  onChangeComplete: (color: string) => void;
  open: boolean;
  onRequestClose: () => void;
}

export default function ({
  color,
  onChangeComplete,
  open,
  onRequestClose,
}: ThemePickerProps) {
  // const THEME_LIST: any[] = (window as any)['fangzhou-themes'] || [];
  //mock的数据
  const THEME_LIST: any[] = [
    {
      id: "--theme-color",
      name: "主题色",
      description: "主题色",
    },
    {
      id: "--theme-color-1",
      name: "主题色1",
      description: "主题色1",
    },
  ];

  const pickerRef = useRef<HTMLDivElement>(null);
  const childRef = useRef<HTMLDivElement>(null);
  const positionElement = pickerRef.current!;
  const ref = childRef;


  useEffect(() => {
    if(open){
      console.log("打开theme选择弹窗");
    }else{
      console.log("关闭theme选择弹窗");
    }
  }, [open]);

  if (!THEME_LIST.length) {
    console.log("THEME_LIST: ", THEME_LIST);
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
