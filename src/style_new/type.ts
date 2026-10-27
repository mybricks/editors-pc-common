import type { Style, Options } from './StyleEditor/type'
import type { ZoneTab } from './core/zone-tab'

export interface EditorProps {
  editConfig: {
    options: Options
    | {
     targetDom?: HTMLDivElement[]
     plugins?: Options
     selector: string
     defaultOpen?: boolean
     disabledSwitch?: boolean;
     autoOptions?: boolean;
    //  autoCollapse?: boolean
     exclude?: string[]
     comId?: string
     /** 编辑器内部附加属性。当前目标的变体信息，由 Zone 收集链路提供。 */
     zoneTab?: ZoneTab | null
     /** 编辑器内部附加属性。当前目标的共享规则集合，由 Zone 收集链路提供。 */
     mergedTabs?: ZoneTab[]
     /** 编辑器内部附加属性。 当前目标的原始规则集合，由 Zone 收集链路提供。 */
     originTabs?: ZoneTab[]
     /** 编辑器内部附加属性。是否单独编辑模式 */
     soloEdit?: boolean
    }
    | undefined
    value: {
      set(style: Style, options?: { selector?: string }): void
      get(): Style
      previewBatch?(style: Style, options?: { selector?: string }): void
      commitBatch?(): void
      discardBatch?(): void
      getBatchMeta?(): {
        enabled: boolean
        dirtyCount: number
        submitting: boolean
      }
    }
    upload: (file: Array<File>) => Array<string>
    title: string
    ifRefresh?: () => boolean;
    getDefaultOptions?(key: string): any;
  }
}

export type GetDefaultConfigurationProps = EditorProps['editConfig']
