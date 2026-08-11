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
import {
  CssVarColorOption,
  parseCssVar,
  resolveCssVarColor,
} from "../../../core/resolve-css-var-color";
import { isGradientValue } from "../../helper/gradient-border";

import css from "./index.less";

const isCssVarRef = (value: unknown): value is string =>
  typeof value === "string" && value.trim().startsWith("var(");

/** 可提交的完整 CSS 变量：var(--name) / var(--name, fallback) */
const isCommitableCssVar = (value: string) => !!parseCssVar(value.trim());

/** 纯十六进制数字（3/6/8 位、无 #）时自动补上 #；中间态不强制补，避免干扰输入 */
const normalizeColorInput = (value: string) => {
  const trimmed = value.trim();
  if (/^[0-9a-fA-F]{3}$|^[0-9a-fA-F]{6}$|^[0-9a-fA-F]{8}$/.test(trimmed)) {
    return `#${trimmed}`;
  }
  return trimmed;
};

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
  /** 变量引用的实际色值，仅用于色块与取色器预览 */
  resolvedColor?: string;
  /** 当前画布可用的 CSS 颜色变量 */
  variableOptions?: CssVarColorOption[];
  /** 画布目标节点：用于在正确 document/作用域解析 CSS 变量 */
  scopeEl?: Element | null;
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

  const isImage = typeof value === "string" && value.includes("url(");
  // 必须用函数名匹配，避免 var(--color-gradient-*) 被误判为渐变
  const isGradient = isGradientValue(value);

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
    } else if (isCssVarRef(finalValue)) {
      // 保留 var() 引用本身，避免 finalValue 被置空后预览/回显丢失
      result.finalValue = finalValue;
      const parsed = parseCssVar(finalValue.trim());
      const propName = parsed?.varName;
      const aicomVar = propName
        ? (window as any).MYBRICKS_AICOM_THEME_VARIABLES?.find(
            (item: any) => item.propertyName === propName
          )
        : null;
      if (aicomVar) {
        result.value = aicomVar.title;
        // 同步补充到 map，避免后续操作（如解绑）找不到
        optionsValueToAllMap[finalValue] = {
          key: propName,
          name: aicomVar.title,
          value: aicomVar.value,
          resetValue: aicomVar.value,
        };
      } else {
        const resolved = resolveCssVarColor(finalValue);
        if (resolved && propName) {
          optionsValueToAllMap[finalValue] = {
            key: propName,
            name: finalValue,
            value: resolved,
            resetValue: resolved,
          };
        }
      }
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

  if (window.MYBRICKS_AICOM_THEME_VARIABLES?.length) {
    window.MYBRICKS_AICOM_THEME_VARIABLES.forEach((item: any) => {
      optionsValueToAllMap[`var(${item.propertyName})`] = {
        key: item.propertyName,
        name: item.title,
        value: item.value,
        resetValue: item.value,
      };
    })
  }

  return optionsValueToAllMap
}

