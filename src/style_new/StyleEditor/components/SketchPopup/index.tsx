import React, { useEffect, useRef, ReactNode } from 'react'
import { createPortal } from 'react-dom'

export interface SketchPopupProps {
  /** 是否可见（控制定位与 visibility） */
  open: boolean
  /** 是否挂载到 DOM（首次打开后可保持挂载） */
  mounted: boolean
  /** 定位锚点 */
  anchorRef: React.RefObject<HTMLElement | null>
  onClose: () => void
  className?: string
  children: ReactNode
  /** 依赖变化时重新定位（如内容高度变化） */
  repositionKey?: string | number
}

/**
 * 固定定位的 Sketch 风格弹层：定位到锚点左侧、点击外部关闭。
 * 视觉样式由 className 提供（各插件自行维护）。
 */
export function SketchPopup({
  open,
  mounted,
  anchorRef,
  onClose,
  className,
  children,
  repositionKey,
}: SketchPopupProps): React.ReactElement | null {
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node
      if (
        !containerRef.current?.contains(target) &&
        !anchorRef.current?.contains(target as Node) &&
        !(event.target as Element)?.closest?.('[data-dropdown-portal="true"]')
      ) {
        onClose()
      }
    }
    setTimeout(() => document.addEventListener('click', handleClickOutside))
    return () => document.removeEventListener('click', handleClickOutside)
  }, [open, onClose, anchorRef])

  useEffect(() => {
    const container = containerRef.current
    const positionElement = anchorRef.current
    if (!container || !positionElement) return

    if (open) {
      const posRect = positionElement.getBoundingClientRect()
      const containerRect = container.getBoundingClientRect()
      let top = posRect.top
      if (top + containerRect.height > window.innerHeight) {
        top = top - containerRect.height + posRect.height
      }
      container.style.top = top + 'px'
      container.style.right = (window.innerWidth - posRect.left) + 'px'
      container.style.visibility = 'visible'
    } else {
      container.style.visibility = 'hidden'
    }
  }, [open, repositionKey, anchorRef])

  if (!mounted) return null

  // createPortal 与仓库内 React 类型版本不一致，与 Effects 旧写法对齐做断言
  return createPortal(
    <div
      ref={containerRef}
      className={className}
      onFocus={(e) => e.stopPropagation()}
    >
      {children}
    </div>,
    document.body
  ) as unknown as React.ReactElement
}

export const SketchCloseIcon = (
  <svg viewBox='64 64 896 896' focusable='false' width='10' height='10' fill='currentColor' aria-hidden='true'>
    <path d='M563.8 512l262.5-312.9c4.4-5.2.7-13.1-6.1-13.1h-79.8c-4.7 0-9.2 2.1-12.3 5.7L511.6 449.8 295.1 191.7c-3-3.6-7.5-5.7-12.3-5.7H203c-6.8 0-10.5 7.9-6.1 13.1L459.4 512 196.9 824.9A7.95 7.95 0 00203 838h79.8c4.7 0 9.2-2.1 12.3-5.7l216.5-258.1 216.5 258.1c3 3.6 7.5 5.7 12.3 5.7h79.8c6.8 0 10.5-7.9 6.1-13.1L563.8 512z'></path>
  </svg>
)
