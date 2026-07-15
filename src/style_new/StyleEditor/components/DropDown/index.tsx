import React, { useRef, useState, useEffect, ReactNode, useCallback, useImperativeHandle } from "react";
import { createPortal } from "react-dom";

import { CheckOutlined } from "../";
import { question as QuestionIcon } from "../../../icon/question";

import css from "./index.less";

interface DropdownOption {
  label: string | number;
  value: any;
  type?: 'action' | 'divider' | 'header';
  checked?: boolean;
  icon?: ReactNode;
  iconSize?: 'sm' | 'md';
}

interface DropdownProps {
  value: any;
  options: Array<DropdownOption>;
  children: ReactNode;
  multiple?: boolean;
  disabled?: boolean;
  onClick: (value: any) => void;
  onAction?: (value: any) => void;
  onReorder?: (newOrder: any[]) => void;
  className?: string;
  footer?: ReactNode;
}

function DragHandleIcon() {
  return (
    <svg width="8" height="12" viewBox="0 0 8 12" fill="currentColor">
      <circle cx="2" cy="2" r="1.2" />
      <circle cx="6" cy="2" r="1.2" />
      <circle cx="2" cy="6" r="1.2" />
      <circle cx="6" cy="6" r="1.2" />
      <circle cx="2" cy="10" r="1.2" />
      <circle cx="6" cy="10" r="1.2" />
    </svg>
  );
}

export function Dropdown({ value, options, children, onClick, onAction, onReorder, className, multiple, disabled = false, footer }: DropdownProps) {
  const positionRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const [show, setShow] = useState(false);
  const [open, setOpen] = useState(false);

  // 用 ref 保持最新的 multiple 值，避免 handleClick 闭包读到旧值（模式切换时 multiple 会变）
  const multipleRef = useRef(multiple);
  multipleRef.current = multiple;

  const handleDropDownClick = useCallback(() => {
    if (disabled) return;
    setShow(true);
    setOpen(true);
  }, [disabled]);

  const handleItemClick = useCallback((value: any, isAction?: boolean) => {
    if (isAction) {
      onAction?.(value);
      setOpen(false);
    } else {
      onClick(value);
      if (!multipleRef.current) setOpen(false);
    }
  }, [onClick, onAction]);

  const handleClick = useCallback((event: { target: any; }) => {
    if (multipleRef.current) {
      let currentDOM = event.target;
      while (currentDOM) {
        if (currentDOM === listRef.current) {
          return
        } 
        currentDOM = currentDOM.parentElement;
      }
      setOpen(false);
    } else {
      setOpen(false);
    }
  }, []);

  useEffect(() => {
    if (open) {
      setTimeout(() => {
        // TODO
        document.addEventListener("click", handleClick);
      });
    } else {
      document.removeEventListener("click", handleClick);
    }
    return () => {
      document.removeEventListener("click", handleClick);
    };
  }, [open]);

  return (
    <>
      <div
        ref={positionRef}
        className={`${css.dropDown}${className ? ` ${className}` : ""}`}
        onClick={handleDropDownClick}
      >
        {children}
      </div>
      {show &&
        createPortal(
          <Items
            ref={listRef}
            value={value}
            options={options}
            positionElement={positionRef.current!}
            open={open}
            onClick={handleItemClick}
            multiple={multiple}
            onReorder={onReorder}
            footer={footer}
          />,
          document.body
        )}
    </>
  );
}

interface ItemsProps {
  value: any;
  options: Array<DropdownOption>;
  onClick: (value: any, isAction?: boolean) => void;
  open: boolean;
  positionElement: HTMLDivElement;
  multiple?: boolean;
  onReorder?: (newOrder: any[]) => void;
  footer?: ReactNode;
}

