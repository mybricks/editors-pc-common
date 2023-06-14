import React, { CSSProperties, ReactNode } from 'react'

import css from './index.less'

interface PanelProps {
  title: string
  children: ReactNode
}
interface ContentProps {
  style?: CSSProperties
  children: ReactNode
}
interface ItemProps {
  children: ReactNode
  style?: CSSProperties
  onClick?: () => void
  className?: string
}

export function Panel ({title, children}: PanelProps) {
  return (
    <div className={css.panel}>
      <div className={css.header}>
        <div className={css.title}>{title}</div>
      </div>
      <div className={css.wrap}>
        {children}
      </div>
    </div>
  )
}

function Content ({style = {}, children}: ContentProps) {
  return (
    <div className={css.panelContent} style={style}>
      {children}
    </div>
  )
}

function Item ({
  children,
  style = {},
  onClick = () => {},
  className
}: ItemProps) {
  return (
    <div className={`${css.panelItem}${className ? ` ${className}` : ''}`} style={style} onClick={onClick}>
      {children}
    </div>
  )
}

Panel.Content = Content
Panel.Item = Item
