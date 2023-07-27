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
import { Panel, Colorpicker, Unbinding, Binding } from "../";
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
  const THEME_LIST: any[] = window.getTheme?.() || [];
  const [value, setValue] = useState(getHex(defaultValue));
  const [finalValue, setFinalValue] = useState(value);
  const [isBinding, setIsBinding] = useState(
    defaultValue === void 0 ? false : !!checkIfVar(defaultValue)
  );
  const handleBindingClick = () => {
    if (isBinding) {
      setValue(varToHex(finalValue));
      setFinalValue(varToHex(finalValue));
      setIsBinding(false);
      onChange(varToHex(finalValue));
      return;
    }
    if (!isBinding) {
      setThemePickerOpen(true);
      return;
    }
  };


  //手动input输入过程中，对不完整的颜色值进行补全处理，暂存到finalValue
  const handleInputChange = useCallback((e) => {
    const value = e.target.value;
    setValue(value);
    try {
      const hex = getHex(value);
      setFinalValue(hex);
      onChange(hex);
    } catch (e) {
      console.log(e);
    }
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
  }, []);

  const handleThemePickerChange = useCallback((color) => {
    setIsBinding(true);
    setValue(color);
    setFinalValue(color);
    onChange(color);
  }, []);



  const input = useMemo(() => {
    const style = isBinding ? { color: "#BFBFBF", cursor: "not-allowed" } : {};
    const title = isBinding ? "颜色被绑定，请点击右侧图标解绑" : "";
    let inputValue = value;
    const themeItem = THEME_LIST.find((item) => {
      return item.id === getVarName(inputValue);
    });
    if (themeItem) {
      inputValue = themeItem.name;
    }
    if (checkIfVar(inputValue)) {
      inputValue = varToHex(inputValue);
    }
    return (
      <input
        value={inputValue}
        className={css.input}
        onChange={handleInputChange}
        onBlur={handleInputBlur}
        disabled={isBinding}
        style={style}
        title={title}
      />
    );
  }, [value, isBinding]);

  const block = useMemo(() => {
    let pickerFinalValue = finalValue;
    if (checkIfVar(pickerFinalValue)) {
      pickerFinalValue = varToHex(pickerFinalValue);
    }
    const style = isBinding
      ? {
          background:
            new ColorUtil(pickerFinalValue).alpha() !== 0
              ? pickerFinalValue
              : 'url("data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAYAAAAf8/9hAAAAAXNSR0IArs4c6QAAADFJREFUOE9jZGBgEGHAD97gk2YcNYBhmIQBgWSAP52AwoAQwJvQRg1gACckQoC2gQgAIF8IscwEtKYAAAAASUVORK5CYII=") left center, white',
          cursor: "not-allowed",
        }
      : {
          background:
            new ColorUtil(pickerFinalValue).alpha() !== 0
              ? pickerFinalValue
              : 'url("data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAYAAAAf8/9hAAAAAXNSR0IArs4c6QAAADFJREFUOE9jZGBgEGHAD97gk2YcNYBhmIQBgWSAP52AwoAQwJvQRg1gACckQoC2gQgAIF8IscwEtKYAAAAASUVORK5CYII=") left center, white',
        };

    return (
      <Colorpicker
        value={pickerFinalValue}
        onChange={handleColorpickerChange}
        disabled={isBinding}
      >
        <div className={css.block} style={style} />
      </Colorpicker>
    );
  }, [finalValue, isBinding]);

  const [themePickerOpen, setThemePickerOpen] = useState(false);

  const theme = useMemo(() => {
    return (
      <>
        <div
          ref={themePickerRef}
          className={css.theme}
        >
          {isBinding ? (
            <div
              className={css.Binding}
              title="点击解绑"
              onClick={handleBindingClick}
            >
              <Binding />
            </div>
          ) : (
            <div className={css.unBinding} onClick={handleBindingClick}>
              <Unbinding />
            </div>
          )}
        </div>
        <ThemePicker
          open={themePickerOpen}
          color=""
          onChangeComplete={(e) => {
            setThemePickerOpen(false);
            handleThemePickerChange(e);
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
        {THEME_LIST.length > 0 && theme}
      </div>
    </Panel.Item>
  );
}

//补全输入过程中不完整的颜色hex值
const getHex = (str: string) => {
  if (checkIfVar(str)) return str;
  if (str === "") {
    const color = new ColorUtil("#000000");
    return (color.alpha() === 1 ? color.hex() : color.hexa()).toLowerCase();
  }
  const color = new ColorUtil(str);
  return (color.alpha() === 1 ? color.hex() : color.hexa()).toLowerCase();
};

const varToHex = (color: string) => {
  const match = color.match(/var\((.*)\)/);
  if (match) {
    const cssVarName = match[1];
    let cssVarValue = getComputedStyle(
      document.querySelector("#root > div")
    ).getPropertyValue(cssVarName);
    cssVarValue = getHex(cssVarValue);
    return cssVarValue.trim() || "transparent";
  } else {
    return color;
  }
};

const checkIfVar = (color: string) => {
  if (color === void 0) return false;
  const match = color.match(/var\((.*)\)/);
  if (match) {
    return true;
  } else {
    return false;
  }
};

const getVarName = (color: string) => {
  const match = color.match(/var\((.*)\)/);
  if (match) {
    return match[1];
  } else {
    return "";
  }
};