const Items = React.forwardRef<HTMLDivElement, ItemsProps>((props, forwardRef) => {
  const { open, options, positionElement, onClick, value: currentValue, multiple, onReorder, footer } = props;
  const ref = useRef<HTMLDivElement>(null);
  const dragValueRef = useRef<any>(null);

  useImperativeHandle(forwardRef, () => ref.current!);

  useEffect(() => {
    const menusContainer = ref.current!;
    if (open && menusContainer) {
      const positionElementBct = positionElement.getBoundingClientRect();
      const menusContainerBct = ref.current!.getBoundingClientRect();
      const totalHeight = window.innerHeight || document.documentElement.clientHeight;
      const top = positionElementBct.top + positionElementBct.height;
      const right = positionElementBct.left + positionElementBct.width;
      const left = right - positionElementBct.width;
      const bottom = top + menusContainerBct.height;

      if (bottom > totalHeight) {
        menusContainer.style.top = positionElementBct.top - menusContainerBct.height + "px";
      } else {
        menusContainer.style.top = top + "px";
      }

      if (menusContainerBct.width > positionElementBct.width) {
        menusContainer.style.left = left - menusContainerBct.width + positionElementBct.width + "px";
      } else {
        menusContainer.style.width = positionElementBct.width + "px";
        menusContainer.style.left = left + "px";
      }

      menusContainer.style.visibility = "visible";
    } else {
      menusContainer.style.visibility = "hidden";
    }
  }, [open, ref.current]);

  const hasAnyIcon = options.some(o => o.icon);
  const canReorder = multiple && !!onReorder;

  const checkedValues = canReorder && Array.isArray(currentValue)
    ? (currentValue as any[]).filter((v) => v !== 'inherit')
    : [];
  const checkedItems = checkedValues
    .map((v) => options.find((o) => o.value === v))
    .filter(Boolean) as typeof options;
  const uncheckedItems = canReorder
    ? options.filter((o) => o.type !== 'action' && !checkedValues.includes(o.value))
    : [];
  const actionItems = options.filter((o) => o.type === 'action');

  const renderItem = (opt: typeof options[number], key: string | number, orderIndex?: number) => {
    const { label, value, type, checked, icon, iconSize } = opt;
    if (type === 'divider') {
      return <div key={key} className={css.divider} />;
    }
    if (type === 'header') {
      return <div key={key} className={css.sectionHeader}>{label}</div>;
    }
    const isAction = type === 'action';
    const isChecked = !isAction
      ? value === currentValue || (Array.isArray(currentValue) && currentValue.includes(value))
      : !!checked;
    const isDraggable = canReorder && isChecked && !isAction;
    // 多选模式下已选字体显示序号，普通模式显示 ✓
    const order = orderIndex !== undefined ? orderIndex : (
      isDraggable ? checkedValues.indexOf(value) + 1 : null
    );
    return (
      <div
        key={key}
        className={`${css.item}${isDraggable ? ` ${css.itemDraggable}` : ''}`}
        onClick={(e) => { e.stopPropagation(); onClick(value, isAction); }}
        draggable={isDraggable}
        onDragStart={isDraggable ? (e) => {
          dragValueRef.current = value;
          e.dataTransfer.effectAllowed = 'move';
          e.dataTransfer.setData('text/plain', String(value));
        } : undefined}
        onDragEnd={isDraggable ? () => {
          dragValueRef.current = null;
        } : undefined}
        onDrop={isDraggable ? (e) => {
          e.preventDefault();
          e.stopPropagation();
          const from = dragValueRef.current;
          const to = value;
          if (!from || from === to) return;
          const arr = Array.isArray(currentValue) ? [...currentValue] : [];
          const fromIdx = arr.indexOf(from);
          const toIdx = arr.indexOf(to);
          if (fromIdx === -1 || toIdx === -1) return;
          arr.splice(fromIdx, 1);
          arr.splice(toIdx, 0, from);
          onReorder!(arr);
          dragValueRef.current = null;
        } : undefined}
      >
        <span className={css.itemCheck}>
          {isDraggable && order !== null
            ? <span className={css.itemOrder}>{order}</span>
            : isChecked ? <CheckOutlined /> : null}
        </span>
        {icon ? (
          <span className={iconSize === 'sm' ? css.itemIconSm : css.itemIcon}>
            {icon}
          </span>
        ) : (hasAnyIcon ? <span style={{ paddingLeft: 5 }} /> : null)}
        <span style={{ flex: 1, minWidth: 0 }}>{label}</span>
        {multiple && isChecked && !isAction && (
          <span
            className={css.itemRemove}
            data-mybricks-tip="移除该字体"
            onClick={(e) => {
              e.stopPropagation();
              onClick(value, isAction);
            }}
          >
            ×
          </span>
        )}
        {isDraggable && (
          <span
            className={css.itemDragHandle}
            data-mybricks-tip="拖拽调整顺序"
            onClick={(e) => e.stopPropagation()}
          >
            <DragHandleIcon />
          </span>
        )}
      </div>
    );
  };

  if (canReorder) {
    return (
      <div
        ref={ref}
        className={css.items}
        data-dropdown-portal="true"
        onDragOver={(e) => e.preventDefault()}
      >
        {/* 已选字体区块：固定在顶部，不参与滚动 */}
        {checkedItems.length > 0 && (
          <div className={css.selectedArea}>
            <div className={css.sectionHeader}>
              已选字体
              <span className={css.sectionHeaderTip} data-mybricks-tip="字体优先级从上到下递减">
                <QuestionIcon />
              </span>
            </div>
            <div className={css.selectedSection}>
              {checkedItems.map((opt, i) => renderItem(opt, opt.value, i + 1))}
            </div>
            <div className={css.divider} />
          </div>
        )}
        {/* 更多字体：可滚动 */}
        <div className={css.scrollBody}>
          {uncheckedItems.length > 0 && (
            <>
              <div className={css.sectionHeader}>更多字体</div>
              {uncheckedItems.map((opt, index) => renderItem(opt, opt.value))}
            </>
          )}
          {actionItems.length > 0 && (
            <>
              <div className={css.divider} />
              {actionItems.map((opt, index) => renderItem(opt, `action-${index}`))}
            </>
          )}
        </div>
        {footer && <div className={css.fixedFooter}>{footer}</div>}
      </div>
    );
  }

  return (
    <div
      ref={ref}
      className={css.items}
      data-dropdown-portal="true"
    >
      <div className={css.scrollBody}>
        {options.map((opt, index) => renderItem(opt, opt.type === 'divider' ? `divider-${index}` : opt.value))}
      </div>
      {footer && <div className={css.fixedFooter}>{footer}</div>}
    </div>
  );
});
