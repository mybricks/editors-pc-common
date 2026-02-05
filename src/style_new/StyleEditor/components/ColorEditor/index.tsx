import React, {
  useRef,
  useMemo,
  useState,
  useEffect,
  useReducer,
  useCallback,
  CSSProperties,
} from "react";
import ColorUtil from "color";

import {
  QuestionCircleOutlined,
  TransparentColorOutlined,
} from "../../components";
import { Panel, Colorpicker, UnbindingOutlined, BindingOutlined } from "../";
import { color2rgba, getRealKey } from "../../utils";

import css from "./index.less";

const IMAGE_RELATED_KEYS = ['backgroundSize', 'backgroundRepeat', 'backgroundPosition'] as const;
const ALL_BACKGROUND_KEYS = ['backgroundColor', 'backgroundImage', ...IMAGE_RELATED_KEYS] as const;

const fixHex = (hex: string) => {
  if (hex[hex.length - 1] === "0") {
    return hex.replace(/00$/, "FF");
  }
  return hex;
};

const getHex = (str: string) => {
  let finalValue = str;
  try {
    const color = new ColorUtil(str);
    finalValue = (
      color.alpha() === 1 ? color.hex() : color.hexa()
    ).toLowerCase();
  } catch {}
  return finalValue;
};


const UnBindingIcon = <svg width="24" height="20" fill="currentColor" viewBox="0 0 24 24"><path fill="var(--color-icon)" d="M8.111 11.648a.5.5 0 0 1 .708.707l-1.232 1.232a2 2 0 0 0 2.828 2.828l1.232-1.232a.5.5 0 0 1 .707.707l-1.232 1.232A3 3 0 0 1 6.88 12.88zM6.147 6.147a.5.5 0 0 1 .629-.065l.078.065 11 11 .064.078a.5.5 0 0 1-.693.693l-.078-.064-11-11-.065-.078a.5.5 0 0 1 .065-.63m6.844.627a3 3 0 0 1 4.238 4.237l-.107.111-1.232 1.233a.5.5 0 0 1-.707-.707l1.232-1.233.138-.151a2.002 2.002 0 0 0-2.815-2.815l-.15.138-1.233 1.232a.5.5 0 0 1-.707-.707L12.88 6.88z"></path></svg>

type ColorOption = {
  label: string;
  value: string;
  resetValue?: string;
  title?: string;
  options?: ColorOptions;
};
type ColorOptions = Array<ColorOption>;

