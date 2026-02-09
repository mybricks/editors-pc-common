import React, { CSSProperties, ReactNode, useCallback, useState } from 'react'

import { useStyleEditorContext } from '../../context'
import { PlusOutlined, MinusOutlined } from '../Icon'

import css from './index.less'

interface PanelProps {
  title: string
  children: ReactNode
  showReset?: boolean
  showTitle?: boolean;
  resetFunction?: () => void
  isActive?: boolean
  collapse?: boolean
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

export function Panel ({title, children, showReset = false, showTitle = true, resetFunction = () => {}, isActive = false, collapse = false}: PanelProps) {
  const [collapsed, setCollapsed] = useState(collapse)

  const handleDelete = useCallback(() => {
    resetFunction()
    setCollapsed(true)
  }, [resetFunction])

  return (
    <div className={`${css.panel} ${collapsed ? css.collapsed : ''}`}>
      <div className={css.header}>
        {showTitle && <div className={css.title}>{title}</div>}
        {
          collapsed && (
            <div className={css.right} onClick={() => setCollapsed(false)}>
              <PlusOutlined />
            </div>
          )
        }
      </div>
      {
        collapsed ? null : (
          <div className={css.wrapContainer}>
            <div className={css.wrap}>
              {children}
            </div>
            <div className={css.deleteBtn} onClick={handleDelete}>
              <MinusOutlined />
            </div>
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
