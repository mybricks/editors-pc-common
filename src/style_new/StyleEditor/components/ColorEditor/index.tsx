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
import { Panel, Colorpicker, UnbindingOutlined, BindingOutlined, UnBindLinkIcon } from "../";
import { ClearButton } from "../ClearButton";
import { color2rgba, getRealKey } from "../../utils";
import {
  CssVarColorOption,
  parseCssVar,
  resolveCssPaintPreview,
  resolveCssVarColor,
} from "../../../core/resolve-css-var-color";
import { formatCssVarTitle, type ThemeVar } from "../../../core/css-var";
import { useThemeVars } from "../../hooks/useThemeVars";
import { isGradientValue } from "../../helper/gradient-border";
import lang from "../../../index.i18n";

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
  /** 外部解析出的实际色值，仅用于色块、取色器和继承态文本预览，不作为配置值写回 */
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
  /** 当前颜色有值时允许清空 */
  clearable?: boolean;
  /** 清空回调；具体需要删除的样式属性由使用方决定 */
  onClear?: () => void;
  /** 当前值来自继承：保留真实色值预览，输入区默认显示“继承” */
  inherited?: boolean;
  /** 继承态输入框直接回显计算色值；仅用户编辑时提交，不改变继承状态 */
  showInheritedColor?: boolean;
  /** 空值时的占位文案；空字符串保留可编辑输入框但不显示文案，配合透明色图标展示未配置状态 */
  emptyValueLabel?: string;
  activeWhenBlur?: boolean;
  /** 强制关闭内部 colorpicker 弹层 */
  forceClose?: boolean;
  /** colorpicker 打开时的回调 */
  onOpen?: () => void;
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
  optionsValueToAllMap,
  themeVars
}: {
  value: string;
  options: ColorOptions;
  optionsValueToAllMap: any
  themeVars: ThemeVar[]
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
        ? themeVars.find(
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

const getOptionsValueToAllMap = (themeVars: ThemeVar[]) => {
  const optionsValueToAllMap: any = {}

  if (window.MYBRICKS_THEME_PACKAGE_VARIABLES) {
    window.MYBRICKS_THEME_PACKAGE_VARIABLES.variables.forEach((variable: any) => {
      variable.configs.forEach((config: any) => {
        optionsValueToAllMap[`var(${config.key})`] = config;
      })
    })
  }

  // 老宿主写 window 全局、新宿主走 editConfig.themeVars，这里收到的已是两者合并后的列表
  if (themeVars?.length) {
    themeVars.forEach((item: any) => {
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
  clearable = false,
  onClear,
  inherited = false,
  showInheritedColor = false,
  emptyValueLabel,
  activeWhenBlur = true,
  forceClose,
  onOpen,
}: ColorEditorProps) {
  const presetRef = useRef<HTMLDivElement>(null);
  const scopeElRef = useRef(scopeEl);
  scopeElRef.current = scopeEl;

  const themeVars = useThemeVars();

  const [optionsValueToAllMap] = useState(() => getOptionsValueToAllMap(themeVars))

  const [state, dispatch] = useReducer(
    reducer,
    getInitialState({ value: defaultValue, options, optionsValueToAllMap, themeVars })
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

    const aicomVar = themeVars.find(
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
  }, [variableOptions, resolvedColor, scopeEl, state.nonColorValue, state.finalValue, state.value, themeVars]);
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

  const [userInput, setUserInput] = useState(inherited ? "" : colorString);
  const [hasInheritedDraft, setHasInheritedDraft] = useState(false);

  /** 当前绑定的变量引用，如 var(--color-title) */
  const varRef = isCssVarRef(state.finalValue)
    ? state.finalValue
    : isCssVarRef(state.value)
      ? state.value
      : "";
  const varName = varRef ? parseCssVar(varRef.trim())?.varName : undefined;

  /** 变量解析出的色值：优先已收集的选项，再退到外部传入与画布计算样式 */
  const resolvedVarColor = useMemo(() => {
    if (!varRef) return null;
    return (
      state.optionsValueToAllMap[varRef]?.value ||
      variableOptions.find((item) => `var(${item.name})` === varRef)?.value ||
      resolvedColor ||
      resolveCssVarColor(varRef, scopeEl) ||
      null
    );
  }, [varRef, state.optionsValueToAllMap, variableOptions, resolvedColor, scopeEl]);

  const paintPreviewValue = useMemo(
    () => resolveCssPaintPreview(state.finalValue || state.value, scopeEl),
    [state.finalValue, state.value, scopeEl]
  );

  /** 框内展示变量名：主题变量显示 title，普通变量转成 xxx/xx 风格；色值已由左侧色块表达 */
  const variableDisplayText = varName
    ? formatCssVarTitle(varName, themeVars)
    : varRef;
  const inheritedTipColor = useMemo(() => {
    const candidate = resolvedVarColor || resolvedColor || state.finalValue || state.value;
    if (!candidate) return '';
    try {
      // 继承色回显与普通颜色输入一致，只展示六位 RGB，保留原始色值中的不透明度。
      return new ColorUtil(candidate).hex().toUpperCase();
    } catch {
      return String(candidate || '');
    }
  }, [resolvedVarColor, resolvedColor, state.finalValue, state.value]);

  /** 胶囊右侧输入中的文本，提交后即替换变量 */
  const [varDraft, setVarDraft] = useState("");

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

    if (inherited) {
      // 草稿结束后恢复只读计算值；回显不经过颜色提交入口。
      setHasInheritedDraft(false);
      const committedColor = getHex(String(finalValue || value || '')).toLowerCase();
      const inputColor = getHex(userInput).toLowerCase();
      // 清掉空值和非法草稿，由展示层恢复计算色值或继承占位。
      setUserInput(inputColor && inputColor === committedColor ? inputColor : '');
      if (value !== finalValue && finalValue) {
        dispatch({ value: finalValue });
      }
      return;
    }

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
  }, [state.value, state.finalValue, state.nonColorValue, inherited, userInput]);

  const [checkColor, setCheckColor] = useState<string>("");
  const handleClear = useCallback(() => {
    dispatch({
      value: "",
      finalValue: "",
      nonColorValue: true,
    });
    setUserInput("");
    setHasInheritedDraft(false);
    setVarDraft("");
    onClear?.();
  }, [onClear]);
  const isFocus = useRef(false);
  useEffect(() => {
    if (!isFocus.current) {
      setUserInput(inherited ? "" : colorString);
      setHasInheritedDraft(false);
    }
  }, [colorString, inherited]);
  const inputColorRef = useRef<HTMLInputElement>(null);
  const handlePaste = (event: React.ClipboardEvent<HTMLInputElement>) => {
    const pastedText = event.clipboardData?.getData("text");
    if (!pastedText) return;
    const normalized = normalizeColorInput(pastedText);
    // #RGB / #RRGGBB / 纯十六进制数字
    if (/^#[0-9a-fA-F]{3}$|^#[0-9a-fA-F]{6}$|^#[0-9a-fA-F]{8}$/.test(normalized)) {
      event.preventDefault();
      if (inherited) setHasInheritedDraft(true);
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
    // 画布上的变量未必进过选项表，退回实时解析出的色值
    const rawColor = state.optionsValueToAllMap[finalValue]?.value || resolvedVarColor;
    if (!rawColor) return;
    const hex = getHex(rawColor);
    const rgbaValue = color2rgba(hex);

    dispatch({
      nonColorValue: false,
      value: hex,
      finalValue: hex,
    });
    // 解绑时同步更新userInput，避免回显残留的var()值
    setUserInput(hex);
    emitChange('backgroundColor', rgbaValue);
  }, [state.finalValue, state.optionsValueToAllMap, resolvedVarColor, emitChange]);

  const commitVarDraft = useCallback(() => {
    const trimmed = varDraft.trim();
    setVarDraft("");
    if (!trimmed) return;
    handleInputChange(trimmed);
  }, [varDraft, handleInputChange]);

  const handleVarKeyDown = useCallback((event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Backspace' || event.key === 'Delete') {
      if (varDraft) return;
      event.preventDefault();
      handleUnbind();
      return;
    }
    if (event.key === 'Enter') {
      commitVarDraft();
      return;
    }
    if (event.key === 'Escape') {
      setVarDraft("");
      event.currentTarget.blur();
    }
  }, [varDraft, commitVarDraft, handleUnbind]);

  const input = useMemo(() => {
    const { value, nonColorValue, finalValue } = state;

    // 渐变文字的透明填充色仅用于 CSS 绘制，继承态也应按实际渐变回显。
    const isGradient = isGradientValue(paintPreviewValue);
    if (isGradient) {
      return (
          <div className={css.text} style={{ marginLeft: 5 }} onClick={onPresetClick}>
            {lang.gradientColorText}
          </div>
      );
    }

    if (inherited) {
      // 有实际生效色时不算“未配置”，不再提示未配置颜色，只保留操作提示。
      const tip = inheritedTipColor ? '' : lang.noColorConfigured;
      return (
        <input
          data-mybricks-tip={tip ? `${tip}; ${lang.colorInputTip}` : lang.colorInputTip}
          ref={inputColorRef}
          value={showInheritedColor && !hasInheritedDraft ? inheritedTipColor : userInput}
          placeholder={emptyValueLabel ?? (showInheritedColor ? "" : lang.inheritFallback)}
          spellCheck={false}
          className={showInheritedColor ? css.input : `${css.input} ${css.inheritedInput}`}
          onFocus={() => {
            isFocus.current = true;
            onFocus && onFocus?.();
          }}
          onChange={(e) => {
            const next = normalizeColorInput(e.target.value);
            setHasInheritedDraft(true);
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
    }

    const isImage = paintPreviewValue?.includes?.("url(");
    if (isImage) {
      return (
          <div className={css.text} style={{ marginLeft: 5 }} onClick={onPresetClick}>
            {lang.backgroundImageText}
          </div>
      );
    }

    // 主题色标题等仍走绑定展示；var() 回显走下方输入框
    if (nonColorValue && !isCssVarRef(value) && (finalValue || emptyValueLabel == null)) {
      const varTip = isCssVarRef(finalValue)
        ? `${lang.variablePrefix}${varName || finalValue}`
        : undefined;
      return (
        <>
          <div className={css.text} data-mybricks-tip={varTip} onClick={onPresetClick}>
            {value}
          </div>
          {finalValue && <div
            className={css.unbind}
            data-mybricks-tip={lang.unbind}
            onClick={handleUnbind}
          ><UnBindLinkIcon /></div>}
        </>
      );
    }
    // 变量态与尺寸编辑器一致：框内显示解析出的色值并套描边衬底，右侧仍可聚焦输入
    if (nonColorValue && isCssVarRef(value)) {
      return (
        <div className={css.variableMain} data-mybricks-tip={`${lang.variablePrefix}${varName || varRef}`}>
          {/* 开始输入后隐藏胶囊，避免「旧变量值 + 新输入」同时出现 */}
          {!varDraft && (
            <span className={css.variableValue} onClick={onPresetClick}>
              {variableDisplayText}
            </span>
          )}
          <input
            className={css.input}
            value={varDraft}
            spellCheck={false}
            onChange={(e) => setVarDraft(e.target.value)}
            onKeyDown={handleVarKeyDown}
            onBlur={commitVarDraft}
          />
          {/* 画布变量等没有 title 的绑定同样需要解绑 */}
          {!varDraft && (
            <div
              className={css.unbind}
              data-mybricks-tip={lang.unbind}
              onClick={handleUnbind}
            ><UnBindLinkIcon /></div>
          )}
        </div>
      );
    }
    return (
      <input
        data-mybricks-tip={lang.colorInputTip}
        ref={inputColorRef}
        value={userInput}
        placeholder={emptyValueLabel}
        className={css.input}
        onFocus={() => {
          isFocus.current = true;
          onFocus && onFocus?.();
        }}
        onChange={(e) => {
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
  }, [userInput, state.value, state.nonColorValue, state.finalValue, inherited, showInheritedColor, hasInheritedDraft, inheritedTipColor, emptyValueLabel, paintPreviewValue, onPresetClick, handleReset, handleUnbind, handleInputChange, handleInputBlur, varDraft, varName, varRef, variableDisplayText, handleVarKeyDown, commitVarDraft]);

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
          data-mybricks-tip={lang.opacityPanelTitle}
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

    // 主题变量选中后立即展示 title，和重新挂载后的回显保持一致
    const parsed = parseCssVar(value.trim());
    const aicomVar = parsed
      ? themeVars.find(
          (item: any) => item.propertyName === parsed.varName
        )
      : null;

    dispatch({
      nonColorValue: true,
      value: aicomVar ? aicomVar.title : value,
      finalValue: value
    });

    setCheckColor(value + name + resetValue);
  }, [emitChange, themeVars])

  const block = useMemo(() => {
    const { finalValue, nonColorValue, value } = state;
    const isImage = paintPreviewValue?.includes?.("url(");
    const isGradient = isGradientValue(paintPreviewValue);

    let style: React.CSSProperties;
    if (isImage) {
      style = {
        backgroundImage: paintPreviewValue,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
      };
    } else if (isGradient) {
      style = {
        backgroundImage: paintPreviewValue,
      };
    } else if (nonColorValue) {
      const previewColor =
        resolvedVarColor ||
        state.optionsValueToAllMap[finalValue]?.value ||
        resolvedColor ||
        finalValue;
      style = {
        backgroundColor: previewColor || "transparent",
      };
    } else {
      style = {
        backgroundColor: finalValue,
      };
    }

    let pickerValue = isGradient || isImage ? paintPreviewValue : finalValue;

    if (nonColorValue && !isGradient && !isImage) {
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
        defaultTab={state.nonColorValue && (isCssVarRef(state.finalValue) || isCssVarRef(state.value)) && !isGradient && !isImage ? "variable" : "custom"}
        canvasVariableOptions={variableOptions}
        scopeEl={scopeEl}
        selectedVariableName={state.finalValue || (isCssVarRef(state.value) ? state.value : undefined)}
        upload={upload}
        imageValue={imageValue}
        disableBackgroundColor={disableBackgroundColor}
        disableBackgroundImage={disableBackgroundImage}
        disableGradient={disableGradient}
        forceClose={forceClose}
        onOpen={onOpen}
      >
        <div className={css.block} style={style} />
        <div className={css.icon}>
          {nonColorValue ? (
            finalValue ? (
              <></>
            ) : resolvedColor ? (
              <TransparentColorOutlined />
            ) : (
              emptyValueLabel != null ? <TransparentColorOutlined /> : <QuestionCircleOutlined />
            )
          ) : (
            <TransparentColorOutlined />
          )}
        </div>
      </Colorpicker>
    );
  }, [state.finalValue, state.value, state.nonColorValue, state.optionsValueToAllMap, paintPreviewValue, resolvedColor, resolvedVarColor, varRef, variableOptions, scopeEl, handleColorpickerChange, showSubTabs, upload, imageValue, disableBackgroundColor, disableBackgroundImage, disableGradient, emptyValueLabel, forceClose, onOpen]);

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
    <Panel.Item style={style} className={css.container} activeWhenBlur={activeWhenBlur}>
      <div
        // className={`${css.color}${state.nonColorValue ? ` ${css.disabled}` : ''}`}
        className={css.color}

      >
        {block}
        {input}
        {opacityInput}
        {clearable && !!(state.finalValue || state.value) && (
          <ClearButton onClick={handleClear} />
        )}
      </div>
      {preset}
    </Panel.Item>
  );
}