interface ColorEditorProps {
  options?: ColorOptions;
  defaultValue: any;
  style?: CSSProperties;
  /** 
   * onChange 回调
   * - 当 showSubTabs=true 时，返回 { key: string; value: string } 或数组格式
   * - 当 showSubTabs=false 时，返回字符串格式（向后兼容）
   */
  onChange: (value: { key: string; value: string } | { key: string; value: string }[] | string) => void;
  onFocus?: () => void;
  keyMap?: Record<string, string>;
  useImportant?: boolean;
  showSubTabs?: boolean;
  upload?: (files: Array<File>, args: any) => Promise<Array<string>>;
  imageValue?: {
    backgroundImage?: string;
    backgroundSize?: string;
    backgroundRepeat?: string;
    backgroundPosition?: string;
  };
  /** 禁用纯色背景 tab */
  disableBackgroundColor?: boolean;
  /** 禁用背景图片 tab */
  disableBackgroundImage?: boolean;
  /** 禁用渐变 tab */
  disableGradient?: boolean;
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

function getInitialState({
  value,
  options,
  optionsValueToAllMap
}: {
  value: string;
  options: ColorOptions;
  optionsValueToAllMap: any
}): State {
  let finalValue = value;
  let nonColorValue = false;

  const isImage = value?.includes?.("url(");
  const isGradient = value?.includes?.("gradient");

  if (!isGradient && !isImage) {
    try {
      const color = new ColorUtil(value);
      finalValue = (
        color.alpha() === 1 ? color.hex() : color.hexa()
      ).toLowerCase();
    } catch {
      nonColorValue = true;
    }
  }

  const result: State = {
    value: finalValue,
    finalValue: nonColorValue ? "" : finalValue,
    nonColorValue,
    showPreset: false,
    options: [],
    optionsValueToAllMap,
  };

  if (nonColorValue) {
    const option = optionsValueToAllMap[finalValue];
    if (option) {
      result.value = option.name;
      result.finalValue = finalValue;
    }
  }

  return result;
}

function reducer(state: State, action: Partial<State>): State {
  return { ...state, ...action };
}

const getOptionsValueToAllMap = () => {
  const optionsValueToAllMap: any = {}

  if (window.MYBRICKS_THEME_PACKAGE_VARIABLES) {
    window.MYBRICKS_THEME_PACKAGE_VARIABLES.variables.forEach((variable: any) => {
      variable.configs.forEach((config: any) => {
        optionsValueToAllMap[`var(${config.key})`] = config;
      })
    })
  }

  return optionsValueToAllMap
}

export function ColorEditor({
  defaultValue,
  style = {},
  onChange,
  options = [],
  onFocus,
  keyMap = {},
  useImportant = false,
  showSubTabs = true,
  upload,
  imageValue,
  disableBackgroundColor,
  disableBackgroundImage,
  disableGradient,
}: ColorEditorProps) {
  const presetRef = useRef<HTMLDivElement>(null);

  const [optionsValueToAllMap] = useState(() => getOptionsValueToAllMap())

  const [state, dispatch] = useReducer(
    reducer,
    getInitialState({ value: defaultValue, options, optionsValueToAllMap })
  );
  const [colorPickerContext] = useState<{ open?: () => void }>({});

  const onPresetClick = useCallback(() => {
    colorPickerContext.open?.();
  }, []);

  const emitChange = useCallback((key: string, value: string) => {
    const realKey = getRealKey(keyMap, key);
    const finalValue = `${value}${useImportant ? "!important" : ""}`;


    if (showSubTabs) {
      onChange({ key: realKey, value: finalValue });
    } else {
      onChange(value);
    }
  }, [onChange, keyMap, useImportant, showSubTabs]);

  const handleColorpickerChange = useCallback((input: { key: string; value: string } | { key: string; value: string }[]) => {
    if (Array.isArray(input)) {
      const bgColor = input.find(item => item.key === 'backgroundColor');
      const bgImage = input.find(item => item.key === 'backgroundImage' && item.value !== 'none');

      if (bgImage) {
        dispatch({
          value: bgImage.value,
          nonColorValue: false,
          finalValue: bgImage.value,
        });
      } else if (bgColor) {
        const hex = getHex(bgColor.value);
        dispatch({
          value: hex,
          nonColorValue: false,
          finalValue: hex,
        });
      }

      if (showSubTabs) {
        const result = input.map(item => ({
          key: getRealKey(keyMap, item.key),
          value: `${item.value}${useImportant ? "!important" : ""}`
        }));
        onChange(result);
      }
      return;
    }

    const { key, value } = input;

    if (IMAGE_RELATED_KEYS.includes(key as typeof IMAGE_RELATED_KEYS[number])) {
      emitChange(key, value);
      return;
    }

    if (key === 'backgroundImage') {
      dispatch({
        value: value,
        nonColorValue: false,
        finalValue: value,
      });
      emitChange(key, value);
    } else {
      const hex = getHex(value);
      const rgbaValue = color2rgba(hex);
      dispatch({
        value: hex,
        nonColorValue: false,
        finalValue: hex,
      });
      emitChange(key, rgbaValue);
    }
  }, [emitChange, showSubTabs, keyMap, useImportant, onChange]);

  const [colorString, opacityNumber] = useMemo(() => {
    try {
      const color = new ColorUtil(state.value);
      const alpha = color.alpha();
      return [color.hex(), isNaN(alpha) ? 1 : alpha];
    } catch (err) {
      return [state.value, 1];
    }
  }, [state.value, state.nonColorValue]);

  useEffect(() => {
    const { options, nonColorValue, finalValue } = state;
    if (nonColorValue && options.length > 0) {
      const foundOption = options.find(
        (option) =>
          option.options &&
          option.options?.some((item) => item?.value === finalValue)
      );

      if (foundOption && foundOption?.options) {
        const matchedItem = foundOption?.options.find(
          (item) => item?.value === finalValue
        );
        if (matchedItem) {
          setCheckColor(
            matchedItem?.value + matchedItem?.label + matchedItem?.resetValue
          );
        }
      }
    }
  }, [state.finalValue, state.nonColorValue]);

  const handleInputChange = useCallback(
    (value: string) => {
      let finalValue = state.value;

      try {
        const color = new ColorUtil(value).alpha(opacityNumber);
        finalValue = fixHex(color.hexa());
        const rgbaValue = color2rgba(finalValue);
        emitChange('backgroundColor', rgbaValue);
        dispatch({
          value: finalValue,
          finalValue,
        });
      } catch { }
    },
    [state.value, opacityNumber, emitChange]
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
  const [checkColor, setCheckColor] = useState<string>("");
  const isFocus = useRef(false);
  useEffect(() => {
    if (!isFocus.current) {
      setUserInput(colorString);
    }
  }, [colorString]);
  const inputColorRef = useRef<HTMLInputElement>(null);
  const handlePaste = (event: React.ClipboardEvent<HTMLInputElement>) => {
    // 获取粘贴的文本
    const pastedText = event.clipboardData?.getData("text");
    // 检查文本的第一个字符是否为 '#' 且长度为7

    if (pastedText?.startsWith("#") && pastedText.length === 7) {
      event.preventDefault();
      // 阻止默认的粘贴行为
      inputColorRef.current!.value = pastedText;
      handleInputChange(pastedText);
    }
  };

  const handleReset = useCallback(() => {
    const defaultHex = '#FFFFFF';
    dispatch({
      value: defaultHex,
      nonColorValue: false,
      finalValue: defaultHex,
    });
    if (showSubTabs) {
      onChange(ALL_BACKGROUND_KEYS.map(key => ({ key, value: '' })));
    } else {
      emitChange('backgroundColor', defaultHex);
    }
  }, [showSubTabs, onChange, emitChange]);

  const input = useMemo(() => {
    const { value, nonColorValue, finalValue } = state;

    const isGradient = finalValue?.includes?.("gradient");
    if (isGradient) {
      return (
          <div className={css.text} style={{ marginLeft: 5 }} onClick={onPresetClick}>
            渐变色
          </div>
      );
    }

    const isImage = finalValue?.includes?.("url(");
    if (isImage) {
      return (
          <div className={css.text} style={{ marginLeft: 5 }} onClick={onPresetClick}>
            背景图
          </div>
      );
    }

    if (nonColorValue) {
      return (
        <>
          <div className={css.text} onClick={onPresetClick}>
            {value}
          </div>
          {finalValue && <div
            className={css.unbind}
            data-mybricks-tip={`解除绑定`}
            onClick={() => {
              const option = state.optionsValueToAllMap[finalValue];
              const hex = getHex(option.value)

              dispatch({
                nonColorValue: false,
                value: hex,
                finalValue: hex
              })
            }}
          >{UnBindingIcon}</div>}
        </>
      );
    }
    return (
      <input
        data-mybricks-tip={"支持16进制、RGB、RGBA、HSL、HSLA或颜色名称"}
        ref={inputColorRef}
        value={userInput}
        className={css.input}
        onFocus={() => {
          isFocus.current = true;
          onFocus && onFocus?.();
        }}
        onChange={(e) => {
          handleInputChange(e.target.value);
          setUserInput(e.target.value);
        }}
        onBlur={() => {
          isFocus.current = false;
          handleInputBlur();
        }}
        onPaste={handlePaste}
        disabled={nonColorValue}
      />
    );
  }, [userInput, state.nonColorValue, state.finalValue, onPresetClick, handleReset]);

  const handleOpacityChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const value = e.target.value;
      let finalValue = state.value;

      try {
        const color = new ColorUtil(state.value).alpha(Number(value) / 100);
        finalValue = color.hexa();
      } catch {}

      const rgbaValue = color2rgba(finalValue);
      emitChange('backgroundColor', rgbaValue);
      dispatch({
        value: finalValue,
        finalValue: finalValue,
      });
    },
    [state.value, emitChange]
  );

