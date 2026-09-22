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
import {
  collectStyleSourceCandidates, createStyleClearPlan, cssPropertyName, getStyleResolution,
  readStaticInlineStyleInfo, resolveEffectiveStyleSource,
} from './style-property'
import type { StyleClearPlan } from './style-property'

export type StyleChangeItem = {
  key: string
  value: any
  intent?: 'clear-effective-style' | 'set-effective-style'
}

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
const INLINE_STYLE_LABEL = 'inline'

type StyleWriteLogContext = {
  targetDom: HTMLElement | null
  activeZoneTab: ZoneTab | null
  zoneTabs: ZoneTab[]
  deletion?: boolean
  skipped?: boolean
}

type StyleOperationLogParams = {
  key: string
  value: any
  action: '写入' | '清空'
  candidates: ReturnType<typeof collectStyleSourceCandidates>
  winner: ReturnType<typeof resolveEffectiveStyleSource>
  writeSelectors: string[]
  skipped?: boolean
  reason?: string
}

function logStyleOperation({
  key,
  value,
  action,
  candidates,
  winner,
  writeSelectors,
  skipped,
  reason,
}: StyleOperationLogParams) {
  const selectors = Array.from(new Set(candidates.map((candidate) => candidate.label).filter(Boolean)))
  const details: Record<string, any> = {
    属性: key,
    方式: action,
    生效selector: winner?.label ?? null,
    其他未生效selector: selectors.filter((selector) => selector !== winner?.label),
    写入selector:
      writeSelectors.length > 1
        ? writeSelectors
        : writeSelectors[0] ?? null,
    值: value,
  }
  if (skipped) {
    details.结果 = '跳过'
    details.原因 = reason || null
  }
  console.log('[样式编辑]', details)
}

function logStyleClearPlan(plan: StyleClearPlan, execute = true) {
  const canApply = execute && (plan.action === 'delete' || plan.action === 'write-unset')
  logStyleOperation({
    key: plan.key,
    value: canApply ? plan.value : null,
    action: '清空',
    candidates: plan.candidates,
    winner: plan.winner,
    writeSelectors: canApply ? [plan.selector] : [],
    skipped: !canApply,
    reason:
      plan.action === 'noop' || plan.action === 'unsupported'
        ? plan.reason
        : execute
          ? undefined
          : 'batch-clear-aborted',
  })
}

function applyStyleClearPlans(
  plans: StyleClearPlan[],
  editConfig: any,
  zoneWriteTargets?: Map<string, ZoneWriteTarget>,
  execute = true
): string[] {
  const appliedKeys: string[] = []

  plans.forEach((plan) => {
    logStyleClearPlan(plan, execute)

    if (!execute || plan.action === 'noop' || plan.action === 'unsupported') return

    // 新清空链路用 null/unset 直接表达意图，不再写全局删除 side-channel。
    ;(window as any).__mybricks_style_deletions = null
    editConfig.value.set(
      { [plan.key]: plan.value },
      { selector: plan.selector }
    )
    zoneWriteTargets?.delete(plan.key)
    appliedKeys.push(plan.key)
  })

  return appliedKeys
}

/**
 * 按组件库 styleProxy 当前路由规则推测实际落点：
 * - 三方/无 zone 节点走 inline preview；
 * - 已有静态 JSX style 的同名属性优先写 inline；
 * - class 节点删除 inline 后还会继续处理 Less selector。
 */
