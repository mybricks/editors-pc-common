// @ts-ignore
import { compare } from 'specificity'

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
import type { ZoneSourceRule, ZoneTab } from './zone-tab'
import { calculateSafeSpecificity } from './selector-utils'

export type StyleChangeItem = {
  key: string
  value: any
  intent?: 'clear-effective-style'
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
const INLINE_STYLE_LABEL = 'inline style'

/** 与 Zone 写入来源解析保持一致的少量简写兜底。 */
const STYLE_SOURCE_PROPERTY_FALLBACKS: Record<string, string[]> = {
  backgroundColor: ['background'],
  backgroundImage: ['background'],
  fontSize: ['font'],
  borderRadius: [
    'border-top-left-radius',
    'border-top-right-radius',
    'border-bottom-right-radius',
    'border-bottom-left-radius',
  ],
}

type DeclaredStyleValue = {
  property: string
  value: string
  important: boolean
}

type StyleSourceCandidate = DeclaredStyleValue & {
  label: string
  source?: ZoneSourceRule
  specificity?: any
  sourceOrder: number
  inline: boolean
}

type StyleClearPlan =
  | {
      action: 'delete' | 'write-unset'
      key: string
      value: null | 'unset' | 'unset !important'
      selector: string
      winner: StyleSourceCandidate
      candidates: StyleSourceCandidate[]
    }
  | {
      action: 'noop' | 'unsupported'
      key: string
      reason: string
      winner: StyleSourceCandidate | null
      candidates: StyleSourceCandidate[]
    }

type StyleWriteLogContext = {
  targetDom: HTMLElement | null
  activeZoneTab: ZoneTab | null
  zoneTabs: ZoneTab[]
  deletion?: boolean
  skipped?: boolean
}

function readDeclaredStyleValue(
  style: CSSStyleDeclaration,
  styleKey: string
): DeclaredStyleValue | null {
  const directProperty = toLine(styleKey)
  const properties = [
    directProperty,
    ...(STYLE_SOURCE_PROPERTY_FALLBACKS[styleKey] || []),
  ]

  for (const property of properties) {
    const value = style.getPropertyValue(property).trim()
    if (!value) continue
    return {
      property,
      value,
      important: style.getPropertyPriority(property) === 'important',
    }
  }

  return null
}

function getDiagnosticZoneTabs(
  zoneTabs: ZoneTab[],
  activeZoneTab: ZoneTab | null
): ZoneTab[] {
  if (!activeZoneTab?.pseudo) {
    return zoneTabs.filter((tab) => !tab.pseudo)
  }

  // 状态 Tab 下同时保留基础态和相同状态的候选，便于看到实际覆盖链。
  return zoneTabs.filter(
    (tab) => !tab.pseudo || tab.pseudo === activeZoneTab.pseudo
  )
}

function collectStyleSourceCandidates(
  targetDom: HTMLElement | null,
  zoneTabs: ZoneTab[],
  activeZoneTab: ZoneTab | null,
  styleKey: string
): StyleSourceCandidate[] {
  if (!targetDom) return []

  const result: StyleSourceCandidate[] = []
  const seenRules = new Set<string>()

  getDiagnosticZoneTabs(zoneTabs, activeZoneTab).forEach((tab) => {
    const rules = tab.pseudo
      ? [...tab.baseRules, ...tab.sourceRules]
      : tab.sourceRules
    rules.forEach((source) => {
      const identity = `${source.sourceOrder}\u0000${source.selectorPart}`
      if (seenRules.has(identity)) return
      seenRules.add(identity)

      const declared = readDeclaredStyleValue(source.rule.style, styleKey)
      if (!declared) return
      result.push({
        ...declared,
        label: source.sourceSelector || tab.selector,
        source,
        specificity: calculateSafeSpecificity(source.selectorPart, targetDom),
        sourceOrder: source.sourceOrder,
        inline: false,
      })
    })
  })

  const isPseudoElement = !!activeZoneTab?.pseudo?.startsWith('::')
  if (!isPseudoElement) {
    const inlineDeclared = readDeclaredStyleValue(targetDom.style, styleKey)
    if (inlineDeclared) {
      result.push({
        ...inlineDeclared,
        label: INLINE_STYLE_LABEL,
        sourceOrder: Number.MAX_SAFE_INTEGER,
        inline: true,
      })
    }
  }

  return result
}

function resolveEffectiveStyleSource(
  candidates: StyleSourceCandidate[]
): StyleSourceCandidate | null {
  const inline = candidates.find((candidate) => candidate.inline)
  const ruleCandidates = candidates
    .filter((candidate) => !candidate.inline)
    .sort((a, b) => {
      if (a.important !== b.important) return a.important ? 1 : -1
      if (a.specificity && b.specificity) {
        const bySpecificity = compare(a.specificity, b.specificity)
        if (bySpecificity !== 0) return bySpecificity
      }
      return a.sourceOrder - b.sourceOrder
    })
  const ruleWinner = ruleCandidates[ruleCandidates.length - 1] ?? null

  if (!inline) return ruleWinner
  if (!ruleWinner) return inline
  if (inline.important || !ruleWinner.important) return inline
  return ruleWinner
}

function normalizeCssKeyword(value: unknown): string {
  return String(value ?? '')
    .replace(/\s*!important\s*$/i, '')
    .trim()
    .toLowerCase()
}

function readStaticInlineStyleInfo(
  targetDom: HTMLElement | null,
  styleKey: string,
  requirePropertyRange = false
): boolean {
  const raw = targetDom?.dataset?.styleInfo
  if (!raw) return false
  try {
    const styleInfo = JSON.parse(raw)
    const aliases = [
      styleKey,
      styleKey ? styleKey[0].toLowerCase() + styleKey.slice(1) : styleKey,
      styleKey ? styleKey[0].toUpperCase() + styleKey.slice(1) : styleKey,
    ]
    return aliases.some((key) => {
      const entry = styleInfo?.[key]
      if (entry?.kind !== 'static') return false
      if (entry.hasSpread || entry.duplicate) return false
      if (!requirePropertyRange) return true
      return (
        typeof entry.propertyStart === 'number' &&
        typeof entry.propertyEnd === 'number'
      )
    })
  } catch {
    return false
  }
}

function createStyleClearPlan(
  targetDom: HTMLElement | null,
  zoneTabs: ZoneTab[],
  activeZoneTab: ZoneTab | null,
  styleKey: string
): StyleClearPlan {
  const candidates = collectStyleSourceCandidates(
    targetDom,
    zoneTabs,
    activeZoneTab,
    styleKey
  )
  const winner = resolveEffectiveStyleSource(candidates)

  if (!winner) {
    return {
      action: 'noop',
      key: styleKey,
      reason: 'no-local-declaration',
      winner: null,
      candidates,
    }
  }

  if (normalizeCssKeyword(winner.value) === 'unset') {
    return {
      action: 'noop',
      key: styleKey,
      reason: 'already-neutralized',
      winner,
      candidates,
    }
  }

  const action = candidates.length === 1 ? 'delete' : 'write-unset'
  if (winner.inline) {
    if (!readStaticInlineStyleInfo(targetDom, styleKey, action === 'delete')) {
      return {
        action: 'unsupported',
        key: styleKey,
        reason: 'dynamic-or-untracked-inline-style',
        winner,
        candidates,
      }
    }
    if (action === 'write-unset' && winner.important) {
      return {
        action: 'unsupported',
        key: styleKey,
        reason: 'inline-important-cannot-be-written-by-jsx-style',
        winner,
        candidates,
      }
    }
  }

  const targetSelector = winner.inline
    ? 'inline'
    : winner.source?.sourceSelector || winner.label
  if (!targetSelector) {
    return {
      action: 'unsupported',
      key: styleKey,
      reason: 'winner-selector-unavailable',
      winner,
      candidates,
    }
  }

  return {
    action,
    key: styleKey,
    value:
      action === 'delete'
        ? null
        : winner.important
          ? 'unset !important'
          : 'unset',
    selector: targetSelector,
    winner,
    candidates,
  }
}

function applyStyleClearPlans(
  plans: StyleClearPlan[],
  editConfig: any,
  zoneWriteTargets?: Map<string, ZoneWriteTarget>,
  execute = true
): string[] {
  const appliedKeys: string[] = []

  plans.forEach((plan) => {
    console.log('[style_new][style-clear-plan]', {
      key: plan.key,
      candidateCount: plan.candidates.length,
      candidates: plan.candidates.map((candidate) => ({
        label: candidate.label,
        inline: candidate.inline,
        property: candidate.property,
        value: candidate.value,
        important: candidate.important,
        sourceOrder: candidate.sourceOrder,
      })),
      effectiveClassName: plan.winner?.label ?? null,
      action: plan.action,
      writeClassName:
        plan.action === 'delete' || plan.action === 'write-unset'
          ? plan.selector
          : null,
      reason:
        plan.action === 'noop' || plan.action === 'unsupported'
          ? plan.reason
          : null,
    })

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
    const allClassNames = Array.from(new Set(candidates.map((candidate) => candidate.label)))
    const ineffectiveClassNames = allClassNames.filter(
      (className) => className !== effective?.label
    )
    const isDeletion = !!context.deletion || value === null
    const writeClassNames = context.skipped
      ? []
      : resolveSandboxWriteClassNames(
        context.targetDom,
        key,
        targetSelector,
        isDeletion
      )

    console.log('[style_new][style-write-source]', {
      key,
      value,
      effectiveClassName: effective?.label ?? null,
      writeClassName: writeClassNames[0] ?? null,
      additionalWriteClassNames: writeClassNames.slice(1),
      ineffectiveClassNames,
      skipped: !!context.skipped,
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
