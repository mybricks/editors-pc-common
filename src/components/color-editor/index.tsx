import React, { CSSProperties } from "react";
import { evt, useComputed, useObservable } from "@mybricks/rxui";
import { createPortal } from "react-dom";
import ColorPicker from "../color-picker";
import ThemePicker from "../theme-picker";
import css from "./index.less";

const Svg = ({ color }: { color: string }) => (
  <svg
    t="1647577777379"
    class="icon"
    viewBox="0 0 1024 1024"
    version="1.1"
    xmlns="http://www.w3.org/2000/svg"
    p-id="3227"
    width="12"
    height="12"
  >
    <path
      d="M62.296463 576.23471l64.234709-64.23471 85.676565 85.646279-42.853425 42.853425a121.140424 121.140424 0 0 0 0 171.292559l42.853425 42.853425a121.140424 121.140424 0 0 0 171.292559 0l214.145983-214.145984a121.140424 121.140424 0 0 0 0-171.322844l-42.823139-42.823139a120.080445 120.080445 0 0 0-24.440081-18.413345l88.705075-88.67479 85.64628 85.64628a211.995741 211.995741 0 0 1 0 299.822548l-256.969124 256.969123a211.995741 211.995741 0 0 1-299.822548 0l-85.646279-85.646279a211.995741 211.995741 0 0 1 0-299.822548z"
      fill={color}
      p-id="3228"
      data-spm-anchor-id="a313x.7781069.0.i2"
    ></path>
    <path
      d="M961.703537 447.76529l-64.234709 64.23471-85.676565-85.646279 42.853425-42.853425a121.140424 121.140424 0 0 0 0-171.292559l-42.853425-42.853425a121.140424 121.140424 0 0 0-171.292559 0l-214.145983 214.145984a121.140424 121.140424 0 0 0 0 171.322844l42.823139 42.823139a120.080445 120.080445 0 0 0 24.440081 18.413345L404.911866 704.734414l-85.64628-85.64628a211.995741 211.995741 0 0 1 0-299.822548l256.969124-256.969123a211.995741 211.995741 0 0 1 299.822548 0l85.646279 85.646279a211.995741 211.995741 0 0 1 0 299.822548z"
      fill={color}
      p-id="3229"
      data-spm-anchor-id="a313x.7781069.0.i1"
    ></path>
  </svg>
);

function isTheme(color: string) {
  return typeof color === "string" && color.match(/^var\(--(.*)\)$/);
}

export default function ColorEditor({
  value = "transparent",
  onChange,

  style,
}: {
  value?: string;
  onChange: (color: string) => void;
  style?: CSSProperties;
}) {
  const THEME_LIST: any[] = (window as any)["fangzhou-themes"] || [];
  const ctx = useObservable(
    class {
      color: string | any = value;

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

  const colorPickerPopup = useComputed(() => {
    if (ctx.colorVisible) {
      const body = document.body;
      const targetBoundingClientRect = (
        ctx.ele as any
      )?.getBoundingClientRect();
      const top =
        targetBoundingClientRect.top + targetBoundingClientRect.height + 5;
      const style: any = {};
      if (window.innerHeight - top < 333) {
        style.top =
          (targetBoundingClientRect.top - 333 > 0
            ? targetBoundingClientRect.top - 333
            : 0) + "px";
      } else {
        style.top = top - 4 + "px";
      }
      style.right =
        window.innerWidth -
        targetBoundingClientRect.x -
        targetBoundingClientRect.width;

      return createPortal(
        <div className={css.popup} onClick={ctx.toggleColorPicker}>
          <div onClick={evt().stop} style={style}>
            <ColorPicker
              color={ctx.color}
              onChangeComplete={ctx.setColorComplete}
            />
          </div>
        </div>,
        body
      );
    }
  });

  const themePickerPopup = useComputed(() => {
    if (ctx.themeVisible) {
      const body = document.body;
      const targetBoundingClientRect = (
        ctx.ele as any
      )?.getBoundingClientRect();
      const top =
        targetBoundingClientRect.top + targetBoundingClientRect.height + 5;
      const style: any = {};
      if (window.innerHeight - top < 350) {
        style.top =
          (targetBoundingClientRect.top - 350 > 0
            ? targetBoundingClientRect.top - 350
            : 0) + "px";
      } else {
        style.top = top - 4 + "px";
      }
      style.right =
        window.innerWidth -
        targetBoundingClientRect.x -
        targetBoundingClientRect.width;

      return createPortal(
        <div className={css.popup} onClick={ctx.toggleThemePicker}>
          <div onClick={evt().stop} style={style}>
            <ThemePicker
              color={ctx.color}
              onChangeComplete={ctx.setColorComplete}
            />
            theme
          </div>
        </div>,
        body
      );
    }
  });

  return (
    <div
      className={css.colorEditor}
      ref={(ele) => ele && (ctx.ele = ele)}
      style={style}
    >
      <div className={css.content}>
        <div
          className={css.now}
          style={{ background: ctx.getColorStr() }}
          onClick={ctx.toggleColorPicker}
        />

        {THEME_LIST.length ? (
          <div className={css.btn} onClick={ctx.toggleThemePicker}>
            {isTheme(ctx.color) ? <Svg color={ctx.color} /> : null}
          </div>
        ) : null}
      </div>
      {colorPickerPopup}
      {themePickerPopup}
    </div>
  );
}
