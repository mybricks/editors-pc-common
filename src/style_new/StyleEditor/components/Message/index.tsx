import React from 'react'
import { render, unmountComponentAtNode } from 'react-dom'
import css from './index.less'

type MessageType = 'success' | 'error' | 'warning'
interface MessageItem {
  type: MessageType
  content: string
  id: number
}

let container: HTMLDivElement | null = null
let items: MessageItem[] = []
let nextId = 0

function renderMessages() {
  render(
    <>
      {items.map(item => <Notice key={item.id} type={item.type} content={item.content} />)}
    </>,
    container!
  )
}

// 提示独立挂到 body，不触发编辑器刷新，面板关闭后仍按原来的三秒时长展示。
function show(type: MessageType, content: string) {
  if (!container) {
    container = document.createElement('div')
    container.className = css.messages
    document.body.appendChild(container)
  }
  const item = { id: nextId++, type, content }
  items.push(item)
  renderMessages()
  setTimeout(() => {
    items = items.filter(notice => notice.id !== item.id)
    if (items.length > 0) {
      renderMessages()
    } else {
      unmountComponentAtNode(container!)
      container!.remove()
      container = null
    }
  }, 3000)
}

function Notice({ type, content }: { type: MessageType; content: string }) {
  let shape = 'M5 1V4.5M5 6.5V7'
  if (type === 'success') shape = 'M1 3.5L3.8 6.5L9 1'
  if (type === 'error') shape = 'M2 1L8 7M8 1L2 7'
  return (
    <div className={css.notice} role={type === 'error' ? 'alert' : 'status'}>
      <div className={css.content}>
        <span className={`${css.icon} ${css[type]}`} aria-hidden="true">
          <svg viewBox="0 0 10 8" width="10" height="8">
            <path d={shape} fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </span>
        <span>{content}</span>
      </div>
    </div>
  )
}

export const message = {
  success: (content: string) => show('success', content),
  error: (content: string) => show('error', content),
  warning: (content: string) => show('warning', content),
}