function resolveSandboxWriteClassNames(
  targetDom: HTMLElement | null,
  styleKey: string,
  targetSelector: string | undefined,
  deletion: boolean
): string[] {
  if (!targetDom) return [targetSelector || '(宿主默认目标)']

  const hasZoneSelector = !!targetDom.dataset?.zoneSelector
  const hasDragInsert = targetDom.hasAttribute('data-drag-insert')
  if ((!hasZoneSelector && !hasDragInsert) || targetDom.classList.length === 0 || hasDragInsert) {
    return [INLINE_STYLE_LABEL]
  }

  if (readStaticInlineStyleInfo(targetDom, styleKey)) {
    if (deletion && targetSelector) {
      return [INLINE_STYLE_LABEL, targetSelector]
    }
    return [INLINE_STYLE_LABEL]
  }

  return [targetSelector || '(宿主默认目标)']
}

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
  targetSelector: string | undefined,
  context: StyleWriteLogContext
) {
  Object.entries(style).forEach(([key, value]) => {
    const candidates = collectStyleSourceCandidates(
      context.targetDom,
      context.zoneTabs,
      context.activeZoneTab,
      key
    )
    const effective = resolveEffectiveStyleSource(candidates)
    const isDeletion = !!context.deletion || value === null
    const writeClassNames = context.skipped
      ? []
      : resolveSandboxWriteClassNames(
        context.targetDom,
        key,
        targetSelector,
        isDeletion
      )

    logStyleOperation({
      key,
      value,
      action: isDeletion ? '清空' : '写入',
      candidates,
      winner: effective,
      writeSelectors: writeClassNames,
      skipped: !!context.skipped,
      reason: context.skipped ? 'write-target-unavailable' : undefined,
    })
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

/** 共享属性决策；普通值沿用现有写入，清空单独提交 null/unset。 */
function applyEffectiveStyleChanges(
  items: StyleChangeItem[], liveStyle: Record<string, any>, tab: ZoneTab,
  target: HTMLElement | null, editConfig: any, onBatchMetaChange?: () => void
): ApplyStyleChangeResult {
  const resolution = getStyleResolution(tab, target)
  const changes = preservePaintRoles(items, liveStyle)
  // 先预检整个用户动作，避免清空不可执行却先修改了共享图层。
  const plans = changes.filter(item => item.value === null).map(item => resolution.get(item.key).clearPlan)
  if (plans.some(plan => plan.action === 'unsupported')) {
    plans.forEach(plan => logStyleClearPlan(plan, false))
    return { nextLiveStyle: liveStyle, applied: false, clearApplied: false, clearUnsupported: true }
  }
  const writes = changes.filter(item => item.value != null).map(({ key, value }) => ({ key, value }))
  const normal = writes.length
    ? applyStyleChange({ value: writes, liveStyle, editConfig })
    : { nextLiveStyle: liveStyle, applied: false }
  const nextLiveStyle = { ...normal.nextLiveStyle }
  const groups = new Map<string, Record<string, any>>()
  let clearApplied = false
  plans.forEach(plan => {
    logStyleClearPlan(plan)
    if (plan.action === 'noop' || plan.action === 'unsupported') return
    const patch = groups.get(plan.selector) || {}
    patch[plan.key] = plan.value
    groups.set(plan.selector, patch)
  })
  groups.forEach((patch, selector) => {
    // 组件库现有协议：整包只包含 null/unset，就按 selector 定向清空。
    editConfig.value.set(patch, { selector })
    // JSX 内联样式经源码重编译后才会更新画布；同步更新当前节点，
    // 让删除回调可以立即读取到清空后的真实计算值。
    if (selector === INLINE_STYLE_LABEL && target) {
      Object.entries(patch).forEach(([key, value]) => {
        const property = cssPropertyName(key)
        if (value === null) {
          target.style.removeProperty(property)
          return
        }
        const nextValue = String(value).trim()
        const important = IMPORTANT_SUFFIX_RE.test(nextValue)
        target.style.setProperty(
          property,
          nextValue.replace(IMPORTANT_SUFFIX_RE, '').trim(),
          important ? 'important' : ''
        )
      })
    }
    Object.entries(patch).forEach(([key, value]) => {
      if (value === null) delete nextLiveStyle[key]
      else nextLiveStyle[key] = value
      resolution.record(key, value, selector)
    })
    clearApplied = true
  })
  const applied = normal.applied || clearApplied
  if (applied) onBatchMetaChange?.()
  return { nextLiveStyle, applied, clearApplied, clearUnsupported: false }
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
  clearApplied: boolean
  clearUnsupported: boolean
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
  const activeZoneTab: ZoneTab | null =
    !Array.isArray(editConfig.options) && editConfig.options
      ? (editConfig.options as any).zoneTab ?? null
      : null
  const zoneTabs: ZoneTab[] =
    !Array.isArray(editConfig.options) && editConfig.options
      ? (editConfig.options as any).zoneTabs ?? (activeZoneTab ? [activeZoneTab] : [])
      : (activeZoneTab ? [activeZoneTab] : [])
  if (activeZoneTab && rawItems.length && rawItems.every(item => item.intent)) {
    return applyEffectiveStyleChanges(rawItems, liveStyle, activeZoneTab, realTargetDom, editConfig, onBatchMetaChange)
  }
  const clearItems = rawItems.filter(
    (item) => item.intent === 'clear-effective-style'
  )
  const normalRawItems = rawItems.filter(
    (item) => item.intent !== 'clear-effective-style'
  )
  // 必须在任何普通写入改变 DOM/CSSOM 之前确定来源、winner 和目标。
  const clearPlans = clearItems.map((item) =>
    createStyleClearPlan(realTargetDom, zoneTabs, activeZoneTab, item.key)
  )
  const clearUnsupported = clearPlans.some(
    (plan) => plan.action === 'unsupported'
  )

  // 显式清空是一个用户动作；目标不可写时不能只执行同批的
  // paint-stack 清理，否则会留下“颜色未清、其他属性已删”的半完成状态。
  if (clearUnsupported) {
    applyStyleClearPlans(clearPlans, editConfig, zoneWriteTargets, false)
    return {
      nextLiveStyle: liveStyle,
      applied: false,
      clearApplied: false,
      clearUnsupported: true,
    }
  }

  if (normalRawItems.length === 0) {
    const appliedKeys = applyStyleClearPlans(
      clearPlans,
      editConfig,
      zoneWriteTargets
    )
    if (appliedKeys.length === 0) {
      return {
        nextLiveStyle: liveStyle,
        applied: false,
        clearApplied: false,
        clearUnsupported: false,
      }
    }
    const nextLiveStyle = deepCopy(liveStyle || {})
    appliedKeys.forEach((key) => delete nextLiveStyle[key])
    onBatchMetaChange?.()
    return {
      nextLiveStyle,
      applied: true,
      clearApplied: true,
      clearUnsupported: false,
    }
  }

  const isSolidTextFillTransition =
    isTextFillActive(liveStyle) &&
    normalRawItems.some(
      (item) =>
        item.key === 'color' &&
        typeof item.value === 'string' &&
        item.value.trim() !== '' &&
        item.value.trim().toLowerCase() !== 'transparent'
    ) &&
    normalRawItems.some(
      (item) =>
        (item.key === 'WebkitTextFillColor' || item.key === 'webkitTextFillColor') &&
        item.value == null
    )
  const priorityAwareItems = preserveCascadePriority(
    normalRawItems,
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

  // 增量修改只归一化本次触碰的属性组，避免修改 position 时误写 margin/padding。
  const normalized = normalizeStyleShorthands(
    nextSetValue,
    changeItems,
    new Set(deletedKeys),
    { changedGroupsOnly: true }
  )
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
    const appliedKeys = applyStyleClearPlans(
      clearPlans,
      editConfig,
      zoneWriteTargets
    )
    if (appliedKeys.length === 0) {
      return {
        nextLiveStyle: liveStyle,
        applied: false,
        clearApplied: false,
        clearUnsupported: false,
      }
    }
    const nextLiveStyle = deepCopy(liveStyle || {})
    appliedKeys.forEach((key) => delete nextLiveStyle[key])
    onBatchMetaChange?.()
    return {
      nextLiveStyle,
      applied: true,
      clearApplied: true,
      clearUnsupported: false,
    }
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
  const writeLogContext: StyleWriteLogContext = {
    targetDom: realTargetDom,
    activeZoneTab,
    zoneTabs,
  }

  if (isSolidTextFillTransition && !isThirdPartyFocus) {
    const comId =
      !Array.isArray(editConfig.options) && editConfig.options
        ? String((editConfig.options as any).comId || '')
        : ''
    const cleanupTargets = collectTextFillCleanupTargets(realTargetDom, comId)
    cleanupTargets.forEach((target) => {
      ;(window as any).__mybricks_style_deletions = target.properties
      const cleanupOptions = { selector: target.selector }
      logStyleWrite(
        Object.fromEntries(target.properties.map((key) => [key, null])),
        target.selector,
        { ...writeLogContext, deletion: true }
      )
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
      if (!deletionTarget) {
        logStyleWrite(
          { [key]: null },
          undefined,
          { ...writeLogContext, deletion: true, skipped: true }
        )
        return
      }
      const group = addStyleWriteGroup(groups, deletionTarget.selector)
      if (!group.deletions.includes(deletionTarget.property)) {
        group.deletions.push(deletionTarget.property)
      }
    })

    if (groups.size === 0) {
      const appliedKeys = applyStyleClearPlans(
        clearPlans,
        editConfig,
        zoneWriteTargets
      )
      if (appliedKeys.length === 0) {
        return {
          nextLiveStyle: liveStyle,
          applied: false,
          clearApplied: false,
          clearUnsupported: false,
        }
      }
      const nextLiveStyle = deepCopy(liveStyle || {})
      appliedKeys.forEach((key) => delete nextLiveStyle[key])
      onBatchMetaChange?.()
      return {
        nextLiveStyle,
        applied: true,
        clearApplied: true,
        clearUnsupported: false,
      }
    }

    try {
      groups.forEach((group, sourceSelector) => {
        ;(window as any).__mybricks_style_deletions =
          group.deletions.length > 0 ? group.deletions : null
        const groupOptions = { selector: sourceSelector }
        logStyleWrite(group.style, sourceSelector, writeLogContext)
        logStyleWrite(
          Object.fromEntries(group.deletions.map((key) => [key, null])),
          sourceSelector,
          { ...writeLogContext, deletion: true }
        )
        write(group.style, groupOptions)
        Object.entries(group.style).forEach(([key, value]) => {
          getStyleResolution(activeZoneTab, realTargetDom).record(key, value, sourceSelector)
        })
      })
    } finally {
      ;(window as any).__mybricks_style_deletions = null
    }
    const appliedKeys = applyStyleClearPlans(
      clearPlans,
      editConfig,
      zoneWriteTargets
    )
    appliedKeys.forEach((key) => delete finalCssProperties[key])
    onBatchMetaChange?.()
    return {
      nextLiveStyle: finalCssProperties,
      applied: true,
      clearApplied: appliedKeys.length > 0,
      clearUnsupported: false,
    }
  }

  ;(window as any).__mybricks_style_deletions =
    effectiveDeletions.length > 0 ? effectiveDeletions : null
  logStyleWrite(
    getStyleDiff(liveStyle || {}, finalCssProperties, effectiveDeletions),
    selector,
    writeLogContext
  )
  write(finalCssProperties, setOptions)
  ;(window as any).__mybricks_style_deletions = null
  const appliedKeys = applyStyleClearPlans(
    clearPlans,
    editConfig,
    zoneWriteTargets
  )
  appliedKeys.forEach((key) => delete finalCssProperties[key])
  onBatchMetaChange?.()
  return {
    nextLiveStyle: finalCssProperties,
    applied: true,
    clearApplied: appliedKeys.length > 0,
    clearUnsupported: false,
  }
}
