import React, {
  ReactNode,
  CSSProperties,
  useCallback,
} from "react";

import css from "./Input.less";

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
  wrapperProps?: React.HTMLAttributes<HTMLDivElement>;
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
  wrapperProps = {},
}: InputProps) {
  const inputValue = value ?? defaultValue ?? '';

  const handleInputChange = useCallback((event: { target: { value: any } }) => {
    onChange?.(event.target.value);
  }, [onChange]);

  return (
    <div className={css.inputWrapper} style={style} {...wrapperProps}>
      <div className={css.input} data-mybricks-tip={tip}>
        {align == 'left' && (
          <>
            {prefix && (
              <div className={css.prefix} data-mybricks-tip={prefixTip}>
                {prefix}
              </div>
            )}
            <input
              value={inputValue}
              onChange={handleInputChange}
              disabled={disabled}
              placeholder={placeholder}
              onFocus={onFocus}
              onBlur={onBlur}
              onKeyDown={onKeyDown}
              data-mybricks-tip={numberTip}
              type={type}
            />
            {suffix && <div className={css.suffix}>{suffix}</div>}
          </>
        )}

        {align == 'right' && (
          <>
            {suffix && <div className={css.suffix}>{suffix}</div>}
            <input
              style={{ textAlign: 'right', paddingRight: 3 }}
              value={inputValue}
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
          </>
        )}
      </div>
    </div>
  );
}
