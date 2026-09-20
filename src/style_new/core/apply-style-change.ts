import { deepCopy } from '../../utils'
import { mergeCSSProperties } from '../StyleEditor/helper'
import { preservePaintRoles } from '../StyleEditor/helper/paint-stack'
import { PANEL_MAP } from './panel-defaults'
import { findCascadeWinnerDetail } from './cascade-winner'
import { toLine } from './css-code-codec'
import { toElementArray } from './dom'
import { collectTextFillCleanupTargets } from './effective-text-fill'
import {
  normalizeStyleShorthands,
  overlayNormalizedShorthands,
} from './shorthand-normalizer'
import { isTextFillActive } from '../StyleEditor/helper/text-fill'
import {
  resolveZoneFallbackSelector,
  resolveZoneDeletionTarget,
  resolveZonePropertySelector,
} from './zone-tab'
import type { ZoneTab } from './zone-tab'

export type StyleChangeItem = { key: string; value: any }

type StyleWriteGroup = {
  style: Record<string, any>
  deletions: string[]
}

export type ZoneWriteTarget = {
  selector: string
  property: string
}

const IMPORTANT_SUFFIX_RE = /!important\s*$/i
const HOVER_SELECTOR_RE = /:hover\s*$/

function getStyleDiff(
  beforeStyle: Record<string, any>,
  afterStyle: Record<string, any>,
  deletions: string[]
): Record<string, any> {
  const changedStyle: Record<string, any> = {}
  const changedKeys = new Set([
    ...Object.keys(beforeStyle || {}),
    ...Object.keys(afterStyle || {}),
    ...deletions,
  ])

  changedKeys.forEach((key) => {
    const hadBefore = Object.prototype.hasOwnProperty.call(beforeStyle || {}, key)
    const hasAfter = Object.prototype.hasOwnProperty.call(afterStyle || {}, key)
    if (hadBefore !== hasAfter || beforeStyle?.[key] !== afterStyle?.[key]) {
      changedStyle[key] = hasAfter ? deepCopy(afterStyle[key]) : null
    }
  })

  return changedStyle
}

function addStyleWriteGroup(
  groups: Map<string, StyleWriteGroup>,
  selector: string
): StyleWriteGroup {
  let group = groups.get(selector)
  if (!group) {
    group = { style: {}, deletions: [] }
    groups.set(selector, group)
  }
  return group
}

function logStyleWrite(
  style: Record<string, any>,
  targetSelector: string | undefined
) {
  Object.entries(style).forEach(([key, value]) => {
    // 排查样式写入目标时可取消下一行注释
    // console.log('[style_new][style-write]', {
    //   key,
    //   value,
    //   className: targetSelector || '(宿主默认目标)',
    // })
  })
}

const preserveCascadePriority = (
  items: StyleChangeItem[],
  targetDom: HTMLElement | null,
  selector: unknown,
  enabled: boolean,
  priorityCache?: Map<string, boolean>
): StyleChangeItem[] => {
  if (!enabled || !targetDom) return items

  const cascadeMode = typeof selector === 'string' && HOVER_SELECTOR_RE.test(selector)
    ? 'hover'
    : 'default'

  return items.map((item) => {
    if (
      item.value === null ||
      (typeof item.value !== 'string' && typeof item.value !== 'number') ||
      IMPORTANT_SUFFIX_RE.test(String(item.value))
    ) {
      return item
    }
    const property = toLine(item.key)
    const cacheKey = `${cascadeMode}:${property}`
    let shouldPreservePriority = priorityCache?.get(cacheKey)
    if (shouldPreservePriority === undefined) {
      shouldPreservePriority = !!findCascadeWinnerDetail(targetDom, property, cascadeMode)?.important
      priorityCache?.set(cacheKey, shouldPreservePriority)
    }
    if (!shouldPreservePriority) return item
    return { ...item, value: `${item.value}!important` }
  })
}