export function ColorEditor({
  defaultValue,
  resolvedColor,
  variableOptions = [],
  scopeEl = null,
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
  const scopeElRef = useRef(scopeEl);
  scopeElRef.current = scopeEl;

  const [optionsValueToAllMap] = useState(() => getOptionsValueToAllMap())

  const [state, dispatch] = useReducer(
    reducer,
    getInitialState({ value: defaultValue, options, optionsValueToAllMap })
  );

  // 补齐 var() 预览色：AICOM / 画布变量列表 / scopeEl 计算样式
  useEffect(() => {
    const varRef = isCssVarRef(state.finalValue)
      ? state.finalValue
      : isCssVarRef(state.value)
        ? state.value
        : "";
    if (!state.nonColorValue || !varRef) return;
    if (state.optionsValueToAllMap[varRef]?.value) return;

    const parsed = parseCssVar(varRef.trim());
    if (!parsed) return;

    const aicomVar = (window as any).MYBRICKS_AICOM_THEME_VARIABLES?.find(
      (item: any) => item.propertyName === parsed.varName
    );
    if (aicomVar) {
      dispatch({
        value: aicomVar.title,
        finalValue: varRef,
        optionsValueToAllMap: {
          ...state.optionsValueToAllMap,
          [varRef]: {
            key: parsed.varName,
            name: aicomVar.title,
            value: aicomVar.value,
            resetValue: aicomVar.value,
          },
        },
      });
      return;
    }

    const fromCanvas = variableOptions.find(
      (item) => item.name === parsed.varName || `var(${item.name})` === varRef
    )?.value;
    const resolved =
      fromCanvas ||
      resolvedColor ||
      resolveCssVarColor(varRef, scopeElRef.current);
    if (!resolved) return;

    dispatch({
      finalValue: varRef,
      optionsValueToAllMap: {
        ...state.optionsValueToAllMap,
        [varRef]: {
          key: parsed.varName,
          name: varRef,
          value: resolved,
          resetValue: resolved,
        },
      },
    });
  }, [variableOptions, resolvedColor, scopeEl, state.nonColorValue, state.finalValue, state.value]);
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
      const normalized = normalizeColorInput(value);

      // 完整合法 var(--x) 才提交；半截 var( / 乱写 var(foo) 不落盘
      if (isCssVarRef(normalized)) {
        if (!isCommitableCssVar(normalized)) return;
        emitChange('backgroundColor', normalized);
        dispatch({
          nonColorValue: true,
          value: normalized,
          finalValue: normalized,
        });
        return;
      }

      try {
        const color = new ColorUtil(normalized).alpha(opacityNumber);
        const next = fixHex(color.hexa());
        const rgbaValue = color2rgba(next);
        emitChange('backgroundColor', rgbaValue);
        dispatch({
          nonColorValue: false,
          value: next,
          finalValue: next,
        });
      } catch {
        // 非法色值：只改输入框展示，不写样式
      }
    },
    [opacityNumber, emitChange]
  );

  const handleInputBlur = useCallback(() => {
    const { value, finalValue, nonColorValue } = state;
    // 失焦回退到已提交值，乱输入不会残留
    if (nonColorValue || isCssVarRef(value) || isCssVarRef(finalValue)) {
      setUserInput(value);
    } else {
      try {
        setUserInput(new ColorUtil(finalValue || value).hex());
      } catch {
        setUserInput(finalValue || value || '');
      }
    }
    if (value !== finalValue && finalValue) {
      dispatch({ value: finalValue });
    }
  }, [state.value, state.finalValue, state.nonColorValue]);

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
    const pastedText = event.clipboardData?.getData("text");
    if (!pastedText) return;
    const normalized = normalizeColorInput(pastedText);
    // #RGB / #RRGGBB / 纯十六进制数字
    if (/^#[0-9a-fA-F]{3}$|^#[0-9a-fA-F]{6}$|^#[0-9a-fA-F]{8}$/.test(normalized)) {
      event.preventDefault();
      setUserInput(normalized);
      handleInputChange(normalized);
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

  const handleUnbind = useCallback(() => {
    const { finalValue } = state;
    const option = state.optionsValueToAllMap[finalValue];
    if (!option) return;
    const hex = getHex(option.value);
    const rgbaValue = color2rgba(hex);

    dispatch({
      nonColorValue: false,
      value: hex,
      finalValue: hex,
    });
    emitChange('backgroundColor', rgbaValue);
  }, [state.finalValue, state.optionsValueToAllMap, emitChange]);

  const input = useMemo(() => {
    const { value, nonColorValue, finalValue } = state;

    const isGradient = isGradientValue(finalValue);
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

    // 主题色标题等仍走绑定展示；var() 回显走下方输入框
    if (nonColorValue && !isCssVarRef(value)) {
      return (
        <>
          <div className={css.text} onClick={onPresetClick}>
            {value}
          </div>
          {finalValue && <div
            className={css.unbind}
            data-mybricks-tip={`解除绑定`}
            onClick={handleUnbind}
          >{UnBindingIcon}</div>}
        </>
      );
    }
    const isVariableReference = nonColorValue && isCssVarRef(value);
    return (
      <input
        data-mybricks-tip={isVariableReference ? "变量引用，点击选择变量" : "支持16进制、RGB、RGBA、HSL、HSLA、var()或颜色名称"}
        data-variable={isVariableReference || undefined}
        ref={inputColorRef}
        value={userInput}
        className={css.input}
        readOnly={isVariableReference}
        onFocus={() => {
          isFocus.current = true;
          onFocus && onFocus?.();
        }}
        onClick={() => {
          if (isVariableReference) onPresetClick();
        }}
        onChange={(e) => {
          if (isVariableReference) return;
          const next = normalizeColorInput(e.target.value);
          setUserInput(next);
          handleInputChange(next);
        }}
        onBlur={() => {
          isFocus.current = false;
          handleInputBlur();
        }}
        onPaste={handlePaste}
      />
    );
  }, [userInput, state.value, state.nonColorValue, state.finalValue, onPresetClick, handleReset, handleUnbind, handleInputChange, handleInputBlur]);

  const handleOpacityChange = useCallback(
    (value: string) => {
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

  const handleOpacityKeyDown = useCallback((e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key !== 'ArrowUp' && e.key !== 'ArrowDown') return;

    e.preventDefault();
    const currentValue = Number(e.currentTarget.value);
    const currentOpacity = Number.isFinite(currentValue)
      ? currentValue
      : Math.round(opacityNumber * 100);
    const nextOpacity = Math.min(100, Math.max(0, Math.round(currentOpacity) + (e.key === 'ArrowUp' ? 1 : -1)));

    handleOpacityChange(String(nextOpacity));
    e.currentTarget.select();
  }, [opacityNumber, handleOpacityChange]);

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
          onChange={(e) => handleOpacityChange(e.target.value)}
          onBlur={handleInputBlur}
          onKeyDown={handleOpacityKeyDown}
        />
        <div onClick={() => inputRef.current?.focus?.()}>%</div>
      </div>
    );
  }, [opacityNumber, state.nonColorValue, handleOpacityChange, handleOpacityKeyDown]);

  const onBindingChange = useCallback((params: any) => {
    const { name, value, resetValue } = params;
    emitChange('backgroundColor', value);

    dispatch({
      nonColorValue: true,
      value,
      finalValue: value
    });

    setCheckColor(value + name + resetValue);
  }, [emitChange])

  const block = useMemo(() => {
    const { finalValue, nonColorValue, value } = state;
    const isImage = finalValue?.includes?.("url(");
    const isGradient = isGradientValue(finalValue);

    let style: React.CSSProperties;
    if (nonColorValue) {
      const varRef = isCssVarRef(finalValue) ? finalValue : isCssVarRef(value) ? value : "";
      const variableOption = variableOptions.find((item) => `var(${item.name})` === varRef);
      const previewColor =
        state.optionsValueToAllMap[varRef || finalValue]?.value ||
        variableOption?.value ||
        resolvedColor ||
        (varRef ? resolveCssVarColor(varRef, scopeEl) : null) ||
        finalValue;
      style = {
        backgroundColor: previewColor || "transparent",
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
      const varRef = isCssVarRef(finalValue) ? finalValue : isCssVarRef(value) ? value : "";
      const option = state.optionsValueToAllMap[varRef || finalValue];
      const variableOption = variableOptions.find((item) => `var(${item.name})` === varRef);
      if (option?.resetValue) {
        pickerValue = option.resetValue;
      } else if (variableOption) {
        pickerValue = variableOption.value;
      } else if (resolvedColor) {
        pickerValue = resolvedColor;
      } else if (varRef) {
        pickerValue = resolveCssVarColor(varRef, scopeEl) || varRef;
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
        defaultTab={state.nonColorValue && isCssVarRef(state.value) ? "variable" : "custom"}
        canvasVariableOptions={variableOptions}
        scopeEl={scopeEl}
        selectedVariableName={state.finalValue || (isCssVarRef(state.value) ? state.value : undefined)}
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
  }, [state.finalValue, state.value, state.nonColorValue, state.optionsValueToAllMap, resolvedColor, variableOptions, scopeEl, handleColorpickerChange, showSubTabs, upload, imageValue, disableBackgroundColor, disableBackgroundImage, disableGradient]);

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
