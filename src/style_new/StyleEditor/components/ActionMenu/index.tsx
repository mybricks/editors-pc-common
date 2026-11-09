import React, { useLayoutEffect, useRef, useState } from 'react'
import { HoverPopup } from '../HoverPopup'
import { DownOutlined } from '../Icon/DownOutlined'
import css from './index.less'

export interface ActionMenuOption {
  key: string
  label: React.ReactNode
  onClick?: () => void
  children?: ActionMenuOption[]
}

export function ActionMenu({ options, children }: { options: ActionMenuOption[]; children: React.ReactNode }) {
  return (
    <HoverPopup menu placement="bottomLeft" className={css.root} content={(close) => <MenuItems options={options} close={close} />}>
      {children}
    </HoverPopup>
  )
}

function MenuItems({ options, close, onBack }: { options: ActionMenuOption[]; close: () => void; onBack?: () => void }) {
  const menuRef = useRef<HTMLDivElement>(null)
  return (
    <div
      ref={menuRef}
      className={css.menu}
      role="menu"
      onKeyDown={(event) => {
        // 子菜单自己处理方向键，不让父菜单重复移动焦点。
        if (event.key === 'ArrowLeft' && onBack) {
          event.preventDefault()
          event.stopPropagation()
          onBack()
          return
        }
        if (!['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) return
        event.preventDefault()
        event.stopPropagation()
        const buttons = Array.from(menuRef.current!.children).map(item => item.querySelector('button')!)
        const current = buttons.indexOf(document.activeElement as HTMLButtonElement)
        let next = 0
        if (event.key === 'End') next = buttons.length - 1
        if (event.key === 'ArrowDown') next = (current + 1) % buttons.length
        if (event.key === 'ArrowUp') next = (current - 1 + buttons.length) % buttons.length
        buttons[next]?.focus()
      }}
    >
      {options.map(option => <MenuItem key={option.key} option={option} close={close} />)}
    </div>
  )
}

function MenuItem({ option, close }: { option: ActionMenuOption; close: () => void }) {
  const buttonRef = useRef<HTMLButtonElement>(null)
  const submenuRef = useRef<HTMLDivElement>(null)
  const focusSubmenuRef = useRef(false)
  const [expanded, setExpanded] = useState(false)
  const children = option.children

  useLayoutEffect(() => {
    if (!expanded || !children) return
    const submenu = submenuRef.current!
    const position = () => {
      const rect = buttonRef.current!.getBoundingClientRect()
      const size = submenu.getBoundingClientRect()
      let left = rect.right + 4
      if (left + size.width > window.innerWidth - 4) left = rect.left - size.width - 4
      submenu.style.left = `${Math.max(4, left)}px`
      submenu.style.top = `${Math.max(4, Math.min(rect.top, window.innerHeight - size.height - 4))}px`
    }
    position()
    // 等主菜单更新位置后再测量子菜单，避免滚动或缩放时两层错位。
    let frame = 0
    const schedulePosition = () => {
      window.cancelAnimationFrame(frame)
      frame = window.requestAnimationFrame(position)
    }
    window.addEventListener('resize', schedulePosition)
    document.addEventListener('scroll', schedulePosition, true)
    if (focusSubmenuRef.current) {
      focusSubmenuRef.current = false
      submenu.querySelector<HTMLButtonElement>('button')?.focus()
    }
    return () => {
      window.cancelAnimationFrame(frame)
      window.removeEventListener('resize', schedulePosition)
      document.removeEventListener('scroll', schedulePosition, true)
    }
  }, [expanded, children])

  return (
    <div
      className={css.item}
      // 普通操作项不处理子菜单展开，避免 hover 产生无用的状态更新。
      onMouseEnter={children ? () => setExpanded(true) : undefined}
      onMouseLeave={children ? () => setExpanded(false) : undefined}
      onBlur={children ? (event) => {
        if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setExpanded(false)
      } : undefined}
    >
      <button
        ref={buttonRef}
        type="button"
        role="menuitem"
        className={css.button}
        aria-haspopup={children ? 'menu' : undefined}
        aria-expanded={children ? expanded : undefined}
        onClick={(event) => {
          event.stopPropagation()
          if (children) {
            focusSubmenuRef.current = true
            setExpanded(true)
            submenuRef.current?.querySelector<HTMLButtonElement>('button')?.focus()
          } else {
            // 先收起菜单再执行原回调，操作仍只触发一次。
            close()
            option.onClick?.()
          }
        }}
        onKeyDown={(event) => {
          if (children && event.key === 'ArrowRight') {
            event.preventDefault()
            event.stopPropagation()
            focusSubmenuRef.current = true
            setExpanded(true)
            submenuRef.current?.querySelector<HTMLButtonElement>('button')?.focus()
          }
        }}
      >
        <span className={css.label}>{option.label}</span>
        {children && <span className={css.arrow} aria-hidden="true"><DownOutlined /></span>}
      </button>
      {children && expanded && (
        <div ref={submenuRef} className={css.submenu}>
          <MenuItems options={children} close={close} onBack={() => { setExpanded(false); buttonRef.current?.focus() }} />
        </div>
      )}
    </div>
  )
}