export type ApplyStyleChangeParams = {
  value: StyleChangeItem | StyleChangeItem[]
  liveStyle: Record<string, any>
  collapsedOptions?: string[]
  editConfig: any
  options?: any
  preserveImportantPriority?: boolean
  importantPriorityCache?: Map<string, boolean>
  zoneWriteTargets?: Map<string, ZoneWriteTarget>
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
  preserveImportantPriority = false,
  importantPriorityCache,
  zoneWriteTargets,
  onBatchMetaChange,
}: ApplyStyleChangeParams): ApplyStyleChangeResult {
  // 每次操作开始前清空上次可能残留的删除信号，防止普通组件的删除操作污染 AI 组件
  ;(window as any).__mybricks_style_deletions = null
  const deletedKeys: string[] = []
  const nextSetValue: Record<string, any> = deepCopy(liveStyle || {})
  const rawItems = Array.isArray(value) ? value : [value]
  const selector =
    options?.selector ??
    (!Array.isArray(editConfig.options) && editConfig.options
      ? (editConfig.options as any).selector
      : undefined)
  const targetDom =
    !Array.isArray(editConfig.options) && editConfig.options
      ? (editConfig.options as any).targetDom ?? null
      : null
  const realTargetDom = (toElementArray(targetDom)[0] ?? null) as HTMLElement | null
  const isSolidTextFillTransition =
    isTextFillActive(liveStyle) &&
    rawItems.some(
      (item) =>
        item.key === 'color' &&
        typeof item.value === 'string' &&
        item.value.trim() !== '' &&
        item.value.trim().toLowerCase() !== 'transparent'
    ) &&
    rawItems.some(
      (item) =>
        (item.key === 'WebkitTextFillColor' || item.key === 'webkitTextFillColor') &&
        item.value == null
    )
  const priorityAwareItems = preserveCascadePriority(
    rawItems,
    realTargetDom,
    selector,
    preserveImportantPriority,
    importantPriorityCache
  )
  const changeItems = preservePaintRoles(priorityAwareItems, nextSetValue)

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

  const normalized = normalizeStyleShorthands(nextSetValue, changeItems, new Set(deletedKeys))
  normalized.deletions.forEach((key) => {
    if (!deletedKeys.includes(key)) deletedKeys.push(key)
  })
  if (
    Object.keys(normalized.style).length !== Object.keys(nextSetValue).length ||
    Object.keys(normalized.style).some((key) => normalized.style[key] !== nextSetValue[key])
  ) {
    hasRealChange = true
  }

  // 没有任何实际变更时直接返回，不触发样式写入（避免展开面板后折叠产生多余版本）
  if (!hasRealChange) {
    return { nextLiveStyle: liveStyle, applied: false }
  }

  const mergedCssProperties = mergeCSSProperties(deepCopy(normalized.style))
  const finalCssProperties = overlayNormalizedShorthands(
    mergedCssProperties as Record<string, any>,
    normalized.style
  )

  // merge 内部 Object.assign 到临时 DOM 后，Chrome 可能把长写折叠进 style.flex；
  // 再次按写入意图收一遍，避免把合成简写写进 Less。
  if (writingFlexLonghand) {
    delete finalCssProperties.flex
  } else if (writingFlexShorthand) {
    delete finalCssProperties.flexGrow
    delete finalCssProperties.flexShrink
    delete finalCssProperties.flexBasis
  }

  // 删除信号通过 window 侧通道传递给 valueProxy.set，不污染 editConfig.value。
  // 以最终写入对象过滤，确保同批重新生成的 key 不会被 valueProxy 再删除。
  const effectiveDeletions = deletedKeys.filter((key) => !(key in finalCssProperties))

  const setOptions = selector ? { selector } : undefined
  const batchMeta = editConfig.value.getBatchMeta?.()
  const isThirdPartyFocus = !!realTargetDom && !realTargetDom.getAttribute('data-zone-selector')
  const activeZoneTab: ZoneTab | null =
    !Array.isArray(editConfig.options) && editConfig.options
      ? (editConfig.options as any).zoneTab ?? null
      : null

  if (isSolidTextFillTransition && !isThirdPartyFocus) {
    const comId =
      !Array.isArray(editConfig.options) && editConfig.options
        ? String((editConfig.options as any).comId || '')
        : ''
    const cleanupTargets = collectTextFillCleanupTargets(realTargetDom, comId)
    cleanupTargets.forEach((target) => {
      ;(window as any).__mybricks_style_deletions = target.properties
      const cleanupOptions = { selector: target.selector }
      editConfig.value.set({}, cleanupOptions)
    })
  }

  // 多目标文字渐变清理会暂时改写删除侧通道；主写入前恢复本次常规删除集合。
  const usePreviewBatch =
    (batchMeta?.enabled || isThirdPartyFocus) && !!editConfig.value.previewBatch
  const write = usePreviewBatch
    ? (style: Record<string, any>, options?: { selector?: string }) =>
      editConfig.value.previewBatch!(style, options)
    : (style: Record<string, any>, options?: { selector?: string }) =>
      editConfig.value.set(style, options)
  // Zone Tab 的 sourceRules 同时保存 CSSOM 运行时 selector 和可写回 Less 的源码 selector。
  // 只有这里才拆分本次变更；普通组件继续沿用原来的完整状态写回逻辑。
  if (activeZoneTab?.sourceRules?.length) {
    const writeStyle = getStyleDiff(liveStyle || {}, finalCssProperties, effectiveDeletions)
    const groups = new Map<string, StyleWriteGroup>()

    Object.entries(writeStyle).forEach(([key, value]) => {
      // getStyleDiff 用 null 表示删除；删除必须通过专用 side-channel 传递，
      // 不能把 null 当作本次要写入的样式值。
      if (!Object.prototype.hasOwnProperty.call(finalCssProperties, key)) return
      const sourceSelector =
        resolveZonePropertySelector(activeZoneTab, key) ||
        resolveZoneFallbackSelector(activeZoneTab)
      const group = addStyleWriteGroup(groups, sourceSelector)
      group.style[key] = deepCopy(value)
      zoneWriteTargets?.set(key, {
        selector: sourceSelector,
        property: key,
      })
    })

    effectiveDeletions.forEach((key) => {
      const rememberedTarget = zoneWriteTargets?.get(key)
      const deletionTarget =
        rememberedTarget ||
        resolveZoneDeletionTarget(activeZoneTab, key)
      if (!deletionTarget) return
      const group = addStyleWriteGroup(groups, deletionTarget.selector)
      if (!group.deletions.includes(deletionTarget.property)) {
        group.deletions.push(deletionTarget.property)
      }
    })

    if (groups.size === 0) {
      return { nextLiveStyle: liveStyle, applied: false }
    }

    try {
      groups.forEach((group, sourceSelector) => {
        ;(window as any).__mybricks_style_deletions =
          group.deletions.length > 0 ? group.deletions : null
        const groupOptions = { selector: sourceSelector }
        logStyleWrite(group.style, sourceSelector)
        logStyleWrite(
          Object.fromEntries(group.deletions.map((key) => [key, null])),
          sourceSelector
        )
        write(group.style, groupOptions)
      })
    } finally {
      ;(window as any).__mybricks_style_deletions = null
    }
    onBatchMetaChange?.()
    return { nextLiveStyle: finalCssProperties, applied: true }
  }

  ;(window as any).__mybricks_style_deletions =
    effectiveDeletions.length > 0 ? effectiveDeletions : null
  logStyleWrite(
    getStyleDiff(liveStyle || {}, finalCssProperties, effectiveDeletions),
    selector
  )
  write(finalCssProperties, setOptions)
  ;(window as any).__mybricks_style_deletions = null
  onBatchMetaChange?.()
  return { nextLiveStyle: finalCssProperties, applied: true }
}
