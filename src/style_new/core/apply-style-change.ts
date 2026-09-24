import { deepCopy } from '../../utils'
import { mergeCSSProperties } from '../StyleEditor/helper'
import { decomposeBackgroundStack, preservePaintRoles } from '../StyleEditor/helper/paint-stack'
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
import { resolveZoneDeletionTarget } from './zone-tab'
import type { ZoneTab } from './zone-tab'
import {
  collectStyleSourceCandidates, createBatchStyleClearPlans, createStyleClearPlan,
  cssPropertyName, getStyleResolution,
  hasFallbackStyleCandidate, readInlineStyleProperties, readStaticInlineStyleInfo, resolveEffectiveStyleSource,
} from './style-property'
import type { StyleClearPlan, StyleResolution } from './style-property'
import { getShorthandFamily, STYLE_SHORTHANDS, stylePropertyKey } from './style-shorthand-groups'
import { BOX_SPACING_KEYS, createSpacingWritePlans, getBoxSpacingProperty, getBoxSpacingSideClearKeys } from './box-spacing'
import { createStyleWriteTargetResolver } from './style-write-target'
import type { StyleWriteTarget } from './style-write-target'
import { BORDER_DETAIL_KEYS, BORDER_RADIUS_KEYS, createBorderRadiusWritePlans, createBorderWritePlans, isBorderProperty, isBorderRadiusProperty } from './border-write'

