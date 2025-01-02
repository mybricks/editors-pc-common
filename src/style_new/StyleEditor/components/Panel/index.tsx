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
            <PlusOutlined />
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