  const inputRef = useRef<HTMLInputElement>(null);

  const opacityInput = useMemo(() => {
    if (
      state.nonColorValue ||
      (isNaN(opacityNumber) && opacityNumber !== undefined)
    ) {
      return <></>;
    }

    return (
      <div className={css.opacity}>
        <input
          data-mybricks-tip={"透明度"}
          ref={inputRef}
          type="inputNumber"
          value={Math.round(opacityNumber * 100)}
          onChange={handleOpacityChange}
          onBlur={handleInputBlur}
        />
        <div onClick={() => inputRef.current?.focus?.()}>%</div>
      </div>
    );
  }, [opacityNumber, state.nonColorValue, handleOpacityChange]);

  const onBindingChange = useCallback((params: any) => {
    const { name, value, resetValue } = params;
    const rgbaValue = color2rgba(value);
    emitChange('backgroundColor', rgbaValue);

    dispatch({
      nonColorValue: true,
      value: name,
      finalValue: value
      // value: option.label || value,
      // finalValue: option.resetValue || "",
    });

    setCheckColor(value + name + resetValue);
  }, [])

  const block = useMemo(() => {
    const { finalValue, nonColorValue } = state;
    const isImage = finalValue?.includes?.("url(");
    const isGradient = finalValue?.includes?.("gradient");

    let style: React.CSSProperties;
    if (nonColorValue) {
      style = {
        backgroundColor: finalValue || "transparent",
      };
    } else if (isImage) {
      style = {
        backgroundImage: finalValue,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
      };
    } else if (isGradient) {
      style = {
        backgroundImage: finalValue,
      };
    } else {
      style = {
        backgroundColor: finalValue,
      };
    }

    let pickerValue = finalValue;

    if (nonColorValue) {
      const option = state.optionsValueToAllMap[finalValue];
      if (option?.resetValue) {
        pickerValue = option.resetValue;
      }
    }

    return (
      <Colorpicker
        context={colorPickerContext}
        // value={finalValue}
        value={pickerValue}
        onChange={handleColorpickerChange}
        onBindingChange={onBindingChange}
        // disabled={nonColorValue}
        className={css.colorPickerContainer}
        showSubTabs={showSubTabs}
        upload={upload}
        imageValue={imageValue}
        disableBackgroundColor={disableBackgroundColor}
        disableBackgroundImage={disableBackgroundImage}
        disableGradient={disableGradient}
      >
        <div className={css.block} style={style} />
        <div className={css.icon}>
          {nonColorValue ? (
            finalValue ? (
              <></>
            ) : (
              <QuestionCircleOutlined />
            )
          ) : (
            <TransparentColorOutlined />
          )}
        </div>
      </Colorpicker>
    );
  }, [state.finalValue, state.nonColorValue, handleColorpickerChange, showSubTabs, upload, imageValue]);

  const preset = useMemo(() => {
    if (!state.showPreset) {
      return null;
    }
    return (
      <div ref={presetRef} className={css.preset} onClick={onPresetClick}>
        {state?.nonColorValue ? <BindingOutlined size={13} /> : <UnbindingOutlined size={13} />}
      </div>
    );
  }, [state]);

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
    </Panel.Item>
  );
}
