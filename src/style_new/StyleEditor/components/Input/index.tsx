import React, {
  ReactNode,
  CSSProperties,
  useState,
  useCallback,
  useEffect,
} from "react";

import { Panel } from "../";

import css from "./index.less";

export interface InputProps {
  prefix?: ReactNode;
  prefixTip?: string;
  suffix?: ReactNode;
  defaultValue?: string | number;
  value?: string | number;
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
  onFocus = () => {},
  onKeyDown = () => {},
  onBlur = () => {},
  tip,
  align = 'left',
  numberTip,
  type = void 0,
}: InputProps) {
  const [inputValue, setInputValue] = useState(defaultValue);

  const handleInputChange = useCallback((event: { target: { value: any } }) => {
    const value = event.target.value;

    setInputValue(value);
    onChange?.(value);
  }, []);

  useEffect(() => {
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
              // value={value || inputValue}
              defaultValue={inputValue}
              onChange={handleInputChange}
              disabled={disabled}
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
              // value={value || inputValue}
              style={{ textAlign: 'right',paddingRight: 3 }}
              defaultValue={inputValue}
              onChange={handleInputChange}
              disabled={disabled}
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
    </Panel.Item>
  );
}
