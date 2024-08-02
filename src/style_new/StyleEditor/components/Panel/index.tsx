import React, { CSSProperties, ReactNode, useCallback, useState } from 'react'

import { ReloadOutlined } from '@ant-design/icons'

import css from './index.less'

interface PanelProps {
  title: string
  children: ReactNode
  showReset?: boolean
  showTitle?: boolean;
  resetFunction?: () => void
  isActive?: boolean
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

export function Panel ({title, children, showReset = false, showTitle = true, resetFunction = () => {}, isActive = false}: PanelProps) {
  return (
    <div className={css.panel}>
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
      </div>
      <div className={css.wrap}>
        {children}
      </div>
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
