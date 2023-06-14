import type { Style, Options } from './StyleEditor/type'

export interface EditorProps {
  editConfig: {
    options: Options
    | {
     targetDom?: HTMLDivElement
     plugins?: Options
     selector: string
    }
    | undefined
    value: {
      set(style: Style): void
      get(): Style
    }
    upload: (file: Array<File>) => Array<string>
    title: string
  }
}

export type GetDefaultConfigurationProps = EditorProps['editConfig']
