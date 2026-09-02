import React, {
  ReactNode,
  CSSProperties,
  useState,
  useCallback,
  useLayoutEffect,
} from "react";

import { Panel } from "../";
import { ClearButton } from "../ClearButton";

import css from "./index.less";

export interface InputProps {
  prefix?: ReactNode;
  prefixTip?: string;
  suffix?: ReactNode;
  defaultValue?: string | number;
  value?: string | number;
  placeholder?: string;
  style?: CSSProperties;
  onChange?: (value: string) => void;
  disabled?: boolean;
  onBlur?: React.FocusEventHandler<HTMLInputElement>;
  onFocus?: React.FocusEventHandler<HTMLInputElement>;
  onKeyDown?: React.KeyboardEventHandler<HTMLInputElement>;
  align?: 'left' | 'right';
  tip?: string;
  numberTip?: string;
  type?: string;
  clearable?: boolean;
  onClear?: () => void;
}

export function Input({
  defaultValue,
  onChange,
  value,
  prefix,
  prefixTip = void 0,
  suffix,
  style = {},
  disabled = false,
  placeholder,
  onFocus = () => {},
  onKeyDown = () => {},
  onBlur = () => {},
  tip,
  align = 'left',
  numberTip,
  type = void 0,
  clearable = false,
  onClear,
}: InputProps) {
  const [inputValue, setInputValue] = useState(defaultValue);

  const handleInputChange = useCallback((event: { target: { value: any } }) => {
    const value = event.target.value;

    setInputValue(value);
    onChange?.(value);
  }, []);

  // 外部值（例如切换选中组件）必须在绘制前同步，避免先显示上一组件的数字。
  useLayoutEffect(() => {
    if (value !== inputValue) {
      setInputValue(value);
    }
  }, [value]);

  return (
    <Panel.Item style={style}>
      <div className={css.input} data-mybricks-tip={tip}>
        {align == 'left' && (
          <>
            {prefix && (
              <div className={css.prefix} data-mybricks-tip={prefixTip}>
                {prefix}
              </div>
            )}
            <input
              value={inputValue ?? ''}
              onChange={handleInputChange}
              disabled={disabled}
              placeholder={placeholder}
              onFocus={onFocus}
              onBlur={onBlur}
              onKeyDown={onKeyDown}
              data-mybricks-tip={numberTip}
              type={type}
            />
            {clearable && inputValue !== '' && inputValue != null && <ClearButton onClick={() => { setInputValue(''); if (onClear) onClear(); else onChange?.('') }} />}
            {suffix && <div className={css.suffix}>{suffix}</div>}
          </>
        )}

        {align == 'right' && (
          <>
            {suffix && <div className={css.suffix}>{suffix}</div>}
            <input
              value={inputValue ?? ''}
              style={{ textAlign: 'right',paddingRight: 3 }}
              onChange={handleInputChange}
              disabled={disabled}
              placeholder={placeholder}
              onFocus={onFocus}
              onBlur={onBlur}
              onKeyDown={onKeyDown}
              data-mybricks-tip={numberTip}
              type={type}
            />
            {prefix && (
              <div className={css.prefix} data-mybricks-tip={prefixTip}>
                {prefix}
              </div>
            )}
            {clearable && inputValue !== '' && inputValue != null && <ClearButton onClick={() => { setInputValue(''); if (onClear) onClear(); else onChange?.('') }} />}
          </>
        )}
      </div>
    </Panel.Item>
  );
}
