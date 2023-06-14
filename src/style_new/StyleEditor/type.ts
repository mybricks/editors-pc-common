import { CSSProperties } from 'react'

import { DEFAULT_OPTIONS } from './constans'

export type Style = {
  [key: string]: any
}

export type Type = typeof DEFAULT_OPTIONS[number]

export type Options = Array<Type | {
  type: Type
  config: {
    [key: string]: any
  }
}>

export interface StyleEditorProps {
  defaultValue: CSSProperties
  options: Options
  onChange: ChangeEvent
}

export type ChangeEvent = (arg: {key: string, value: any} | Array<{key: string, value: any}>) => void
