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
import { varToHex } from "@/utils";

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
  const ctx = useObservable(
    class {
      color: string | any = "transparent";

      ele: HTMLElement | undefined;

      colorVisible = false;

      themeVisible = false;

      getColorStr() {
        if (this.color) {
          if (typeof this.color === "string") {
            return this.color;
          } else if (typeof this.color === "object") {
            return `rgba(${this.color.r},${this.color.g},${this.color.b},${this.color.a})`;
          }
        }
      }

      toggleColorPicker() {
        this.colorVisible = !this.colorVisible;
      }

      toggleThemePicker() {
        this.themeVisible = !this.themeVisible;
      }

      setColor(color: { rgb: string | object }) {
        this.color = color.rgb;
      }

      setColorComplete(color: string) {
        this.color = color;
        onChange(color);
      }
    }
  );

  const [value, setValue] = useState(getHex(defaultValue));
  const [finalValue, setFinalValue] = useState(value);

  const handleInputChange = useCallback((e) => {
    const value = e.target.value;
    setValue(value);
    try {
      const hex = getHex(value);
      setFinalValue(hex);
      onChange(hex);
    } catch {}
  }, []);

  const handleInputBlur = useCallback(() => {
    if (value !== finalValue) {
      setValue(finalValue);
    }
  }, [value, finalValue]);

  const handleColorpickerChange = useCallback((color) => {
    const hex = getHex(color.hexa);
    setValue(hex);
    setFinalValue(hex);
    onChange(hex);
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
  }, [themePickerOpen]);


  const theme = useMemo(() => {
    const varToHex = (color: string) => {
      const arr = color?.match(/^var\((.*)\)$/);
      if (arr) {
        const name = arr[1];
        console.log("name", name)
        return (
          getComputedStyle(document.body).getPropertyValue(name) ||
          "transparent"
        );
      } else {
        return color;
      }
    };

    return (
      <>
        <div
          className={css.theme}
          onClick={() => {
            console.log("点击了theme", finalValue);
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
            console.log("onChangeComplete", e);
            setThemePickerOpen(false);
            setValue(varToHex(e));
          }}
          onRequestClose={() => {
            console.log("onRequestClose");
          }}
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

const getHex = (str: string) => {
  const color = new ColorUtil(str);
  return (color.alpha() === 1 ? color.hex() : color.hexa()).toLowerCase();
};
