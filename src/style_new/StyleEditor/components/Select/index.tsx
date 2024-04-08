import React, { useState, ReactNode, useCallback, CSSProperties } from "react";

import { useUpdateEffect } from "../../hooks";
import { Panel, Dropdown, DownOutlined } from "../";

import css from "./index.less";

interface SelectProps {
  value?: any;
  prefix?: ReactNode;
  defaultValue?: any;
  style?: CSSProperties;
  onChange: (value: any) => void;
  options: Array<{ value: any; label: string | number }>;
  multiple?: boolean;
  /** 是否展示下拉的icon */
  showIcon?: boolean;
  labelClassName?: string;
  tip?: string;
}

export function Select({
  value: propsValue,
  prefix,
  defaultValue,
  style = {},
  onChange,
  options,
  showIcon = true,
  labelClassName,
  multiple = false,
  tip,
}: SelectProps) {
  const [value, setValue] = useState(propsValue || defaultValue);
  const [label, setLabel] = useState(
    options.find(({ value: optionValue }) => {
      if (Array.isArray(value)) {
        return value.includes(optionValue);
      }
      return optionValue === value;
    })?.label || value
  );

  const handleDropDownClick = useCallback((clickValue) => {
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
    setLabel(propsValue.map((v) => options.find(({ value }) => value === v)!.label).join(","));
  }, [propsValue]);

  return (
    <Panel.Item style={style}>
      <Dropdown multiple={multiple} options={options} value={value} onClick={handleDropDownClick}>
        <div data-mybricks-tip={tip} className={css.select} style={showIcon ? {} : { padding: 0 }}>
          {prefix && <div className={css.prefix}>{prefix}</div>}
          <div className={`${css.value}${labelClassName ? ` ${labelClassName}` : ""}`}>{label}</div>
          {showIcon && (
            <span className={css.icon}>
              <DownOutlined />
            </span>
          )}
        </div>
      </Dropdown>
    </Panel.Item>
  );
}
