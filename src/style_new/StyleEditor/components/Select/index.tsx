import React, {
  useState,
  useRef,
  ReactNode,
  useCallback,
  CSSProperties,
  useEffect,
} from "react";

import { useUpdateEffect } from "../../hooks";
import { Panel, Dropdown, DownOutlined } from "../";
import { CleanFont } from "../../icons/CleanFont";

import css from "./index.less";

interface SelectProps {
  value?: any;
  prefix?: ReactNode;
  defaultValue?: any;
  style?: CSSProperties;
  labelStyle?: CSSProperties;
  onChange: (value: any) => void;
  onAction?: (value: any) => void;
  onReorder?: (newOrder: any[]) => void;
  options: Array<{ value: any; label: string | number; suffix?: string | number; type?: 'action' | 'divider'; checked?: boolean; icon?: ReactNode; iconSize?: 'sm' | 'md'; disabled?: boolean }>;
  multiple?: boolean;
  /** 是否展示下拉的icon */
  showIcon?: boolean;
  /** 隐藏当前选中 label，只保留下拉箭头 */
  hideLabel?: boolean;
  labelClassName?: string;
  iconClassName?: string;
  tip?: string;
  disabled?: boolean;
  clearable?: boolean;
  onClear?: () => void;
  placeholder?: string;
  /** 固定在下拉底部的自定义内容，不随列表滚动 */
  footer?: ReactNode;
}

export function Select({
  value: propsValue,
  prefix,
  defaultValue,
  style = {padding: "0 8px"},
  labelStyle,
  onChange,
  onAction,
  onReorder,
  options,
  showIcon = true,
  hideLabel = false,
  labelClassName,
  iconClassName,
  multiple = false,
  tip,
  disabled = false,
  clearable = false,
  onClear,
  placeholder,
  footer,
}: SelectProps) {
  const [value, setValue] = useState(propsValue !== undefined ? propsValue : defaultValue);
  const [hovered, setHovered] = useState(false);
  const [label, setLabel] = useState(
    Array.isArray(value)
      ? value
          .map((v) => options.find(({ value }) => value === v)?.label)
          .join(",")
      : options.find(({ value: optionValue }) => optionValue === value)?.label || value
  );

  // 用 ref 保持最新值，避免 useCallback([]依赖) 闭包读到旧值（模式切换时 multiple/options/onChange 会变）
  const multipleRef = useRef(multiple);
  multipleRef.current = multiple;
  const optionsRef = useRef(options);
  optionsRef.current = options;
  const onActionRef = useRef(onAction);
  onActionRef.current = onAction;
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  const handleDropDownClick = useCallback((clickValue: any) => {
    const clickedOption = optionsRef.current.find(o => o.value === clickValue);
    if (clickedOption?.disabled) return;
    if (clickedOption?.type === 'action') {
      onActionRef.current?.(clickValue);
      return;
    }
    setValue((value: any) => {
      if (multipleRef.current) {
        const nextValue = Array.isArray(value) ? value.slice() : [value];
        const index = nextValue.indexOf(clickValue);
        if (index > -1) {
          nextValue.splice(index, 1);
        } else {
          nextValue.push(clickValue);
        }
        setLabel(
          nextValue
            .map((v) => optionsRef.current.find(({ value }) => value === v)?.label ?? v)
            .filter(Boolean)
            .join(",")
        );
        onChangeRef.current(nextValue);
        return nextValue;
      }

      if (value !== clickValue) {
        setLabel(optionsRef.current.find(({ value }) => value === clickValue)?.label ?? clickValue);
        onChangeRef.current(clickValue);
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
        : options.find(({ value: optionValue }) => optionValue === value)?.label || value
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
        onReorder={onReorder ? (newOrder) => {
          setValue(newOrder);
          setLabel(newOrder.map((v) => options.find(({ value }) => value === v)?.label ?? v).join(","));
          onReorder(newOrder);
        } : undefined}
        disabled={disabled}
        footer={footer}
      >
        <div
          data-mybricks-tip={clearable && hovered ? undefined : tip}
          className={`${css.select}${disabled ? ` ${css.disabled}` : ''}`}
          style={showIcon ? {} : { padding: 0 }}
          onMouseEnter={() => setHovered(true)}
          onMouseLeave={() => setHovered(false)}
        >
          {prefix && <div className={css.prefix}>{prefix}</div>}
          {!hideLabel && (
            <div
              style={labelStyle}
              className={`${css.value}${labelClassName ? ` ${labelClassName}` : ''}${!label && placeholder ? ` ${css.placeholder}` : ''}`}
            >
              <span className={css.valueText}>
                {label || placeholder}
                {!Array.isArray(value) && options.find(o => o.value === value)?.suffix
                  ? <span className={css.valueSuffix}>{options.find(o => o.value === value)?.suffix}</span>
                  : null
                }
              </span>
            </div>
          )}
          {showIcon && (
            clearable && hovered
              ? (
                <span
                  className={`${css.icon}${iconClassName ? ` ${iconClassName}` : ''} ${css.clearIcon}`}
                  data-mybricks-tip="清空"
                  onClick={(e) => {
                    e.stopPropagation();
                    onClear?.();
                  }}
                >
                  <CleanFont />
                </span>
              )
              : (
                <span className={`${css.icon}${iconClassName ? ` ${iconClassName}` : ''}`}>
                  <DownOutlined />
                </span>
              )
          )}
        </div>
      </Dropdown>
    </Panel.Item>
  );
}
