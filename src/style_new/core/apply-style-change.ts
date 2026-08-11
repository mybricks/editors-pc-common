import { deepCopy } from '../../utils'
import { mergeCSSProperties } from '../StyleEditor/helper'
import { preservePaintRoles } from '../StyleEditor/helper/paint-stack'
import { PANEL_MAP } from './panel-defaults'

export type StyleChangeItem = { key: string; value: any }

export type ApplyStyleChangeParams = {
  value: StyleChangeItem | StyleChangeItem[]
  liveStyle: Record<string, any>
  collapsedOptions?: string[]
  editConfig: any
  options?: any
  onBatchMetaChange?: () => void
}

export type ApplyStyleChangeResult = {
  nextLiveStyle: Record<string, any>
  applied: boolean
}

/**
 * 处理 StyleEditor onChange：删除守卫、paint roles、merge、batch preview / value.set。
 * 返回更新后的 liveStyle；未实际变更时 applied=false。
 */
export function applyStyleChange({
  value,
  liveStyle,
  collapsedOptions,
  editConfig,
  options,
  onBatchMetaChange,
}: ApplyStyleChangeParams): ApplyStyleChangeResult {
  // 每次操作开始前清空上次可能残留的删除信号，防止普通组件的删除操作污染 AI 组件
  ;(window as any).__mybricks_style_deletions = null
  const deletedKeys: string[] = []
  const nextSetValue: Record<string, any> = deepCopy(liveStyle || {})
  const rawItems = Array.isArray(value) ? value : [value]
  const changeItems = preservePaintRoles(rawItems, nextSetValue)

  let hasRealChange = false
  const collapsedPanelSet = new Set(
    (collapsedOptions || []).map((panelKey: string) => panelKey?.toLowerCase?.())
  )
  const resolvePanelMapKey = (styleKey: string) => {
    if (PANEL_MAP[styleKey]) return styleKey
    if (!styleKey) return styleKey
    const normalizedKey = styleKey[0].toLowerCase() + styleKey.slice(1)
    return PANEL_MAP[normalizedKey] ? normalizedKey : styleKey
  }

  // 同一批 onChange 里，若有其他 key 被赋了真实值（非 null），说明用户正在真实编辑
  // 该 key 所属的面板（如 Size 插件同批提交 width 真实值 + flex/flexGrow/flexBasis 清空），
  // 此时不应受 collapsedOptions 初始快照（选中元素时一次性算好、后续不再更新）的影响，
  // 否则面板初始被判定为"无生效样式"而折叠时，同批的清除请求会被误判为无效删除而丢弃。
  const activePanelsInBatch = new Set(
    changeItems
      .filter(({ value }) => value !== null)
      .map(({ key }) => PANEL_MAP[resolvePanelMapKey(key)])
      .filter(Boolean)
  )

  // flex* 已归属弹性面板，但 Size 改固定尺寸时仍会同批清空它们；
  // 允许在 size 面板有真实赋值的批次里放行这些清除。
  const SIZE_CLEARS_FLEX_KEYS = new Set(['flex', 'flexGrow', 'flexShrink', 'flexBasis'])

  changeItems.forEach(({ key, value }) => {
    if (value === null) {
      const hasUserSetValue = key in nextSetValue
      // 仅当该 key 已由用户写入、其所属面板当前有生效样式、或同批次有该面板的真实赋值，才视为真实删除。
      // 否则（如展开空面板后折叠、或插件内部的无效 null），跳过，不触发写入。
      const panelMapKey = resolvePanelMapKey(key)
      const panelKey = PANEL_MAP[panelMapKey]
      const hasEffectedStyle = panelKey
        ? (!collapsedPanelSet.has(panelKey.toLowerCase()) || activePanelsInBatch.has(panelKey))
        : false
      const sizeClearsFlex =
        SIZE_CLEARS_FLEX_KEYS.has(panelMapKey) && activePanelsInBatch.has('size')
      const shouldDelete = hasUserSetValue || hasEffectedStyle || sizeClearsFlex

      if (shouldDelete) {
        deletedKeys.push(key)
        hasRealChange = true
      }
      if (hasUserSetValue) {
        delete nextSetValue[key]
      }
    } else {
      if (nextSetValue[key] !== value) {
        hasRealChange = true
      }
      nextSetValue[key] = value
    }
  })

  // flex 简写与长写必须互斥落盘。否则 Less 里残留 flex:1 再写 flex-shrink:11，
  // Chrome CSSOM 会合成 flex: 1 11 0%，重聚焦时被误判成「比例」且回显错误。
  const FLEX_LONGHAND_KEYS = ['flexGrow', 'flexShrink', 'flexBasis'] as const
  const isPresent = (v: unknown) => v != null && String(v).trim() !== ''
  const writingFlexLonghand = FLEX_LONGHAND_KEYS.some((k) => isPresent(nextSetValue[k]))
  const writingFlexShorthand = isPresent(nextSetValue.flex)
  const forceDelete = (key: string) => {
    if (key in nextSetValue) delete nextSetValue[key]
    if (!deletedKeys.includes(key)) deletedKeys.push(key)
    hasRealChange = true
  }
  if (writingFlexLonghand) {
    forceDelete('flex')
  } else if (writingFlexShorthand) {
    FLEX_LONGHAND_KEYS.forEach((k) => forceDelete(k))
  }

  // 没有任何实际变更时直接返回，不触发样式写入（避免展开面板后折叠产生多余版本）
  if (!hasRealChange) {
    return { nextLiveStyle: liveStyle, applied: false }
  }

  // 删除信号通过 window 侧通道传递给 valueProxy.set，
  // 不污染 editConfig.value（代码编辑器不会看到 null 值）。
  // 同批又被赋了新值的 key 必须排除：styleProxy 会先写 value 再按 deletions 删除，
  // 重叠 key 会被清掉（表现为粘贴/批量替换后样式变空）。
  const effectiveDeletions = deletedKeys.filter((key) => !(key in nextSetValue))
  if (effectiveDeletions.length > 0) {
    ;(window as any).__mybricks_style_deletions = effectiveDeletions
  }

  const mergedCssProperties = mergeCSSProperties(deepCopy(nextSetValue))
  // merge 内部 Object.assign 到临时 DOM 后，Chrome 可能把长写折叠进 style.flex；
  // 再次按写入意图收一遍，避免把合成简写写进 Less。
  if (writingFlexLonghand) {
    delete (mergedCssProperties as any).flex
  } else if (writingFlexShorthand) {
    delete (mergedCssProperties as any).flexGrow
    delete (mergedCssProperties as any).flexShrink
    delete (mergedCssProperties as any).flexBasis
  }

  // options?.selector 优先；兜底从 editConfig.options.selector 读取当前激活的 selector
  const selector =
    options?.selector ??
    (!Array.isArray(editConfig.options) && editConfig.options
      ? (editConfig.options as any).selector
      : undefined)

  const setOptions = selector ? { selector } : undefined
  const batchMeta = editConfig.value.getBatchMeta?.()
  const targetDom =
    !Array.isArray(editConfig.options) && editConfig.options
      ? (editConfig.options as any).targetDom ?? null
      : null
  const realTargetDom = (
    Object.prototype.toString.call(targetDom) === '[object NodeList]' && targetDom?.length
      ? targetDom[0]
      : targetDom
  ) as HTMLElement | null
  const isThirdPartyFocus = !!realTargetDom && !realTargetDom.getAttribute('data-zone-selector')
  if ((batchMeta?.enabled || isThirdPartyFocus) && editConfig.value.previewBatch) {
    editConfig.value.previewBatch(mergedCssProperties, setOptions)
    onBatchMetaChange?.()
    return { nextLiveStyle: nextSetValue, applied: true }
  }

  editConfig.value.set(mergedCssProperties, setOptions)
  onBatchMetaChange?.()
  return { nextLiveStyle: nextSetValue, applied: true }
}
