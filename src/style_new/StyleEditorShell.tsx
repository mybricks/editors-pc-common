import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'

import { CheckOutlined, CloseOutlined, LoadingOutlined } from './StyleEditor/components/Icon/ActionIcons'
import { message } from './StyleEditor/components/Message'
import { copyText } from '../utils'
import { applyStyleChange } from './core/apply-style-change'
import {
  buildCssRule,
  diffStyleData,
  mergeObjectKeys,
  extractCssRuleBody,
  filterStyleForCssCode,
  parseToCssCode,
  parseToStyleData,
  resolveDisplaySelector,
} from './core/css-code-codec'
import { getDefaultConfiguration, getDefaultConfiguration2 } from './core/get-default-configuration'
import type { SuggestOptionsCache } from './core/get-default-configuration'
import { mergeStylesWithPasteConflicts } from './core/paste-style-merge'
import { normalizePastedStyleVars } from './core/resolve-paste-css-vars'
import { CssEditor } from './CssEditor'
import type { CssEditorHandle } from './CssEditor'
import { useUpdateEffect } from './StyleEditor/hooks'
import { StyleMount } from './StyleMount'
import type { EditorProps } from './type'
import { useAffectedCount } from './hooks/useAffectedCount'
import { useBatchMeta } from './hooks/useBatchMeta'
import { useZoneSelectors } from './hooks/useZoneSelectors'
import {
  buildSoloSelector,
  getSavedSoloStyle,
} from './core/build-solo-selector'
import type { SavedSoloStyle } from './core/build-solo-selector'
import { excludeSoloSources, getZoneTabLabels } from './core/zone-tab'
import type { ZoneTab } from './core/zone-tab'
import { createAncestorStateLink, collectAncestorStateLinkTab, hasAncestorStateLinkRule, resolveStateLinkAncestor, withAncestorStateLinkSelector } from './core/ancestor-state-link'
import { applyStatePreview, clearStatePreview, getStatePreviewContext, getStatePreviewMode, isPreviewablePseudo, onStatePreviewChange } from './core/state-preview'
import { registerVariationFocusHandler, setFocusedVariation } from './core/variations'
import { setSoloEditState } from './core/get-similar-zones'
import { getDocument, toElementArray } from './core/dom'
import { ZoneTabBar } from './ZoneTabBar'
import lang from './index.i18n'
import css from './index.less'

const STYLE_EDITOR_CACHE_LIMIT = 5

type StyleEditorCacheScope = {
  key: number
  editMode: boolean
  selectedTarget: Element | null
  zoneSelectorSignature: string
  zoneTabSourceSignature: string
}

type CachedStyleEditor = {
  element: React.ReactElement
  stale: boolean
}

async function writeClipboardText(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text)
      return true
    }
  } catch {}
  // fallback：textarea 可保留多行；utils.copyText 用 input 会丢换行
  const ta = document.createElement('textarea')
  ta.value = text
  ta.setAttribute('readonly', 'true')
  ta.style.position = 'fixed'
  ta.style.left = '-9999px'
  document.body.appendChild(ta)
  ta.select()
  const ok = document.execCommand('copy')
  document.body.removeChild(ta)
  return ok
}

async function readClipboardText(): Promise<string> {
  if (navigator.clipboard?.readText) {
    return navigator.clipboard.readText()
  }
  throw new Error('clipboard unavailable')
}

