import React, { useRef, useMemo, useState, useEffect, useReducer, useCallback, CSSProperties } from "react";
import { createPortal } from "react-dom";

import ColorUtil from "color";

import { Tooltip } from "antd";

import { Dropdown, BindingOutlined, QuestionCircleOutlined, TransparentColorOutlined } from "../../components";
import { Panel, Colorpicker, UnbindingOutlined } from "../";

import css from "./index.less";

type ColorOption = {
  label: string;
  value: string;
  resetValue?: string;
};
type ColorOptions = Array<ColorOption>;

interface ColorEditorProps {
  options?: ColorOptions;
  defaultValue: any;
  style?: CSSProperties;
  onChange: (value: any) => void;
}

interface State {
  /** 可修改值 */
  value: string;
  /** 最终值 */
  finalValue: string;
  /** 非色值 */
  nonColorValue: boolean;
  /** 非色值选项 */
  options: ColorOptions;

  showPreset: boolean;

  optionsValueToAllMap: any;
}

function getInitialState({ value, options }: { value: string; options: ColorOptions }): State {
  let finalValue = value;
  let nonColorValue = false;

  try {
    const color = new ColorUtil(value);
    finalValue = (color.alpha() === 1 ? color.hex() : color.hexa()).toLowerCase();
  } catch {
    nonColorValue = true;
  }

  const optionsValueToAllMap: any = {};

  const colorOptions = Array.isArray(window.MYBRICKS_CSS_VARIABLE_LIST) ? window.MYBRICKS_CSS_VARIABLE_LIST : [];

  const showPreset = !!colorOptions.length;

  if (showPreset) {
    colorOptions.forEach(({ title, options }) => {
      if (Array.isArray(options)) {
        options.forEach((option) => {
          optionsValueToAllMap[option.value] = option;
        });
      }
    });
  }

  const result = {
    value: finalValue,
    finalValue: nonColorValue ? "" : finalValue,
    nonColorValue,
    showPreset,
    options: colorOptions,
    optionsValueToAllMap,
  };

  if (nonColorValue) {
    const option = optionsValueToAllMap[finalValue];
    if (option) {
      result.value = option.label;
      result.finalValue = finalValue;
    }
  }

  return result;
}

function reducer(state: State, action: any): State {
  return {
    ...state,
    ...action,
  };
}

// const COLOR_OPTIONS = [
//   {label: 'inherit', value: 'inherit'}
// ]

