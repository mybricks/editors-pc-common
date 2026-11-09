import React from 'react'
import { SketchCloseIcon } from '../SketchPopup'
import css from './ActionIcons.less'

export function CloseOutlined() {
  return <span className={css.icon}>{SketchCloseIcon}</span>
}

export function CheckOutlined() {
  return <span className={css.icon}><svg viewBox="64 64 896 896" width="1em" height="1em" fill="currentColor" aria-hidden="true"><path d="M889.4 150.8h-73.8c-10.4 0-20.3 5-26.7 13.6L353.5 768.1 235.2 603.9a33.01 33.01 0 00-26.7-13.6h-73.8c-6.5 0-10.3 7.4-6.5 12.7l199.3 276.4c12.8 17.7 39.1 17.7 51.8 0l516.5-715.9c3.9-5.3.1-12.7-6.4-12.7z" /></svg></span>
}

export function DeleteOutlined() {
  return <span className={css.icon}><svg viewBox="64 64 896 896" width="1em" height="1em" fill="currentColor" aria-hidden="true"><path d="M360 184h-8c4.4 0 8-3.6 8-8v8h304v-8c0 4.4 3.6 8 8 8h-8v72h72v-80c0-35.3-28.7-64-64-64H352c-35.3 0-64 28.7-64 64v80h72v-72zm504 72H160c-17.7 0-32 14.3-32 32v32c0 4.4 3.6 8 8 8h60.4l24.7 522c1.6 34.1 29.8 61 63.9 61h454c34.2 0 62.3-26.8 63.9-61l24.7-522H888c4.4 0 8-3.6 8-8v-32c0-17.7-14.3-32-32-32zM731.3 839H292.7l-24.2-511h487l-24.2 511z" /></svg></span>
}

export function LoadingOutlined() {
  return <span className={`${css.icon} ${css.loading}`}><svg viewBox="0 0 24 24" width="1em" height="1em" fill="none" aria-hidden="true"><circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="2" strokeDasharray="42 15" /></svg></span>
}
