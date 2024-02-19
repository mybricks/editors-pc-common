import React, { CSSProperties, ReactNode, useCallback, useState } from 'react'

import css from './index.less'

interface PanelProps {
  title: string
  children: ReactNode
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

  // 因为存在嵌套的情况，不想改了，只允许最外层的响应，子元素不允许响应
  const onFocusCapture = useCallback((e) => {
    setActive(true);
    e.stopPropagation();
  }, []);

  return (
    <div className={`${css.panelItem}${className ? ` ${className}` : ''} ${activeWhenBlur && active ? css.active : ''}`} style={style} onClick={onClick} onFocusCapture={onFocusCapture} onBlur={() => setActive(false)}>
      {children}
    </div>
  )
}

Panel.Content = Content
Panel.Item = Item
