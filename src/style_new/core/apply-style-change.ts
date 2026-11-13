import { resolveStateLinkAncestor } from './ancestor-state-link'
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
import { resolveZoneDeletionTarget, splitAncestorState, splitZoneSelectorState, excludeSoloSources, collectZoneSourceStyleKeys } from './zone-tab'
import { buildSoloSelector } from './build-solo-selector'
import type { ZoneTab } from './zone-tab'
import {
  collectStyleSourceCandidates, createBatchStyleClearPlans, createStyleClearPlan,
  cssPropertyName, getStyleResolution, isSourceInline,
  hasFallbackStyleCandidate, readInlineStyleProperties, readStaticInlineStyleInfo, resolveEffectiveStyleSource,
} from './style-property'
import type { StyleClearPlan, StyleResolution } from './style-property'
import { getShorthandFamily, STYLE_SHORTHANDS, stylePropertyKey } from './style-shorthand-groups'
import { BOX_SPACING_KEYS, createSpacingWritePlans, getBoxSpacingProperty, getBoxSpacingSideClearKeys } from './box-spacing'
import { createStyleWriteTargetResolver } from './style-write-target'
import type { StyleWriteTarget } from './style-write-target'
import { BORDER_DETAIL_KEYS, BORDER_RADIUS_KEYS, createBorderRadiusWritePlans, createBorderWritePlans, isBorderProperty, isBorderRadiusProperty } from './border-write'
import { createOverflowWritePlans, isOverflowProperty } from './overflow'
import { createFlexLonghandWritePlans } from './flex-write'
import { getTextBackgroundShorthandWrite } from './text-background-write'
import { createBackgroundColorMigrationPlan } from './background-color-migration'
import { backgroundCore } from './background-core'
import { appendMotionFillRemoval, createMotionFillPlan, isMotionFillProperty } from '../StyleEditor/plugins/Background/transition-adapter'
import { applyMotionFillStylePlan, hasMotionFillChanges } from '../StyleEditor/plugins/Background/motion-fill-plan'
import { shouldUseAIForThirdPartyStyle } from './ai-style/third-party-style-ai'
import { createTransitionRemovalPlan } from './transition-removal'

