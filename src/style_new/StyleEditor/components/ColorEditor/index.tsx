import React, {
  useEffect,
  useMemo,
  useState,
  useCallback,
  CSSProperties,
  useRef,
} from "react";
import { createPortal } from "react-dom";
import { evt, useComputed, useObservable } from "@mybricks/rxui";
import ColorUtil from "color";
import { Panel, Colorpicker, Unbinding } from "../";
import css from "./index.less";
import ThemePicker from "../ThemePicker";

interface ColorEditorProps {
  defaultValue: any;
  style?: CSSProperties;
  onChange: (value: any) => void;
  tip?: string;
}

export function ColorEditor({
  defaultValue,
  style = {},
  onChange,
  tip,
}: ColorEditorProps) {
  const themePickerRef = useRef<HTMLDivElement>(null);

  const [value, setValue] = useState(getHex(defaultValue));
  const [finalValue, setFinalValue] = useState(value);

  //手动input输入过程中，对不完整的颜色值进行补全处理，暂存到finalValue
  const handleInputChange = useCallback((e) => {
    const value = e.target.value;
    setValue(value);
    try {
      const hex = getHex(value);
      setFinalValue(hex);
      onChange(hex);
    } catch (e) {console.log(e)}
  }, []);

  //手动input完成输入后，如果输入的值与最终值不一致，则将最终值（finalValue）赋给输入框
  const handleInputBlur = useCallback(() => {
    if (value !== finalValue) {
      setValue(finalValue);
    }
  }, [value, finalValue]);


  const handleColorpickerChange = useCallback((color) => {
    const rawhex = color.hexa;
    //对hex进行处理，使之符合规范
    const hex = getHex(rawhex);
    setValue(hex);
    setFinalValue(hex);
    onChange(hex);
    // onChange('var(--theme-color)')
  }, []);

  const input = useMemo(() => {
    return (
      <input
        value={value}
        className={css.input}
        onChange={handleInputChange}
        onBlur={handleInputBlur}
      />
    );
  }, [value]);

  const block = useMemo(() => {
    return (
      <Colorpicker value={finalValue} onChange={handleColorpickerChange}>
        <div
          className={css.block}
          style={{
            background:
              new ColorUtil(finalValue).alpha() !== 0
                ? finalValue
                : 'url("data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAYAAAAf8/9hAAAAAXNSR0IArs4c6QAAADFJREFUOE9jZGBgEGHAD97gk2YcNYBhmIQBgWSAP52AwoAQwJvQRg1gACckQoC2gQgAIF8IscwEtKYAAAAASUVORK5CYII=") left center, white',
          }}
        />
      </Colorpicker>
    );
  }, [finalValue]);

  const [themePickerOpen, setThemePickerOpen] = useState(false);

  useEffect(() => {
    console.log("themePickerOpen", themePickerOpen);
    console.log("value", value);
    console.log("finalValue", finalValue);
  }, [themePickerOpen]);

  const theme = useMemo(() => {
    return (
      <>
        <div
          ref={themePickerRef}
          className={css.theme}
          onClick={() => {
            setThemePickerOpen(true);
          }}
        >
          <div className={css.unBinding}>
            <Unbinding />
          </div>
        </div>
        <ThemePicker
          open={themePickerOpen}
          color=""
          onChangeComplete={(e) => {
            setThemePickerOpen(false);
            if (e.startsWith('var')) {
              const cssVarName = e.match(/var\((.*)\)/)[1];
              const cssVarValue = getComputedStyle(document.querySelector("#root > div")).getPropertyValue(cssVarName).trim();
              handleColorpickerChange({ hexa: getHex(cssVarValue) });
              console.log("通过变脸设置上颜色", { hexa: getHex(cssVarValue) });
            } else {
              handleColorpickerChange({ hexa: getHex(e) });
              console.log("通过颜色设置上颜色", { hexa: getHex(e) });
            }
          }}
          onRequestClose={() => {
            setThemePickerOpen(false);
          }}
          positionElement={themePickerRef}
        ></ThemePicker>
      </>
    );
  }, [finalValue, themePickerOpen]);

  return (
    <Panel.Item style={style}>
      <div className={css.color} data-mybricks-tip={tip}>
        {block}
        {input}
        {theme}
      </div>
    </Panel.Item>
  );
}

//补全输入过程中不完整的颜色hex值
const getHex = (str: string) => {
  const color = new ColorUtil(str);
  return (color.alpha() === 1 ? color.hex() : color.hexa()).toLowerCase();
};


const varToHex = (color: string) => {
  const match = color.match(/var\((.*)\)/);
  if (match) {
    const cssVarName = match[1];
    const cssVarValue = getComputedStyle(
      document.querySelector("#root > div")
    ).getPropertyValue(cssVarName);
    return cssVarValue.trim() || "transparent";
  } else {
    return color;
  }
};
