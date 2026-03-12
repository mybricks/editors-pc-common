import React, { CSSProperties, ReactNode, useCallback, useEffect, useRef, useState } from 'react'

import { useStyleEditorContext } from '../../context'
import { PlusOutlined, MinusOutlined } from '../Icon'
import { Dropdown } from '../DropDown'

import css from './index.less'

interface AddOption {
  label: string;
  value: string;
}

interface PanelProps {
  title: string
  children: ReactNode
  showReset?: boolean
  showTitle?: boolean;
  showDelete?: boolean
  deleteNode?: ReactNode
  onDelete?: () => void
  rightColumn?: ReactNode
  deleteRef?: React.MutableRefObject<(() => void) | null>
  resetFunction?: () => void
  isActive?: boolean
  collapse?: boolean | 'inherited'
  onAdd?: () => void
  addTip?: string
  addOptions?: AddOption[]
  onAddOption?: (value: string) => void
}
interface ContentProps {
  style?: CSSProperties
  children: ReactNode
  className?: string
}
interface ItemProps {
  children: ReactNode
  style?: CSSProperties
  onClick?: () => void
  className?: string
  activeWhenBlur?: boolean
}

export function Panel ({title, children, showReset = false, showTitle = true, showDelete = true, deleteNode, onDelete, rightColumn, deleteRef, resetFunction = () => {}, isActive = false, collapse = false, onAdd, addTip, addOptions, onAddOption}: PanelProps) {
  const isInherited = collapse === 'inherited'
  const [collapsed, setCollapsed] = useState(collapse === true)

  const handleDelete = useCallback(() => {
    resetFunction()
    setCollapsed(true)
  }, [resetFunction])

  const handleAddOptionCollapsed = useCallback((val: string) => {
    setCollapsed(false);
    onAddOption?.(val);
  }, [onAddOption]);

  const handleAddOptionExpanded = useCallback((val: string) => {
    onAddOption?.(val);
  }, [onAddOption]);

  useEffect(() => {
    if (deleteRef) deleteRef.current = handleDelete
  }, [deleteRef, handleDelete])
  return (
    <div className={`${css.panel} ${collapsed ? css.collapsed : ''}`}>
      <div className={css.header}>
        {showTitle && <div className={css.title}>{title}</div>}
        {
          collapsed ? (
            addOptions && addOptions.length > 0 ? (
              <Dropdown
                value={null}
                options={addOptions}
                onClick={handleAddOptionCollapsed}
                className={css.right}
              >
                <PlusOutlined />
              </Dropdown>
            ) : (
              <div className={css.right} onClick={() => setCollapsed(false)}>
                <PlusOutlined />
              </div>
            )
          ) : addOptions && addOptions.length > 0 ? (
            <Dropdown
              value={null}
              options={addOptions}
              onClick={handleAddOptionExpanded}
              className={css.addBtn}
            >
              <PlusOutlined />
            </Dropdown>
          ) : onAdd ? (
            <div className={css.addBtn} onClick={onAdd} {...(addTip ? { 'data-mybricks-tip': addTip } : {})}>
              <PlusOutlined />
            </div>
          ) : null
        }
      </div>
      {
        collapsed ? null : (
          <div className={css.wrapContainer}>
            <div className={css.wrap}>
              {children}
            </div>
            {rightColumn ? rightColumn : deleteNode ? (
              <div className={css.deleteBtn} onClick={onDelete}>{deleteNode}</div>
            ) : isInherited || !showDelete ? (
              <div style={{ width: 22, flexShrink: 0 }} />
            ) : (
              <div className={css.deleteBtn} onClick={handleDelete}>
                <MinusOutlined />
              </div>
            )}
          </div>
        )
      }
    </div>
  )
}

function Content ({style = {}, children, className}: ContentProps) {
  return (
    <div className={`${css.panelContent}${className ? ` ${className}` : ''}`} style={style}>
      {children}
    </div>
  )
}

function Item ({
  children,
  style = {},
  onClick = () => {},
  className,
  activeWhenBlur = true,
}: ItemProps) {
  const [active, setActive] = useState(false);

  // const onFocusCapture = useCallback((e) => {
  //   setActive(true);
  //   e.stopPropagation();
  // }, []);

  const onFocus = useCallback((e) => {
    setActive(true);
    e.stopPropagation();
  }, [])

  return (
    <div className={`${css.panelItem}${className ? ` ${className}` : ''} ${activeWhenBlur && active ? css.active : ''}`} style={style} onClick={onClick} 
    // onFocusCapture={onFocusCapture} 
    onFocus={onFocus}
    onBlur={() => setActive(false)}>
      {children}
    </div>
  )
}

Panel.Content = Content
Panel.Item = Item
