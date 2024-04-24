import React, { CSSProperties, ReactNode, useCallback, useState } from 'react'

import css from './index.less'

interface PanelProps {
  title: string
  children: ReactNode
  showReset?: boolean
  resetFunction?: () => void
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

export function Panel ({title, children, showReset = false, resetFunction = () => {}}: PanelProps) {
  return (
    <div className={css.panel}>
      <div className={css.header}>
        <div className={css.title}>{title}</div>
        {showReset && (
          <div
            className={css.icon}
            data-mybricks-tip={`{content:'重置${title}',position:'left'}`}
            onClick={resetFunction}
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="12"
              height="6"
              viewBox="0 0 12 6"
            >
              <path
                fill="#000"
                fill-opacity="1"
                fill-rule="nonzero"
                stroke="none"
                d="M11.5 3.5H.5v-1h11v1z"
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
