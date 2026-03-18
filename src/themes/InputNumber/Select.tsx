import React, {
  useState,
  ReactNode,
  useCallback,
  CSSProperties,
  useEffect,
} from "react";

import { useUpdateEffect } from "../../style_new/StyleEditor/hooks";
import { Dropdown, DownOutlined } from "../../style_new/StyleEditor/components";

import css from "./Select.less";

interface SelectProps {
  value?: any;
  prefix?: ReactNode;
  defaultValue?: any;
  style?: CSSProperties;
  labelStyle?: CSSProperties;
  onChange: (value: any) => void;
  onAction?: (value: any) => void;
  options: Array<{ value: any; label: string | number; type?: 'action'; checked?: boolean }>;
  multiple?: boolean;
  showIcon?: boolean;
  hideLabel?: boolean;
  labelClassName?: string;
  tip?: string;
}

export function Select({
  value: propsValue,
  prefix,
  defaultValue,
  style = { padding: "0 8px" },
  labelStyle,
  onChange,
  onAction,
  options,
  showIcon = true,
  hideLabel = false,
  labelClassName,
  multiple = false,
  tip,
}: SelectProps) {
  const [value, setValue] = useState(propsValue !== undefined ? propsValue : defaultValue);
  const [label, setLabel] = useState(
    Array.isArray(value)
      ? value.map((v) => options.find(({ value }) => value === v)?.label).join(",")
      : options.find(({ value: optionValue }) => optionValue === value)?.label || value
  );

  const handleDropDownClick = useCallback((clickValue: any) => {
    const clickedOption = options.find(o => o.value === clickValue);
    if (clickedOption?.type === 'action') {
      onAction?.(clickValue);
      return;
    }
    setValue((value: any) => {
      if (multiple) {
        const nextValue = Array.isArray(value) ? value.slice() : [value];
        const index = nextValue.indexOf(clickValue);
        if (index > -1) {
          nextValue.splice(index, 1);
        } else {
          nextValue.push(clickValue);
        }
        setLabel(nextValue.map((v) => options.find(({ value }) => value === v)!.label).join(","));
        onChange(nextValue);
        return nextValue;
      }
      if (value !== clickValue) {
        setLabel(options.find(({ value }) => value === clickValue)!.label);
        onChange(clickValue);
      }
      return clickValue;
    });
  }, []);

  useUpdateEffect(() => {
    setValue(propsValue);
  }, [propsValue]);

  useEffect(() => {
    setLabel(
      Array.isArray(propsValue)
        ? propsValue.map((v) => options.find(({ value }) => value === v)?.label).join(",")
        : options.find(({ value: optionValue }) => optionValue === value)?.label || value
    );
  }, [value]);

  return (
    <div className={css.selectWrapper} style={style}>
      <Dropdown
        multiple={multiple}
        options={options}
        value={value}
        onClick={handleDropDownClick}
        onAction={onAction}
      >
        <div
          data-mybricks-tip={tip}
          className={css.select}
          style={showIcon ? {} : { padding: 0 }}
        >
          {prefix && <div className={css.prefix}>{prefix}</div>}
          {!hideLabel && (
            <div
              style={labelStyle}
              className={`${css.value}${labelClassName ? ` ${labelClassName}` : ''}`}
            >
              {label}
            </div>
          )}
          {showIcon && (
            <span className={css.icon}>
              <DownOutlined />
            </span>
          )}
        </div>
      </Dropdown>
    </div>
  );
}
