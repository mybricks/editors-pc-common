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
import { ClearButton } from "../ClearButton";

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
  /** Grid 菜单用完整文案（如 Hug contents），回显仍用短 label（如 Hug）；目前仅 Grid 传 menuLabel，未传时沿用原 label。 */
  options: Array<{ value: any; label: string | number; menuLabel?: string | number; suffix?: string | number; type?: 'action' | 'divider'; checked?: boolean; icon?: ReactNode; iconSize?: 'sm' | 'md'; disabled?: boolean; style?: CSSProperties; tip?: string }>;
  multiple?: boolean;
  /** 是否展示下拉的icon */
  showIcon?: boolean;
  /** hover 时隐藏单位文案、仅显示下拉箭头（需配合 showIcon） */
  showIconOnHover?: boolean;
  /** 隐藏当前选中 label，只保留下拉箭头 */
  hideLabel?: boolean;
  /** Grid 传 false，使括号仅出现在菜单中（如固定 (100)），回显只显示固定；默认 true，保留历史调用方的 suffix 回显。 */
  showSelectedSuffix?: boolean;
  labelClassName?: string;
  iconClassName?: string;
  tip?: string;
  disabled?: boolean;
  clearable?: boolean;
  onClear?: () => void;
  placeholder?: string;
  /** 仅覆盖当前回显文案，不改变真实选中值或下拉勾选状态。 */
  displayValue?: ReactNode;
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
  showIconOnHover = false,
  hideLabel = false,
  showSelectedSuffix = true,
  labelClassName,
  iconClassName,
  multiple = false,
  tip,
  disabled = false,
  clearable = false,
  onClear,
  placeholder,
  displayValue,
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

  const hasDisplayValue = displayValue !== undefined && displayValue !== null && displayValue !== '';

  return (
    <Panel.Item
      style={style}
    >
      <Dropdown
        multiple={multiple}
        // 仅提供 menuLabel 的选项覆盖菜单文案；不修改原 options，收起后的 label 和历史调用方仍走原逻辑。
        options={options.some(option => option.menuLabel !== undefined)
          ? options.map(option => option.menuLabel === undefined ? option : { ...option, label: option.menuLabel })
          : options}
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
          className={`${css.select}${disabled ? ` ${css.disabled}` : ''}${showIconOnHover && !hideLabel ? ` ${css.iconOnHover}` : ''}${showIconOnHover && hideLabel ? ` ${css.iconHoverOnly}` : ''}`}
          style={showIcon ? {} : { padding: 0 }}
          onMouseEnter={() => setHovered(true)}
          onMouseLeave={() => setHovered(false)}
        >
          {prefix && <div className={css.prefix}>{prefix}</div>}
          {!hideLabel && (
            <div
              style={labelStyle}
              className={`${css.value}${labelClassName ? ` ${labelClassName}` : ''}${!label && !hasDisplayValue && placeholder ? ` ${css.placeholder}` : ''}`}
            >
              <span className={css.valueText}>
                {label || (hasDisplayValue ? displayValue : placeholder)}
                {/* Grid 显式关闭选中项括号；其他调用方默认继续显示原 suffix。 */}
                {showSelectedSuffix && !Array.isArray(value) && options.find(o => o.value === value)?.suffix
                  ? <span className={css.valueSuffix}>{options.find(o => o.value === value)?.suffix}</span>
                  : null
                }
              </span>
            </div>
          )}
          {showIcon && (
            clearable && hovered
              ? (
                <ClearButton visible className={css.icon} onClick={() => onClear?.()} />
              )
              : (
                <span
                  className={`${css.icon}${iconClassName ? ` ${iconClassName}` : ''}`}
                  data-select-icon={1}
                  {...(showIconOnHover && hideLabel ? { 'data-unit-arrow': '' } : {})}
                >
                  <DownOutlined />
                </span>
              )
          )}
        </div>
      </Dropdown>
    </Panel.Item>
  );
}