export type StyleChangeItem = {
  key: string
  value: any
  intent?: 'clear-effective-style' | 'set-effective-style'
  target?: 'current-rule'
  borderMode?: 'all' | 'split'
  paintRole?: 'text'
  motionFill?: boolean
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
const EXPLICIT_STYLE_SELECTOR_KEY = '__mybricks_style_explicit_selector'

/**
 * DOM 重编译后编辑器可能暂时仍持有已断开的旧节点，宿主此时会把 value.set 的
 * selector options 回退成面板原 selector。用同步 side-channel 保留公共规划层已经
 * 确定的实际写入目标；styleProxy 会优先读取它。嵌套调用结束后恢复原值。
 */
export function withExplicitStyleSelector<T>(selector: string, write: () => T): T {
  const scope = window as any
  const hadPrevious = Object.prototype.hasOwnProperty.call(scope, EXPLICIT_STYLE_SELECTOR_KEY)
  const previous = scope[EXPLICIT_STYLE_SELECTOR_KEY]
  scope[EXPLICIT_STYLE_SELECTOR_KEY] = selector
  try {
    return write()
  } finally {
    if (hadPrevious) scope[EXPLICIT_STYLE_SELECTOR_KEY] = previous
    else delete scope[EXPLICIT_STYLE_SELECTOR_KEY]
  }
}

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
    if (family === 'border') {
      const familyKeys = getShorthandFamily(family).map(stylePropertyKey)
      const inlineKeys = familyKeys.filter(key => inlineProperties.has(cssPropertyName(key)))
      const winners = BORDER_DETAIL_KEYS.map(key => resolution.get(key).winner)
        .filter(winner => winner?.currentState)
      const hasInlineBorder = winners.some(winner => winner!.inline) ||
        (property.winner?.currentState && property.winner.inline)
      const hasClassBorder = familyKeys.some(key => resolution.get(key).candidates.some(candidate => !candidate.inline))
      const alreadyUnset = inlineKeys.length === 1 && inlineKeys[0] === 'border' && property.clearPlan.action === 'noop'
      // 减号清除整个边框，与统一/单边模式无关；用一条 unset 替换内联属性族。
      // important 仍按原有逐属性规则预检，JSX 无法写入 unset !important。
      if (hasInlineBorder && hasClassBorder && !alreadyUnset &&
        !property.winner?.important && !winners.some(winner => winner!.important)) {
        const group = groups.get(INLINE_STYLE_LABEL) || { selector: INLINE_STYLE_LABEL, style: {}, deletions: [] }
        group.style.border = 'unset'
        group.deletions.push(...inlineKeys.filter(key => key !== 'border'))
        groups.set(INLINE_STYLE_LABEL, group)
        familyKeys.forEach(key => handledKeys.add(key))
        continue
      }
    }
    const winner = property.winner
    if (!winner?.currentState) continue
    // CSSOM 会把独立长写合成简写；内联只能原位改写 JSX 中真正存在的声明。
    if (winner.inline && !inlineProperties.has(family)) continue
    if (property.clearPlan.action === 'noop') {
      getShorthandFamily(family).forEach(name => handledKeys.add(stylePropertyKey(name)))
      continue
    }
    const hasFamilyFallback = hasFallbackStyleCandidate(property) ||
      STYLE_SHORTHANDS[family].some(key => hasFallbackStyleCandidate(resolution.get(key)))
    if (!hasFamilyFallback) continue
    const plan = property.clearPlan
    if (plan.action === 'unsupported') return blocked(plan.reason)
    if (plan.action !== 'write-unset' && plan.action !== 'delete') return blocked('无法安全屏蔽后备样式来源')
    const group = groups.get(plan.selector) || { selector: plan.selector, style: {}, deletions: [] }
    group.style[plan.key] = winner.important ? 'unset !important' : 'unset'
    // 同组的内联长写仍会覆盖简写，整组清除时一并中和。
    if (winner.inline) getShorthandFamily(family).forEach(name => {
      if (name !== family && inlineProperties.has(name)) group.style[stylePropertyKey(name)] = 'unset'
    })
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
    // 原有变量纯色删除仅改为 backgroundCore.xxx 调用，下方删除和拆分规则不变。
    const backgroundPlan = backgroundCore.getBackgroundColorShorthandRemoval(key, property, target)
    const fromBackground = backgroundKeys.includes(key) && (
      // 改色前：.test { background: var(--bg-color); }（变量为 red）。
      // 面板改蓝色后：.test { background: var(--bg-color); background-color: blue; }
      // CSSOM 只暴露颜色长写，下面的来源判断会漏掉变量简写，需要用源码生成的方案补充判断。
      // 这样删除时才能进入背景分支，一起清理两条声明，避免只删 background-color 后原红色重新生效。
      !!backgroundPlan ||
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
    if (backgroundPlan) {
      // 旧流程没有纯色变量简写的专用删除方案，会走下面的通用拆分。
      // 通用拆分需要读取各个背景长写，判断删掉颜色后要保留什么；
      // var(...) 在 CSSOM 中可能缺少这些候选，因此返回“无法安全拆分”，面板不显示减号。
      // 本方案已确认变量解析为纯色，直接删除颜色声明，保留独立图片，无需拆分。例如：
      // 删除前：.test { background: var(--bg-color); background-image: url("a.png"); }
      // 删除后：.test { background-image: url("a.png"); }
      group.deletions.push(...backgroundPlan.deletions)
      // 该属性的删除项已收集完，跳过通用拆分，继续处理下一个属性。
      continue
    }
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
      // 删除最后一层图片时，只清理不再需要屏蔽后备颜色来源的 unset。
      if (name === 'backgroundColor' && raw === 'unset' && requested.has('backgroundImage') &&
        !hasFallbackStyleCandidate(resolution.get(name))) {
        delete preserved[name]
      }
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
      const rewritingBorder = group.style.border === 'unset' && group.deletions.some(isBorderProperty)
      if ((requestedInlineDeletion && !group.deletions.length) ||
        group.deletions.some(key => !readStaticInlineStyleInfo(target, key, true)) ||
        Object.keys(group.style).some(key => {
          if (rewritingBorder && key === 'border' && !inlineProperties.has('border')) return false
          return !readStaticInlineStyleInfo(target, key, rewritingBorder)
        }) ||
        Object.values(group.style).some(value => IMPORTANT_SUFFIX_RE.test(String(value)))) {
        return blocked('动态 JSX 或缺少源码范围，无法安全删除/拆分')
      }
    } else if (!(splitAncestorState(group.selector) || splitZoneSelectorState(group.selector).pseudo) &&
      [...group.deletions, ...Object.keys(group.style)].some(key => inlineProperties.has(cssPropertyName(key)))) {
      return blocked('同名 JSX 样式会改变写入目标，无法安全删除')
    }
  }
  return { groups: Array.from(groups.values()), canClear: groups.size > 0 }
}

/** 动画一次提交完整文件计划；注册块不进入元素来源索引和面板值。 */
function applyMotionFillGroups(
  groups: StyleRemovalPlan['groups'], liveStyle: Record<string, any>, resolution: StyleResolution,
  target: HTMLElement, tab: ZoneTab, baseResolution?: StyleResolution,
): Record<string, any> {
  const plan = applyMotionFillStylePlan(groups, target)
  const nextLiveStyle = { ...liveStyle }
  const currentSelectors = new Set([tab.selector, ...tab.sourceRules.map(source => source.sourceSelector)])
  const touched = new Set<string>()
  plan.changes.forEach(({ selector, style }) => {
    if (selector.startsWith('@property ')) return
    if (currentSelectors.has(selector)) {
      Object.entries(style).forEach(([key, value]) => {
        resolution.record(key, value, selector)
        getShorthandFamily(cssPropertyName(key)).forEach(property => touched.add(stylePropertyKey(property)))
      })
    } else if (baseResolution && tab.baseRules.some(source => source.sourceSelector === selector)) {
      // 基础态只记入基础态索引，不把起点当作当前态的显式声明。
      Object.entries(style).forEach(([key, value]) => baseResolution.record(key, value, selector))
    }
  })
  touched.forEach(key => {
    const winner = resolution.get(key).winner
    if (winner?.currentState) nextLiveStyle[key] = `${winner.value}${winner.important ? ' !important' : ''}`
    else delete nextLiveStyle[key]
  })
  return nextLiveStyle
}

