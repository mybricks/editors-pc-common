import React, { useRef, useState, useEffect, ReactNode, useCallback, useImperativeHandle } from "react";
import { createPortal } from "react-dom";

import { CheckOutlined } from "../";

import css from "./index.less";

interface DropdownOption {
  label: string | number;
  value: any;
  type?: 'action' | 'divider';
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
  className?: string;
}

export function Dropdown({ value, options, children, onClick, onAction, className, multiple, disabled = false }: DropdownProps) {
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
}

const Items = React.forwardRef<HTMLDivElement, ItemsProps>((props, forwardRef) => {
  const { open, options, positionElement, onClick, value: currentValue } = props;
  const ref = useRef<HTMLDivElement>(null);

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

  return (
    <div ref={ref} className={css.items} data-dropdown-portal="true">
      {options.map(({ label, value, type, checked, icon, iconSize }, index) => {
        if (type === 'divider') {
          return <div key={index} className={css.divider} />;
        }
        const isAction = type === 'action';
        const isChecked = !isAction
          ? value === currentValue || (Array.isArray(currentValue) && currentValue.includes(value))
          : !!checked;
        return (
          <div key={index} className={css.item} onClick={() => onClick(value, isAction)}>
            <span className={css.itemCheck}>
              {isChecked ? <CheckOutlined /> : null}
            </span>
            {icon ? (
              <span className={iconSize === 'sm' ? css.itemIconSm : css.itemIcon}>
                {icon}
              </span>
            ) : (hasAnyIcon ? <span style={{ paddingLeft: 5 }} /> : null)}
            {label}
          </div>
        );
      })}
    </div>
  );
});
