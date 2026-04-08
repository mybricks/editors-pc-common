import React, {
  useState,
  ReactNode,
  useCallback,
  CSSProperties,
  useEffect,
} from "react";

import { useUpdateEffect } from "../../hooks";
import { Panel, Dropdown, DownOutlined } from "../";

import css from "./index.less";

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
  /** 是否展示下拉的icon */
  showIcon?: boolean;
  /** 隐藏当前选中 label，只保留下拉箭头 */
  hideLabel?: boolean;
  labelClassName?: string;
  tip?: string;
  disabled?: boolean;
}

export function Select({
  value: propsValue,
  prefix,
  defaultValue,
  style = {padding: "0 8px"},
  labelStyle,
  onChange,
  onAction,
  options,
  showIcon = true,
  hideLabel = false,
  labelClassName,
  multiple = false,
  tip,
  disabled = false,
}: SelectProps) {
  const [value, setValue] = useState(propsValue !== undefined ? propsValue : defaultValue);
  const [label, setLabel] = useState(
    Array.isArray(value)
      ? value
          .map((v) => options.find(({ value }) => value === v)?.label)
          .join(",")
      : options.find(({ value: optionValue }) => optionValue === value)
          ?.label || value
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
        setLabel(
          nextValue
            .map((v) => options.find(({ value }) => value === v)!.label)
            .join(",")
        );
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
        ? propsValue
            .map((v) => options.find(({ value }) => value === v)?.label)
            .join(",")
        : options.find(({ value: optionValue }) => optionValue === value)
            ?.label || value
    );
  }, [value]);

  return (
    <Panel.Item
      style={style}
    >
      <Dropdown
        multiple={multiple}
        options={options}
        value={value}
        onClick={handleDropDownClick}
        onAction={onAction}
        disabled={disabled}
      >
        <div
          data-mybricks-tip={tip}
          className={`${css.select}${disabled ? ` ${css.disabled}` : ''}`}
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
    </Panel.Item>
  );
}
