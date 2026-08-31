import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'

import { Button, Checkbox, message, Tooltip } from 'antd'
import {
  AppstoreOutlined,
  CaretRightOutlined,
  CheckOutlined,
  CloseOutlined,
  ReloadOutlined,
} from '@ant-design/icons'
import { Code } from './StyleEditor/icons/Code'
import { Copy } from './StyleEditor/icons/Copy'
import { Paste } from './StyleEditor/icons/Paste'

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
import { getDocument, toElementArray } from './core/dom'
import { goBackIcon } from './icon'
import { ZoneTabBar } from './ZoneTabBar'
import css from './index.less'

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
  const [soloSelector, setSoloSelector] = useState<string | null>(null)
  const skipSoloRehydrateRef = useRef(false)
  const soloStyleBackupRef = useRef(new Map<string, SavedSoloStyle>())
  const suggestOptionsCacheRef = useRef<SuggestOptionsCache>(new WeakMap())
  const cssEditorHandleRef = useRef<CssEditorHandle | null>(null)

  useEffect(() => {
    suggestOptionsCacheRef.current = new WeakMap()
  }, [key])

  // 只从 editConfig 中拿 targetDom，用于 hover 标记效果
  const targetDom = useMemo(() => {
    if (!editConfig.options || Array.isArray(editConfig.options)) return null
    return (editConfig.options as any).targetDom ?? null
  }, [editConfig])

  const { batchMeta, refreshBatchMeta, onBatchDiscard, onBatchCommit } = useBatchMeta(editConfig)
  const { zoneSelectorList, activeZoneIdx, setActiveZoneIdx } = useZoneSelectors(
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
    zoneSelectorList,
    finalSelector,
    shellComId || undefined,
    selectedTarget
  )

  const baseSelector = useMemo(() => {
    return (
      (zoneSelectorList[activeZoneIdx] as string | undefined) ||
      (typeof finalSelector === 'string' ? finalSelector : (finalSelector as string[])?.[0]) ||
      null
    )
  }, [zoneSelectorList, activeZoneIdx, finalSelector])

  const componentRoot = useMemo(() => {
    return shellComId ? getDocument().getElementById(shellComId) : null
  }, [shellComId])

  const expectedSoloSelector = useMemo(() => {
    return selectedTarget && baseSelector
      ? buildSoloSelector(selectedTarget, baseSelector, componentRoot)
      : null
  }, [selectedTarget, baseSelector, componentRoot])

  const resolveActiveEditContext = useCallback(() => {
    const originalOptions = editConfig.options
    let resolvedEditConfig =
      zoneSelectorList.length < 1 || !originalOptions || Array.isArray(originalOptions)
        ? editConfig
        : {
            ...editConfig,
            options: { ...originalOptions, selector: zoneSelectorList[activeZoneIdx] },
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
        options: { ...resolvedEditConfig.options, selector: soloSelector },
      }
    }

    return { resolvedEditConfig, activeSelector }
  }, [editConfig, zoneSelectorList, activeZoneIdx, finalSelector, isSoloEdit, soloSelector])

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
          editConfig.value.set(restoredStyle, { selector: savedRule.selector })
          restored = true
        }
      })
      if (restored) {
        refreshBatchMeta()
      }
    }
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
          savedSoloStyle.rules.forEach((savedRule) => {
            const soloStyle = parseToStyleData(
              buildCssRule(savedRule.selector, savedRule.body),
              savedRule.selector
            )
            if (Object.keys(soloStyle).length === 0) return
            // value.set({}) 只会覆盖空值；删除已有声明需要显式传递删除字段。
            ;(window as any).__mybricks_style_deletions = Object.keys(soloStyle)
            editConfig.value.set({}, { selector: savedRule.selector })
            removed = true
          })
          if (removed) refreshBatchMeta()
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

  const refresh = useCallback(() => {
    editConfig.value.set({})
    isResetRef.current = true
    setKey((key) => key + 1)
  }, [])

  const copy = useCallback(() => {
    if (finalSelector) {
      if (typeof finalSelector === 'string') {
        copyText(
          JSON.stringify({
            [finalSelector]: {},
          })
        )
      } else {
        copyText(
          JSON.stringify(
            (finalSelector as string[]).reduce((p, c) => {
              p[c] = {}
              return p
            }, {} as any)
          )
        )
      }
      message.success('复制成功')
    }
  }, [])

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
      message.success(body ? '样式已复制' : '已复制（当前无样式）')
    } else {
      message.error('复制失败')
    }
  }, [resolveActiveEditContext])

  const onPasteStyle = useCallback(async () => {
    let text = ''
    try {
      text = await readClipboardText()
    } catch {
      message.error('无法读取剪切板，请检查浏览器权限')
      return
    }
    const body = extractCssRuleBody(text)
    if (!body.trim()) {
      message.warning('剪切板中没有可粘贴的样式')
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
      message.warning('剪切板样式无法解析')
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
      message.success('样式已粘贴')
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
      message.warning('没有可应用的样式')
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
      message.success('样式已粘贴')
    } else {
      message.warning('样式未发生变化')
    }
  }, [resolveActiveEditContext, refreshBatchMeta, targetDom, canvasEle])

  function onOpenClick() {
    if (!finalDisabledSwitch) {
      setStatus((status) => {
        return {
          ...status,
          show: true,
          open: !status.open,
        }
      })
    }
  }

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
      <>
        {/* 可视化编辑态的工具条 */}
        {editMode && (
          <div className={css.titleContainer}>
            <div className={css.title} onClick={onOpenClick}>
              <div>{editConfig.title}</div>
            </div>
            <div className={css.actions_allawys_display}>
              <div className={css.selector} data-mybricks-tip={finalSelector} onClick={copy}>
                {finalSelector}
              </div>
              <div className={css.iconActions}>
                <div
                  className={`${css.icon} ${css.codeIcon}`}
                  data-mybricks-tip={`{content:'复制样式',position:'left'}`}
                  onClick={onCopyStyle}
                >
                  <Copy />
                </div>
                <div
                  className={`${css.icon} ${css.codeIcon}`}
                  data-mybricks-tip={`{content:'粘贴样式',position:'left'}`}
                  onClick={onPasteStyle}
                >
                  <Paste />
                </div>
                <div
                  className={`${css.icon} ${css.codeIcon}`}
                  data-mybricks-tip={`{content:'CSS编辑',position:'left'}`}
                  onClick={onEditModeClick}
                >
                  {editMode ? <Code /> : <AppstoreOutlined />}
                </div>
              </div>
            </div>
          </div>
        )}
        {/* 代码编辑的工具条 */}
        {!editMode && (
          <div
            onMouseEnter={onMouseEnter}
            onMouseLeave={onMouseLeave}
            className={css.titleContainer}
          >
            <div className={css.title} style={{ fontWeight: 'normal' }} onClick={onOpenClick}>
              {finalDisabledSwitch ? null : (
                <div
                  className={`${css.icon}${open ? ` ${css.iconOpen}` : ''}`}
                  data-mybricks-tip={open ? '收起' : '展开'}
                >
                  <CaretRightOutlined />
                </div>
              )}
              <div>{editConfig.title}</div>
            </div>
            <div className={css.actions_allawys_display}>
              <div className={css.selector} data-mybricks-tip={finalSelector} onClick={copy}>
                {finalSelector}
              </div>
              <div className={css.iconActions}>
                <div
                  className={`${css.icon} ${css.codeIcon}`}
                  data-mybricks-tip={`{content:'复制样式',position:'left'}`}
                  onClick={onCopyStyle}
                >
                  <Copy />
                </div>
                <div
                  className={`${css.icon} ${css.codeIcon}`}
                  data-mybricks-tip={`{content:'粘贴样式',position:'left'}`}
                  onClick={onPasteStyle}
                >
                  <Paste />
                </div>
                <div
                  className={css.icon}
                  data-mybricks-tip={`{content:'返回可视化编辑',position:'left'}`}
                  onClick={onEditModeClick}
                >
                  {goBackIcon}
                </div>
              </div>
              {/* <div className={css.icon} data-mybricks-tip={'复制selector'} onClick={copy}>
                <CopyOutlined />
              </div> */}
              {/* <div className={css.icon} data-mybricks-tip={'重置'} onClick={refresh}>
                <ReloadOutlined />
              </div> */}
            </div>
          </div>
        )}
      </>
    )
  }, [open, editMode, titleContent, batchMeta, onBatchDiscard, onBatchCommit, onCopyStyle, onPasteStyle])

  const editor = useMemo(() => {
    const { resolvedEditConfig, activeSelector } = resolveActiveEditContext()

    const config = getDefaultConfiguration(resolvedEditConfig, suggestOptionsCacheRef.current)

    // 插件内部大量用 useState 初始化 value，切 zone tab 时必须 remount，否则面板不刷新
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
      return (
        <StyleMount
          key={editorRemountKey}
          editConfig={resolvedEditConfig}
          preserveImportantPriority={isSoloEdit}
          onBatchMetaChange={refreshBatchMeta}
          {...activeStyleProps}
        />
      )
    }

    return (
      <CssEditor
        key={editorRemountKey}
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
  }, [editMode, key, activeZoneIdx, resolveActiveEditContext, refreshBatchMeta, isSoloEdit])

  function onMouseEnter() {
    try {
      if (canvasEle && targetDom.length) {
        setTitleContent('(已标记)')
        const res: any = Array.from(targetDom).reduce(
          (res: any, dom: any) => {
            const rect = dom.getBoundingClientRect()
            if (res.left > rect.left) {
              res.left = rect.left
            }
            if (res.top > rect.top) {
              res.top = rect.top
            }
            const width = rect.left + rect.width
            if (res.width < width) {
              res.width = width
            }
            const height = rect.top + rect.height
            if (res.height < height) {
              res.height = height
            }

            return res
          },
          {
            left: Infinity,
            top: Infinity,
            width: -Infinity,
            height: -Infinity,
          }
        )
        const width = res.width - res.left
        const height = res.height - res.top
        const cRect = canvasEle.getBoundingClientRect()
        setTargetStyle({
          canvas: {
            left: res.left - cRect.left,
            top: res.top - cRect.top,
            width,
            height,
          },
          tips: {
            left: res.left - cRect.left,
            top: res.top - cRect.top + 8,
          },
        })
      } else {
        setTitleContent('(非dom节点)')
      }
    } catch {}
  }

  function onMouseLeave() {
    try {
      if (canvasEle && targetDom.length) {
        setTargetStyle(null)
      }
      setTitleContent('')
    } catch {}
  }

  const showEditModeControl = affectedCount !== null && affectedCount > 1

  return {
    render: (
      <>
        {batchMeta.enabled && (
          <div className={css.batchActionStickyWrap}>
            <div className={css.batchActionBar}>
              <div className={css.batchMetaInfo}>{batchMeta.dirtyCount} 处变更</div>
              <div className={css.batchActions}>
                <Button
                  size="small"
                  type="default"
                  shape="circle"
                  className={css.batchIconBtn}
                  data-tip="全部丢弃"
                  data-mybricks-tip="全部丢弃"
                  disabled={batchMeta.submitting || batchMeta.dirtyCount === 0}
                  onClick={onBatchDiscard}
                  aria-label="清空暂存"
                >
                  <CloseOutlined />
                </Button>
                <Button
                  size="small"
                  type="default"
                  shape="circle"
                  className={`${css.batchIconBtn} ${css.batchConfirmBtn}`}
                  data-tip="交给AI应用"
                  data-mybricks-tip={`{content:'交给AI应用',position:'left'}`}
                  loading={batchMeta.submitting}
                  disabled={batchMeta.dirtyCount === 0}
                  onClick={onBatchCommit}
                  aria-label="提交给AI修改"
                >
                  {!batchMeta.submitting && <CheckOutlined />}
                </Button>
              </div>
            </div>
          </div>
        )}
        {zoneSelectorList.length > 1 && (
          <ZoneTabBar
            selectors={zoneSelectorList}
            activeIdx={activeZoneIdx}
            onSelect={setActiveZoneIdx}
          />
        )}
        {showEditModeControl && (
          <div className={css.editModeControl}>
            <Checkbox
              checked={!isSoloEdit}
              onChange={(event) => (event.target.checked ? onExitSoloEdit() : onEnterSoloEdit())}
            >
              应用至全部
            </Checkbox>
            <div
              className={`${css.affectedHint} ${
                isSoloEdit ? css.soloAffectedHint : css.batchAffectedHint
              }`}
            >
              {isSoloEdit
                ? '当前仅编辑选中区域'
                : `修改会影响 ${affectedCount}个区域`}
            </div>
          </div>
        )}
        <div className={css.styleSection}>
          {title}
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
                title={editConfig.title || '当前dom区域'}
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
