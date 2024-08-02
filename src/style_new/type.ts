import type { Style, Options } from './StyleEditor/type'

export interface EditorProps {
  editConfig: {
    options: Options
    | {
     targetDom?: HTMLDivElement[]
     plugins?: Options
     selector: string
     defaultOpen?: boolean
     disabledSwitch?: boolean;
    }
    | undefined
    value: {
      set(style: Style): void
      get(): Style
    }
    upload: (file: Array<File>) => Array<string>
    title: string
    ifRefresh?: () => boolean;
    getDefaultOptions?(key: string): any;
  }
}

export type GetDefaultConfigurationProps = EditorProps['editConfig']
