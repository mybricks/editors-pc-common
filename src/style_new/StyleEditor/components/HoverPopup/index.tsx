import React, { ReactNode, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import css from './index.less'

interface HoverPopupProps {
  children: ReactNode
  content: ReactNode | ((close: () => void) => ReactNode)
  placement?: 'left' | 'bottomLeft'
  className?: string
  menu?: boolean
}

// 触发区与浮层共用延迟关闭，鼠标跨过两者之间的间隙时保留浮层。
export function HoverPopup({ children, content, placement = 'left', className = '', menu = false }: HoverPopupProps) {
  const anchorRef = useRef<HTMLSpanElement>(null)
  const popupRef = useRef<HTMLDivElement>(null)
  const timerRef = useRef<number>()
  const focusOnOpenRef = useRef(false)
  const [open, setOpen] = useState(false)

  const cancelTimer = () => window.clearTimeout(timerRef.current)
  const close = () => {
    cancelTimer()
    setOpen(false)
  }
  const enter = () => {
    cancelTimer()
    // 菜单沿用原来的 150ms，图片预览仍保持 100ms。
    const delay = menu ? 150 : 100
    if (!open) timerRef.current = window.setTimeout(() => setOpen(true), delay)
  }
  const leave = () => {
    cancelTimer()
    timerRef.current = window.setTimeout(() => setOpen(false), 100)
  }

  useEffect(() => () => window.clearTimeout(timerRef.current), [])

  useLayoutEffect(() => {
    if (!open) return
    const anchor = anchorRef.current!
    const popup = popupRef.current!
    const position = () => {
      const rect = anchor.getBoundingClientRect()
      const size = popup.getBoundingClientRect()
      let left = rect.left
      let top = rect.bottom + 4
      if (placement === 'left') {
        left = rect.left - size.width - 12
        top = rect.top + (rect.height - size.height) / 2
        if (left < 4) left = rect.right + 12
      } else if (top + size.height > window.innerHeight - 4) {
        top = rect.top - size.height - 4
      }
      popup.style.left = `${Math.max(4, Math.min(left, window.innerWidth - size.width - 4))}px`
      popup.style.top = `${Math.max(4, Math.min(top, window.innerHeight - size.height - 4))}px`
      popup.style.visibility = 'visible'
    }
    position()
    if (focusOnOpenRef.current) {
      focusOnOpenRef.current = false
      popup.querySelector<HTMLButtonElement>('button')?.focus()
    }
    window.addEventListener('resize', position)
    document.addEventListener('scroll', position, true)
    return () => {
      window.removeEventListener('resize', position)
      document.removeEventListener('scroll', position, true)
    }
  }, [open, placement])

  useEffect(() => {
    if (!open) return
    const clickOutside = (event: MouseEvent) => {
      const path = event.composedPath()
      if (!path.includes(anchorRef.current!) && !path.includes(popupRef.current!)) setOpen(false)
    }
    document.addEventListener('mousedown', clickOutside)
    return () => document.removeEventListener('mousedown', clickOutside)
  }, [open])

  const handleBlur = (event: React.FocusEvent) => {
    const target = event.relatedTarget as Node | null
    if (!anchorRef.current?.contains(target) && !popupRef.current?.contains(target)) leave()
  }

  return (
    <span
      ref={anchorRef}
      className={css.anchor}
      onMouseEnter={enter}
      onMouseLeave={leave}
      onFocus={(event) => {
        cancelTimer()
        if (!menu && anchorRef.current?.contains(event.target as Node)) setOpen(true)
      }}
      onBlur={handleBlur}
      onKeyDown={(event) => {
        if (event.key === 'Escape') {
          event.stopPropagation()
          close()
          anchorRef.current?.querySelector<HTMLButtonElement>('button')?.focus()
        } else if (menu && ['ArrowDown', 'Enter', ' '].includes(event.key) && anchorRef.current?.contains(event.target as Node)) {
          event.preventDefault()
          cancelTimer()
          focusOnOpenRef.current = true
          setOpen(true)
          if (open) popupRef.current?.querySelector<HTMLButtonElement>('button')?.focus()
        }
      }}
    >
      {menu ? React.cloneElement(React.Children.only(children) as React.ReactElement, {
        'aria-expanded': open,
        'aria-haspopup': 'menu',
      }) : children}
      {open && (createPortal(
        <div
          ref={popupRef}
          className={`${css.popup} ${className}`}
          onMouseEnter={cancelTimer}
          onMouseLeave={leave}
          onFocus={cancelTimer}
          onBlur={handleBlur}
        >
          {typeof content === 'function' ? content(close) : content}
        </div>,
        document.body
      ) as unknown as React.ReactElement)}
    </span>
  )
}
