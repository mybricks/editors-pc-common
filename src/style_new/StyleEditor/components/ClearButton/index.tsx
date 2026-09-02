import React from 'react'
import css from './index.less'

interface ClearButtonProps {
  onClick: () => void
  visible?: boolean
  className?: string
}

export function ClearButton({ onClick, visible = false, className = '' }: ClearButtonProps) {
  return (
    <button
      type="button"
      className={`${css.button}${visible ? ` ${css.visible}` : ''}${className ? ` ${className}` : ''}`}
      aria-label="清空"
      data-input-clear="true"
      data-mybricks-tip="清空"
      onMouseDown={(e) => e.preventDefault()}
      onClick={(e) => {
        e.stopPropagation()
        const button = e.currentTarget
        onClick()
        requestAnimationFrame(() => {
          const input = button.parentElement?.querySelector('input') as HTMLInputElement | null
          input?.blur()
        })
      }}
    >
      <svg viewBox="0 0 24 24" focusable="false" data-icon="close-circle" aria-hidden="true">
        <circle cx="12" cy="12" r="10" fill="currentColor" />
        <path d="M8 8l8 8M16 8l-8 8" fill="none" stroke="white" strokeWidth="1.6" strokeLinecap="round" />
      </svg>
    </button>
  )
}