export type StyleChangeItem = {
  key: string
  value: any
  intent?: 'clear-effective-style' | 'set-effective-style'
  target?: 'current-rule'
  borderMode?: 'all' | 'split'
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

type StyleRemovalGroup = StyleWriteGroup & { selector: string }
export type StyleRemovalPlan = {
  groups: StyleRemovalGroup[]
  canClear: boolean
  disabledReason?: string
}

const BACKGROUND_INITIAL_VALUES: Record<string, string[]> = {
  backgroundColor: ['transparent', 'rgba(0, 0, 0, 0)'],
  backgroundImage: ['none'],
  backgroundSize: ['auto', 'auto auto'],
  backgroundPosition: ['0% 0%', '0px 0px'],
  backgroundRepeat: ['repeat', 'repeat repeat'],
  backgroundOrigin: ['padding-box'],
  backgroundClip: ['border-box'],
  backgroundAttachment: ['scroll'],
}

/**
 * 取消配置与 clear-effective-style 共用级联保护：存在后备来源时写 unset，
 * 没有后备来源时才删除当前声明；简写删除必须同源安全拆分。
 * 预检与执行共用此计划，面板不需要理解 selector、简写或 JSX 写入限制。
 */
export function createStyleRemovalPlan(
  keys: readonly string[], resolution: StyleResolution, target: HTMLElement | null,
  liveStyle: Record<string, any> = {}
): StyleRemovalPlan {
  const blocked = (disabledReason: string): StyleRemovalPlan => ({ groups: [], canClear: false, disabledReason })
  const requested = new Set(keys.flatMap(key => {
    const property = cssPropertyName(key)
    return (STYLE_SHORTHANDS[property] || [property]).map(stylePropertyKey)
  }))
  const backgroundKeys = STYLE_SHORTHANDS.background.map(stylePropertyKey)
  if (backgroundKeys.some(key => requested.has(key))) {
    const effective = { ...liveStyle }
    ;[...backgroundKeys, 'WebkitBackgroundClip'].forEach(key => {
      const winner = resolution.get(key).winner
      if (winner) effective[key] = winner.value
    })
    const stack = decomposeBackgroundStack(effective)
    if (stack.textLayer || stack.borderLayer) return blocked('背景与文字渐变或渐变边框共用图层，暂不支持直接删除')
    // var()/env() 简写可能没有可读的 longhand，不能把它当作“没有配置”。
    if (resolution.get('background').winner?.currentState &&
      backgroundKeys.some(key => requested.has(key) && !resolution.get(key).winner)) {
      return blocked('背景简写无法安全拆分，请在源码中调整')
    }
  }
  const groups = new Map<string, StyleRemovalGroup>()
  const inlineProperties = readInlineStyleProperties(target)
  const wholeFamilies = Object.keys(STYLE_SHORTHANDS).filter(name =>
    STYLE_SHORTHANDS[name].every(property => requested.has(stylePropertyKey(property)))
  )
  // flex: var(--flex) 或刚写入的简写可能暂时没有 longhand；整组删除不需要拆值。
  const shorthandOnly = wholeFamilies.filter(name =>
    STYLE_SHORTHANDS[name].every(property => !resolution.get(property).winner)
  ).map(stylePropertyKey)
  // 调用方明确提交整个简写族（如 flex + 三个 longhand）时，优先中和简写本身。
  // 否则逐个 longhand 写 unset 会留下原 flex 声明，也会把一条配置膨胀成多条。
  const handledKeys = new Set<string>()
  const explicitProperties = new Set(keys.map(cssPropertyName))
  const explicitWholeFamilies = wholeFamilies.filter(name => explicitProperties.has(name))
  for (const family of explicitWholeFamilies) {
    if (handledKeys.has(stylePropertyKey(family))) continue
    const property = resolution.get(family)
    const winner = property.winner
    if (!winner?.currentState) continue
    if (property.clearPlan.action === 'noop') {
      getShorthandFamily(family).forEach(name => handledKeys.add(stylePropertyKey(name)))
      continue
    }
    if (!hasFallbackStyleCandidate(property)) continue
    const plan = property.clearPlan
    if (plan.action === 'unsupported') return blocked(plan.reason)
    if (plan.action !== 'write-unset') return blocked('无法安全屏蔽后备样式来源')
    const group = groups.get(plan.selector) || { selector: plan.selector, style: {}, deletions: [] }
    group.style[plan.key] = plan.value
    groups.set(plan.selector, group)
    getShorthandFamily(family).forEach(name => handledKeys.add(stylePropertyKey(name)))
  }
  // 显式转数组，避免宿主降级编译时把 Set/Map 迭代器当作数组而跳过循环。
  for (const key of Array.from(new Set([...Array.from(requested), ...shorthandOnly]))) {
    if (handledKeys.has(key)) continue
    const property = resolution.get(key)
    const winner = property.winner
    if (!winner?.currentState) continue
    if (property.clearPlan.action === 'noop') continue
    if (hasFallbackStyleCandidate(property)) {
      const plan = property.clearPlan
      if (plan.action === 'unsupported') return blocked(plan.reason)
      if (plan.action !== 'write-unset') return blocked('无法安全屏蔽后备样式来源')
      const group = groups.get(plan.selector) || { selector: plan.selector, style: {}, deletions: [] }
      group.style[key] = plan.value
      groups.set(plan.selector, group)
      continue
    }
    if (!winner.label) return blocked('找不到可删除的样式来源')
    const selector = winner.label
    const group = groups.get(selector) || { selector, style: {}, deletions: [] }
    groups.set(selector, group)
    const family = wholeFamilies.find(name =>
      name === cssPropertyName(key) || STYLE_SHORTHANDS[name].includes(cssPropertyName(key))
    )
    if (family) {
      group.deletions.push(...getShorthandFamily(family).map(stylePropertyKey))
      continue
    }
    const sameSource = (name: string) => resolution.get(name).candidates.filter(candidate =>
      candidate.currentState && candidate.label === selector
    )
    const fromBackground = backgroundKeys.includes(key) && (
      sameSource('background').length > 0 ||
      backgroundKeys.some(name => sameSource(name).some(candidate => candidate.property === 'background'))
    )
    if (!fromBackground) {
      if (winner.property !== cssPropertyName(key)) return blocked('此简写暂不支持局部删除')
      group.deletions.push(key)
      continue
    }
    // 同 selector 的多条规则无法通过当前宿主协议分别拆写，禁止混合它们的值。
    const sources = new Set(backgroundKeys.flatMap(name => sameSource(name).map(candidate => candidate.source?.rule)))
    if (sources.size > 1) return blocked('同一 selector 存在多条背景规则，无法安全拆分')
    const preserved: Record<string, string> = {}
    for (const name of backgroundKeys) {
      const candidate = resolveEffectiveStyleSource(sameSource(name))
      if (!candidate) return blocked('背景简写无法安全拆分，请在源码中调整')
      if (!requested.has(name) || resolution.get(name).winner?.label !== selector) {
        preserved[name] = `${candidate.value}${candidate.important ? ' !important' : ''}`
      }
    }
    // 纯色简写/最后一层图片没有剩余图片时，不留下简写自动补出的默认配套声明。
    const hasImage = preserved.backgroundImage && !/^none(?:\s*!important)?$/i.test(preserved.backgroundImage)
    if (!hasImage) Object.keys(preserved).forEach(name => {
      const raw = preserved[name].replace(IMPORTANT_SUFFIX_RE, '').trim().toLowerCase()
      if (BACKGROUND_INITIAL_VALUES[name]?.includes(raw)) delete preserved[name]
    })
    Object.assign(group.style, preserved)
    group.deletions.push('background', ...backgroundKeys)
  }
  for (const group of Array.from(groups.values())) {
    const requestedInlineDeletion = group.deletions.length > 0
    group.deletions = Array.from(new Set(group.deletions)).filter(key => !(key in group.style))
    if (group.selector === INLINE_STYLE_LABEL) {
      // 仅删除真实 JSX 属性；不能要求 CSSOM 展开的子属性都有源码范围。
      group.deletions = group.deletions.filter(key => inlineProperties.has(cssPropertyName(key)))
      if ((requestedInlineDeletion && !group.deletions.length) ||
        group.deletions.some(key => !readStaticInlineStyleInfo(target, key, true)) ||
        Object.keys(group.style).some(key => !readStaticInlineStyleInfo(target, key)) ||
        Object.values(group.style).some(value => IMPORTANT_SUFFIX_RE.test(String(value)))) {
        return blocked('动态 JSX 或缺少源码范围，无法安全删除/拆分')
      }
    } else if ([...group.deletions, ...Object.keys(group.style)].some(key => inlineProperties.has(cssPropertyName(key)))) {
      return blocked('同名 JSX 样式会改变写入目标，无法安全删除')
    }
  }
  return { groups: Array.from(groups.values()), canClear: groups.size > 0 }
}

function applyStyleRemoval(
  plan: StyleRemovalPlan, liveStyle: Record<string, any>, resolution: StyleResolution,
  target: HTMLElement | null, editConfig: any, zoneWriteTargets?: Map<string, ZoneWriteTarget>
): ApplyStyleChangeResult {
  if (plan.disabledReason) return { nextLiveStyle: liveStyle, applied: false, clearApplied: false, clearUnsupported: true }
  const nextLiveStyle = { ...liveStyle }
  const touched = new Set<string>()
  plan.groups.forEach(({ selector, style, deletions }) => {
    try {
      ;(window as any).__mybricks_style_deletions = Object.keys(style).length ? deletions : null
      if (!Object.keys(style).length) {
        editConfig.value.set(Object.fromEntries(deletions.map(key => [key, null])), { selector })
      } else {
        const usePreview = (editConfig.value.getBatchMeta?.()?.enabled ||
          (!!target && !target.getAttribute('data-zone-selector'))) && !!editConfig.value.previewBatch
        if (usePreview) editConfig.value.previewBatch(style, { selector })
        else editConfig.value.set(style, { selector })
      }
    } finally {
      ;(window as any).__mybricks_style_deletions = null
    }
    deletions.forEach(key => {
      getShorthandFamily(cssPropertyName(key)).forEach(property => touched.add(stylePropertyKey(property)))
      resolution.record(key, null, selector)
      if (selector === INLINE_STYLE_LABEL) target?.style.removeProperty(cssPropertyName(key))
    })
    Object.entries(style).forEach(([key, value]) => {
      touched.add(key)
      resolution.record(key, value, selector)
      if (selector === INLINE_STYLE_LABEL) target?.style.setProperty(cssPropertyName(key), String(value))
    })
    console.log('[样式编辑][取消配置]', { selector, 删除: deletions, 写入: style })
  })
  // 先完成所有删除/拆分，再按真实剩余来源刷新，避免清掉刚保留的兄弟属性。
  touched.forEach(key => {
    zoneWriteTargets?.delete(key)
    const winner = resolution.get(key).winner
    if (winner?.currentState) nextLiveStyle[key] = `${winner.value}${winner.important ? ' !important' : ''}`
    else delete nextLiveStyle[key]
  })
  return { nextLiveStyle, applied: plan.canClear, clearApplied: plan.canClear, clearUnsupported: false }
}

function removeClearedLiveStyleKeys(style: Record<string, any>, key: string) {
  getShorthandFamily(cssPropertyName(key)).forEach(property => delete style[stylePropertyKey(property)])
}

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

function logStyleWriteTarget(
  key: string, value: any, target: StyleWriteTarget, tab: ZoneTab,
  patch?: Record<string, any>
) {
  console.log('[样式编辑][写入目标解析]', {
    属性: key,
    写入值: value,
    计算出的classname: target.selector,
    classname来源: target.source,
    选择原因: target.reason,
    当前ZoneTabSelector: tab.selector,
    候选selector: target.candidates,
    ...(patch ? { 实际写入样式: patch } : {}),
  })
}

function applyStyleClearPlans(
  plans: StyleClearPlan[],
  editConfig: any,
  zoneWriteTargets?: Map<string, ZoneWriteTarget>,
  execute = true,
  resolution?: StyleResolution
): string[] {
  const appliedKeys: string[] = []
  const groups = new Map<string, Record<string, any>>()

  plans.forEach((plan) => {
    logStyleClearPlan(plan, execute)

    if (!execute || plan.action === 'noop' || plan.action === 'unsupported') return

    const patch = groups.get(plan.selector) || {}
    patch[plan.key] = plan.value
    groups.set(plan.selector, patch)
  })

  groups.forEach((patch, selector) => {
    // 同一属性族一次提交，避免逐条删除期间读取到半清空的源码/CSSOM。
    ;(window as any).__mybricks_style_deletions = null
    editConfig.value.set(patch, { selector })
    Object.entries(patch).forEach(([key, value]) => {
      getShorthandFamily(cssPropertyName(key)).forEach(property =>
        zoneWriteTargets?.delete(stylePropertyKey(property))
      )
      resolution?.record(key, value, selector)
      appliedKeys.push(key)
    })
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
  const flexKeys = getShorthandFamily('flex').map(stylePropertyKey)
  // Flex 面板提交的是整组替换；其中的 null 只是清理冲突写法，不是屏蔽级联。
  const replacingFlex = flexKeys.every(key => changes.some(item => item.key === key)) &&
    changes.some(item => flexKeys.includes(item.key) && item.value != null)
  const sideClearKeys = getBoxSpacingSideClearKeys(changes)
  const shouldUseCascadeClearPlan = (item: StyleChangeItem) =>
    item.value === null &&
    !(replacingFlex && flexKeys.includes(item.key)) &&
    hasFallbackStyleCandidate(resolution.get(item.key))
  const specializedChanges = changes.filter(item => !shouldUseCascadeClearPlan(item))
  // 先预检整个用户动作，避免清空不可执行却先修改了共享图层。
  const plans = createBatchStyleClearPlans(
    changes.filter(item => item.value === null && (shouldUseCascadeClearPlan(item) || (
      !sideClearKeys.has(item.key) && !isBorderProperty(item.key) &&
      !(replacingFlex && flexKeys.includes(item.key))
    ))).map(item => item.key),
    resolution,
    target
  )
  const resolveWriteTarget = createStyleWriteTargetResolver(tab, target, resolution)
  const writeTargets = new Map(changes.filter(item => item.value != null).map(item =>
    [item.key, resolveWriteTarget(item.key, item.target)] as const
  ))
  const flexWrites = replacingFlex ? changes.filter(item => flexKeys.includes(item.key) && item.value != null) : []
  const flexSelector = flexWrites.length ? writeTargets.get(flexWrites[0].key)?.selector || '' : ''
  const flexImportant = flexKeys.some(key => resolution.get(key).candidates.some(candidate =>
    candidate.currentState && candidate.label === flexSelector && candidate.important
  ))
  const flexStyle = Object.fromEntries(flexWrites.map(({ key, value }) => [key,
    flexImportant && !IMPORTANT_SUFFIX_RE.test(String(value)) ? `${value} !important` : value,
  ]))
  const inlineProperties = readInlineStyleProperties(target)
  const flexDeletions = flexKeys.filter(key => !(key in flexStyle) &&
    (flexSelector !== INLINE_STYLE_LABEL || inlineProperties.has(cssPropertyName(key))))
  const flexUnsupported = replacingFlex && (!flexSelector ||
    flexWrites.some(item => writeTargets.get(item.key)?.selector !== flexSelector) ||
    (flexSelector === INLINE_STYLE_LABEL
      ? flexWrites.some(item => !readStaticInlineStyleInfo(target, item.key)) ||
        flexDeletions.some(key => !readStaticInlineStyleInfo(target, key, true)) ||
        Object.values(flexStyle).some(value => IMPORTANT_SUFFIX_RE.test(String(value)))
      : flexKeys.some(key => inlineProperties.has(cssPropertyName(key)))))
  const propertyPlans = [
    ...(replacingFlex ? [{ property: 'flex' as const, selector: flexSelector, style: flexStyle,
      deletions: flexDeletions, clearedKeys: [] as string[], unsupported: flexUnsupported }] : []),
    ...createSpacingWritePlans(specializedChanges, resolution, tab.selector, target,
      change => writeTargets.get(change.key)?.selector || null),
    ...createBorderRadiusWritePlans(specializedChanges, resolution, target,
      change => writeTargets.get(change.key)?.selector || null),
    ...createBorderWritePlans(specializedChanges, resolution, target,
      change => writeTargets.get(change.key)?.selector || null),
  ]
  if (plans.some(plan => plan.action === 'unsupported') || propertyPlans.some(plan => plan.unsupported) ||
    Array.from(writeTargets.values()).some(item => !item.selector)) {
    changes.forEach(item => {
      const writeTarget = writeTargets.get(item.key)
      if (writeTarget && !writeTarget.selector) logStyleWriteTarget(item.key, item.value, writeTarget, tab)
    })
    plans.forEach(plan => logStyleClearPlan(plan, false))
    return { nextLiveStyle: liveStyle, applied: false, clearApplied: false, clearUnsupported: true }
  }
  const writes = changes.filter(item => item.value != null && !getBoxSpacingProperty(item.key) && !isBorderProperty(item.key) && !isBorderRadiusProperty(item.key) &&
    !(replacingFlex && flexKeys.includes(item.key)))
    .map(({ key, value, borderMode, target }) => ({ key, value, borderMode, target }))
  const normal = writes.length
    ? applyStyleChange({ value: writes, liveStyle, editConfig })
    : { nextLiveStyle: liveStyle, applied: false }
  if ('clearUnsupported' in normal && normal.clearUnsupported) return normal
  const nextLiveStyle = { ...normal.nextLiveStyle }
  propertyPlans.forEach(plan => {
    const { selector, style, deletions, clearedKeys } = plan
    clearedKeys.forEach(key => logStyleOperation({
      key, value: null, action: '清空', candidates: resolution.get(key).candidates,
      winner: resolution.get(key).winner, writeSelectors: [selector],
    }))
    changes.filter(item => item.value != null &&
      (plan.property === 'flex' ? flexKeys.includes(item.key) :
        plan.property === 'border' ? isBorderProperty(item.key) :
          plan.property === 'borderRadius' ? isBorderRadiusProperty(item.key) :
            getBoxSpacingProperty(item.key) === plan.property))
      .forEach(item => {
        const writeTarget = writeTargets.get(item.key)!
        if (writeTarget.selector === selector) logStyleWriteTarget(item.key, item.value, writeTarget, tab, style)
      })
    if (!Object.keys(style).length) {
      // 独立声明清空仍沿用宿主的定向删除协议。
      editConfig.value.set(Object.fromEntries(deletions.map(key => [key, null])), { selector })
    } else {
      const usePreview = (editConfig.value.getBatchMeta?.()?.enabled ||
        (!!target && !target.getAttribute('data-zone-selector'))) && !!editConfig.value.previewBatch
      try {
        // 简写拆分/压缩与旧声明删除必须在同一次源码写入中完成。
        ;(window as any).__mybricks_style_deletions = deletions.length ? deletions : null
        if (usePreview) editConfig.value.previewBatch(style, { selector })
        else editConfig.value.set(style, { selector })
      } finally {
        ;(window as any).__mybricks_style_deletions = null
      }
    }
    deletions.forEach(key => {
      delete nextLiveStyle[key]
      resolution.record(key, null, selector)
      if (selector === INLINE_STYLE_LABEL && target) target.style.removeProperty(cssPropertyName(key))
    })
    Object.entries(style).forEach(([key, value]) => {
      nextLiveStyle[key] = value
      resolution.record(key, value, selector)
      if (selector === INLINE_STYLE_LABEL && target) target.style.setProperty(cssPropertyName(key), String(value))
      logStyleOperation({
        key, value, action: '写入', candidates: resolution.get(key).candidates,
        winner: resolution.get(key).winner, writeSelectors: [selector],
      })
    })
    if (clearedKeys.length && plan.property !== 'flex') {
      // 拆分后的本地快照保持稀疏，并保留其他来源真正生效的相邻方向。
      delete nextLiveStyle[plan.property]
      let keys: readonly string[]
      if (plan.property === 'border') {
        keys = BORDER_DETAIL_KEYS
      } else if (plan.property === 'borderRadius') {
        keys = BORDER_RADIUS_KEYS
      } else {
        keys = BOX_SPACING_KEYS[plan.property]
      }
      keys.forEach(key => {
        const winner = resolution.get(key).winner
        if (winner?.currentState) nextLiveStyle[key] = `${winner.value}${winner.important ? ' !important' : ''}`
        else delete nextLiveStyle[key]
      })
    }
  })
  const groups = new Map<string, Record<string, any>>()
  let clearApplied = propertyPlans.some(plan => plan.clearedKeys.length > 0)
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
      if (value === null) removeClearedLiveStyleKeys(nextLiveStyle, key)
      else nextLiveStyle[key] = value
      resolution.record(key, value, selector)
    })
    clearApplied = true
  })
  const applied = normal.applied || propertyPlans.length > 0 || clearApplied
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
  /** 由 useStyleClear 的兼容删除模式提交；公共层仍根据后备来源决定 delete/unset。 */
  removeKeys?: readonly string[]
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
  removeKeys,
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
  if (removeKeys) {
    if (!activeZoneTab) return { nextLiveStyle: liveStyle, applied: false, clearApplied: false, clearUnsupported: true }
    const resolution = getStyleResolution(activeZoneTab, realTargetDom)
    const plan = createStyleRemovalPlan(removeKeys, resolution, realTargetDom, liveStyle)
    const result = applyStyleRemoval(plan, liveStyle, resolution, realTargetDom, editConfig, zoneWriteTargets)
    if (result.applied) {
      importantPriorityCache?.clear()
      onBatchMetaChange?.()
    }
    return result
  }
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
  const clearResolution = activeZoneTab
    ? getStyleResolution(activeZoneTab, realTargetDom)
    : undefined
  const clearPlans = clearResolution
    ? createBatchStyleClearPlans(
      clearItems.map(item => item.key),
      clearResolution,
      realTargetDom
    )
    : clearItems.map((item) =>
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
      zoneWriteTargets,
      true,
      clearResolution
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
    appliedKeys.forEach((key) => removeClearedLiveStyleKeys(nextLiveStyle, key))
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
      zoneWriteTargets,
      true,
      clearResolution
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
    appliedKeys.forEach((key) => removeClearedLiveStyleKeys(nextLiveStyle, key))
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

  const resolveWriteTarget = activeZoneTab
    ? createStyleWriteTargetResolver(activeZoneTab, realTargetDom)
    : undefined
  const pendingWrites = resolveWriteTarget
    ? Object.entries(getStyleDiff(liveStyle || {}, finalCssProperties, effectiveDeletions))
      // diff 中的 null 是删除信号，必须走原有删除来源，不能选最高权重规则。
      .filter(([key]) => Object.prototype.hasOwnProperty.call(finalCssProperties, key))
      .map(([key, value]) => ({ key, value, target: resolveWriteTarget(key) }))
    : []
  // 在文字渐变清理等副作用之前整批预检，避免只有部分属性写入成功。
  if (activeZoneTab && pendingWrites.some(item => !item.target.selector)) {
    pendingWrites.forEach(item => logStyleWriteTarget(item.key, item.value, item.target, activeZoneTab))
    return { nextLiveStyle: liveStyle, applied: false, clearApplied: false, clearUnsupported: true }
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
  if (activeZoneTab) {
    const groups = new Map<string, StyleWriteGroup>()
    pendingWrites.forEach(({ key, value, target }) => {
      const sourceSelector = target.selector!
      logStyleWriteTarget(key, value, target, activeZoneTab)
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
        zoneWriteTargets,
        true,
        clearResolution
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
      appliedKeys.forEach((key) => removeClearedLiveStyleKeys(nextLiveStyle, key))
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
      zoneWriteTargets,
      true,
      clearResolution
    )
    appliedKeys.forEach((key) => removeClearedLiveStyleKeys(finalCssProperties, key))
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
    zoneWriteTargets,
    true,
    clearResolution
  )
  appliedKeys.forEach((key) => removeClearedLiveStyleKeys(finalCssProperties, key))
  onBatchMetaChange?.()
  return {
    nextLiveStyle: finalCssProperties,
    applied: true,
    clearApplied: appliedKeys.length > 0,
    clearUnsupported: false,
  }
}