export function ColorEditor({ defaultValue, style = {}, onChange, options = [] }: ColorEditorProps) {
  const presetRef = useRef<HTMLDivElement>(null);
  const [state, dispatch] = useReducer(reducer, getInitialState({ value: defaultValue, options }));
  const [show, setShow] = useState(false);
  const [open, setOpen] = useState(false);

  const onPresetClick = useCallback(() => {
    setShow(true);
    setOpen(true);
  }, []);

  const handleColorpickerChange = useCallback((color) => {
    const hex = getHex(color.hexa);

    dispatch({
      value: hex,
      nonColorValue: false,
      finalValue: hex,
    });
    onChange(hex);
  }, []);

  const [colorString, opacityNumber] = useMemo(() => {
    try {
      const color = new ColorUtil(state.value);
      const alpha = color.alpha();
      return [color.hex(), isNaN(alpha) ? 1 : alpha];
    } catch (err) {
      return [state.value, 1];
    }
  }, [state.value, state.nonColorValue]);

  const handleInputChange = useCallback(
    (value) => {
      let finalValue = state.value;

      try {
        console.log(opacityNumber);
        const color = new ColorUtil(value).alpha(opacityNumber);
        finalValue = color.hexa();
        console.log("change", opacityNumber, color.hexa());
        dispatch({
          value: finalValue,
          finalValue,
        });
      } catch (e) {
        console.log(e);
      }
    },
    [state.value, opacityNumber]
  );

  const handleInputBlur = useCallback(() => {
    setUserInput(new ColorUtil(state.value).hex());
    const { value, finalValue } = state;
    if (value !== finalValue) {
      dispatch({
        value: finalValue,
      });
    }
  }, [state.value, state.finalValue]);

  const [userInput, setUserInput] = useState(colorString);
  const isFocus = useRef(false);
  useEffect(() => {
    if (!isFocus.current) {
      setUserInput(colorString);
    }
  }, [colorString]);
  const input = useMemo(() => {
    const { value, nonColorValue } = state;
    if (nonColorValue) {
      return (
        <div className={css.text} onClick={onPresetClick}>
          {value}
        </div>
      );
    }
    return (
      <input
        value={userInput}
        className={css.input}
        onFocus={() => {
          isFocus.current = true;
        }}
        onChange={(e) => {
          handleInputChange(e.target.value);
          setUserInput(e.target.value);
        }}
        onBlur={(e) => {
          isFocus.current = false;
          handleInputBlur(e)
        }}
        disabled={nonColorValue}
      />
    );
  }, [userInput, state.nonColorValue]);

  const handleOpacityChange = useCallback(
    (e) => {
      const value = e.target.value;
      // const state: any = {
      //   value
      // }

      let finalValue = state.value;

      try {
        const color = new ColorUtil(state.value).alpha(value / 100);
        finalValue = color.hexa();
      } catch {}

      onChange(finalValue);
      dispatch({
        value: finalValue,
        finalValue,
      });
    },
    [state.value]
  );

  const inputRef = useRef(null);

  const opacityInput = useMemo(() => {
    if (state.nonColorValue || (isNaN(opacityNumber) && opacityNumber !== undefined)) {
      return <></>;
    }

    return (
      <div className={css.opacity}>
        <input
          ref={inputRef}
          type="inputNumber"
          value={parseInt(opacityNumber * 100)}
          onChange={handleOpacityChange}
          onBlur={handleInputBlur}
        />
        <div onClick={() => inputRef.current?.focus?.()}>%</div>
      </div>
    );
  }, [opacityNumber, state.nonColorValue, handleOpacityChange]);

  const block = useMemo(() => {
    const { finalValue, nonColorValue } = state;
    const style = nonColorValue
      ? {
          backgroundColor: finalValue || "transparent",
          // cursor: 'not-allowed'
        }
      : {
          backgroundColor: finalValue,
        };

    let pickerValue = finalValue;

    if (nonColorValue) {
      const option = state.optionsValueToAllMap[finalValue];
      if (option?.resetValue) {
        pickerValue = option.resetValue;
      }
    }

    return (
      <Colorpicker
        // value={finalValue}
        value={pickerValue}
        onChange={handleColorpickerChange}
        // disabled={nonColorValue}
        className={css.colorPickerContainer}
      >
        <div className={css.block} style={style} />
        <div className={css.icon}>
          {nonColorValue ? finalValue ? <></> : <QuestionCircleOutlined /> : <TransparentColorOutlined />}
        </div>
      </Colorpicker>
    );
  }, [state.finalValue, state.nonColorValue]);

  // /** 绑定 */
  // const bind = useCallback((value) => {
  //   const option = state.options.find((option) => option.value === value) as ColorOption
  //   const { label, resetValue } = option

  //   dispatch({
  //     nonColorValue: true,
  //     value: label || value,
  //     finalValue: resetValue || ''
  //   })
  // }, [])

  // /** 解除绑定 */
  // const unBind = useCallback(() => {
  //   const { value, finalValue } = state
  //   const option = state.options.find((option) => option.resetValue ? (option.resetValue === finalValue) : option.value === value) as ColorOption
  //   const resetValue = option?.resetValue || ''
  //   const hex = getHex(resetValue || '')

  //   dispatch({
  //     nonColorValue: false,
  //     value: hex,
  //     finalValue: hex
  //   })
  // }, [state.nonColorValue])

  /** 绑定操作按钮 */
  // const preset = useMemo(() => {
  //   const { options, finalValue, nonColorValue } = state

  //   return (
  //     <div
  //       className={`${css.preset} ${nonColorValue ? css.binding : css.unBinding}`}
  //       data-mybricks-tip={nonColorValue ? '解除绑定' : '绑定'}
  //     >
  //       {nonColorValue ? (
  //         <div onClick={unBind} className={css.iconContainer}>
  //           <BindingOutlined />
  //         </div>
  //       ) : (
  //         <Dropdown
  //           className={css.iconContainer}
  //           options={options}
  //           value={finalValue}
  //           onClick={bind}
  //         >
  //           <UnbindingOutlined />
  //         </Dropdown>
  //       )}
  //     </div>
  //   )
  // }, [state.finalValue, state.nonColorValue])

  const preset = useMemo(() => {
    if (!state.showPreset) {
      return null;
    }
    return (
      <div ref={presetRef} className={css.preset} onClick={onPresetClick}>
        {/* <BindOutlined /> */}
        <UnbindingOutlined />
      </div>
    );
  }, []);

  const onPresetColorChange = useCallback((value) => {
    onChange(value);

    const option = state.optionsValueToAllMap[value];

    dispatch({
      nonColorValue: true,
      value: option.label || value,
      finalValue: option.resetValue || "",
    });

    // setOpen(false)
  }, []);

  const handleClick = useCallback(() => {
    setOpen(false);
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
    <Panel.Item style={style} className={css.container}>
      <div
        // className={`${css.color}${state.nonColorValue ? ` ${css.disabled}` : ''}`}
        className={css.color}
      >
        {block}
        {input}
        {opacityInput}
      </div>
      {preset}
      {show &&
        createPortal(
          <PresetColorPanel
            // value={value}
            options={state.options}
            positionElement={presetRef.current!}
            open={open}
            onChange={onPresetColorChange}
          />,
          document.body
        )}
    </Panel.Item>
  );
}

const getHex = (str: string) => {
  let finalValue = str;
  try {
    const color = new ColorUtil(str);
    finalValue = (color.alpha() === 1 ? color.hex() : color.hexa()).toLowerCase();
  } catch {}

  return finalValue;
};

function BindOutlined() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="16"
      height="16"
      viewBox="0 0 24 24"
      aria-hidden="true"
      fill="currentColor"
    >
      <path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M7.5 9C8.32843 9 9 8.32843 9 7.5C9 6.67157 8.32843 6 7.5 6C6.67157 6 6 6.67157 6 7.5C6 8.32843 6.67157 9 7.5 9ZM7.5 18C8.32843 18 9 17.3284 9 16.5C9 15.6716 8.32843 15 7.5 15C6.67157 15 6 15.6716 6 16.5C6 17.3284 6.67157 18 7.5 18ZM18 7.5C18 8.32843 17.3284 9 16.5 9C15.6716 9 15 8.32843 15 7.5C15 6.67157 15.6716 6 16.5 6C17.3284 6 18 6.67157 18 7.5ZM16.5 18C17.3284 18 18 17.3284 18 16.5C18 15.6716 17.3284 15 16.5 15C15.6716 15 15 15.6716 15 16.5C15 17.3284 15.6716 18 16.5 18Z"
      ></path>
    </svg>
  );
}

