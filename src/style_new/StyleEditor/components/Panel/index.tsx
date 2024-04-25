import React, { CSSProperties, ReactNode, useCallback, useState } from 'react'

import { ReloadOutlined } from '@ant-design/icons'

import css from './index.less'

interface PanelProps {
  title: string
  children: ReactNode
  showReset?: boolean
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

export function Panel ({title, children, showReset = false, resetFunction = () => {}, isActive = false}: PanelProps) {
  return (
    <div className={css.panel}>
      <div className={css.header}>
        <div className={css.title}>{title}</div>
        {showReset && (
          <div
            className={`${css.icon} ${isActive ? css.active : ''}`}
            data-mybricks-tip={`{content:'重置${title}',position:'left'}`}
            onClick={resetFunction}
          >
            {/* <ReloadOutlined /> */}
            <svg
              viewBox="0 0 1024 1024"
              version="1.1"
              xmlns="http://www.w3.org/2000/svg"
              p-id="1471"
              width="15"
              height="15"
            >
              <path
                d="M512 1024a512 512 0 1 1 512-512 512.576 512.576 0 0 1-512 512z m0-960a448 448 0 1 0 448 448A448.512 448.512 0 0 0 512 64z m192 480H320a32 32 0 0 1 0-64h384a32 32 0 0 1 0 64z"
                fill="currentColor"
                p-id="1472"
              ></path>
            </svg>
          </div>
        )}
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
