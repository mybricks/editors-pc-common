import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'

import { Button, Checkbox, Menu, message, Tooltip } from 'antd'
import { CheckOutlined, CloseOutlined } from '@ant-design/icons'
import { copyText } from '../utils'
import { applyStyleChange } from './core/apply-style-change'
import {
  buildCssRule,
  diffStyleData,
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
import { excludeSoloSources } from './core/zone-tab'
import type { ZoneTab } from './core/zone-tab'
import { applyStatePreview, clearStatePreview, getStatePreviewContext, isPreviewablePseudo, isStatePreviewRelated, isStatePreviewSurface, refreshStatePreview, retreatStatePreview } from './core/state-preview'
import { registerVariationFocusHandler, setFocusedVariation } from './core/variations'
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
  const [titleContent, setTitleContent] = useState('')
  const [targetStyle, setTargetStyle] = useState<any>(null)

  useMemo(() => {
    // 将 selector 写为空，避免后续依赖 selector 的逻辑（如 zone tab 生成、样式写入）拿到错误的值。便于发现问题
    if (editConfig && editConfig.options) {
      (editConfig.options as any).selector = ''
    }
  }, [editConfig])

  const [{ finalOpen, finalDisabledSwitch, finalSelector }, canvasEle] = useMemo(() => {
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
  const pendingBatchStyleRefreshRef = useRef(false)
  const soloStyleBackupRef = useRef(new Map<string, SavedSoloStyle>())
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
    userSelectedRef,
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
      `${tab.selector}:${tab.sourceRules.map((item) =>
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

  // 伪类 tab 激活时，把该状态的样式套到选中元素上预览。
  // 批量（非单独编辑）：同类元素一起预览；单独编辑：只预览选中的。
  // 换选相关元素（祖先/子孙/同类）时预览保留，手动点回基础态才清除。
  // 面板卸载不清除：宿主画布交互会反复卸载/重挂面板，清了预览会跟丢；
  // 清理由本 effect 的判定和 refreshStatePreview 的断连自愈兜底。
  useEffect(() => {
    const pseudo = activeZoneTab?.pseudo
    const preview = getStatePreviewContext()
    const batch = !isSoloEdit
    if (editMode && pseudo && isPreviewablePseudo(pseudo) && selectedTarget) {
      // 同一状态、同模式已在预览且点的是预览对象本身（或同类元素）：效果不变，跳过。
      // 子孙不能算：子孙的伪类 tab 只可能是手动点的（自动对齐会落回常规 tab），

      if (preview?.pseudo === pseudo && preview.batch === batch && isStatePreviewSurface(selectedTarget)) {
        return
      }
      applyStatePreview(
        selectedTarget,
        activeZoneTab,
        batch ? { comId: shellComId } : undefined
      )
      return
    }
    // 手动点常规 tab 退出预览，分三种情况：
    // - 点在预览根上（发起预览的那个元素）：退一层，回到父级的预览
    // - 点在父级上（下钻前预览过的那个）：整个预览退出
    // - 点在子孙等其他相关元素上：不算退出，只是切过去编辑
    const manualExitAtRoot = !!preview && userSelectedRef.current && preview.roots.includes(selectedTarget)
    const manualExit = manualExitAtRoot
      || (!!preview && userSelectedRef.current && preview.parentTarget === selectedTarget)
    if (editMode && selectedTarget && !manualExit && isStatePreviewRelated(selectedTarget)) {
      return
    }
    // 只有预览根上的退出才退一层；父级上退出直接全清——
    // 父子同时 hover 是一体的，没法只退父、留着子
    if (manualExitAtRoot && retreatStatePreview()) {
      return
    }
    clearStatePreview()
  }, [editMode, selectedTarget, activeZoneTab, isSoloEdit, shellComId])

  // 把当前选中的变体同步给引擎
  // 宿主会反复卸载/重挂面板，重挂后 tab 对齐回默认，这里会重新同步。
  useEffect(() => {
    setFocusedVariation(activeZoneTab?.selector ?? null)
  }, [activeZoneTab])
  // 面板卸载：画布上的状态预览还活着时（关面板不清预览），选中状态也保留，
  useEffect(() => () => {
    if (!getStatePreviewContext()) setFocusedVariation(null)
  }, [])

  // 引擎通过 useVariation让面板聚焦某个变体，效果等同用户手动点 tab
  useEffect(() => {
    return registerVariationFocusHandler((selector) => {
      const idx = zoneTabs.findIndex((tab) => tab.selector === selector)
      if (idx < 0) return false
      setActiveZoneIdx(idx)
      return true
    })
  }, [zoneTabs, setActiveZoneIdx])

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
  }, [activeZoneTab, addZoneTab, baseSelector, selectedTarget, zoneTabs])

  const onDeleteZoneTab = useCallback((selector: string) => {
    deleteZoneTab(selector)
  }, [deleteZoneTab])

  const componentRoot = useMemo(() => {
    return shellComId ? getDocument().getElementById(shellComId) : null
  }, [shellComId])

  const expectedSoloSelector = useMemo(() => {
    return selectedTarget && baseSelector
      ? buildSoloSelector(selectedTarget, baseSelector, componentRoot)
      : null
  }, [selectedTarget, baseSelector, componentRoot])

  const onZoneTabSelect = useCallback(
    (idx: number) => {
      if (idx === activeZoneIdx) return

      const nextTab = zoneTabs[idx]
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
          ? buildSoloSelector(selectedTarget, zoneSelectorList[idx], componentRoot)
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
    ]
  )

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
            editConfig.value.set(restoredStyle, { selector: savedRule.selector })
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
    setSoloSelector(savedBackup?.selector || expectedSoloSelector)

    setIsSoloEdit(true)
    setKey((k) => k + 1)
  }, [editConfig, expectedSoloSelector, refreshBatchMeta])

  // 切回批量时，完整路径规则会备份并移除；手写短规则保留，仅切换后续编辑的写入目标。
  const onExitSoloEdit = useCallback(() => {
    if (soloSelector && selectedTarget && baseSelector) {
      const savedSoloStyle = getSavedSoloStyle(
        selectedTarget,
        baseSelector,
        componentRoot,
        getDocument()
      )
      if (savedSoloStyle) {
        const hasShortSelector =
          !!expectedSoloSelector &&
          savedSoloStyle.rules.some((savedRule) => savedRule.selector !== expectedSoloSelector)

        // 手写短 selector 由宿主删除时会误伤同类基础规则；保留它，仅切换后续编辑的写入目标。
        if (!hasShortSelector) {
          soloStyleBackupRef.current.set(expectedSoloSelector || soloSelector, savedSoloStyle)
          let removed = false
          try {
            savedSoloStyle.rules.forEach((savedRule) => {
              const soloStyle = parseToStyleData(
                buildCssRule(savedRule.selector, savedRule.body),
                savedRule.selector
              )
              if (Object.keys(soloStyle).length === 0) return
              // value.set({}) 只会覆盖空值；删除已有声明需要显式传递删除字段。
              // 同时需要 explicit_selector side-channel，否则宿主重编译后会忽略 selector option
              // 回退到面板原始 selector，导致基础规则（如 .featureTag{}）的属性被误删。
              ;(window as any).__mybricks_style_explicit_selector = savedRule.selector
              ;(window as any).__mybricks_style_deletions = Array.from(new Set([
                ...Object.keys(soloStyle), ...savedRule.declarationKeys,
              ]))
              try {
                editConfig.value.set({}, { selector: savedRule.selector })
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
            pendingBatchStyleRefreshRef.current = !!getSavedSoloStyle(
              selectedTarget, baseSelector, componentRoot, getDocument()
            )
          }
        }
      }
    }
    skipSoloRehydrateRef.current = true
    setSoloSelector(null)
    setIsSoloEdit(false)
    setKey((k) => k + 1)
  }, [
    editConfig,
    soloSelector,
    selectedTarget,
    baseSelector,
    componentRoot,
    expectedSoloSelector,
    refreshBatchMeta,
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

  // 有单独规则自动回显，否则默认回到批量编辑。
  useEffect(() => {
    if (skipSoloRehydrateRef.current) {
      skipSoloRehydrateRef.current = false
      return
    }

    const savedSoloStyle =
      selectedTarget && baseSelector
        ? getSavedSoloStyle(selectedTarget, baseSelector, componentRoot, getDocument())
        : null
    const nextSoloSelector = savedSoloStyle?.selector || null
    const nextIsSoloEdit = !!nextSoloSelector

    if (soloSelector !== nextSoloSelector || isSoloEdit !== nextIsSoloEdit) {
      setSoloSelector(nextSoloSelector)
      setIsSoloEdit(nextIsSoloEdit)
      setKey((k) => k + 1)
    }
  }, [
    selectedTarget,
    baseSelector,
    componentRoot,
    soloSelector,
    isSoloEdit,
  ])

  useEffect(() => {
    refreshBatchMeta()
  }, [refreshBatchMeta, key, activeZoneIdx, editMode])

  const title = useMemo(() => {
    return (
      <Menu>
        <Menu.Item key="copy" onClick={onCopyStyle}>{lang.copyStyleTip}</Menu.Item>
        <Menu.Item key="paste" onClick={onPasteStyle}>{lang.pasteStyleTip}</Menu.Item>
        <Menu.Item key="edit" onClick={onEditModeClick}>{lang.cssEditorTip}</Menu.Item>
      </Menu>
    );
  }, [open, editMode, titleContent, batchMeta, onBatchDiscard, onBatchCommit, onCopyStyle, onPasteStyle])

  const onBatchStyleSourceChange = useCallback(() => {
    if (!pendingBatchStyleRefreshRef.current || !selectedTarget || !baseSelector) return
    if (getSavedSoloStyle(selectedTarget, baseSelector, componentRoot, getDocument())) return
    pendingBatchStyleRefreshRef.current = false
    setKey(k => k + 1)
  }, [selectedTarget, baseSelector, componentRoot])

  const editor = useMemo(() => {
    let { resolvedEditConfig, activeSelector } = resolveActiveEditContext()

    // 有手写短规则时退出单独编辑不会删除 CSS；批量面板应按公共来源回显，
    // 而不是继续把当前节点的 nth-child 覆盖当成公共值。
    if (!isSoloEdit && selectedTarget && baseSelector && !Array.isArray(resolvedEditConfig.options)) {
      const savedSoloStyle = getSavedSoloStyle(selectedTarget, baseSelector, componentRoot, getDocument())
        || (expectedSoloSelector ? soloStyleBackupRef.current.get(expectedSoloSelector) : null)
      const zoneTab = (resolvedEditConfig.options as { zoneTab?: ZoneTab }).zoneTab
      if (savedSoloStyle && zoneTab) {
        resolvedEditConfig = {
          ...resolvedEditConfig,
          options: {
            ...resolvedEditConfig.options,
            zoneTab: excludeSoloSources(zoneTab, savedSoloStyle.rules.map(rule => rule.selector)),
          } as EditorProps['editConfig']['options'],
        }
      }
    }

    const configEditConfig = isSoloEdit && baseSelector && !Array.isArray(resolvedEditConfig.options)
      ? { ...resolvedEditConfig, options: { ...(resolvedEditConfig.options as any), selector: baseSelector } }
      : resolvedEditConfig
    const config = getDefaultConfiguration(configEditConfig, suggestOptionsCacheRef.current)
    if (isSoloEdit && selectedTarget && baseSelector) {
      const savedSoloStyle = getSavedSoloStyle(selectedTarget, baseSelector, componentRoot, getDocument())
      const soloStyle = Object.assign({}, ...((savedSoloStyle?.rules || []).map((rule) =>
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
                <Button
                  size="small"
                  type="default"
                  shape="circle"
                  className={css.batchIconBtn}
                  data-tip={lang.discardAllTip}
                  data-mybricks-tip={lang.discardAllTip}
                  disabled={batchMeta.submitting || batchMeta.dirtyCount === 0}
                  onClick={onBatchDiscard}
                  aria-label={lang.discardAllAriaLabel}
                >
                  <CloseOutlined />
                </Button>
                <Button
                  size="small"
                  type="default"
                  shape="circle"
                  className={`${css.batchIconBtn} ${css.batchConfirmBtn}`}
                  data-tip={lang.aiApplyTip}
                  data-mybricks-tip={`{content:'${lang.aiApplyTip}',position:'left'}`}
                  loading={batchMeta.submitting}
                  disabled={batchMeta.dirtyCount === 0}
                  onClick={onBatchCommit}
                  aria-label={lang.aiApplyAriaLabel}
                >
                  {!batchMeta.submitting && <CheckOutlined />}
                </Button>
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
        {showEditModeControl && (
          <div
            className={`${css.editModeControl} ${
              zoneSelectorList.length > 1 ? css.editModeControlWithTabs : ''
            } ${!isSoloEdit ? css.editModeControlBatch : ''}`}
            data-mybricks-tip={isSoloEdit
              ? lang.onlyCurrentZone
              : lang.syncAllZones}
          >
            <Checkbox
              checked={!isSoloEdit}
              onChange={(event) => (event.target.checked ? onExitSoloEdit() : onEnterSoloEdit())}
            >
              {lang.applyToAll}
            </Checkbox>
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
        {canvasEle &&
          targetStyle &&
          createPortal(
            <>
              <div className={css.popupTips} style={targetStyle.canvas}></div>
              <Tooltip
                placement="topLeft"
                title={editConfig.title || lang.currentDomZone}
                visible={true}
                overlayInnerStyle={{
                  color: '#555',
                  fontSize: 12,
                  minWidth: 50,
                  textAlign: 'center',
                  boxShadow: '0px 1px 4px 2px rgba(39, 54, 78, 0.37)',
                  borderRadius: 4,
                }}
                color="#fff"
                transitionName=""
              >
                <div className={css.popupTips} style={targetStyle.tips}></div>
              </Tooltip>
            </>,
            canvasEle
          )}
      </>
    ),
  }
}