function PresetColorPanel({ open, positionElement, onChange, options, value }: any) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const menusContainer = ref.current!;
    if (open) {
      const positionElementBct = positionElement.getBoundingClientRect();
      const menusContainerBct = ref.current!.getBoundingClientRect();
      const totalHeight = window.innerHeight || document.documentElement.clientHeight;
      const top = positionElementBct.top + positionElementBct.height;
      const right = positionElementBct.left + positionElementBct.width;
      const letf = right - positionElementBct.width;
      const bottom = top + menusContainerBct.height;

      if (bottom > totalHeight) {
        // 目前判断下方是否超出即可
        // 向上
        menusContainer.style.top = positionElementBct.top - menusContainerBct.height + "px";
      } else {
        menusContainer.style.top = top + "px";
      }

      // 保证完全展示
      if (menusContainerBct.width > positionElementBct.width) {
        menusContainer.style.left = letf - menusContainerBct.width + positionElementBct.width + "px";
      } else {
        menusContainer.style.width = positionElementBct.width + "px";
        menusContainer.style.left = letf + "px";
      }

      menusContainer.style.visibility = "visible";
    } else {
      menusContainer.style.visibility = "hidden";
    }
  }, [open]);

  const onColorCircelClick = useCallback(({ label, value, resetValue }) => {
    onChange(value);
  }, []);

  return (
    <div ref={ref} className={css.panel} onClick={(e) => e.stopPropagation()}>
      {/* {options.map(({label, value}, index) => {
        return (
          <div key={index} className={css.item} onClick={() => onClick(value)}>
            {value === currentValue ? <CheckOutlined /> : <></>}
            {label}
          </div>
        )
      })} */}
      {options.map(({ title, options }) => {
        return (
          <div key={title} className={css.catelog}>
            <div className={css.title}>{title}</div>
            <div className={css.colorList}>
              {options.map(({ label, value, resetValue }) => {
                return (
                  <div key={label + value} className={css.colorItem}>
                    {/* TODO: 临时先用antd组件 */}
                    <Tooltip title={label}>
                      <div
                        className={css.circel}
                        style={{ backgroundColor: value }}
                        onClick={() => onColorCircelClick({ label, value, resetValue })}
                      ></div>
                    </Tooltip>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}
