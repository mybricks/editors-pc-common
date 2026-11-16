import type { StyleChangeItem } from '../../StyleEditor/type'
import type { StyleRemovalPlan } from '../apply-style-change'
import type { StyleResolution } from '../style-property'
import type { ZoneTab } from '../zone-tab'
import type { EffectLayer, CssEffectsBundle } from '../../StyleEditor/plugins/Effects/layers'

/** Effects 的空态与清空结果，目前仅用于文字阴影。 */
export interface StyleEmptyState {
  /** 解析继承后的实际效果是否为空；自身没有声明不等于没有阴影。 */
  isEmpty: boolean
  /**
   * 复用现有清空计划：canClear 控制减号，disabledReason 说明不能清空的原因。
   * groups 中的 deletions 表示删除声明，style 表示写 unset/none 等覆盖值。
   * 效果已为空时 groups 为空、canClear 为 false，无需写入。
   */
  clearPlan: StyleRemovalPlan
}

/** 属性的 CSS 语义，供空值判定和清空值选择使用。 */
export interface StyleEmptyStrategy {
  /** 关闭效果的初始值，例如文字阴影的 none。 */
  initialValue: string
  /** 是否默认继承父值；text-shadow 为 true，所以 unset 仍可能显示父级阴影。 */
  inherited: boolean
}

/** Effects 专用接口：只读来源、准备数据，实际提交由面板 onChange 完成。 */
export interface EffectsCore {
  /** 查询当前是否为空及清空方案；未接入的属性返回 undefined，沿用旧逻辑。 */
  getStyleEmptyState(
    key: string,
    tab: ZoneTab,
    target: HTMLElement | null,
    /** 可复用本次操作的来源索引；省略时从 tab 和 target 获取。 */
    resolution?: StyleResolution,
  ): StyleEmptyState | undefined

  /** 判断已解析的有效值是否为空；调用前需将 unset/inherit 解析为父级实际值。 */
  isStyleValueEmpty(key: string, value: any): boolean

  /**
   * 将图层变化转换成提交数据，补齐文字阴影清空值和 !important。
   * 返回数组：交给原 onChange；返回 undefined：清空不可执行，保留当前面板。
   */
  prepareEffectChanges(
    /** 操作后的图层列表。 */
    next: EffectLayer[],
    /** 操作前的图层列表，用于判断文字阴影是否真的变化。 */
    previousLayers: EffectLayer[],
    /** 最近一次 CSS 快照，包含图层列表无法表达的 none/unset 覆盖值。 */
    previous: CssEffectsBundle,
    /** 单独编辑或没有 Zone 时不传，沿用原序列化结果。 */
    tab: ZoneTab | null | undefined,
    target: HTMLElement | null,
  ): StyleChangeItem[] | undefined
}