export default function StyleEditorShell({ editConfig }: EditorProps) {
  useMemo(() => {
    // 将 selector 写为空，避免后续依赖 selector 的逻辑（如 zone tab 生成、样式写入）拿到错误的值。便于发现问题
    if (editConfig && editConfig.options) {
      (editConfig.options as any).selector = ''
    }
  }, [editConfig])

  const [{ finalOpen, finalSelector }, canvasEle] = useMemo(() => {
    return [
      getDefaultConfiguration2(editConfig),
      // @ts-ignore
      editConfig.canvasEle,
    ]
  }, [])

  const [{ open, show, editMode }, setStatus] = useState({
    open: finalOpen,
    show: finalOpen,
    editMode: true,
  })

  const [key, setKey] = useState(0)
  const isResetRef = useRef(false)
  const [isSoloEdit, setIsSoloEdit] = useState(false)
  const editModeHintRef = useRef<HTMLDivElement | null>(null)
  const [soloSelector, setSoloSelector] = useState<string | null>(null)
  const skipSoloRehydrateRef = useRef(false)
  const useBatchStyleSourcesRef = useRef(false)
  const pendingBatchStyleRefreshRef = useRef(false)
  const soloStyleBackupRef = useRef(new Map<string, SavedSoloStyle>())
  const batchSwitchSoloStyleRef = useRef<{
    key: number
    target: Element
    selector: string
    componentRoot: Element | null
    style: SavedSoloStyle | null
  } | null>(null)
  const suggestOptionsCacheRef = useRef<SuggestOptionsCache>(new WeakMap())
  const cssEditorHandleRef = useRef<CssEditorHandle | null>(null)
  const activeStyleEditorCacheKeyRef = useRef<string | null>(null)
  const styleEditorCacheRef = useRef(new Map<string, CachedStyleEditor>())
  const styleEditorCacheScopeRef = useRef<StyleEditorCacheScope | null>(null)
  const styleEditorCacheGenerationRef = useRef(0)
  const styleEditorMountRevisionRef = useRef(0)

  useEffect(() => {
    suggestOptionsCacheRef.current = new WeakMap()
  }, [key])

  // 只从 editConfig 中拿 targetDom，用于 hover 标记效果
  const targetDom = useMemo(() => {
    if (!editConfig.options || Array.isArray(editConfig.options)) return null
    return (editConfig.options as any).targetDom ?? null
  }, [editConfig])

  const { batchMeta, refreshBatchMeta, onBatchDiscard, onBatchCommit } = useBatchMeta(editConfig)
  const {
    zoneSelectorList,
    zoneTabs,
    mergedTabs,
    originTabs,
    activeZoneIdx,
    setActiveZoneIdx,
    addZoneTab,
    deleteZoneTab,
  } = useZoneSelectors(
    editConfig,
    targetDom,
    open
  )

  const shellComId = useMemo(() => {
    if (!editConfig.options || Array.isArray(editConfig.options)) return ''
    return (editConfig.options as any).comId ?? ''
  }, [editConfig])

  const selectedTarget = useMemo(() => {
    return toElementArray(targetDom)[0] ?? null
  }, [targetDom])

  const affectedCount = useAffectedCount(
    activeZoneIdx,
    zoneTabs,
    finalSelector,
    shellComId || undefined,
    selectedTarget
  )

  // 保留已经访问过的 StyleMount，避免每次 zone tab 切换都卸载并重建 15 个插件。
  // 外部刷新、编辑模式变化、目标元素或 selector 列表变化时必须丢弃旧实例，
  // 防止插件内部的 useState 继续持有上一轮样式快照。
  const styleEditorCacheScope: StyleEditorCacheScope = {
    key,
    editMode,
    selectedTarget,
    zoneSelectorSignature: zoneSelectorList.join('\u0001'),
    zoneTabSourceSignature: zoneTabs.map((tab) =>
      `${tab.selector}:${tab.linkedSelector || ''}:${tab.sourceRules.map((item) =>
        `${item.sourceOrder}:${item.selectorPart}:${item.sourceSelector}`
          + `:${item.isPageStyle ? 'page' : 'external'}`
      ).join('|')}`
    ).join('\u0002'),
  }
  const previousStyleEditorCacheScope = styleEditorCacheScopeRef.current
  if (
    previousStyleEditorCacheScope &&
    (
      previousStyleEditorCacheScope.key !== styleEditorCacheScope.key ||
      previousStyleEditorCacheScope.editMode !== styleEditorCacheScope.editMode ||
      previousStyleEditorCacheScope.selectedTarget !== styleEditorCacheScope.selectedTarget ||
      previousStyleEditorCacheScope.zoneSelectorSignature !== styleEditorCacheScope.zoneSelectorSignature
      || previousStyleEditorCacheScope.zoneTabSourceSignature !== styleEditorCacheScope.zoneTabSourceSignature
    )
  ) {
    styleEditorCacheRef.current.clear()
    styleEditorCacheGenerationRef.current += 1
  }
  styleEditorCacheScopeRef.current = styleEditorCacheScope
  const styleEditorCacheGeneration = styleEditorCacheGenerationRef.current

  const invalidateInactiveStyleEditors = useCallback(() => {
    const activeCacheKey = activeStyleEditorCacheKeyRef.current
    for (const [cachedKey, cachedEditor] of styleEditorCacheRef.current.entries()) {
      if (cachedKey !== activeCacheKey) {
        cachedEditor.stale = true
      }
    }
    refreshBatchMeta()
  }, [refreshBatchMeta])

  const baseSelector = useMemo(() => {
    return (
      (zoneSelectorList[activeZoneIdx] as string | undefined) ||
      (typeof finalSelector === 'string' ? finalSelector : (finalSelector as string[])?.[0]) ||
      null
    )
  }, [zoneSelectorList, activeZoneIdx, finalSelector])

  const activeZoneTab = zoneTabs[activeZoneIdx] ?? null

  // 用户切换变体才改变预览；换选中和自动回显只读取目标自己的状态。
  const previewZoneTab = useCallback((tab: ZoneTab) => {
    if (!selectedTarget || tab.ancestorStateLink) return
    if (tab.pseudo && isPreviewablePseudo(tab.pseudo)) {
      applyStatePreview(selectedTarget, tab, isSoloEdit ? undefined : { comId: shellComId })
    } else if (!tab.pseudo) {
      clearStatePreview(selectedTarget)
    }
  }, [selectedTarget, isSoloEdit, shellComId])

  // 其他同组元素发起批量操作时，同步当前面板的编辑范围。
  useEffect(() => onStatePreviewChange(() => {
    const mode = getStatePreviewMode(selectedTarget)
    if (mode) setIsSoloEdit(!mode.batch)
  }), [selectedTarget])

  // 面板焦点只描述当前元素；画布预览独立保留，不随面板卸载清理。
  useEffect(() => {
    if (selectedTarget) setFocusedVariation(selectedTarget, activeZoneTab?.selector ?? null)
  }, [selectedTarget, activeZoneTab])
  useEffect(() => () => {
    if (selectedTarget) setFocusedVariation(selectedTarget, null)
  }, [selectedTarget])

  const zoneTabAddOptions = useMemo(() => {
    const ZONE_TAB_ADD_OPTIONS = [
      { key: 'hover', suffix: ':hover', label: lang.hoverState },
      { key: 'focus', suffix: ':focus', label: lang.focusState },
      { key: 'active', suffix: ':active', label: lang.activeState },
      { key: 'disabled', suffix: ':disabled', label: lang.disabledState },
      // { key: 'before', suffix: '::before', label: '前缀元素' },
      // { key: 'after', suffix: '::after', label: '后缀元素' },
    ] as const
    const currentBaseSelector = activeZoneTab?.baseSelector || baseSelector
    if (!currentBaseSelector) return []

    return ZONE_TAB_ADD_OPTIONS
      .filter((option) => {
        const expectedSelector = `${currentBaseSelector}${option.suffix}`
        return !zoneTabs.some((tab) => (
          tab.selector === expectedSelector ||
          tab.pseudo === option.suffix
        ))
      })
      .map(({ key, label }) => ({ key, label }))
  }, [activeZoneTab, baseSelector, zoneTabs])

  const onAddZoneTab = useCallback((type: string) => {
    const currentBaseSelector = activeZoneTab?.baseSelector || baseSelector
    if (!currentBaseSelector) return
    const suffixMap: Record<string, string> = {
      hover: ':hover',
      focus: ':focus',
      active: ':active',
      disabled: ':disabled',
      before: '::before',
      after: '::after',
    }
    const suffix = suffixMap[type]
    if (!suffix) return
    const selector = `${currentBaseSelector}${suffix}`
    const labels: Record<string, string> = {
      hover: lang.hoverState,
      focus: lang.focusState,
      active: lang.activeState,
      disabled: lang.disabledState,
      before: lang.beforePseudo,
      after: lang.afterPseudo,
    }
    // 优先使用对应基础态；状态合并后则从常规 Tab 取得完整的源码规则。
    const baseTab = zoneTabs.find((tab) => tab.selector === currentBaseSelector && !tab.pseudo)
      || zoneTabs.find((tab) => !tab.pseudo)
    const tab: ZoneTab = {
      selector,
      baseSelector: currentBaseSelector,
      pseudo: suffix.startsWith(':') ? suffix : null,
      sourceRules: [],
      baseRules: (baseTab?.sourceRules.length ? baseTab.sourceRules : activeZoneTab?.baseRules || []).slice(),
      target: selectedTarget || undefined,
      label: labels[type],
      effectiveStyle: {},
      isAdded: true,
    }
    // console.log('[添加Tab]', tab);
    addZoneTab(tab)
    previewZoneTab(tab)
  }, [activeZoneTab, addZoneTab, baseSelector, selectedTarget, zoneTabs, previewZoneTab])

  const onDeleteZoneTab = useCallback((selector: string) => {
    deleteZoneTab(selector)
  }, [deleteZoneTab])

  const componentRoot = useMemo(() => {
    return shellComId ? getDocument().getElementById(shellComId) : null
  }, [shellComId])

  const [ancestorStateLinkRevision, setAncestorStateLinkRevision] = useState(0)

  useEffect(() => onStatePreviewChange(() => setAncestorStateLinkRevision(revision => revision + 1)), [])

  // 这里做三件事：
  // 当前已经在联动编辑，就不重复展示入口。
  // 调 createAncestorStateLink()，找能联动的父级。
  // 这条联动规则已经保存过，就走恢复，不再展示“添加”入口。
  const ancestorStateLinkCandidate = useMemo(() => {
    if (!selectedTarget || !activeZoneTab || activeZoneTab.ancestorStateLink) return null
    const link = createAncestorStateLink(selectedTarget, activeZoneTab.baseSelector, shellComId)
    if (!link) return null
    // 把祖先状态规则接进来，再交给原来的回显逻辑计算。
    const tab = collectAncestorStateLinkTab(selectedTarget, activeZoneTab, link, shellComId)
    if (hasAncestorStateLinkRule(tab, link)) return null
    return { ...tab, label: getZoneTabLabels([tab.selector])[0], isAdded: !zoneTabs.some(item => item.pseudo === link.pseudo) }
  }, [selectedTarget, activeZoneTab, shellComId, zoneTabs, ancestorStateLinkRevision])


  const onAddAncestorStateLink = useCallback(() => {
    if (!ancestorStateLinkCandidate) return
    // 添加新的zonetab，只建立编辑上下文，不写空 CSS，也不额外开启后代自身状态。
    addZoneTab(ancestorStateLinkCandidate)
  }, [ancestorStateLinkCandidate, addZoneTab])
  const soloBaseSelector = activeZoneTab?.ancestorStateLink ? activeZoneTab.baseSelector : baseSelector
  const stateAncestor = activeZoneTab?.ancestorStateLink
    ? resolveStateLinkAncestor(selectedTarget, activeZoneTab.ancestorStateLink) || undefined
    : undefined

  // 退出单独编辑后的本次刷新复用现场读取结果；其他切换和刷新重新扫描。
  const savedSoloStyle = useMemo(() => {
    const snapshot = batchSwitchSoloStyleRef.current
    if (!isSoloEdit && snapshot && snapshot.key === key &&
      snapshot.target === selectedTarget && snapshot.selector === baseSelector &&
      snapshot.componentRoot === componentRoot) {
      return snapshot.style
    }
    return selectedTarget && baseSelector
      ? getSavedSoloStyle(selectedTarget, soloBaseSelector || baseSelector, componentRoot, getDocument(), stateAncestor, activeZoneTab?.linkedSelector)
      : null
  }, [selectedTarget, baseSelector, soloBaseSelector, stateAncestor, activeZoneTab?.linkedSelector, componentRoot, key, isSoloEdit])

  const expectedSoloSelector = useMemo(() => {
    return selectedTarget && baseSelector
      ? buildSoloSelector(selectedTarget, soloBaseSelector || baseSelector, componentRoot, { stateAncestor, linkedSelector: activeZoneTab?.linkedSelector })
      : null
  }, [selectedTarget, baseSelector, soloBaseSelector, stateAncestor, activeZoneTab?.linkedSelector, componentRoot])

  const onZoneTabSelect = useCallback(
    (idx: number) => {
      const nextTab = zoneTabs[idx]
      previewZoneTab(nextTab)
      if (idx === activeZoneIdx) return
      const selectors = Array.from(new Set([
        nextTab?.selector,
        ...((nextTab?.baseRules || []).map((item) => item.sourceSelector || item.selectorPart)),
        ...((nextTab?.sourceRules || []).map((item) => item.sourceSelector || item.selectorPart)),
        ...(selectedTarget && (selectedTarget as HTMLElement).style?.length ? ['inline'] : []),
      ].filter(Boolean)))
      // console.log('[样式编辑][切换Tab]', {
      //   tab: nextTab?.label || nextTab?.selector || null,
      //   selectors,
      // })

      // Solo 模式下同步更新写入目标，避免先用旧 soloSelector 构建一遍，
      // 再由 rehydrate effect 根据新 tab selector 触发第二次构建。
      if (isSoloEdit) {
        skipSoloRehydrateRef.current = true
        const nextSoloSelector = selectedTarget
          ? buildSoloSelector(selectedTarget, nextTab?.ancestorStateLink ? nextTab.baseSelector : zoneSelectorList[idx], componentRoot, {
              stateAncestor: nextTab?.ancestorStateLink ? resolveStateLinkAncestor(selectedTarget, nextTab.ancestorStateLink) || undefined : undefined,
              linkedSelector: nextTab?.linkedSelector,
            })
          : null
        if (nextSoloSelector) {
          setSoloSelector(nextSoloSelector)
        }
      }

      setActiveZoneIdx(idx)
    },
    [
      activeZoneIdx,
      componentRoot,
      isSoloEdit,
      selectedTarget,
      setActiveZoneIdx,
      zoneSelectorList,
      zoneTabs,
      previewZoneTab,
    ]
  )

  // 引擎指定的 DOM 必须与面板目标一致，不能仅按同名 selector 接走其他元素的操作。
  useEffect(() => {
    return registerVariationFocusHandler((target, selector) => {
      if (target !== selectedTarget) return false
      const idx = zoneTabs.findIndex(tab => tab.selector === selector)
      if (idx < 0) return false
      onZoneTabSelect(idx)
      return true
    })
  }, [selectedTarget, zoneTabs, onZoneTabSelect])

  const resolveActiveEditContext = useCallback(() => {
    const originalOptions = editConfig.options
    let resolvedEditConfig =
      zoneSelectorList.length < 1 || !originalOptions || Array.isArray(originalOptions)
        ? editConfig
        : {
            ...editConfig,
            options: {
              ...originalOptions,
              selector: zoneSelectorList[activeZoneIdx],
              zoneTab: activeZoneTab,
              // 诊断样式写入来源时需要看到当前元素的全部候选 selector，
              // 不能只拿 activeZoneTab，否则无法列出其他未生效的 classname。
              zoneTabs,
              mergedTabs,
              originTabs,
            },
          }
    let activeSelector =
      zoneSelectorList[activeZoneIdx] ||
      (!Array.isArray(resolvedEditConfig.options) && resolvedEditConfig.options
        ? (resolvedEditConfig.options as any).selector
        : undefined) ||
      finalSelector

    // 联动地址作为新增属性的默认目标；已有属性由原来源解析决定。
    if (activeZoneTab?.linkedSelector) {
      activeSelector = activeZoneTab.linkedSelector
      if (resolvedEditConfig.options && !Array.isArray(resolvedEditConfig.options)) {
        resolvedEditConfig = { ...resolvedEditConfig, options: { ...resolvedEditConfig.options, selector: activeSelector } }
      }
    }
    if (isSoloEdit && soloSelector && !Array.isArray(resolvedEditConfig.options) && resolvedEditConfig.options) {
      activeSelector = soloSelector
      resolvedEditConfig = {
        ...resolvedEditConfig,
        // 写入目标与回显来源分离：保留 zoneTab 汇总完整生效样式，单独编辑的写入仍固定到专属 selector。
        options: { ...resolvedEditConfig.options, selector: soloSelector, soloEdit: true },
      }
    }

    return { resolvedEditConfig, activeSelector }
  }, [editConfig, zoneSelectorList, zoneTabs, mergedTabs, originTabs, activeZoneIdx, activeZoneTab, finalSelector, isSoloEdit, soloSelector])

  // 进入单独编辑模式
  const onEnterSoloEdit = useCallback(() => {
    useBatchStyleSourcesRef.current = false
    if (!expectedSoloSelector) return
    const savedBackup = soloStyleBackupRef.current.get(expectedSoloSelector)
    if (savedBackup) {
      // 清除上次切换遗留的删除信号，确保恢复的单独样式不会被再次删掉。
      ;(window as any).__mybricks_style_deletions = null
      let restored = false
      savedBackup.rules.forEach((savedRule) => {
        const restoredStyle = parseToStyleData(
          buildCssRule(savedRule.selector, savedRule.body),
          savedRule.selector
        )
        if (Object.keys(restoredStyle).length > 0) {
          // 宿主重编译后 value.set 的 selector option 会回退到面板原始选择器；
          // 必须通过 side-channel 强制写入目标，与 apply-style-change 保持一致。
          ;(window as any).__mybricks_style_explicit_selector = savedRule.selector
          try {
            if (activeZoneTab?.linkedSelector) {
              withAncestorStateLinkSelector(savedRule.selector, () => editConfig.value.set(restoredStyle, { selector: savedRule.selector }))
            } else {
              editConfig.value.set(restoredStyle, { selector: savedRule.selector })
            }
          } finally {
            delete (window as any).__mybricks_style_explicit_selector
          }
          restored = true
        }
      })
      if (restored) {
        refreshBatchMeta()
      }
    }
    pendingBatchStyleRefreshRef.current = false
    skipSoloRehydrateRef.current = true
    setSoloSelector(expectedSoloSelector)

    setIsSoloEdit(true)
    const preview = getStatePreviewContext(selectedTarget)
    if (selectedTarget && preview) applyStatePreview(selectedTarget, preview.tab)
    setKey((k) => k + 1)
  }, [editConfig, expectedSoloSelector, refreshBatchMeta, selectedTarget, activeZoneTab?.linkedSelector])

  // 切回批量时，完整路径规则会备份并移除；手写短规则保留，仅切换后续编辑的写入目标。
  const onExitSoloEdit = useCallback(() => {
    useBatchStyleSourcesRef.current = true
    if (soloSelector && selectedTarget && baseSelector) {
      // 子面板写入不一定触发 Shell 渲染，退出前读取最新规则再备份和删除。
      const savedSoloStyle = getSavedSoloStyle(selectedTarget, soloBaseSelector || baseSelector, componentRoot, getDocument(), stateAncestor, activeZoneTab?.linkedSelector)
      if (savedSoloStyle) {
        // 只备份和删除当前元素的完整规则；共用的手写短规则保持不动。
        const soloRules = savedSoloStyle.rules.filter(rule => rule.selector === expectedSoloSelector)
        if (soloRules.length) {
          soloStyleBackupRef.current.set(expectedSoloSelector || soloSelector, {
            ...soloRules[0], rules: soloRules,
          })
          let removed = false
          try {
            soloRules.forEach((savedRule) => {
              const soloStyle = parseToStyleData(
                buildCssRule(savedRule.selector, savedRule.body),
                savedRule.selector
              )
              if (Object.keys(soloStyle).length === 0) return
              // value.set({}) 只会覆盖空值；删除已有声明需要显式传递删除字段。
              // 同时需要 explicit_selector side-channel，否则宿主重编译后会忽略 selector option
              // 回退到面板原始 selector，导致基础规则（如 .featureTag{}）的属性被误删。
              ;(window as any).__mybricks_style_explicit_selector = savedRule.selector
              ;(window as any).__mybricks_style_deletions = mergeObjectKeys(
                soloStyle, savedRule.declarationKeys
              )
              try {
                if (activeZoneTab?.linkedSelector) {
                  withAncestorStateLinkSelector(savedRule.selector, () => editConfig.value.set({}, { selector: savedRule.selector }))
                } else {
                  editConfig.value.set({}, { selector: savedRule.selector })
                }
              } finally {
                delete (window as any).__mybricks_style_explicit_selector
              }
              removed = true
            })
          } finally {
            ;(window as any).__mybricks_style_deletions = null
          }
          if (removed) {
            refreshBatchMeta()
            // 宿主异步重编译时才等待源码通知；同步删除已经由本次切换刷新。
            pendingBatchStyleRefreshRef.current = !!savedSoloStyle
          }
        }
      }
      // 只供紧接着的批量渲染使用，包含没有规则的 null；删除失败时不会记录。
      batchSwitchSoloStyleRef.current = {
        key: key + 1, target: selectedTarget, selector: baseSelector, componentRoot, style: savedSoloStyle,
      }
    }
    skipSoloRehydrateRef.current = true
    setSoloSelector(null)
    setIsSoloEdit(false)
    const preview = getStatePreviewContext(selectedTarget)
    if (selectedTarget && preview) applyStatePreview(selectedTarget, preview.tab, { comId: shellComId })
    setKey((k) => k + 1)
  }, [
    key,
    editConfig,
    soloSelector,
    selectedTarget,
    baseSelector,
    componentRoot,
    soloBaseSelector,
    stateAncestor,
    activeZoneTab?.linkedSelector,
    expectedSoloSelector,
    refreshBatchMeta,
    shellComId,
  ])

  const onCopyStyle = useCallback(async () => {
    let body = ''
    if (cssEditorHandleRef.current) {
      body = cssEditorHandleRef.current.getCssBody()
    } else {
      const { resolvedEditConfig, activeSelector } = resolveActiveEditContext()
      const config = getDefaultConfiguration(resolvedEditConfig, suggestOptionsCacheRef.current)
      body = extractCssRuleBody(parseToCssCode(config.defaultValue, activeSelector))
    }
    const ok = await writeClipboardText(body)
    if (ok) {
      message.success(body ? lang.stylesCopiedMsg : lang.emptyStylesCopiedMsg)
    } else {
      message.error(lang.copyFailedMsg)
    }
  }, [resolveActiveEditContext])

  const onPasteStyle = useCallback(async () => {
    let text = ''
    try {
      text = await readClipboardText()
    } catch {
      message.error(lang.clipboardPermissionMsg)
      return
    }
    const body = extractCssRuleBody(text)
    if (!body.trim()) {
      message.warning(lang.noStyleToPasteMsg)
      return
    }

    const { resolvedEditConfig, activeSelector } = resolveActiveEditContext()
    const displaySelector = resolveDisplaySelector(activeSelector)
    const scopeEl =
      (Array.isArray(targetDom) ? targetDom[0] : targetDom) ||
      canvasEle ||
      null
    // Figma 等来源常带 var(--xxx, #fallback)；灵创无该变量时只保留兜底色值
    const pastedStyle = normalizePastedStyleVars(
      parseToStyleData(buildCssRule(displaySelector, body), displaySelector),
      scopeEl
    )
    if (Object.keys(pastedStyle).length === 0) {
      message.warning(lang.styleParseFailMsg)
      return
    }

    // 合并粘贴：同名覆盖 + 缺省保留；简写/longhand 冲突按粘贴侧清理
    // CSS 编辑态：合并进 Monaco {} 后落盘
    if (cssEditorHandleRef.current) {
      const currentBody = cssEditorHandleRef.current.getCssBody()
      const currentStyle = parseToStyleData(
        buildCssRule(displaySelector, currentBody),
        displaySelector
      )
      const mergedStyle = mergeStylesWithPasteConflicts(currentStyle, pastedStyle)
      const mergedBody = extractCssRuleBody(parseToCssCode(mergedStyle, displaySelector))
      cssEditorHandleRef.current.replaceCssBody(mergedBody)
      message.success(lang.stylesPastedMsg)
      return
    }

    // 可视化态：对「当前 ∪ 粘贴」做 diff。
    // 冲突清理会删掉冲突 longhand（如粘贴 background 时去掉旧 backgroundImage），
    // diff 会生成 value:null；非冲突缺省属性仍保留。
    const config = getDefaultConfiguration(resolvedEditConfig, suggestOptionsCacheRef.current)
    const currentStyle = filterStyleForCssCode(config.defaultValue || {})
    const mergedStyle = mergeStylesWithPasteConflicts(currentStyle, pastedStyle)
    const changes = diffStyleData(currentStyle, mergedStyle)
    if (changes.length === 0) {
      message.warning(lang.noStyleAppliedMsg)
      return
    }
    const { applied } = applyStyleChange({
      value: changes,
      liveStyle: currentStyle,
      collapsedOptions: [],
      editConfig: resolvedEditConfig,
      onBatchMetaChange: refreshBatchMeta,
    })
    if (applied) {
      setKey((k) => k + 1)
      message.success(lang.stylesPastedMsg)
    } else {
      message.warning(lang.styleUnchangedMsg)
    }
  }, [resolveActiveEditContext, refreshBatchMeta, targetDom, canvasEle])

  function onEditModeClick() {
    setStatus((status) => {
      return {
        show: true,
        open: true,
        editMode: !status.editMode,
      }
    })
  }

  useUpdateEffect(() => {
    setKey((key) => key + 1)
  }, [editConfig.ifRefresh?.()])

  // 重新选中元素时默认批量编辑；已有单独样式只参与回显，不恢复上次的编辑模式。
  useLayoutEffect(() => {
    skipSoloRehydrateRef.current = false
    useBatchStyleSourcesRef.current = false
    setSoloSelector(null)
    setIsSoloEdit(false)
  }, [selectedTarget])

  // 本次手动进入单独编辑后，状态切换和刷新都使用当前元素算出的完整路径。
  useLayoutEffect(() => {
    if (skipSoloRehydrateRef.current) {
      skipSoloRehydrateRef.current = false
      return
    }
    if (!isSoloEdit) return
    const nextSoloSelector = expectedSoloSelector
    if (soloSelector !== nextSoloSelector) {
      setSoloSelector(nextSoloSelector)
      setKey((k) => k + 1)
    }
  }, [selectedTarget, baseSelector, componentRoot, soloSelector, isSoloEdit, expectedSoloSelector])

  // 在绘制前同步编辑模式状态
  useLayoutEffect(() => {
    setSoloEditState(isSoloEdit)
    return () => setSoloEditState(false)
  }, [isSoloEdit])

  useEffect(() => {
    refreshBatchMeta()
  }, [refreshBatchMeta, key, activeZoneIdx, editMode])

  const title = useMemo(() => {
    return (
      [
        { key: 'copy', label: lang.copyStyleTip, onClick: onCopyStyle },
        { key: 'paste', label: lang.pasteStyleTip, onClick: onPasteStyle },
        { key: 'edit', label: lang.cssEditorTip, onClick: onEditModeClick },
      ]
    );
  }, [open, editMode, batchMeta, onBatchDiscard, onBatchCommit, onCopyStyle, onPasteStyle])

  const onBatchStyleSourceChange = useCallback(() => {
    if (!pendingBatchStyleRefreshRef.current || !selectedTarget || !baseSelector) return
    const currentSoloStyle = getSavedSoloStyle(selectedTarget, soloBaseSelector || baseSelector, componentRoot, getDocument(), stateAncestor, activeZoneTab?.linkedSelector)
    if (currentSoloStyle?.rules.some(rule => rule.selector === expectedSoloSelector)) return
    pendingBatchStyleRefreshRef.current = false
    setKey(k => k + 1)
  }, [selectedTarget, baseSelector, soloBaseSelector, stateAncestor, activeZoneTab?.linkedSelector, componentRoot, expectedSoloSelector])

  const editor = useMemo(() => {
    let { resolvedEditConfig, activeSelector } = resolveActiveEditContext()

    // 手动切回批量时仍沿用原来的公共回显；默认打开则保留现有单独样式回显。
    if (!isSoloEdit && selectedTarget && baseSelector && !Array.isArray(resolvedEditConfig.options)) {
      let batchSoloStyle = expectedSoloSelector ? soloStyleBackupRef.current.get(expectedSoloSelector) : null
      if (useBatchStyleSourcesRef.current) batchSoloStyle = savedSoloStyle || batchSoloStyle
      const zoneTab = (resolvedEditConfig.options as { zoneTab?: ZoneTab }).zoneTab
      if (batchSoloStyle && zoneTab) {
        resolvedEditConfig = {
          ...resolvedEditConfig,
          options: {
            ...resolvedEditConfig.options,
            zoneTab: excludeSoloSources(zoneTab, batchSoloStyle.rules.map(rule => rule.selector)),
          } as EditorProps['editConfig']['options'],
        }
      }
    }

    const configEditConfig = isSoloEdit && baseSelector && !Array.isArray(resolvedEditConfig.options)
      ? { ...resolvedEditConfig, options: { ...(resolvedEditConfig.options as any), selector: baseSelector } }
      : resolvedEditConfig
    const config = getDefaultConfiguration(configEditConfig, suggestOptionsCacheRef.current)
    if (isSoloEdit && selectedTarget && baseSelector) {
      // 恢复写入尚未完成重编译时，用已有备份回显；CSSOM 更新后优先读取最新规则。
      const soloStyleSource = savedSoloStyle || (expectedSoloSelector
        ? soloStyleBackupRef.current.get(expectedSoloSelector)
        : null)
      const soloStyle = Object.assign({}, ...((soloStyleSource?.rules || []).map((rule) =>
        parseToStyleData(buildCssRule(rule.selector, rule.body), rule.selector)
      )))
      config.setValue = soloStyle
      config.authoredStyle = { ...config.authoredStyle, ...soloStyle }
    }

    // CssEditor 仍然按 zone 强制 remount；它的 initialStyle 不是受控值。
    const editorRemountKey = `${key}:${activeZoneIdx}:${String(activeSelector ?? '')}`

    if (editMode) {
      const { targetDom: _td, ...activeStyleProps } = config
      if (isResetRef.current) {
        isResetRef.current = false
        const allOptionKeys = (config.options || []).map((t: any) =>
          typeof t === 'string' ? t.toLowerCase() : t?.type?.toLowerCase()
        )
        activeStyleProps.collapsedOptions = allOptionKeys
      }
      // 同一个 selector 只挂载一次。切走的实例保留在树中并隐藏，切回时复用
      // 原有插件状态；key 变化（刷新/单独编辑切换）会在上面清空整个缓存。
      const styleEditorCacheKey = `${key}:${String(activeSelector ?? '')}`
      activeStyleEditorCacheKeyRef.current = styleEditorCacheKey
      const styleEditorCache = styleEditorCacheRef.current
      const cachedEditor = styleEditorCache.get(styleEditorCacheKey)
      const cacheHit = !!cachedEditor && !cachedEditor.stale
      const styleMountKey = cacheHit && cachedEditor?.element.key
        ? cachedEditor.element.key
        : `${styleEditorCacheKey}:${styleEditorCacheGeneration}:${++styleEditorMountRevisionRef.current}`
      // 命中缓存时沿用 key 保留插件内部状态，但仍用本轮配置刷新 props；
      // 否则切回 Tab 后 effectiveStyle/defaultValue 会停留在首次挂载快照。
      styleEditorCache.set(
        styleEditorCacheKey,
        {
          stale: false,
          element: (
            <StyleMount
              key={styleMountKey}
              editConfig={resolvedEditConfig}
              preserveImportantPriority={isSoloEdit}
              onBatchMetaChange={invalidateInactiveStyleEditors}
              onStyleSourceChange={onBatchStyleSourceChange}
              {...activeStyleProps}
            />
          ),
        }
      )

      if (!cacheHit && styleEditorCache.size > STYLE_EDITOR_CACHE_LIMIT) {
        const oldestKey = styleEditorCache.keys().next().value
        if (oldestKey && oldestKey !== styleEditorCacheKey) {
          styleEditorCache.delete(oldestKey)
        }
      }

      return (
        <>
          {Array.from(styleEditorCache.entries()).map(([cachedKey, cachedEntry]) => (
            <div
              key={cachedKey}
              aria-hidden={cachedKey !== styleEditorCacheKey}
              style={{ display: cachedKey === styleEditorCacheKey ? 'block' : 'none' }}
            >
              {cachedEntry.element}
            </div>
          ))}
        </>
      )
    }

    return (
      <CssEditor
        key={editorRemountKey}
        onBackEditor={onEditModeClick}
        popView={(editConfig as any).popView}
        getDefaultOptions={editConfig.getDefaultOptions}
        editConfig={resolvedEditConfig}
        selector={activeSelector}
        initialStyle={config.defaultValue}
        // 代码编辑删除某行时需能落到 deletions；不沿用可视化折叠快照
        collapsedOptions={[]}
        onBatchMetaChange={refreshBatchMeta}
        editorHandleRef={cssEditorHandleRef}
      />
    )
  }, [
    editMode,
    key,
    activeZoneIdx,
    activeZoneTab?.linkedSelector,
    // TODO: 暂时去掉这个依赖，此依赖会导致 editor 被频繁刷新重新渲染。持续观察，没问题就可以删除这依赖
    // resolveActiveEditContext,
    refreshBatchMeta,
    invalidateInactiveStyleEditors,
    isSoloEdit,
    soloSelector,
    baseSelector,
    selectedTarget,
    componentRoot,
    expectedSoloSelector,
    onBatchStyleSourceChange,
    styleEditorCacheGeneration,
  ])

  const showEditModeControl = affectedCount !== null && affectedCount > 1 && zoneSelectorList.length > 0

  useEffect(() => {
    const hint = editModeHintRef.current
    if (!hint?.parentElement?.matches(':hover')) return

    // 宿主只在 mouseover 的目标节点变化时重读 data-mybricks-tip。
    // 状态切换后从新的说明节点触发刷新，保留复选框节点及键盘焦点。
    hint.dispatchEvent(new MouseEvent('mouseover', { bubbles: true }))
  }, [isSoloEdit])

  return {
    render: (
      <>
        {batchMeta.enabled && (
          <div className={css.batchActionStickyWrap}>
            <div className={css.batchActionBar}>
              <div className={css.batchMetaInfo}>{batchMeta.dirtyCount} {lang.changesCount}</div>
              <div className={css.batchActions}>
                <button
                  type="button"
                  className={css.batchIconBtn}
                  data-tip={lang.discardAllTip}
                  data-mybricks-tip={lang.discardAllTip}
                  disabled={batchMeta.submitting || batchMeta.dirtyCount === 0}
                  onClick={onBatchDiscard}
                  aria-label={lang.discardAllAriaLabel}
                >
                  <CloseOutlined />
                </button>
                <button
                  type="button"
                  className={`${css.batchIconBtn} ${css.batchConfirmBtn}`}
                  data-tip={lang.aiApplyTip}
                  data-mybricks-tip={`{content:'${lang.aiApplyTip}',position:'left'}`}
                  aria-busy={batchMeta.submitting}
                  disabled={batchMeta.dirtyCount === 0}
                  onClick={(event) => {
                    // 原 Button 的 loading 会拦截点击，不改变禁用条件和提交回调。
                    if (batchMeta.submitting) event.preventDefault()
                    else onBatchCommit()
                  }}
                  aria-label={lang.aiApplyAriaLabel}
                >
                  {batchMeta.submitting ? <LoadingOutlined /> : <CheckOutlined />}
                </button>
              </div>
            </div>
          </div>
        )}
        <ZoneTabBar
          selectors={zoneSelectorList}
          labels={zoneTabs.map((tab) => tab.label || tab.selector)}
          activeIdx={activeZoneIdx}
          onSelect={onZoneTabSelect}
          onAdd={zoneSelectorList.length > 0 ? onAddZoneTab : undefined}
          addOptions={zoneTabAddOptions}
          deletableSelectors={zoneTabs.filter((tab) => tab.isAdded).map((tab) => tab.selector)}
          onDelete={onDeleteZoneTab}
          moreMenus={title}
          targetDom={selectedTarget as HTMLElement}
        />
        {ancestorStateLinkCandidate && (
          <div className={`${css.editModeControl} ${css.ancestorStateLinkControl}`}>
            <label className={css.applyAllCheckbox}>
              <span className={css.checkboxBox}>
                <input type="checkbox" checked={false} onChange={onAddAncestorStateLink} />
                <span className={css.checkboxVisual} aria-hidden="true" />
              </span>
              <span className={css.checkboxLabel}>
                {lang.addParentStateLink.replace('{state}', ancestorStateLinkCandidate.label)}
              </span>
            </label>
          </div>
        )}
        {showEditModeControl && (
          <div
            className={`${css.editModeControl} ${
              zoneSelectorList.length > 1 ? css.editModeControlWithTabs : ''
            } ${!isSoloEdit ? css.editModeControlBatch : ''}`}
            data-mybricks-tip={isSoloEdit
              ? lang.onlyCurrentZone
              : lang.syncAllZones}
          >
            <label className={css.applyAllCheckbox}>
              <span className={css.checkboxBox}>
                <input
                  type="checkbox"
                  checked={!isSoloEdit}
                  onChange={(event) => (event.target.checked ? onExitSoloEdit() : onEnterSoloEdit())}
                />
                <span className={css.checkboxVisual} aria-hidden="true">
                  {!isSoloEdit && (
                    <svg width="10" height="8" viewBox="0 0 10 8" fill="none">
                      <path d="M1 3.5L3.8 6.5L9 1" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  )}
                </span>
              </span>
              <span className={css.checkboxLabel}>{lang.applyToAll}</span>
            </label>
            <div
              key={isSoloEdit ? 'solo' : 'batch'}
              ref={editModeHintRef}
              className={`${css.affectedHint} ${
                isSoloEdit ? css.soloAffectedHint : css.batchAffectedHint
              }`}
            >
              {isSoloEdit
                ? lang.editCurrentZoneOnly
                : <>{lang.affectedLabel} <span className={css.affectedCount}>{affectedCount}</span> {lang.affectedZones}</>}
            </div>
          </div>
        )}
        <div className={css.styleSection}>
          <div style={{ display: open ? 'block' : 'none' }}>
            {show && editor}
          </div>
        </div>
      </>
    ),
  }
}
