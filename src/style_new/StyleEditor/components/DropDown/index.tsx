import React, { useRef, useState, useEffect, ReactNode, useCallback, useImperativeHandle } from "react";
import { createPortal } from "react-dom";

import { CheckOutlined } from "../";

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

export function Dropdown({ value, options, children, onClick, onAction, onReorder, className, multiple, disabled = false }: DropdownProps) {
  const positionRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const [show, setShow] = useState(false);
  const [open, setOpen] = useState(false);

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
      if (!multiple) setOpen(false);
    }
  }, [onClick, onAction, multiple]);

  const handleClick = useCallback((event: { target: any; }) => {
    if (multiple) {
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
}

const Items = React.forwardRef<HTMLDivElement, ItemsProps>((props, forwardRef) => {
  const { open, options, positionElement, onClick, value: currentValue, multiple, onReorder } = props;
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

  // 当可拖拽排序时，把已选中的 item 按 currentValue 顺序提前显示，未选中的放后面
  const displayOptions = canReorder && Array.isArray(currentValue) && currentValue.length >= 1
    ? (() => {
        const checkedValues = (currentValue as any[]).filter((v) => v !== 'inherit');
        if (checkedValues.length === 0) return options;
        const checkedItems = checkedValues
          .map((v) => options.find((o) => o.value === v))
          .filter(Boolean) as typeof options;
        const uncheckedItems = options.filter(
          (o) => o.type !== 'action' && !checkedValues.includes(o.value)
        );
        const actionItems = options.filter((o) => o.type === 'action');
        return [
          { label: '已选字体', value: '__header_selected__', type: 'header' as const },
          ...checkedItems,
          ...(uncheckedItems.length > 0 ? [
            { label: '', value: '__divider_mid__', type: 'divider' as const },
            { label: '更多字体', value: '__header_more__', type: 'header' as const },
            ...uncheckedItems,
          ] : []),
          ...(actionItems.length > 0 ? [{ label: '', value: '__divider2__', type: 'divider' as const }, ...actionItems] : []),
        ];
      })()
    : options;

  const renderItem = (opt: typeof options[number], key: string | number) => {
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
    return (
      <div
        key={key}
        className={`${css.item}${isDraggable ? ` ${css.itemDraggable}` : ''}`}
        onClick={() => onClick(value, isAction)}
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
          {isChecked ? <CheckOutlined /> : null}
        </span>
        {icon ? (
          <span className={iconSize === 'sm' ? css.itemIconSm : css.itemIcon}>
            {icon}
          </span>
        ) : (hasAnyIcon ? <span style={{ paddingLeft: 5 }} /> : null)}
        <span style={{ flex: 1, minWidth: 0 }}>{label}</span>
        {isChecked && !isAction && (
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

  return (
    <div
      ref={ref}
      className={css.items}
      data-dropdown-portal="true"
      onDragOver={canReorder ? (e) => e.preventDefault() : undefined}
    >
      {displayOptions.map((opt, index) => renderItem(opt, opt.type === 'divider' ? `divider-${index}` : opt.value))}
    </div>
  );
});