function applyStyleRemoval(
  plan: StyleRemovalPlan, liveStyle: Record<string, any>, resolution: StyleResolution,
  target: HTMLElement | null, editConfig: any, zoneWriteTargets?: Map<string, ZoneWriteTarget>
): ApplyStyleChangeResult {
  if (plan.disabledReason) return { nextLiveStyle: liveStyle, applied: false, clearApplied: false, clearUnsupported: true }
  let nextLiveStyle = { ...liveStyle }
  const touched = new Set<string>()
  const motionGroups = plan.groups.filter(group => hasMotionFillChanges(group, resolution))
  if (motionGroups.length) {
    motionGroups.forEach(group => appendMotionFillRemoval(group, resolution, target))
    nextLiveStyle = applyMotionFillGroups(motionGroups, nextLiveStyle, resolution, target!, editConfig.options.zoneTab)
    motionGroups.forEach(group => [...group.deletions, ...Object.keys(group.style)].forEach(key => zoneWriteTargets?.delete(key)))
  }
  plan.groups.forEach(group => {
    if (motionGroups.includes(group)) return
    appendMotionFillRemoval(group, resolution, target)
    const { selector, style, deletions } = group
    try {
      ;(window as any).__mybricks_style_deletions = Object.keys(style).length ? deletions : null
      withExplicitStyleSelector(selector, () => {
        if (!Object.keys(style).length) {
          editConfig.value.set(Object.fromEntries(deletions.map(key => [key, null])), { selector })
        } else {
          const usePreview = (editConfig.value.getBatchMeta?.()?.enabled ||
            (!!target && !target.getAttribute('data-zone-selector'))) && !!editConfig.value.previewBatch
          if (usePreview) editConfig.value.previewBatch(style, { selector })
          else editConfig.value.set(style, { selector })
        }
      })
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
    // console.log('[样式编辑][取消配置]', { selector, 删除: deletions, 写入: style })
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
  // console.log('[样式编辑]', details)
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
  // console.log('[样式编辑][写入目标解析]', {
  //   属性: key,
  //   写入值: value,
  //   计算出的classname: target.selector,
  //   classname来源: target.source,
  //   选择原因: target.reason,
  //   当前ZoneTabSelector: tab.selector,
  //   候选selector: target.candidates,
  //   ...(patch ? { 实际写入样式: patch } : {}),
  // })
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
    if (editConfig.options?.soloEdit) {
      // 清除覆盖了某个简写的全部属性时，把旧简写一起删掉，保留各属性的 unset。
      // 例如四个角都清除，就删除旧 border-radius: 8px；只清左上角则保留，其他角还要用。
      // border 同理：宽度、样式、颜色全部清除才删旧 border，只清宽度时仍需保留它的样式和颜色。
      const shorthands = ['margin', 'padding', 'border-radius', ...getShorthandFamily('border')]
      shorthands.forEach(property => {
        if (STYLE_SHORTHANDS[property]?.every(key => patch[stylePropertyKey(key)] != null)) {
          patch[stylePropertyKey(property)] = null
        }
      })
    }
    // 同一属性族一次提交，避免逐条删除期间读取到半清空的源码/CSSOM。
    ;(window as any).__mybricks_style_deletions = null
    withExplicitStyleSelector(selector, () => editConfig.value.set(patch, { selector }))
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
    if (targetSelector && splitZoneSelectorState(targetSelector).pseudo) return [targetSelector]
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

/** 状态覆盖保留基础态的 inline，仅给存在内联竞争的属性提高优先级。 */
function preserveStateInlinePriority(
  items: StyleChangeItem[], tab: ZoneTab | null, target: HTMLElement | null
): StyleChangeItem[] {
  if (!tab?.pseudo || tab.pseudo.includes('::') || !target) return items
  const resolution = getStyleResolution(tab, target)
  const inlineProperties = readInlineStyleProperties(target)
  const inlineLonghands = new Set(Array.from(inlineProperties).flatMap(property =>
    STYLE_SHORTHANDS[property] || [property]
  ))
  return items.map(item => {
    if (item.value == null || IMPORTANT_SUFFIX_RE.test(String(item.value))) return item
    const property = cssPropertyName(item.key)
    const properties = STYLE_SHORTHANDS[property] || [property]
    const hasInline = properties.some(name => inlineLonghands.has(name) ||
      resolution.get(name).candidates.some(candidate => candidate.inline))
    // 保留当前状态生效声明原有的 !important，避免改值后丢失优先级。
    // 如 .B:hover 的绿色带 !important，改成蓝色后也保留它，否则 .A:hover .B 的红色可能重新生效。
    const stateWinner = tab.ancestorStateLink && resolveEffectiveStyleSource(
      resolution.get(item.key).candidates.filter(candidate => candidate.currentState)
    )
    return hasInline || stateWinner?.important ? { ...item, value: `${item.value} !important` } : item
  })
}

/** 共享属性决策；普通值沿用现有写入，清空单独提交 null/unset。 */
function applyEffectiveStyleChanges(
  items: StyleChangeItem[], liveStyle: Record<string, any>, tab: ZoneTab,
  target: HTMLElement | null, editConfig: any, onBatchMetaChange?: () => void
): ApplyStyleChangeResult {
  const resolution = getStyleResolution(tab, target)
  const changes = preserveStateInlinePriority(preservePaintRoles(items, liveStyle), tab, target)
  const motion = items.find(item => item.motionFill && item.key === 'transition')
  if (motion && tab.pseudo) {
    const plan = createMotionFillPlan(motion.value, tab, resolution, target)
    if (plan) {
      // 起点、终点和注册一次落盘；本地回显仍分别记录两个状态的声明。
      const nextLiveStyle = applyMotionFillGroups([...plan.base.groups, ...plan.current.groups],
        liveStyle, resolution, target!, tab, plan.baseResolution)
      onBatchMetaChange?.()
      return { nextLiveStyle, applied: true, clearApplied: false, clearUnsupported: false }
    }
  }
  // .demo { background-color: red; } 点 + 后，应变成（仅列颜色）：
  // .demo { background-image: linear-gradient(#FFFFFF, #FFFFFF), linear-gradient(red, red); }
  // 专用方法给出这次替换计划；例如 .demo { width: 10px; } 改为 width: 20px，则返回 null，继续下方流程。
  const backgroundPlan = createBackgroundColorMigrationPlan(
    items, changes, resolution, target, editConfig.options?.comId || '')
  if (backgroundPlan) {
    const result = applyStyleRemoval(backgroundPlan, liveStyle, resolution, target, editConfig)
    if (result.applied) onBatchMetaChange?.()
    // .demo 从 1 个红色填充变成白、红 2 个填充，所以按新增完成返回，不是“清空了填充”。
    return { ...result, clearApplied: false }
  }
  // 之前换图只追加 background-image，未清理旧 background；现在由 core 同时给出删除和写入计划。
  // 复用原执行器一次提交，沿用原有记录与通知；具体 CSS 前后例子见 createBackgroundReplacementPlan。
  // 未命中时继续下方原链路；「＋」底色迁移仍由上方分支处理。
  const replacement = backgroundCore.createBackgroundReplacementPlan(changes, resolution, tab, target)
  if (replacement) {
    const result = applyStyleRemoval(replacement, liveStyle, resolution, target, editConfig)
    if (result.applied) onBatchMetaChange?.()
    return result
  }
  const flexKeys = getShorthandFamily('flex').map(stylePropertyKey)
  // Flex 面板提交的是整组替换；其中的 null 只是清理冲突写法，不是屏蔽级联。
  const replacingFlex = flexKeys.every(key => changes.some(item => item.key === key)) &&
    changes.some(item => flexKeys.includes(item.key) && item.value != null)
  const sideClearKeys = getBoxSpacingSideClearKeys(changes)
  // 属性属于 margin 或 padding、且当前值按 JSX style 处理时，才走内联源码的清除方式；预览不算。
  const isInlineSpacing = (item: StyleChangeItem) =>
    !!getBoxSpacingProperty(item.key) && isSourceInline(resolution.get(item.key).winner)
  // 内联四方向属性由专用规划器一起处理 unset 和简写拆分。
  const shouldUseCascadeClearPlan = (item: StyleChangeItem) =>
    item.value === null &&
    !(replacingFlex && flexKeys.includes(item.key)) &&
    !isBorderProperty(item.key) &&
    !(isBorderRadiusProperty(item.key) && resolution.get(item.key).winner?.inline) &&
    !isInlineSpacing(item) &&
    hasFallbackStyleCandidate(resolution.get(item.key))
  const specializedChanges = changes.filter(item => !shouldUseCascadeClearPlan(item))
  // 先预检整个用户动作，避免清空不可执行却先修改了共享图层。
  const plans = createBatchStyleClearPlans(
    changes.filter(item => item.value === null && (shouldUseCascadeClearPlan(item) || (
      !sideClearKeys.has(item.key) && !isInlineSpacing(item) && !isBorderProperty(item.key) && !isBorderRadiusProperty(item.key) &&
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
      : !(splitAncestorState(flexSelector) || splitZoneSelectorState(flexSelector).pseudo) &&
        flexKeys.some(key => inlineProperties.has(cssPropertyName(key)))))
  const flexPlans = !replacingFlex ? [] : flexWrites.some(item => item.key === 'flex')
    ? [{ property: 'flex' as const, selector: flexSelector, style: flexStyle,
        deletions: flexDeletions, clearedKeys: [] as string[], unsupported: flexUnsupported }]
    : createFlexLonghandWritePlans(changes, resolution, target,
        change => writeTargets.get(change.key)?.selector || null)
  const propertyPlans = [
    ...flexPlans,
    ...createSpacingWritePlans(specializedChanges, resolution, tab.selector, target,
      change => writeTargets.get(change.key)?.selector || null),
    ...createBorderRadiusWritePlans(specializedChanges, resolution, target,
      change => writeTargets.get(change.key)?.selector || null),
    ...createBorderWritePlans(specializedChanges, resolution, target,
      change => writeTargets.get(change.key)?.selector || null),
    ...createOverflowWritePlans(changes.filter(item => item.value != null), resolution, target,
      change => writeTargets.get(change.key)?.selector || null),
  ]
  if (shouldUseAIForThirdPartyStyle(target, tab, writeTargets)) {
    // 整次操作通过已有 set 通道交给宿主，包含同批的样式写入和清除。
    const style = Object.fromEntries(changes.map(({ key, value }) => [key, value]))
    editConfig.value.set({ type: 'ai-style-update', styles: style }, { selector: tab.selector })

    const nextLiveStyle = { ...liveStyle }
    changes.forEach(({ key, value }) => {
      if (value == null) removeClearedLiveStyleKeys(nextLiveStyle, key)
      else nextLiveStyle[key] = value
    })
    onBatchMetaChange?.()
    return {
      nextLiveStyle,
      applied: true,
      clearApplied: changes.some(item => item.value === null),
      clearUnsupported: false,
    }
  }
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
    !isOverflowProperty(item.key) &&
    !(replacingFlex && flexKeys.includes(item.key)))
    .map(({ key, value, borderMode, target, paintRole }) => {
      // 文字纯色可能来自 background: ... !important；新长写必须保持同等优先级。
      const textFillSource = paintRole === 'text' && key === 'backgroundColor'
        ? resolveEffectiveStyleSource(resolution.get(key).candidates.filter(candidate =>
            candidate.currentState && candidate.label === writeTargets.get(key)?.selector))
        : null
      return { key, value: textFillSource?.important && !IMPORTANT_SUFFIX_RE.test(String(value))
        ? `${value} !important` : value, borderMode, target,
        ...(paintRole ? { paintRole } : {}) }
    })
  // 受管图层把本次写入与清空放入同一计划，其他属性继续原执行器。
  let motionLiveStyle = liveStyle
  let managedGroups: StyleRemovalPlan['groups'] = []
  if (changes.some(item => isMotionFillProperty(item.key) || item.key === 'backgroundImage' || item.key === 'background')) {
    const motionGroups = new Map<string, StyleRemovalPlan['groups'][number]>()
    const groupFor = (selector: string) => {
      if (!motionGroups.has(selector)) motionGroups.set(selector, { selector, style: {}, deletions: [] })
      return motionGroups.get(selector)!
    }
    writes.forEach(({ key, value }) => { groupFor(writeTargets.get(key)!.selector!).style[key] = value })
    plans.forEach(plan => {
      if (plan.action === 'delete') groupFor(plan.selector).deletions.push(plan.key)
      else if (plan.action === 'write-unset') groupFor(plan.selector).style[plan.key] = plan.value
    })
    managedGroups = Array.from(motionGroups.values()).filter(group => hasMotionFillChanges(group, resolution))
    if (managedGroups.length) {
      managedGroups.forEach(group => appendMotionFillRemoval(group, resolution, target))
      motionLiveStyle = applyMotionFillGroups(managedGroups, liveStyle, resolution, target!, tab)
    }
  }
  const pendingWrites = managedGroups.length ? writes.filter(item =>
    !managedGroups.some(group => group.selector === writeTargets.get(item.key)?.selector)) : writes
  const normal = pendingWrites.length
    ? applyStyleChangeInternal({ value: pendingWrites, liveStyle: motionLiveStyle, editConfig }, true)
    : { nextLiveStyle: motionLiveStyle, applied: managedGroups.length > 0 }
  if ('clearUnsupported' in normal && normal.clearUnsupported) return normal
  let nextLiveStyle = { ...normal.nextLiveStyle }
  propertyPlans.forEach(plan => {
    const { selector, style, deletions, clearedKeys } = plan
    clearedKeys.forEach(key => logStyleOperation({
      key, value: null, action: '清空', candidates: resolution.get(key).candidates,
      winner: resolution.get(key).winner, writeSelectors: [selector],
    }))
    changes.filter(item => {
      if (item.value == null) return false
      if (plan.property === 'flex') return flexKeys.includes(item.key)
      if (plan.property === 'border') return isBorderProperty(item.key)
      if (plan.property === 'borderRadius') return isBorderRadiusProperty(item.key)
      if (plan.property === 'overflow') return isOverflowProperty(item.key)
      return getBoxSpacingProperty(item.key) === plan.property
    })
      .forEach(item => {
        const writeTarget = writeTargets.get(item.key)!
        if (writeTarget.selector === selector) logStyleWriteTarget(item.key, item.value, writeTarget, tab, style)
      })
    if (!Object.keys(style).length) {
      // 独立声明清空仍沿用宿主的定向删除协议。
      withExplicitStyleSelector(selector, () =>
        editConfig.value.set(Object.fromEntries(deletions.map(key => [key, null])), { selector })
      )
    } else {
      const usePreview = (editConfig.value.getBatchMeta?.()?.enabled ||
        (!!target && !target.getAttribute('data-zone-selector'))) && !!editConfig.value.previewBatch
      try {
        // 简写拆分/压缩与旧声明删除必须在同一次源码写入中完成。
        ;(window as any).__mybricks_style_deletions = deletions.length ? deletions : null
        withExplicitStyleSelector(selector, () => {
          if (usePreview) editConfig.value.previewBatch(style, { selector })
          else editConfig.value.set(style, { selector })
        })
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
    if (clearedKeys.length && plan.property !== 'flex' && plan.property !== 'overflow') {
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
  if (flexPlans.length > 1) {
    // 同来源简写拆分会携带该规则自己的后备值，不能按写入顺序覆盖面板快照。
    // 等各来源全部 record 后再取当前状态的赢家，连续编辑才与重新聚焦一致。
    delete nextLiveStyle.flex
    flexKeys.filter(key => key !== 'flex').forEach(key => {
      const winner = resolveEffectiveStyleSource(resolution.get(key).candidates.filter(candidate => candidate.currentState))
      if (winner) nextLiveStyle[key] = `${winner.value}${winner.important ? ' !important' : ''}`
      else delete nextLiveStyle[key]
    })
  }
  const groups = new Map<string, Record<string, any>>()
  let clearApplied = propertyPlans.some(plan => plan.clearedKeys.length > 0) ||
    managedGroups.some(group => group.deletions.length > 0)
  plans.forEach(plan => {
    logStyleClearPlan(plan)
    if (plan.action === 'noop' || plan.action === 'unsupported') return
    if (managedGroups.some(group => group.selector === plan.selector)) return
    const patch = groups.get(plan.selector) || {}
    patch[plan.key] = plan.value
    groups.set(plan.selector, patch)
  })
  groups.forEach((patch, selector) => {
    // 组件库现有协议：整包只包含 null/unset，就按 selector 定向清空。
    withExplicitStyleSelector(selector, () => editConfig.value.set(patch, { selector }))
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
  // 样式清空成功后统一移除对应动效；不影响背景已有的内部变量清理。
  if (tab.pseudo) {
    const transitionPlan = createTransitionRemovalPlan(changes, resolution, target)
    if (transitionPlan) {
      const result = applyStyleRemoval(transitionPlan, nextLiveStyle, resolution, target, editConfig)
      nextLiveStyle = result.nextLiveStyle
      clearApplied = clearApplied || result.clearApplied
    }
  }
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
export function applyStyleChange(params: ApplyStyleChangeParams): ApplyStyleChangeResult {
  const editOptions = params.editConfig.options
  const tab: ZoneTab | undefined = editOptions?.zoneTab
  if (tab?.ancestorStateLink && !editOptions.soloEdit) {
    // 给每项输入补操作标记：有值走设置样式，空值走清空样式；已有标记保持不变。
    const items = Array.isArray(params.value) ? params.value : [params.value]
    params = { ...params, value: items.map(item => ({
      ...item, intent: item.intent || (item.value == null ? 'clear-effective-style' : 'set-effective-style'),
    })) }
  }
  let batchSoloContext: {
    tab: ZoneTab
    target: Element
    expectedSelector: string
    soloSources: ZoneTab['sourceRules']
  } | undefined

  // 1. 仅在批量编辑、有样式来源（tab），且来源里至少有一条同时带空格和 nth 的 selector，进入新逻辑；其他情况走原方法。
  if (tab && !editOptions.soloEdit && tab.sourceRules.some(source =>
    source.sourceSelector.includes(' ') && source.sourceSelector.includes(':nth-child('))) {
    const target = toElementArray(editOptions.targetDom)[0]
    const root = target.getRootNode() as Document | ShadowRoot
    const componentRoot = editOptions.comId ? root.getElementById(editOptions.comId) : null
    // 找回当前元素对应的状态祖先，生成它的单独规则地址，供批量编辑识别已有的单独样式。
    // 如第二组文字生成 .A:nth-child(2):hover .B:nth-child(1)，Hover 仍放在父级 A 上。
    const stateAncestor = tab.ancestorStateLink ? resolveStateLinkAncestor(target, tab.ancestorStateLink) || undefined : undefined
    const expectedSelector = buildSoloSelector(target, tab.linkedSelector ? tab.baseSelector : tab.selector, componentRoot, { stateAncestor, linkedSelector: tab.linkedSelector })
    // 联动默认地址即使已有父级 nth，也不能当作额外的子级单独规则清理。
    if (expectedSelector !== tab.linkedSelector && expectedSelector.includes(' ') && expectedSelector.includes(':nth-child(')) {
      // 只取当前元素、当前状态的单独规则，交给下方原批量流程处理，不带入其他实例或状态。
      const soloSources = tab.sourceRules.filter(source =>
        source.sourceSelector === expectedSelector && (splitAncestorState(source.selectorPart) || splitZoneSelectorState(source.selectorPart)).pseudo === tab.pseudo)
      if (soloSources.length) batchSoloContext = { tab, target, expectedSelector, soloSources }
    }
  }

  if (batchSoloContext) {
    const { tab, target, expectedSelector, soloSources } = batchSoloContext
    const batchTab = excludeSoloSources(tab, [expectedSelector])

    // 2. 用公共规则选址，但保留本次输入值；旧单独属性不能被整包带入公共规则。
    const liveStyle = { ...params.liveStyle }
    const resolution = getStyleResolution(batchTab, target as HTMLElement)
    const soloKeys = new Set(collectZoneSourceStyleKeys(soloSources))
    soloKeys.forEach(key => {
      if (!Object.prototype.hasOwnProperty.call(liveStyle, key)) return
      const winner = resolution.get(key).winner
      if (winner) liveStyle[key] = winner.value
      else delete liveStyle[key]
    })
    const zoneWriteTargets = params.zoneWriteTargets ? new Map<string, ZoneWriteTarget>() : undefined
    const importantPriorityCache = params.importantPriorityCache ? new Map<string, boolean>() : undefined
    const value = params.editConfig.value
    let removed = false
    const beforeWrite = () => {
      if (removed) return
      const previousDeletions = (window as unknown as { __mybricks_style_deletions: string[] | null }).__mybricks_style_deletions
      // 3. 本次操作通过原有预检并真正写入时，先删除整份规则；失败时恢复删除信号。
      try {
        const scope = window as unknown as { __mybricks_style_deletions: string[] | null }
        scope.__mybricks_style_deletions = Array.from(soloKeys)
        withExplicitStyleSelector(expectedSelector, () => value.set({}, { selector: expectedSelector }))
        removed = true
        const currentResolution = getStyleResolution(tab, target as HTMLElement)
        soloKeys.forEach(key => currentResolution.record(key, null, expectedSelector))
        tab.sourceRules = batchTab.sourceRules
        tab.baseRules = batchTab.baseRules
        tab.excludedSourceSelectors = batchTab.excludedSourceSelectors
        tab.excludedRules = batchTab.excludedRules
        tab.excludedStyleKeys = batchTab.excludedStyleKeys
        tab.effectedCssResult = undefined
        tab.effectiveStyle = {}
        params.zoneWriteTargets?.clear()
        params.importantPriorityCache?.clear()
      } finally {
        ;(window as unknown as { __mybricks_style_deletions: string[] | null }).__mybricks_style_deletions = previousDeletions
      }
    }
    const wrappedValue = {
      ...value,
      set: (...args: unknown[]) => { beforeWrite(); return value.set(...args) },
    }
    if (value.previewBatch) {
      wrappedValue.previewBatch = (...args: unknown[]) => { beforeWrite(); return value.previewBatch(...args) }
    }
    // 4. 后续仍走原有批量写入，覆盖可视化、CSS 编辑和粘贴入口。
    const result = applyStyleChangeInternal({
      ...params,
      liveStyle,
      zoneWriteTargets,
      importantPriorityCache,
      editConfig: { ...params.editConfig, options: { ...editOptions, zoneTab: batchTab }, value: wrappedValue },
    })
    const items = Array.isArray(params.value) ? params.value : [params.value]
    const clearsSoloProperty = params.removeKeys?.some(key => soloKeys.has(key)) ||
      items.some(item => {
        if (item.value !== null || !soloKeys.has(item.key)) return false
        if (item.intent === 'clear-effective-style') return true
        const panel = PANEL_MAP[item.key]
        return !!panel && !(params.collapsedOptions || []).includes(panel)
      })
    // 单独属性没有公共后备值时，公共清空为 noop；删除单独规则本身仍完成了本次清空。
    if (!removed && !result.clearUnsupported && clearsSoloProperty) {
      beforeWrite()
      params.onBatchMetaChange?.()
      return { ...result, nextLiveStyle: liveStyle, applied: true, clearApplied: true }
    }
    if (removed) {
      const currentResolution = getStyleResolution(tab, target as HTMLElement)
      for (const key of new Set([...soloKeys, ...Object.keys(result.nextLiveStyle)])) {
        const winner = resolution.get(key).winner
        if (winner) currentResolution.record(key, winner.value, winner.label, winner.property)
      }
      zoneWriteTargets?.forEach((target, key) => params.zoneWriteTargets?.set(key, target))
      importantPriorityCache?.forEach((priority, key) => params.importantPriorityCache?.set(key, priority))
    }
    if (!result.applied) return { ...result, nextLiveStyle: params.liveStyle }
    return result
  } else {
    return applyStyleChangeInternal(params)
  }
}

function applyStyleChangeInternal({
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
}: ApplyStyleChangeParams, paintRolesPreserved = false): ApplyStyleChangeResult {
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
  const editOptions = !Array.isArray(editConfig.options) ? editConfig.options : null
  const isSoloEditWrite = !!editOptions && 'soloEdit' in editOptions && !!editOptions.soloEdit
  const activeZoneTab: ZoneTab | null = editOptions && !(editOptions as any).soloEdit
    ? (editOptions as any).zoneTab ?? null
    : null
  const zoneTabs: ZoneTab[] =
    !Array.isArray(editConfig.options) && editConfig.options
      ? (editConfig.options as any).zoneTabs ?? (activeZoneTab ? [activeZoneTab] : [])
      : (activeZoneTab ? [activeZoneTab] : [])
  if (removeKeys) {
    if (!activeZoneTab) return { nextLiveStyle: liveStyle, applied: false, clearApplied: false, clearUnsupported: true }
    const resolution = getStyleResolution(activeZoneTab, realTargetDom)
    const plan = createStyleRemovalPlan(removeKeys, resolution, realTargetDom, liveStyle)
    if (activeZoneTab.pseudo && !plan.disabledReason) {
      const transitionPlan = createTransitionRemovalPlan(
        removeKeys.map(key => ({ key, value: null })), resolution, realTargetDom)
      if (transitionPlan) {
        plan.groups.push(...transitionPlan.groups)
        plan.canClear = true
      }
    }
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
  // 单独编辑虽然不走批量写入，清除时仍要查当前选中的 Tab，不能退回常规态。
  // 例如在 Hover 清除 margin，要查 Hover 自己的配置；常规态的 margin-left: unset 不代表 Hover 左边也已清除。
  const clearSourceTab: ZoneTab | null = editOptions?.zoneTab ?? activeZoneTab
  const clearPlans = clearResolution
    ? createBatchStyleClearPlans(
      clearItems.map(item => item.key),
      clearResolution,
      realTargetDom
    )
    : clearItems.map((item) =>
      createStyleClearPlan(realTargetDom, zoneTabs, clearSourceTab, item.key)
    )
  const clearUnsupported = clearPlans.some(
    (plan) => plan.action === 'unsupported'
  )
  // 单独编辑模式下，清空必须拿 solo-selector而不是baseSelector
  // 之前在单独编辑模式下也会拿 baseSelector，所以永远修改的都是 baseSelector的样式
  if (isSoloEditWrite && typeof selector === 'string') {
    // 之前写 border 会"刚写进去就被自己带的清空抹掉"（border: 5px solid 后面跟着 border-top: unset 等），
    // 现在本批刚写入过值的属性（含同简写族的成员）不再参与清空，因为这些 unset 只会抵消刚写入的值
    const authoredFamily = new Set<string>()
    rawItems.filter(item => item.value != null).forEach(item => {
      getShorthandFamily(cssPropertyName(item.key)).forEach(name => authoredFamily.add(name))
    })
    for (let i = 0; i < clearPlans.length; i += 1) {
      const plan = clearPlans[i]
      if (plan.action === 'noop' || plan.action === 'unsupported') continue
      if (authoredFamily.has(cssPropertyName(plan.key))) continue
      // 反过来也一样：写的是长写（如 borderTop）时，不清整个简写（border）
      if (getShorthandFamily(cssPropertyName(plan.key)).some(name => authoredFamily.has(name))) continue
      clearPlans[i] = {
        ...plan,
        selector,
        action: 'write-unset' as const,
        value: plan.winner?.important ? 'unset !important' : 'unset',
      }
    }
  }

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
  // effective 路径已合并过共享背景层；再次判断会把生成的 text clip 当作字体修改，丢掉新增填充。
  const changeItems = preserveStateInlinePriority(
    paintRolesPreserved ? priorityAwareItems : preservePaintRoles(priorityAwareItems, nextSetValue),
    activeZoneTab, realTargetDom
  )

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
  // 单独编辑不走 previewBatch
  const usePreviewBatch =
    !isSoloEditWrite &&
    (batchMeta?.enabled || isThirdPartyFocus) &&
    !!editConfig.value.previewBatch
  const write = usePreviewBatch
    ? (style: Record<string, any>, options?: { selector?: string }) =>
      editConfig.value.previewBatch!(style, options)
    : (style: Record<string, any>, options?: { selector?: string }) =>
      editConfig.value.set(style, options)
  // Zone Tab 的 sourceRules 同时保存 CSSOM 运行时 selector 和可写回 Less 的源码 selector。
  // 只有这里才拆分本次变更；普通组件继续沿用原来的完整状态写回逻辑。
  if (activeZoneTab) {
    const groups = new Map<string, StyleWriteGroup>()
    const textBackgroundWrites = new Map<string, any>()
    const isTextBackgroundColorWrite = changeItems.length === 1 &&
      changeItems[0].key === 'backgroundColor' && changeItems[0].paintRole === 'text'
    pendingWrites.forEach(({ key, value, target }) => {
      const sourceSelector = target.selector!
      logStyleWriteTarget(key, value, target, activeZoneTab)
      const group = addStyleWriteGroup(groups, sourceSelector)
      const source = isTextBackgroundColorWrite && key === 'backgroundColor'
        ? resolveEffectiveStyleSource(getStyleResolution(activeZoneTab, realTargetDom).get(key).candidates
            .filter(candidate => candidate.currentState && candidate.label === sourceSelector))
        : null
      const shorthand = getTextBackgroundShorthandWrite(source, realTargetDom)
      const writeKey = shorthand ? 'background' : key
      group.style[writeKey] = deepCopy(value)
      if (shorthand) {
        group.deletions.push(...shorthand.deletions)
        textBackgroundWrites.set(sourceSelector, value)
        // 面板继续按长写回显；同时同步简写快照，避免连续拖色时使用旧 background。
        finalCssProperties.background = value
      }
      zoneWriteTargets?.set(key, {
        selector: sourceSelector,
        property: writeKey,
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

    const motionResolution = getStyleResolution(activeZoneTab, realTargetDom)
    const motionGroups = Array.from(groups, ([selector, group]) => ({ ...group, selector }))
      .filter(group => hasMotionFillChanges(group, motionResolution))
    if (motionGroups.length) {
      motionGroups.forEach(group => appendMotionFillRemoval(group, motionResolution, realTargetDom))
      const next = applyMotionFillGroups(motionGroups, finalCssProperties, motionResolution, realTargetDom!, activeZoneTab)
      Object.keys(finalCssProperties).forEach(key => { if (!(key in next)) delete finalCssProperties[key] })
      Object.assign(finalCssProperties, next)
      motionGroups.forEach(group => groups.delete(group.selector))
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
        if (activeZoneTab.pseudo) {
          // 状态写入不能在宿主持有旧 DOM 时回退到常规 selector。
          withExplicitStyleSelector(sourceSelector, () => write(group.style, groupOptions))
        } else {
          write(group.style, groupOptions)
        }
        Object.entries(group.style).forEach(([key, value]) => {
          getStyleResolution(activeZoneTab, realTargetDom).record(key, value, sourceSelector)
        })
        if (textBackgroundWrites.has(sourceSelector)) {
          getStyleResolution(activeZoneTab, realTargetDom).record(
            'backgroundColor', textBackgroundWrites.get(sourceSelector), sourceSelector, 'background'
          )
        }
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
if (editOptions && 'soloEdit' in editOptions && editOptions.soloEdit && typeof selector === 'string') {
    // 单独编辑在源码重编译后可能仍持有旧 DOM；宿主回退 selector 时也要锁定 nth-child 规则。
    // solo 规则是新建的，里面没有旧属性可删，所以把删除改成写 unset 来压过基础类（如基础类 flex:1 会压住 width）
    const isRealAuthoredValue = (val: unknown) => val != null && String(val).trim() !== ''
    // 之前删除转的 unset 会把同批刚写入的简写抹掉
    //（border: 5px solid 后跟 border-top: unset），现在同族的删除不再转 unset。
    const authoredFamily = new Set<string>()
    Object.entries(finalCssProperties).forEach(([key, value]) => {
      if (isRealAuthoredValue(value)) {
        getShorthandFamily(cssPropertyName(key)).forEach(name => authoredFamily.add(name))
      }
    })
    const soloDeletions = effectiveDeletions.filter((key) => {
      const property = cssPropertyName(key)
      if (authoredFamily.has(property)) return false
      return !getShorthandFamily(property).some(name => authoredFamily.has(name))
    })
    const soloWriteValue = soloDeletions.length
      ? {
          ...finalCssProperties,
          ...Object.fromEntries(soloDeletions.map((key) => [key, 'unset'])),
        }
      : finalCssProperties
    // 写入新值时，也要通知宿主删掉当前单独规则里与它冲突的旧写法。
    // 例如清除 margin 后再填 margin: 20px，要删掉旧的 margin-top/right/bottom/left: unset，
    // 否则这些旧声明留在新 margin 后面，四边就不会按 20px 生效。
    const replacementDeletions = effectiveDeletions.filter(key => !soloDeletions.includes(key))
    ;(window as unknown as { __mybricks_style_deletions: string[] | null }).__mybricks_style_deletions =
      replacementDeletions.length ? replacementDeletions : null
    withExplicitStyleSelector(selector, () => write(soloWriteValue, setOptions))
  } else {
    write(finalCssProperties, setOptions)
  }
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
