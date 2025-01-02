import React, { CSSProperties, ReactNode, useCallback, useState } from 'react'

import { ReloadOutlined, DownOutlined, PlusOutlined, MinusOutlined } from '@ant-design/icons'

import { useStyleEditorContext } from '../../context'

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

const PlusIcon = () => <svg viewBox="0 0 1024 1024" version="1.1" fill='currentColor' width="64" height="64"><path d="M550.4 550.4v332.8c0 21.20704-17.19296 38.4-38.4 38.4s-38.4-17.19296-38.4-38.4v-332.8h-332.8c-21.20704 0-38.4-17.19296-38.4-38.4s17.19296-38.4 38.4-38.4h332.8v-332.8c0-21.20704 17.19296-38.4 38.4-38.4s38.4 17.19296 38.4 38.4v332.8h332.8c21.20704 0 38.4 17.19296 38.4 38.4s-17.19296 38.4-38.4 38.4h-332.8z"></path></svg>

export function Panel ({title, children, showReset = false, showTitle = true, resetFunction = () => {}, isActive = false, collapse = false}: PanelProps) {
  const [collapsed, setCollapsed] = useState(collapse)

  const { autoCollapseWhenUnusedProperty } = useStyleEditorContext()
  
  return (
    <div className={`${css.panel} ${autoCollapseWhenUnusedProperty && collapsed ? css.collapsed : ''}`}>
      <div className={css.header}>
        {showTitle && <div className={css.title}>{title}</div>}
        {/* {showReset && (
          <div
            className={`${css.icon} ${isActive ? css.active : ''}`}
            data-mybricks-tip={`{content:'重置${title}',position:'left'}`}
            onClick={resetFunction}
          >
            <ReloadOutlined />
          </div>
        )} */}
        {
          autoCollapseWhenUnusedProperty && collapsed &&<div className={css.right} onClick={() => setCollapsed(c => !c)}  data-mybricks-tip={`{content:'展开配置',position:'left'}`}>
            <PlusIcon />
          </div>
        }
      </div>
      {
        autoCollapseWhenUnusedProperty && collapsed ? null : <div className={css.wrap}>
          {children}
        </div>
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
