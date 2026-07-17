import React, {CSSProperties, useCallback, useMemo, useRef, useState,useEffect} from 'react'
import {createPortal} from "react-dom";

// @ts-ignore
import colorUtil from 'color-string'
// @ts-ignore
import {toCSS, toJSON} from 'cssjson';
// @ts-ignore
import {calculate, compare} from 'specificity';

import {Button, message, Tooltip} from "antd";

import {AppstoreOutlined, CaretRightOutlined, CheckOutlined, CloseOutlined, CodeOutlined, CopyOutlined, ReloadOutlined,DeleteOutlined} from '@ant-design/icons'
// @ts-ignore
import MonacoEditor from "@mybricks/code-editor";

import {copyText, deepCopy} from '../utils'
import StyleEditor, {DEFAULT_OPTIONS, StyleEditorProvider} from './StyleEditor'

import {getSuggestOptionsByElement, mergeCSSProperties, splitCSSProperties} from './StyleEditor/helper'
import { initLiveStyle } from './StyleEditor/helper/gradient-border'
import {
  decomposeBackgroundStack,
  isPaintStackPropIrrelevantToBorder,
  isPaintStackPropOwnedByTextFill,
  preservePaintRoles,
  refineEffectedPanel,
} from './StyleEditor/helper/paint-stack'

import type {EditorProps, GetDefaultConfigurationProps} from './type'
import type {ChangeEvent, Options, Style} from './StyleEditor/type'

import {useUpdateEffect} from './StyleEditor/hooks'

import css from './index.less'
import {fullScreenIcon, goBackIcon} from './icon';

interface State {
  open: boolean
  editMode: boolean
}

type SuggestOptionItem = { type: string, config?: any }
type SuggestOptionsCache = WeakMap<HTMLElement, { options: SuggestOptionItem[], timestamp: number }>

const SUGGEST_OPTIONS_CACHE_TTL = 1500

function getSuggestOptionsWithCache(realTargetDom: HTMLElement, cache?: SuggestOptionsCache) {
  if (!cache) {
    return getSuggestOptionsByElement(realTargetDom)
  }

  const now = Date.now()
  const cacheItem = cache.get(realTargetDom)
  if (cacheItem && (now - cacheItem.timestamp) < SUGGEST_OPTIONS_CACHE_TTL) {
    return cacheItem.options
  }

  const suggestOptions = getSuggestOptionsByElement(realTargetDom)
  if (suggestOptions) {
    cache.set(realTargetDom, { options: suggestOptions as SuggestOptionItem[], timestamp: now })
  }
  return suggestOptions
}

function getDocument() {
  const root = document.getElementById('_mybricks-geo-webview_')?.shadowRoot || document
  return root
}

/** 将字符串中的正则特殊字符转义，用于把 CSS 选择器安全地嵌入 RegExp */
function escapeRegExp(str: string) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

/**
 * 伪类的展示优先级顺序。
 * 扫描到的伪类按此列表排序，不在列表里的排到末尾。
 */
const PSEUDO_ORDER = [':hover', ':focus', ':focus-visible', ':focus-within', ':active', ':disabled', ':checked', ':placeholder-shown']

/**
 * 扫描 shadow DOM 里的 <style> 标签，找出指定选择器在当前组件（comId）样式表中
 * 实际存在的伪类变体。
 *
 * 例：baseSelector=".searchArea .hotWords span"，comId="u_VvteU"
 * 若样式表中有 ".u_VvteU .hotWords span:hover"
 * 则返回 [".searchArea .hotWords span:hover"]
 *
 * 注意：匹配时只取 baseSelector 的最后一段（如 "span"）与 comId 组合做正则，
 * 因为 LESS 嵌套展开后的路径与 JSX 祖先链不一定完全一致（中间层级可能不同）。
 *
 * @param baseSelectors - 基础选择器列表（不含伪类，不含 comId 前缀）
 * @param comId         - 组件 ID，用于隔离不同组件的同名选择器
 */
function scanPseudoSelectors(baseSelectors: string[], comId: string): string[] {
  if (!baseSelectors.length || !comId) return []

  // 收集每个基础选择器对应的伪类集合
  const pseudoMap = new Map<string, Set<string>>()
  for (const sel of baseSelectors) {
    pseudoMap.set(sel, new Set())
  }

  const root = getDocument()

  // 平台样式注入在 shadow DOM 里，document.styleSheets 拿不到
  // 需要从 shadow root 里的 <style> 标签手动提取 cssRules
  const styleEls = Array.from((root as any).querySelectorAll?.('style') || [])

  for (const styleEl of styleEls as HTMLStyleElement[]) {
    let rules: CSSRuleList | null = null
    try {
      rules = styleEl.sheet?.cssRules ?? null
    } catch {
      continue
    }
    if (!rules) continue

    for (const rule of Array.from(rules)) {
      const selectorText = (rule as CSSStyleRule).selectorText
      if (!selectorText) continue

      for (const sel of baseSelectors) {
        // 只用选择器的最后一段来匹配（最具体的片段）
        // 例：sel=".searchArea .hotWords span"，最后一段是 "span"
        // 样式表里是 ".u_VvteU .hotWords span:hover"，用最后一段能正确命中
        // 用完整路径匹配会因为中间层级不一致（LESS嵌套展开后路径与JSX祖先链不同）而失败
        const lastSegment = sel.trim().split(/\s+/).pop() || sel
        // 类选择器（以 . 开头）需同时匹配 CSS Modules 编译后带前缀的形式
        // 例：lastSegment=".glowBox" → 同时匹配 ".glowBox" 和 "pages_xxx_less-glowBox"
        const segmentPattern = lastSegment.startsWith('.')
          ? `(?:${escapeRegExp(lastSegment)}|[\\w\\-]*\\-${escapeRegExp(lastSegment.slice(1))})`
          : escapeRegExp(lastSegment)
        const regex = new RegExp(
          escapeRegExp(comId) + '.*' + segmentPattern + '(:{1,2}[a-zA-Z\\-]+(?:\\([^)]*\\))?)$'
        )
        const match = selectorText.match(regex)
        if (match) {
          pseudoMap.get(sel)!.add(match[1])
          continue
        }

        // ── 父级伪类兜底 ──────────────────────────────────────────────────────
        // 场景：sel 末尾是纯 HTML 标签名（如 "span"），自身没有 :hover 规则，
        // 但父级选择器（如 ".actionItem"）有 :hover 规则，子元素会继承其样式。
        // 此时也应为 sel 生成 hover tab，让用户能感知/覆盖继承值。
        // 判断条件：lastSegment 无 . # : 前缀（纯标签名），
        //           且样式表中存在 comId 作用域内、以父级末尾段+伪类结尾的规则。
        const lastSegIsTag = /^[a-z][a-zA-Z0-9]*$/.test(lastSegment)
        if (lastSegIsTag) {
          const segments = sel.trim().split(/\s+/)
          if (segments.length >= 2) {
            const parentLastSeg = segments[segments.length - 2]
            const parentSegPattern = parentLastSeg.startsWith('.')
              ? `(?:${escapeRegExp(parentLastSeg)}|[\\w\\-]*\\-${escapeRegExp(parentLastSeg.slice(1))})`
              : escapeRegExp(parentLastSeg)
            const parentPseudoRegex = new RegExp(
              escapeRegExp(comId) + '.*' + parentSegPattern + '(:{1,2}[a-zA-Z\\-]+(?:\\([^)]*\\))?)$'
            )
            const parentMatch = selectorText.match(parentPseudoRegex)
            if (parentMatch) {
              pseudoMap.get(sel)!.add(parentMatch[1])
            }
          }
        }
      }
    }
  }

  // 按 PSEUDO_ORDER 排序后，为每个基础选择器生成带伪类的完整选择器
  const result: string[] = []
  for (const sel of baseSelectors) {
    const pseudoSet = pseudoMap.get(sel)!
    const sorted = Array.from(pseudoSet).sort((a, b) => {
      const ai = PSEUDO_ORDER.indexOf(a)
      const bi = PSEUDO_ORDER.indexOf(b)
      // 不在列表里的排末尾（indexOf 返回 -1，用 Infinity 替代）
      return (ai === -1 ? Infinity : ai) - (bi === -1 ? Infinity : bi)
    })
    for (const pseudo of sorted) {
      result.push(sel + pseudo)
    }
  }
  return result
}

export default function ({editConfig}: EditorProps) {
  const [titleContent, setTitleContent] = useState("");
  const [targetStyle, setTargetStyle] = useState<any>(null);

  const [
    {
      finalOpen,
      finalDisabledSwitch,
      finalSelector
    },
    canvasEle
  ] = useMemo(() => {

    return [
      getDefaultConfiguration2(editConfig), 
      // @ts-ignore
      editConfig.canvasEle
    ]
  }, [])

  const [{
    open,
    show,
    editMode,
  }, setStatus] = useState({
    open: finalOpen,
    show: finalOpen,
    editMode: true
  })

  const [key, setKey] = useState(0)
  const [activeZoneIdx, setActiveZoneIdx] = useState(0)
  const [affectedCount, setAffectedCount] = useState<number | null>(null)
  const isResetRef = useRef(false)
  const suggestOptionsCacheRef = useRef<SuggestOptionsCache>(new WeakMap())

  useEffect(() => {
    suggestOptionsCacheRef.current = new WeakMap()
  }, [key])

  // 只从 editConfig 中拿 targetDom，用于 hover 标记效果
  const targetDom = useMemo(() => {
    if (!editConfig.options || Array.isArray(editConfig.options)) return null
    return (editConfig.options as any).targetDom ?? null
  }, [editConfig])

  // 从样式表中扫描到的伪类选择器列表，如 [".searchArea .hotWords span:hover"]
  const [pseudoSelectorList, setPseudoSelectorList] = useState<string[]>([])
  const [batchMeta, setBatchMeta] = useState<{ enabled: boolean; dirtyCount: number; submitting: boolean }>({
    enabled: false,
    dirtyCount: 0,
    submitting: false,
  })
  const refreshBatchMeta = useCallback(() => {
    const localMeta = editConfig.value.getBatchMeta?.()
    const bridgeMeta = (window as any).__mybricks_style_batch_bridge?.getMeta?.()
    const localDirty = Number(localMeta?.dirtyCount || 0)
    const bridgeDirty = Number(bridgeMeta?.dirtyCount || 0)
    const dirtyCount = Math.max(localDirty, bridgeDirty)
    const submitting = !!(localMeta?.submitting || bridgeMeta?.submitting)
    const enabled = !!(localMeta?.enabled || bridgeMeta?.enabled || dirtyCount > 0)
    setBatchMeta(prev => {
      if (
        prev.enabled === enabled &&
        prev.dirtyCount === dirtyCount &&
        prev.submitting === submitting
      ) {
        return prev
      }
      return { enabled, dirtyCount, submitting }
    })
  }, [editConfig])

  useEffect(() => {
    if (!open) return

    // 提取基础选择器列表（不含伪类的条目）
    const domList = Object.prototype.toString.call(targetDom) === '[object NodeList]'
      ? Array.from(targetDom as NodeList)
      : targetDom ? [targetDom as Element] : []

    const baseSelectors: string[] = []
    for (const dom of domList as Element[]) {
      const raw = dom?.getAttribute?.('data-zone-selector')
      if (raw) {
        try {
          const parsed: string[] = JSON.parse(raw)
          if (Array.isArray(parsed)) {
            parsed.forEach(s => {
              // 只取不含伪类的基础选择器
              if (!s.includes(':') && !baseSelectors.includes(s)) {
                baseSelectors.push(s)
              }
            })
          }
        } catch {}
      }
    }

    const comId = (!editConfig.options || Array.isArray(editConfig.options))
      ? ''
      : (editConfig.options as any).comId ?? ''

    setPseudoSelectorList(prev => {
      const next = scanPseudoSelectors(baseSelectors, comId)
      if (prev.length === next.length && prev.every((v, i) => v === next[i])) return prev
      return next
    })
  }, [open, targetDom])

  const refresh = useCallback(() => {
    editConfig.value.set({})
    isResetRef.current = true
    setKey(key => key + 1)
  }, [])

  const copy = useCallback(() => {
    if (finalSelector) {
      if (typeof finalSelector === "string") {
        copyText(JSON.stringify({
          [finalSelector]: {}
        }))
      } else {
        copyText(JSON.stringify((finalSelector as string[]).reduce((p, c) => {
          p[c] = {};
          return p
        }, {} as any)))
      }
      message.success("复制成功");
    }
  }, [])

  function onOpenClick () {
    if (!finalDisabledSwitch) {
      setStatus((status) => {
        return {
          ...status,
          show: true,
          open: !status.open
        }
      })
    }
  }

  function onEditModeClick () {
    setStatus((status) => {
      return {
        show: true,
        open: true,
        editMode: !status.editMode
      }
    })
  }

  useUpdateEffect(() => {
    setKey(key => key + 1)
  }, [editConfig.ifRefresh?.()])

  useEffect(() => {
    refreshBatchMeta()
  }, [refreshBatchMeta, key, activeZoneIdx, editMode])

  const onBatchDiscard = useCallback(() => {
    if (editConfig.value.discardBatch) {
      editConfig.value.discardBatch()
    } else {
      (window as any).__mybricks_style_batch_bridge?.discard?.()
    }
    refreshBatchMeta()
  }, [editConfig, refreshBatchMeta])

  const onBatchCommit = useCallback(() => {
    if (editConfig.value.commitBatch) {
      editConfig.value.commitBatch()
    } else {
      (window as any).__mybricks_style_batch_bridge?.commit?.()
    }
    refreshBatchMeta()
  }, [editConfig, refreshBatchMeta])

  const title = useMemo(() => {
    return (
      <>
      {/* 可视化编辑态的工具条 */}
      {editMode &&  (<div
        // onMouseEnter={onMouseEnter}
        // onMouseLeave={onMouseLeave}
        className={css.titleContainer}
        //style={{ marginBottom: open ? 3 : 0 }}
      >
        <div className={css.title} onClick={onOpenClick}>
          {/*{finalDisabledSwitch ? null : <div*/}
          {/*  className={`${css.icon}${open ? ` ${css.iconOpen}` : ''}`}*/}
          {/*  data-mybricks-tip={open ? '收起' : '展开'}*/}
          {/*>*/}
          {/*  <CaretRightOutlined />*/}
          {/*</div>}*/}
          <div>
              {editConfig.title}
            {/* <span className={css.tips}>{titleContent}</span> */}
            </div>
        </div>
        <div className={css.actions}>
          <div
            className={css.selector}
            data-mybricks-tip={finalSelector}        
            onClick={copy}
            >
            {finalSelector}
          </div>

          <div
            className={css.icon}
            data-mybricks-tip={'复制selector'}
            onClick={copy}
          >
            <CopyOutlined />
          </div>
          <div
            className={css.icon}
            data-mybricks-tip={'重置'}
            onClick={refresh}
          >
            <ReloadOutlined />
          </div>
          <div
            className={css.icon}
            data-mybricks-tip={'代码编辑'}
            onClick={onEditModeClick}
          >
            {editMode ? <CodeOutlined /> : <AppstoreOutlined />}
          </div>
        </div>
      </div>)}
      {/* 代码编辑的工具条 */}
      {!editMode && (<div
        onMouseEnter={onMouseEnter}
        onMouseLeave={onMouseLeave}
        className={css.titleContainer}
        //style={{ marginBottom: open ? 3 : 0 }}
      >
        <div className={css.title} style={{fontWeight: "normal"}} onClick={onOpenClick}>
          {finalDisabledSwitch ? null : <div
            className={`${css.icon}${open ? ` ${css.iconOpen}` : ''}`}
            data-mybricks-tip={open ? '收起' : '展开'}
          >
            <CaretRightOutlined />
          </div>}
          <div>
            {editConfig.title}
            {/* <span className={css.tips}>
              {titleContent}
            </span> */}
          </div>
        </div>
        <div className={css.actions_allawys_display}>
          <div
            className={css.selector}
            data-mybricks-tip={finalSelector}        
            onClick={copy}
            >
            {finalSelector}
          </div>
          <div
            className={css.icon}
            data-mybricks-tip={'复制selector'}
            onClick={copy}
          >
            <CopyOutlined />
          </div>
          <div
            className={css.icon}
            data-mybricks-tip={'重置'}
            onClick={refresh}
          >
            <ReloadOutlined/>
          </div>
          <div
            className={css.icon}
            data-mybricks-tip={`{content:'返回可视化编辑',position:'left'}`}
            onClick={onEditModeClick}
          >
            {/* {<AppstoreOutlined />} */}
            {goBackIcon}
          </div>
        </div>
      </div>)}
      </>
    )
  }, [open, editMode, titleContent, batchMeta, onBatchDiscard, onBatchCommit])

  const zoneSelectorList = useMemo(() => {
    const domList = Object.prototype.toString.call(targetDom) === '[object NodeList]'
      ? Array.from(targetDom as NodeList)
      : targetDom
        ? [targetDom as Element]
        : []
    const result: string[] = []

    const comId = (!editConfig.options || Array.isArray(editConfig.options))
      ? ''
      : (editConfig.options as any).comId ?? ''

    // 预先收集当前组件样式表中所有出现过的 class 名，用于过滤动态 class 噪音
    const classesInStyleSheet = new Set<string>()
    if (comId) {
      const root = getDocument()
      const styleEls = Array.from((root as any).querySelectorAll?.('style') || [])
      for (const styleEl of styleEls as HTMLStyleElement[]) {
        let rules: CSSRuleList | null = null
        try { rules = (styleEl as HTMLStyleElement).sheet?.cssRules ?? null } catch { continue }
        if (!rules) continue
        for (const rule of Array.from(rules)) {
          const selectorText = (rule as CSSStyleRule).selectorText
          if (!selectorText || !selectorText.includes(comId)) continue
          // 提取选择器中所有 .className 片段
          const matches = selectorText.match(/\.([a-zA-Z_][a-zA-Z0-9_-]*)/g)
          if (matches) matches.forEach(m => classesInStyleSheet.add(m.slice(1)))
        }
      }
    }

    for (const dom of domList as Element[]) {
      const raw = dom?.getAttribute?.('data-zone-selector')
      if (raw) {
        try {
          const parsed = JSON.parse(raw)
          if (Array.isArray(parsed)) {
            parsed.forEach((s: string) => {
              if (!result.includes(s)) result.push(s)
            })
          }
        } catch {}
      }

      // 从 data-loc.cn 取编译期已知的静态 class 列表
      const knownClasses: string[] = (() => {
        try { return JSON.parse(dom?.getAttribute?.('data-loc') ?? '{}')?.cn ?? [] } catch { return [] }
      })()
      // 运行时实际 class 与静态 class 的差集 = 动态 class（如 iconUser）
      // comId 为空时跳过，避免无样式表过滤依据时产生噪音
      // 再过滤：只保留在组件样式表中真实存在的 class，排除平台注入的噪音 class

      // CSS module 会将 class 名混淆为 "<模块路径>-<真实class名>" 的形式（如 pages_Foo_less-text-container-213），
      // 而 knownClasses（来自 data-loc.cn）只存储短名（如 text-container-213），两者格式不同无法精确匹配。
      // isMangledKnown 用"带答案找问题"的方式：直接检查 DOM class 是否以 "-已知短名" 结尾，
      // 且前缀部分含下划线（模块路径特征），是则认定为静态 class 的混淆版本，在 filter 阶段直接排除。
      const isMangledKnown = (c: string) =>
        knownClasses.some(kc => c.endsWith(`-${kc}`) && c.slice(0, c.length - kc.length - 1).includes('_'))

      const dynamicClasses = (comId
        ? Array.from((dom as Element)?.classList ?? []).filter(c =>
            !knownClasses.includes(c) &&  // 精确匹配（短名直接挂在 DOM 上时）
            !isMangledKnown(c) &&         // 混淆名反向匹配（CSS module 编译后的长名）
            classesInStyleSheet.has(c)
          )
        : [])

      
      // 有动态 class 时，与静态选择器组合成复合选择器（无空格，即同元素上多个 class）
      // 例：".statCard .statIcon" + "iconUser" → ".statCard .statIcon.iconUser"
      // 复合选择器插到 result 最前面，使 activeZoneIdx=0 时默认回显实际生效的样式
      if (dynamicClasses.length > 0 && raw) {
        try {
          const staticSelectors: string[] = JSON.parse(raw)
          const compoundSelectors: string[] = []
          for (const dc of dynamicClasses) {
            for (const sel of staticSelectors) {
              // 若静态选择器末段已包含该 class，则动态 class 与静态重复，跳过
              // 如动态 class "pageTitle" 已包含在 data-zone-selector 末段 ".pageTitle" 中，则重复，跳过
              const lastSegment = sel.trim().split(/\s+/).pop() ?? ''
              if (lastSegment.includes(`.${dc}`)) continue
              const compound = `${sel}.${dc}`
              if (!result.includes(compound) && !compoundSelectors.includes(compound)) {
                compoundSelectors.push(compound)
              }
            }
          }
          result.unshift(...compoundSelectors)
        } catch {}
      }
    }

    // 基础选择器排前面（第 0 位默认激活），伪类变体追加到末尾
    // 去重：pseudoSelectorList 里的条目不再重复加入
    for (const pseudo of pseudoSelectorList) {
      if (!result.includes(pseudo)) result.push(pseudo)
    }
    return result
  }, [targetDom, pseudoSelectorList])

  // 监听目标元素 class 属性变化，实时将 activeZoneIdx 对齐到当前实际匹配的 selector。
  // 同时承担 zoneSelectorList 变化时的初始对齐（替代原来的固定重置为 0）。
  useEffect(() => {
    const el = (
      Object.prototype.toString.call(targetDom) === '[object NodeList]'
        ? Array.from(targetDom as NodeList)[0]
        : targetDom
    ) as Element | null
    if (!el || zoneSelectorList.length === 0) {
      setActiveZoneIdx(0)
      return
    }

    /**
     * 判断一个 DOM class 是否对应选择器里的某个短名。
     * 支持三种形式：
     *   1. 精确匹配：cls === shortName
     *   2. CSS Modules "--" 分隔：pages_Foo--shortName
     *   3. CSS Modules "-" 分隔（含下划线前缀）：pages_Foo_less-shortName
     */
    function classMatchesShortName(cls: string, shortName: string): boolean {
      return cls === shortName ||
        cls.endsWith('--' + shortName) ||
        (cls.endsWith('-' + shortName) && cls.slice(0, cls.length - shortName.length - 1).includes('_'))
    }

    /**
     * 用"选择器末段短名"匹配元素的实际（可能哈希的）classList。
     * 只验证末段（空格分隔的最后一段），祖先部分由 zoneSelectorList 构建逻辑保证。
     */
    function elMatchesSelectorTail(element: Element, sel: string): boolean {
      const lastPart = sel.trim().split(/\s+/).pop() ?? ''
      const shortNames = (lastPart.match(/\.([a-zA-Z_][a-zA-Z0-9_-]*)/g) ?? []).map(c => c.slice(1))
      if (shortNames.length === 0) return false
      const elClasses = Array.from(element.classList)
      return shortNames.every(sn => elClasses.some(cls => classMatchesShortName(cls, sn)))
    }

    function syncActiveIdx() {
      const idx = zoneSelectorList.findIndex(sel => {
        const base = sel.replace(/:{1,2}[a-zA-Z\-]+(\([^)]*\))?/g, '').trim()
        return !!base && elMatchesSelectorTail(el as Element, base)
      })
      setActiveZoneIdx(idx >= 0 ? idx : 0)
    }

    syncActiveIdx()

    const observer = new MutationObserver(syncActiveIdx)
    observer.observe(el, { attributes: true, attributeFilter: ['class'] })
    return () => observer.disconnect()
  }, [targetDom, zoneSelectorList])

  // 计算当前激活 selector 在页面中命中的元素个数
  useEffect(() => {
    const root = getDocument()
    // 遍历所有带 data-zone-selector 的元素，比对其中记录的原始选择器列表。
    function countByZoneSelector(sel: string): number {
      const zoneEls = (root as any).querySelectorAll?.('[data-zone-selector]') ?? []
      return Array.from(zoneEls).filter((el: any) => {
        try {
          const sels: string[] = JSON.parse(el.getAttribute('data-zone-selector'))
          return Array.isArray(sels) && sels.includes(sel)
        } catch {
          return false
        }
      }).length
    }

    // 无打标场景（finalSelector fallback）：元素没有 data-zone-selector，直接用 CSS 选择器查找。
    // 先去掉伪类（::before / :hover 等），避免 querySelectorAll 报错。
    function countByCssSelector(sel: string): number {
      const base = sel.replace(/:{1,2}[a-zA-Z\-]+(\([^)]*\))?/g, '').trim()
      try {
        return (root as any).querySelectorAll?.(base)?.length ?? 0
      } catch {
        return 0
      }
    }

    const activeSelector = zoneSelectorList[activeZoneIdx]
    if (activeSelector) {
      setAffectedCount(countByZoneSelector(activeSelector))
      return
    }

    // zoneSelectorList 为空时降级：用编辑器配置中的 finalSelector 统计受影响元素数。
    // 连 finalSelector 也没有，则无法计算，置为 null（区别于 0）表示"未知"，提示条静默不展示。
    if (!finalSelector) {
      setAffectedCount(null)
      return
    }
    const fallbackSelectors = Array.isArray(finalSelector) ? finalSelector : [finalSelector]
    setAffectedCount(fallbackSelectors.reduce((sum, s) => sum + countByCssSelector(s), 0))
  }, [activeZoneIdx, zoneSelectorList, finalSelector])

  const editor = useMemo(() => {
    if (editMode) {
      const resolvedEditConfig = (() => {
        const originalOptions = editConfig.options
        if (zoneSelectorList.length < 1 || !originalOptions || Array.isArray(originalOptions)) {
          return editConfig
        }
        return {
          ...editConfig,
          options: { ...originalOptions, selector: zoneSelectorList[activeZoneIdx] }
        }
      })()
      const config = getDefaultConfiguration(resolvedEditConfig, suggestOptionsCacheRef.current)


      const { targetDom: _td, ...activeStyleProps } = config
      if (isResetRef.current) {
        isResetRef.current = false
        const allOptionKeys = (config.options || []).map((t: any) =>
          typeof t === 'string' ? t.toLowerCase() : t?.type?.toLowerCase()
        )
        activeStyleProps.collapsedOptions = allOptionKeys
      }
      return (
        <Style editConfig={resolvedEditConfig} onBatchMetaChange={refreshBatchMeta} {...activeStyleProps}/>
      )
    } else {
      return (
        <CssEditor {...editConfig} selector={':root'} onChange={(value: any) => {
          // console.log("value",value)
          editConfig.value.set(deepCopy(value))
        }}/>
      )
    }
  }, [editMode, key, activeZoneIdx, refreshBatchMeta])

  function onMouseEnter() {
    try {
      if (canvasEle && targetDom.length) {
        setTitleContent("(已标记)")
        const res: any = Array.from(targetDom).reduce((res: any, dom: any) => {
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
        }, {
          left: Infinity,
          top: Infinity,
          width: -Infinity,
          height: -Infinity
        })
        const width = res.width - res.left
        const height = res.height - res.top
        const cRect = canvasEle.getBoundingClientRect()
        setTargetStyle({
          canvas: {
            left: res.left - cRect.left,
            top: res.top - cRect.top,
            width,
            height
          },
          tips: {
            left: res.left - cRect.left,
            top: res.top - cRect.top + 8,
          }
        })
      } else {
        setTitleContent("(非dom节点)")
      }
    } catch {}
  }

  function onMouseLeave() {
    try {
      if (canvasEle && targetDom.length) {
        setTargetStyle(null)
      }
      setTitleContent("")
    } catch {}
  }

  const zoneTabBar = useMemo(() => {
    if (zoneSelectorList.length < 2) return null
    return (
      <div className={css.zoneTabBar}>
        {zoneSelectorList.map((sel, idx) => {
          const parts = sel.trim().split(/\s+/)
          const lastPart = parts[parts.length - 1]
          // 含伪类的选择器只显示伪类部分（如 ":hover"），基础态选择器保持原逻辑
          const pseudoMatch = lastPart.match(/(:{1,2}[a-zA-Z\-]+(?:\([^)]*\))?)$/)
          const rawLabel = lastPart.replace(/^\./, '')
          let label: string
          if (pseudoMatch) {
            label = pseudoMatch[1]
          } else {
            // 若复合类中含有 CSS Modules 哈希类名（形如 "pages_xxx--cyan"），
            // 只显示哈希类名中 '--' 之后的原始部分（如 "cyan"），避免超长显示
            const classes = rawLabel.split('.')
            const hashedClasses = classes.filter(cls => cls.includes('--'))
            label = hashedClasses.length > 0
              ? hashedClasses.map(cls => cls.slice(cls.lastIndexOf('--') + 2)).join('.')
              : rawLabel
          }
          return (
            <div
              key={sel}
              className={`${css.zoneTab}${idx === activeZoneIdx ? ` ${css.zoneTabActive}` : ''}`}
              onClick={() => {
                setActiveZoneIdx(idx)
                // editConfig.value.set({},{selector:sel})
                // ;(window as any).__mybricks_active_zone_selector = sel
              }}
            >
              {label}
            </div>
          )
        })}
      </div>
    )
  }, [zoneSelectorList, activeZoneIdx])

  return {
    render: (
      <>
        {batchMeta.enabled && (
          <div className={css.batchActionStickyWrap}>
            <div className={css.batchActionBar}>
              <div className={css.batchMetaInfo}>
                {batchMeta.dirtyCount} 处变更
              </div>
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
        {zoneSelectorList.length > 0 && zoneTabBar}
        {zoneSelectorList.length > 0 && affectedCount !== null && affectedCount > 1 && (
          <div className={css.affectedHint} style={{marginTop: zoneSelectorList.length > 1 ? '10px' : '0'}}>
            修改当前样式会影响 {affectedCount} 个区域
          </div>
        )}
        <div className={css.styleSection}>
          {title}
        <div key={`${key}_${activeZoneIdx}`} style={{display: open ? 'block' : 'none'}}>
          {show && editor}
        </div>
        </div>
        {canvasEle && targetStyle && createPortal(
          <>
            <div className={css.popupTips} style={targetStyle.canvas}></div>
            <Tooltip
              placement="topLeft"
              title={editConfig.title || "当前dom区域"}
              visible={true}
              overlayInnerStyle={{
                color: "#555",
                fontSize: 12,
                minWidth: 50,
                textAlign: 'center',
                boxShadow: "0px 1px 4px 2px rgba(39, 54, 78, 0.37)",
                borderRadius: 4
              }}
              color='#fff'
              transitionName=""
            >
              <div className={css.popupTips} style={targetStyle.tips}></div>
            </Tooltip>
          </>
          , canvasEle)}
      </>
    )
  }
}

interface StyleProps extends EditorProps {
  [key: string]: any;
}

function Style ({editConfig, options, setValue, collapsedOptions, readonlyExpandedOptions, autoCollapseWhenUnusedProperty, finnalExcludeOptions, defaultValue, onBatchMetaChange }: StyleProps) {
  // 追踪每次 handleChange 实际写入后的完整样式快照，
  // 替代 stale 的 setValue prop，作为渐变边框保护逻辑的数据源。
  const liveStyleRef = useRef<Record<string, any>>(
    initLiveStyle(deepCopy(setValue || {}), (defaultValue as any) || {})
  )

  // 当 setValue 被外部改写时，同步更新 liveStyleRef。
  useEffect(() => {
    liveStyleRef.current = initLiveStyle(deepCopy(setValue || {}), (defaultValue as any) || {})
  }, [setValue])

  const handleChange: ChangeEvent = useCallback((value) => {
    // 每次操作开始前清空上次可能残留的删除信号，防止普通组件的删除操作污染 AI 组件
    ;(window as any).__mybricks_style_deletions = null
    const deletedKeys: string[] = []
    const nextSetValue: Record<string, any> = deepCopy(liveStyleRef.current || {})
    const rawItems = Array.isArray(value) ? value : [value]
    const changeItems = preservePaintRoles(
      rawItems,
      nextSetValue
    );

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
        const shouldDelete = hasUserSetValue || hasEffectedStyle

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

    // 没有任何实际变更时直接返回，不触发样式写入（避免展开面板后折叠产生多余版本）
    if (!hasRealChange) return

    // 删除信号通过 window 侧通道传递给 valueProxy.set，
    // 不污染 editConfig.value（代码编辑器不会看到 null 值）
    if (deletedKeys.length > 0) {
      (window as any).__mybricks_style_deletions = deletedKeys
    }

    const mergedCssProperties = mergeCSSProperties(deepCopy(nextSetValue))

    // 写入成功后更新 liveStyleRef，供下次 handleChange 的保护逻辑使用
    liveStyleRef.current = nextSetValue

    // options?.selector 优先；兜底从 editConfig.options.selector 读取当前激活的 selector
    const selector = options?.selector
      ?? ((!Array.isArray(editConfig.options) && editConfig.options)
          ? (editConfig.options as any).selector
          : undefined)

    const setOptions = selector ? { selector } : undefined
    const batchMeta = editConfig.value.getBatchMeta?.()
    const bridgeMeta = (window as any).__mybricks_style_batch_bridge?.getMeta?.()
    const targetDom = (!Array.isArray(editConfig.options) && editConfig.options)
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
      return
    }

    editConfig.value.set(mergedCssProperties, setOptions)
    onBatchMetaChange?.()
  }, [editConfig, options, collapsedOptions, onBatchMetaChange])

  const editorContext = useMemo(() => {
    const dom = (!editConfig.options || Array.isArray(editConfig.options))
      ? null
      : (editConfig.options as any).targetDom ?? null
    const realDom = (
      Object.prototype.toString.call(dom) === '[object NodeList]' && dom?.length
        ? dom[0]
        : dom
    ) as HTMLElement | null
    const CDN = (editConfig as any).getDefaultOptions?.('stylenew')?.CDN
    return {
      editConfig: {
        ...editConfig,
        CDN,
      },
      autoCollapseWhenUnusedProperty,
      targetDom: realDom,
    }
  }, [editConfig, autoCollapseWhenUnusedProperty])

  return (
    <StyleEditorProvider value={editorContext}>
      <StyleEditor
        defaultValue={defaultValue}
        options={options}
        finnalExcludeOptions={finnalExcludeOptions}
        collapsedOptions={collapsedOptions}
        readonlyExpandedOptions={readonlyExpandedOptions}
        onChange={handleChange}
      />
    </StyleEditorProvider>
  )
}

// code
const CSS_EDITOR_TITLE = 'CSS样式编辑'

function getDefaultValue({value, selector}: any) {
  const styleValue = deepCopy(value.get() || {})

  return parseToCssCode(styleValue, selector)
}

export interface StyleData {
  styleKey: string;
  value: string | number | boolean;
}

/**
 * 将驼峰写法改成xx-xx的css命名写法
 * @param styleKey
 */
export function toLine(styleKey: string) {
  return styleKey.replace(/([A-Z])/g, '-$1').toLowerCase();
}

export function toHump(name: String) {
  return name.replace(/\-(\w)/g, (all, letter) => {
    return letter.toUpperCase();
  });
}

function parseToCssCode(styleData: StyleData, selector: string) {
  const parseStyleData: any = {};
  for (const styleKey in styleData) {
    // @ts-ignore
    parseStyleData[toLine(styleKey)] = styleData[styleKey];
  }

  const cssJson = {
    children: {
      [selector || 'div']: {
        children: {},
        attributes: parseStyleData,
      },
    },
  };

  return toCSS(cssJson);
}

export function parseToStyleData(cssCode: string, selector: string) {
  const styleData = {};
  try {
    const cssJson = toJSON(cssCode.trim().endsWith('}') ? cssCode : (cssCode + '}'));// 包bug
    const cssJsonData = cssJson?.children?.[selector || 'div']?.attributes;
    for (const key in cssJsonData) {
      // @ts-ignore
      styleData[toHump(key)] = cssJsonData[key];
    }
  } catch (e: any) {
    console.error(e.message);
  }

  return styleData;
}

function CssEditor ({popView, options, value, selector, onChange: onPropsChange, getDefaultOptions}: any) {
  const [cssValue, setCssValue] = useState(getDefaultValue({value, selector}))
  const editorRef = useRef<MonacoEditor>(null)
  const defaultOptions = useMemo(() => getDefaultOptions?.('stylenew') ?? {}, []);
  const [context] = useState({value: cssValue})

  const onMounted = useCallback((editor: any) => {
    editorRef.current = editor
  }, [])

  const onChange = useCallback((value: any) => {
    setCssValue(value);

    context.value = value
  }, [])

  const onBlur = useCallback(() => {
    const newStyleData = parseToStyleData(context.value, selector);
    onPropsChange(newStyleData)
  }, [])

  const onFullscreen = useCallback(() => {
    popView(
      CSS_EDITOR_TITLE,
      () => {
        return <div className={css.modal}>{monaco}</div>;
      },
      { 
        onClose: () => {
          // const val = editorRef.current?.getValue();
        }
      }
    )
  }, [cssValue])

  const monaco = useMemo(() => {
    return (
      <MonacoEditor
        height='100%'
        onMounted={onMounted}
        value={cssValue}
        onChange={onChange}
        CDN={defaultOptions.CDN}
        onBlur={onBlur}
        language='css'
      />
    )
  }, [cssValue])

  return (
    <div className={css.codeWrap}>
      <div className={css.inlineWrap}>
        {/* <div className={css.header}>
          <span className={css.title}>{'CSS样式编辑'}</span>
          <div data-mybricks-tip='放大编辑' className={css.plus} onClick={onFullscreen}>
            <FullscreenOutlined />
          </div>
        </div> */}
        <div className={css.body}>
          <div data-mybricks-tip='放大' className={css.plus} onClick={onFullscreen}>
            {fullScreenIcon}
          </div>
          {monaco}
        </div>
      </div>
    </div>
  )
}

function getDefaultConfiguration2 ({value, options}: GetDefaultConfigurationProps) {
  let finalOpen = false
  let finalDisabledSwitch = false
  let finalSelector

  if (!options) {

  } else if (Array.isArray(options)) {

  } else {
    const { plugins, selector, targetDom, defaultOpen = false, disabledSwitch = false } = options
    finalSelector = selector
    finalOpen = defaultOpen
    if (disabledSwitch) {
      // 禁用开关，默认打开
      finalOpen = true
    }
    finalDisabledSwitch = disabledSwitch
  }

  return {
    finalOpen,
    finalSelector,
    finalDisabledSwitch
  } as {
    finalOpen: boolean,
    finalSelector: string,
    finalDisabledSwitch: boolean,
  }
}

/** 旧 boxshadow / blur 与 effects 统一别名 */
const EFFECTS_ALIASES = new Set(['effects', 'boxshadow', 'blur'])

function mapPanelAliasToEffects(panel: string): string {
  return EFFECTS_ALIASES.has(panel) && panel !== 'effects' ? 'effects' : panel
}

function mapEffectedPanels(panels: string[] | null | undefined): string[] {
  return Array.from(new Set((panels ?? []).map(mapPanelAliasToEffects)))
}

/** 将旧的 boxshadow / blur 插件配置归一为 effects，避免双面板 */
function normalizeEffectOptions (options: any): any {
  if (!Array.isArray(options)) return options
  let hasEffects = false
  const result: any[] = []
  for (const option of options) {
    const type = (typeof option === 'string' ? option : option?.type)?.toLowerCase?.()
    if (type && EFFECTS_ALIASES.has(type)) {
      if (!hasEffects) {
        hasEffects = true
        result.push(typeof option === 'string' ? 'effects' : { ...option, type: 'effects' })
      }
      continue
    }
    result.push(option)
  }
  return result
}

/**
 * 获取默认的配置项和样式
 */
function getDefaultConfiguration ({value, options}: GetDefaultConfigurationProps, suggestOptionsCache?: SuggestOptionsCache) {
  let finalOpen = false
  let finalOptions
  /** 自动收起没有生效的 CSS 插件 */
  let autoCollapseWhenUnusedProperty = true;
  let defaultValue: CSSProperties = {}
  let finalSelector
  const setValue = deepCopy(value.get() || {})

  let getDefaultValue = true
  let dom;
  let effctedOptions: string[] | null = null;
  let effectedFromRulesOnly: string[] = [];
  let effectedFromAncestorsOnly: string[] = [];
  let finnalExcludeOptions: string[] | null = null;

  if (!options) {
    // 没有options，普通编辑器配置使用，直接使用默认的配置，展示全部
    finalOptions = DEFAULT_OPTIONS
  } else if (Array.isArray(options)) {
    // options是一个数组，直接使用
    finalOptions = options
  } else {
    const { plugins, selector, targetDom, defaultOpen = false, autoOptions = false, exclude, comId } = options
    dom = targetDom
    finalSelector = selector
    finalOpen = defaultOpen
    // 这里还要再处理一下 
    finalOptions = plugins || DEFAULT_OPTIONS

    // 黑名单
    if (exclude) {
      finnalExcludeOptions = exclude
    }

    let realTargetDom: HTMLElement | undefined

    if (Object.prototype.toString.call(targetDom) === '[object NodeList]' && targetDom?.length) {
      realTargetDom = targetDom[0]
    } else if (Object.prototype.toString.call(targetDom).indexOf('HTML') > -1) {
      realTargetDom = targetDom as any
    }

    /** 用户是否配置options */
    const userNoConfig = finalOptions === DEFAULT_OPTIONS
    
    // 未配置options，开启自动折叠
    if (userNoConfig || autoOptions) {
      autoCollapseWhenUnusedProperty = true
    }
    // 未配置options，自动disabled不可用的配置
    if ((userNoConfig || autoOptions) && !!realTargetDom) {
      finalOptions = getSuggestOptionsWithCache(realTargetDom, suggestOptionsCache) ?? finalOptions
    }


    
    // 将引擎传入的 [data-zone-selector='[...]'] 格式解析为 CSS 选择器数组
    const rawSelector = Array.isArray(selector) ? selector[0] : selector;
    const zoneArrayMatch = rawSelector?.match(/\[data-zone-selector=['"]?(\[[^\]]*\])['"]?\]/);

    // realSelectors：完整数组，用于多类名场景（如 [".actionBtn", ".primary"]）覆盖所有规则
    // realSelector：最后一个，用于伪类判断等需要单值的场景
    let realSelectors: string[] = rawSelector ? [rawSelector] : [];
    let realSelector: string | undefined = rawSelector;

    if (zoneArrayMatch) {
      try {
        const selectors: string[] = JSON.parse(zoneArrayMatch[1]);
        realSelectors = selectors;
        realSelector = selectors[selectors.length - 1];
      } catch {}
    }

    const isPseudoSelector = typeof realSelector === 'string' && /:(:)?[a-zA-Z0-9\-\_]+/.test(realSelector);
    const realDom = !!realTargetDom ? realTargetDom : null;
    if (realDom || isPseudoSelector) {
      getDefaultValue = false;
      const [styleValues, options, ownRulesPanels, ancestorPanels] = getEffectedCssPropertyAndOptions(realDom, realSelectors.length > 1 ? realSelectors : (realSelector ?? ''), comId);

      effctedOptions = options == null ? options : mapEffectedPanels(options as string[]);
      effectedFromRulesOnly = mapEffectedPanels(ownRulesPanels as string[]);
      effectedFromAncestorsOnly = mapEffectedPanels(ancestorPanels as string[]);
      finalOptions = normalizeEffectOptions(finalOptions)
      finalOptions.forEach((option) => {
        let type, config;
        if (typeof option === 'string') {
          type = option.toLowerCase();
          config = {};
        } else {
          type = option.type.toLowerCase();
          config = option.config || {};
        }
        // @ts-ignore
        if (DEFAULT_OPTIONS.includes(type)) {
          // @ts-ignore TODO: 类型补全
          Object.assign(defaultValue, getDefaultValueFunctionMap[type](styleValues, config));
        }
      });
    }
  }

  finalOptions = normalizeEffectOptions(finalOptions)

  if (getDefaultValue) {
    finalOptions.forEach((option) => {
      let type, config

      if (typeof option === 'string') {
        type = option.toLowerCase()
        config = {}
      } else {
        type = option.type.toLowerCase()
        config = option.config || {}
      }

      // @ts-ignore
      if (DEFAULT_OPTIONS.includes(type)) {
        // @ts-ignore TODO: 类型补全
        Object.assign(defaultValue, getDefaultValueFunctionMap2[type]())
      }
    })
  }

  const splitedSetValue = splitCSSProperties(setValue)

  const setValueEffectedPanels = new Set<string>();
  const setValueBag = splitedSetValue as Record<string, any>
  Object.keys(splitedSetValue).forEach(property => {
    const mapped = PANEL_MAP[property]
    if (isMeaninglessStylePropForPanel(property, setValueBag[property], mapped, setValueBag)) {
      return
    }
    const panel = refineEffectedPanel(property, mapped, setValueBag)
    if (panel) {
      if (panel === 'border' && !isBorderPanelMeaningfullyUsed(setValueBag)) {
        return
      }
      setValueEffectedPanels.add(panel)
    }
  })

  let collapsedOptions: any = [];
  if (effctedOptions) {
    collapsedOptions = finalOptions.map(t => {
      return typeof t === 'string' ? t.toLowerCase() : t?.type.toLowerCase()
    }).filter(t => !effctedOptions.includes(t) && !setValueEffectedPanels.has(t) && !effectedFromAncestorsOnly.includes(t))
  }

  const ownEffectedSet = new Set([...effectedFromRulesOnly, ...Array.from(setValueEffectedPanels)]);
  
  let readonlyExpandedOptions = Array.from(new Set(effectedFromAncestorsOnly.filter(p => !ownEffectedSet.has(p))));

  // 检测被折叠的面板中是否有 UA/computedStyle 默认值（即 defaultValue 里的属性值与空白默认值不同）。
  // 若直接折叠，用户展开后会看到有值却显示 - 号（可误删），因此将它们移入 readonlyExpandedOptions，
  // 渲染为 collapse='inherited'，展开且无 - 号，与父级继承样式的处理方式保持一致。
  if (collapsedOptions.length > 0) {
    const uaFilledPanels: string[] = [];
    collapsedOptions = collapsedOptions.filter((panelKey: string) => {
      // @ts-ignore
      const emptyValues: Record<string, any> = getDefaultValueFunctionMap2[panelKey]?.() ?? {};
      const diffProps: Array<{prop: string, empty: any, current: any}> = [];
      const hasUAValue = Object.keys(emptyValues).some(prop => {
        const styleBag = defaultValue as Record<string, any>
        // 文字渐变占用的 backgroundImage/clip 等不应让边框/背景面板被当成「有值」而展开
        if (isPaintStackPropOwnedByTextFill(prop, styleBag)) {
          return false
        }
        // 普通背景渐变写在 backgroundImage 上：边框面板空白基准也含该字段，需排除
        if (
          panelKey === 'border' &&
          isPaintStackPropIrrelevantToBorder(prop, styleBag)
        ) {
          return false
        }
        const emptyVal = emptyValues[prop];
        // @ts-ignore
        const currentVal = defaultValue[prop];
        // CSS "无值"关键字，与空字符串视为等价，避免 UA 默认值（如 boxShadow:'none'）被误判为有效值
        const CSS_NONE_KEYWORDS = CSS_TRIVIAL_VALUES
        const normalize = (v: any) => {
          if (v === '' || CSS_NONE_KEYWORDS.has(v)) return null
          // rgba(0,0,0,0) 是 transparent 的 computedStyle 等价形式，统一视为无语义值
          if (v === 'rgba(0, 0, 0, 0)') return null
          return v
        }
        // 空白基准为 '' 的属性（如 borderTopColor）：
        // 其 computedStyle 初始值依赖 currentColor（随 color 属性变化），
        // 无法与"无配置"状态区分，直接跳过，避免误判为有 UA 值。
        // 注：backgroundColor 不属于此类（不继承，初始值固定为 transparent），
        // 已改为 'rgba(0,0,0,0)' 作为空白基准，可正常参与 diff。
        if (emptyVal === '') return false
        // 当前值存在且与空白默认值不同，说明有 UA 或 computed 值填充
        const isDiff = currentVal !== undefined && normalize(currentVal) !== normalize(emptyVal);
        if (isDiff) diffProps.push({ prop, empty: emptyVal, current: currentVal });
        return isDiff;
      });
      if (hasUAValue) {
        uaFilledPanels.push(panelKey);
        return false;
      }
      return true;
    });
    // 将有 UA 值的面板加入 readonlyExpandedOptions（去重，且不能与 ownEffectedSet 重叠）
    const newReadonly = uaFilledPanels.filter(p => !ownEffectedSet.has(p) && !readonlyExpandedOptions.includes(p));
    readonlyExpandedOptions = [...readonlyExpandedOptions, ...newReadonly];
  }

  return {
    options: finalOptions,
    collapsedOptions,
    readonlyExpandedOptions,
    autoCollapseWhenUnusedProperty,
    defaultValue: getDefaultValue
      ? Object.assign(defaultValue, splitedSetValue)
      : Object.assign({}, splitedSetValue, defaultValue),
    setValue: Object.assign({}, splitedSetValue),
    finalOpen,
    finalSelector,
    finnalExcludeOptions,
    targetDom: dom,
  } as {
    options: Options,
    collapsedOptions: string[]
    readonlyExpandedOptions: string[]
    autoCollapseWhenUnusedProperty: boolean,
    defaultValue: CSSProperties,
    setValue: CSSProperties & Record<string, any>,
    finalOpen: boolean,
    finalSelector: string,
    finnalExcludeOptions: any,
    targetDom: any,
  }
}

const getDefaultValueFunctionMap = {
  font(values: CSSProperties, config: any) {
    return {
      color: values.color,
      fontSize: values.fontSize,
      textAlign: values.textAlign,
      fontWeight: values.fontWeight,
      fontFamily: values.fontFamily,
      lineHeight: values.lineHeight,
      letterSpacing: values.letterSpacing,
      whiteSpace: values.whiteSpace,
      textOverflow: (values as any).textOverflow,
      webkitLineClamp: (values as any).webkitLineClamp,
      textDecoration: (values as any).textDecoration,
      fontStyle: (values as any).fontStyle,
      textTransform: (values as any).textTransform,
      // 文字渐变回显（与 background / border 共用栈，Font 侧需要读到）
      backgroundImage: values.backgroundImage,
      backgroundClip: values.backgroundClip,
      backgroundOrigin: (values as any).backgroundOrigin,
      WebkitBackgroundClip: (values as any).WebkitBackgroundClip ?? (values as any).webkitBackgroundClip,
      WebkitTextFillColor: (values as any).WebkitTextFillColor ?? (values as any).webkitTextFillColor,
      backgroundColor: values.backgroundColor,
    }
  },
  border(values: CSSProperties, config: any) {
    return {
      borderTopColor: values.borderTopColor,
      borderBottomColor: values.borderBottomColor,
      borderRightColor: values.borderRightColor,
      borderLeftColor: values.borderLeftColor,
      borderTopLeftRadius: values.borderTopLeftRadius,
      borderTopRightRadius: values.borderTopRightRadius,
      borderBottomRightRadius: values.borderBottomRightRadius,
      borderBottomLeftRadius: values.borderBottomLeftRadius,
      borderTopStyle: values.borderTopStyle,
      borderBottomStyle: values.borderBottomStyle,
      borderRightStyle: values.borderRightStyle,
      borderLeftStyle: values.borderLeftStyle,
      borderTopWidth: values.borderTopWidth,
      borderBottomWidth: values.borderBottomWidth,
      borderLeftWidth: values.borderLeftWidth,
      borderRightWidth: values.borderRightWidth,
      backgroundColor: values.backgroundColor,
      backgroundImage: values.backgroundImage,
      backgroundOrigin: values.backgroundOrigin,
      backgroundClip: values.backgroundClip
    }
  },
  background(values: CSSProperties, config: any) {
    return {
      backgroundColor: values.backgroundColor,
      backgroundImage: values.backgroundImage,
      backgroundRepeat: values.backgroundRepeat,
      backgroundPosition: values.backgroundPosition,
      backgroundSize: values.backgroundSize
    }
  },
  padding(values: CSSProperties, config: any) {
    return {
      paddingTop: values.paddingTop,
      paddingRight: values.paddingRight,
      paddingBottom: values.paddingBottom,
      paddingLeft: values.paddingLeft
    }
  },
  margin(values: CSSProperties, config: any) {
    return {
      marginTop: values.marginTop,
      marginRight: values.marginRight,
      marginBottom: values.marginBottom,
      marginLeft: values.marginLeft
    }
  },
  size(values: CSSProperties, config: any) {
    return {
      width: values.width,
      height: values.height,
      maxWidth: values.maxWidth,
      maxHeight: values.maxHeight,
      minWidth: values.minWidth,
      minHeight: values.minHeight
    }
  },
  cursor(values: CSSProperties, config: any) {
    return {
      cursor: values.cursor
    }
  },
  effects(values: CSSProperties, config: any) {
    return {
      boxShadow: values.boxShadow,
      filter: values.filter,
      backdropFilter: (values as any).backdropFilter,
      WebkitBackdropFilter: (values as any).WebkitBackdropFilter ?? (values as any).webkitBackdropFilter,
    }
  },
  // 旧配置兼容：boxshadow / blur → effects
  boxshadow(values: CSSProperties, config: any) {
    return getDefaultValueFunctionMap.effects(values, config)
  },
  blur(values: CSSProperties, config: any) {
    return getDefaultValueFunctionMap.effects(values, config)
  },
  overflow(values: CSSProperties, config: any) {
    return {
      overflowX: values.overflowX,
      overflowY: values.overflowY
    }
  },
  opacity(values: CSSProperties, config: any) {
    return {
      opacity: values.opacity
    }
  },
  appearance(values: CSSProperties, config: any) {
    return {
      opacity: values.opacity,
      borderTopLeftRadius: values.borderTopLeftRadius,
      borderTopRightRadius: values.borderTopRightRadius,
      borderBottomRightRadius: values.borderBottomRightRadius,
      borderBottomLeftRadius: values.borderBottomLeftRadius,
    }
  },
  zindex(values: CSSProperties, config: any) {
    return {
      zIndex: values.zIndex
    }
  },
  rotation(values: CSSProperties, config: any) {
    return {
      transform: values.transform
    }
  },
  layout(values: CSSProperties, config: any) {
    return {
      display: values.display,
      flexDirection: values.flexDirection,
      alignItems: values.alignItems,
      justifyContent: values.justifyContent,
      flexWrap: values.flexWrap,
      rowGap: values.rowGap,
      columnGap: values.columnGap,
      position: values.position,
      overflow: values.overflow,
      paddingTop: values.paddingTop,
      paddingRight: values.paddingRight,
      paddingBottom: values.paddingBottom,
      paddingLeft: values.paddingLeft,
    }
  },
  csspaste(values: CSSProperties, config: any) {
    return {}
  }
}

const getDefaultValueFunctionMap2 = {
  font() {
    return {
      color: 'transparent',
      fontSize: '14px',
      textAlign: 'start',
      fontWeight: '400',
      fontFamily: '默认',
      lineHeight: 'inherit',
      letterSpacing: 0,
      whiteSpace: 'normal',
      textOverflow: 'clip',
      webkitLineClamp: 'none',
      textDecoration: 'none',
      fontStyle: 'normal',
      textTransform: 'none',
      // 用于 PANEL_MAP：文字填充相关属性归属 font（后注册的 border/background 会覆盖同名 key）
      WebkitTextFillColor: '',
    }
  },
  border() {
    return {
      borderTopColor: '',
      borderBottomColor: '',
      borderRightColor: '',
      borderLeftColor: '',
      borderTopLeftRadius: '0px',
      borderTopRightRadius: '0px',
      borderBottomRightRadius: '0px',
      borderBottomLeftRadius: '0px',
      borderTopStyle: 'none',
      borderBottomStyle: 'none',
      borderRightStyle: 'none',
      borderLeftStyle: 'none',
      borderTopWidth: '0px',
      borderBottomWidth: '0px',
      borderLeftWidth: '0px',
      borderRightWidth: '0px',
      backgroundImage: 'none',
      backgroundOrigin: '',
      backgroundClip: ''
    }
  },
  background() {
    return {
      // backgroundColor 不继承，初始值固定为 transparent（rgba(0,0,0,0)），
      // 与 borderTopColor 不同，可安全地与计算值做 diff 来检测 UA 填充（如 button 的 buttonface）。
      backgroundColor: 'rgba(0, 0, 0, 0)',
      backgroundImage: 'none',
      backgroundRepeat: 'repeat',
      backgroundPosition: 'left top',
      backgroundSize: 'auto'
    }
  },
  padding() {
    return {
      paddingTop: '0px',
      paddingRight: '0px',
      paddingBottom: '0px',
      paddingLeft: '0px'
    }
  },
  margin() {
    return {
      marginTop: '0px',
      marginRight: '0px',
      marginBottom: '0px',
      marginLeft: '0px'
    }
  },
  size() {
    return {
      width: 'auto',
      height: 'auto',
      maxWidth: 'auto',
      maxHeight: 'auto',
      minWidth: 'auto',
      minHeight: 'auto',
      // flex/flexGrow/flexBasis 本身不是 Size 面板展示的字段，
      // 但 Size 插件在改宽高时会尝试清空它们（避免 flex-basis 覆盖 width/height），
      // 这里注册空白基准值只是为了让它们进入 PANEL_MAP，归属到 size 面板，
      // 使 handleChange 的删除守卫能正确识别并放行这几个属性的清除请求。
      flex: 'auto',
      flexGrow: '0',
      flexBasis: 'auto',
    }
  },
  cursor() {
    return {
      cursor: 'inherit'
    }
  },
  effects() {
    return {
      boxShadow: 'none',
      filter: 'none',
      backdropFilter: 'none',
      WebkitBackdropFilter: 'none',
    }
  },
  // 旧配置兼容占位：不注册 CSS 属性到 PANEL_MAP，避免覆盖 effects
  boxshadow() {
    return {}
  },
  blur() {
    return {}
  },
  overflow() {
    return {
      overflowX: 'visible',
      overflowY: 'visible'
    }
  },
  opacity() {
    return {
      opacity: 1
    }
  },
  appearance() {
    return {
      opacity: 1,
      borderTopLeftRadius: '0px',
      borderTopRightRadius: '0px',
      borderBottomRightRadius: '0px',
      borderBottomLeftRadius: '0px',
    }
  },
  zindex() {
    return {
      zIndex: ''
    }
  },
  rotation() {
    return {
      transform: 'none'
    }
  },
  layout() {
    return {
      display: 'flex',
      flexDirection: 'row',
      alignItems: 'flex-start',
      justifyContent: 'flex-start',
      flexWrap: 'nowrap',
      rowGap: '0px',
      columnGap: '0px',
      position: 'static',
      overflow: 'visible',
      paddingTop: '0px',
      paddingRight: '0px',
      paddingBottom: '0px',
      paddingLeft: '0px',
    }
  },
  csspaste() {
    return {}
  }
}

/**
 * 在 comId 组件根节点内，找到一个当前持有目标 rawClass（或其 CSS Modules 哈希变体）的元素。
 * 搜索范围严格限定在 #comId 以内，不做祖先链遍历，不跨组件实例，不做全局搜索。
 */
function findElementInState(
  anchor: HTMLElement,
  rawClass: string,
  comId?: string,
): HTMLElement | null {
  if (!comId) return null
  const comRoot = getDocument().querySelector('#' + comId)
  if (!comRoot) return null
  const allEls = Array.from(comRoot.querySelectorAll('[class]')) as HTMLElement[]
  // 复合选择器（如 "bubble.aiBubble"）：拆分为独立 class，元素需同时持有所有 class
  if (rawClass.includes('.')) {
    const parts = rawClass.split('.').filter(Boolean)
    return allEls.find(el =>
      el !== anchor &&
      parts.every(part =>
        Array.from(el.classList).some(c => c === part || c.endsWith('-' + part))
      )
    ) ?? null
  }
  return allEls.find(el =>
    el !== anchor && Array.from(el.classList).some(c => c === rawClass || c.endsWith('-' + rawClass))
  ) ?? null
}

/** 获取当前 CSS 规则下生效的样式及面板配置 */
function getEffectedCssPropertyAndOptions (element: HTMLElement | null, selector: string | string[], comId?: string) {
  // 多类名时传数组，对每个 selector 分别查规则后去重合并；单个 selector 行为不变
  const selectorArray = Array.isArray(selector) ? selector : [selector];
  const primarySelector = selectorArray[selectorArray.length - 1] ?? '';
  const _selectorStr = Array.isArray(selector) ? selector.join(',') : (selector ?? '');
  try {
    let finalRules: CSSStyleRule[];
    let computedValues;
    // 汇总所有来自父级继承来源的规则，传给 getValues 做 inheritOnly 过滤
    const allInheritOnlyRules = new Set<CSSStyleRule>()

    if (element) {
      const classListValue = element.classList.value;

      // 最终用于 getComputedStyle 的元素；默认与聚焦元素相同，
      // 若目标 selector 是"状态类"（当前元素不处于该状态），会替换为 DOM 中真正处于该状态的元素
      let computedElement: HTMLElement = element

      // 按 selectorText 去重，避免多次查询返回重复规则
      const rulesMap = new Map<string, any>();
      for (const sel of selectorArray) {
        // 判断当前元素是否真正持有 sel 对应的 class（兼容 CSS Modules hash 后缀）
        // 例：sel=".pageBtnActive"，rawClass="pageBtnActive"，
        // 元素实际 class 为 "pages_xxx-pageBtnActive" → endsWith 命中 → elementHasClass=true
        const rawClass = (sel.trim().split(/\s+/).pop() ?? sel)
          .replace(/^\./, '')
          .replace(/:{1,2}[a-zA-Z\-]+(?:\([^)]*\))?$/, '')
        // 复合选择器（如 ".bubble.aiBubble" → rawClass="bubble.aiBubble"）：
        // 拆分为独立 class，元素需同时持有所有 class（支持 CSS Modules hash 前缀）
        const elementHasClass = !rawClass
          ? classListValue.indexOf(sel) !== -1
          : rawClass.includes('.')
            ? rawClass.split('.').filter(Boolean).every(part =>
                Array.from(element.classList).some(c => c === part || c.endsWith('-' + part))
              )
            : Array.from(element.classList).some(c => c === rawClass || c.endsWith('-' + rawClass))

        let queryEl: HTMLElement = element
        if (!elementHasClass && rawClass && sel.startsWith('.')) {
          // 当前元素不在目标状态（如聚焦的是 pageBtn，编辑的是 pageBtnActive）
          // 在 #comId 组件根节点内查找处于该状态的元素，不跨组件实例，不做全局搜索
          const found = findElementInState(element, rawClass, comId)
          if (found) {
            queryEl = found
            computedElement = found
          }
        }

        const { rules, inheritOnlyRules } = getStyleRules(queryEl, sel);

        rules.forEach((rule: any) => {
          if (!rulesMap.has(rule.selectorText)) {
            rulesMap.set(rule.selectorText, rule);
          }
        });
        inheritOnlyRules.forEach(r => allInheritOnlyRules.add(r))
      }

      finalRules = Array.from(rulesMap.values()).filter((finalRule: any) => {
        let tempCompare
        try {
          tempCompare = calculate(finalRule.selectorText)
        } catch {}

        if (tempCompare) {
          finalRule.tempCompare = tempCompare
          return true
        }

        return false
      }).sort((a, b) => {
        // @ts-ignore
        return compare(a.tempCompare, b.tempCompare)
      })

      const isPseudoElement = primarySelector.includes('::') || primarySelector.includes(':before') || primarySelector.includes(':after')
      if (isPseudoElement) {
        const pseudoSelector = primarySelector.split(':')[1]
        computedValues = window.getComputedStyle(computedElement, pseudoSelector)
      } else {
        computedValues = window.getComputedStyle(computedElement)
      }
    } else if (primarySelector) {

      // 无真实 DOM（伪类如 :hover、:disabled 等，或 span 等无 class 的子标签）
      const { rules: rawRules, inheritOnlyRules } = getStyleRules(null, primarySelector)
      inheritOnlyRules.forEach(r => allInheritOnlyRules.add(r))
      finalRules = rawRules.filter((finalRule: any) => {
        let tempCompare
        try {
          tempCompare = calculate(finalRule.selectorText)
        } catch {}

        if (tempCompare) {
          finalRule.tempCompare = tempCompare
          return true
        }

        return false
      }).sort((a, b) => {
        // @ts-ignore
        return compare(a.tempCompare, b.tempCompare)
      })

      // 获取基础选择器对应的元素，严格限定在 #comId 组件根节点内，不做全局搜索
      const root = getDocument()
      // 去掉末尾伪类/伪元素部分，得到真实 DOM 的选择器
      const baseSelector = primarySelector.replace(/:{1,2}[a-zA-Z\-]+(\([^)]*\))?$/, '').trim()
      const targetElement = comId ? root.querySelector(`#${comId} ${baseSelector}`) : null
      
      if (targetElement) {
        // 检查是否是伪元素（如::before、::after、::placeholder）
        const pseudoMatch = primarySelector.match(/(::[a-zA-Z0-9\-]+)/);
        const pseudoSelector = pseudoMatch ? pseudoMatch[0] : null;
        if (pseudoSelector) {
          computedValues = window.getComputedStyle(targetElement, pseudoSelector);
        } else {
          // 属于伪类（如:hover、:disabled等），则获取普通元素的computedStyle作为基础样式
          computedValues = window.getComputedStyle(targetElement);
        }
      } else {
        // 如果找不到对应元素，创建一个空的，防止报错
        computedValues = window.getComputedStyle(document.createElement('div'))
      }
    } else {
      return [{}, []]
    }

    const effectedFromRules = getEffectedPanelsFromCssRules(finalRules);

    const values = getValues(finalRules, computedValues, allInheritOnlyRules);


    // ── 高优先级竞争规则覆盖校正 ──────────────────────────────────────────────
    // 默认态下，CSS 规则里的颜色值可能被更高特指度规则（如 .tableHeadRow th { color: #555 }，
    // 特指度 0,1,1）覆盖，而目标选择器（如 .colTag，特指度 0,1,0）的规则值无法生效。
    // getStyleRules 只返回匹配目标选择器的规则，不含竞争规则，导致回显与实际不符。
    //
    // 修复：扫描 document.styleSheets 中所有匹配当前 element 的规则，按 CSS 级联规则
    // （!important 优先，再比特指度，最后按源码顺序）找出真正胜出的值覆盖回显。
    // element.matches() 天然过滤伪类规则（:hover/:disabled 等非激活态不会匹配），
    // 因此无需担心点击选中时 hover 状态的干扰。
    // 仅在默认态（primarySelector 无伪类后缀）且有真实 DOM 时执行。
    const _hasPseudo = /:{1,2}[a-zA-Z\-]+(?:\([^)]*\))?$/.test(primarySelector)
    if (element && !_hasPseudo) {
      const _isVarRef = (v: any) => typeof v === 'string' && v.startsWith('var(')
      // ── 公共级联扫描：找到所有匹配 element 的规则中，按 CSS 级联（!important → 特指度 → 源码顺序）
      // 取最终胜出的属性值。注意：点击元素时 element.matches(':hover') 可能返回 true，
      // 因此需在规则循环内显式过滤交互伪类选择器（:hover/:focus/:active 等）。
      //
      // background shorthand 语义处理：
      //   • `background: #1677ff` 不含 gradient → background-image 隐式变为 'none'，background-color = '#1677ff'
      //   • `background: linear-gradient(...)` 含 gradient → background-image = gradient，background-color = ''
      const _findCascadeWinner = (hyphen: string): string | null => {
        let winnerValue: string | null = null
        let winnerSpec: any = null
        let winnerImportant = false
        try {
          const _root = getDocument()
          for (const sheet of Array.from(_root.styleSheets)) {
            try {
              for (const rule of Array.from(sheet.cssRules || [])) {
                if (!(rule instanceof CSSStyleRule)) continue
                let _dbgMatches = false
                try { _dbgMatches = element.matches(rule.selectorText) } catch { continue }
                if (!_dbgMatches) continue
                // 跳过含交互态伪类的规则（:hover/:focus/:active 等）。
                // 原因：点击元素时 element.matches(':hover') = true，导致 hover 规则以 !important 赢得级联，
                // 默认态面板错误回显 hover 颜色。交互态规则只应在对应 pseudo tab（_hasPseudo=true）下生效。
                if (/:(hover|focus-within|focus-visible|focus|active|visited|checked|disabled|indeterminate|placeholder-shown|target|enabled|read-only|read-write)\b/i.test(rule.selectorText)) continue

                // 提取该规则对目标属性（hyphen）的有效值，处理 background shorthand 展开逻辑
                let propVal = rule.style.getPropertyValue(hyphen)
                if (!propVal && hyphen.startsWith('background-')) {
                  const bgShorthand = rule.style.getPropertyValue('background')
                  if (bgShorthand) {
                    const hasGradient = bgShorthand.includes('gradient')
                    if (hyphen === 'background-image') {
                      // background: color → image 隐式为 none；background: gradient → gradient IS image
                      propVal = hasGradient ? bgShorthand : 'none'
                    } else if (hyphen === 'background-color') {
                      // background: color → this IS the color；background: gradient → no explicit color
                      // Chrome 可能以完整 canonical 形式返回 shorthand（如 'rgb(22,119,255) none 0%...'），
                      // 尝试用 rgba?\([^)]+\)|#[0-9a-f]{3,8} 提取首个颜色令牌
                      if (!hasGradient) {
                        const colorMatch = bgShorthand.match(/^(rgba?\([^)]+\)|#[0-9a-f]{3,8}|hsla?\([^)]+\))/)
                        propVal = colorMatch ? colorMatch[1] : bgShorthand
                      }
                    }
                  }
                }
                // 'initial'/'unset'/'revert' 对 background-image 语义等同于 'none'
                // Chrome 对 `background: #1677ff` 的 getPropertyValue('background-image') 返回 'initial'，
                // 需归一化，否则后续 fallback 条件 backgroundImage === 'none' 无法命中。
                if (hyphen === 'background-image' && propVal && /^(initial|unset|revert)$/i.test(propVal.trim())) {
                  propVal = 'none'
                }
                if (!propVal) continue

                const isImportant = rule.style.getPropertyPriority(hyphen) === 'important'
                  || rule.style.getPropertyPriority('background') === 'important'
                let ruleSpec: any
                try { ruleSpec = calculate(rule.selectorText) } catch { continue }

                if (winnerSpec === null) {
                  winnerSpec = ruleSpec; winnerValue = propVal; winnerImportant = isImportant
                } else if (winnerImportant && !isImportant) {
                  // 当前胜者是 !important，新规则不是 → 保持
                } else if (!winnerImportant && isImportant) {
                  winnerSpec = ruleSpec; winnerValue = propVal; winnerImportant = true
                } else if (compare(ruleSpec, winnerSpec) >= 0) {
                  winnerSpec = ruleSpec; winnerValue = propVal; winnerImportant = isImportant
                }
              }
            } catch {}
          }
        } catch {}
        return winnerValue
      }

      // ── 颜色属性：用 colorUtil 归一化比较（处理 rgb/rgba/hex 格式差异）─────────────
      const colorPropMap: Array<[string, string]> = [
        ['color', 'color'],
        ['backgroundColor', 'background-color'],
        ['borderTopColor', 'border-top-color'],
        ['borderRightColor', 'border-right-color'],
        ['borderBottomColor', 'border-bottom-color'],
        ['borderLeftColor', 'border-left-color'],
      ]
      colorPropMap.forEach(([camel, hyphen]) => {
        const val = (values as any)[camel]
        if (!val || _isVarRef(val)) return
        const winnerValue = _findCascadeWinner(hyphen)
        if (winnerValue === null) return
        const c1 = colorUtil.get(val)
        const c2 = colorUtil.get(winnerValue)
        if (c1 && c2 && c1.value.join(',') !== c2.value.join(',')) {
          (values as any)[camel] = winnerValue
        }
      })

      // ── 背景图属性：用字符串比较（linear-gradient 无法被 colorUtil 解析）────────────
      // 场景：antd `.ant-btn-variant-solid { background: #1677ff }` 特指度 (0,2,0) 高于
      // 组件单类 `.headerStockInBtn` (0,1,0)，实际 background-image 被重置为 none，
      // 但 getValues 读到的是 Less 文件里的渐变值，导致回显错误。
      const bgImageVal = (values as any)['backgroundImage']
      if (bgImageVal && bgImageVal !== 'none' && !_isVarRef(bgImageVal)) {
        const bgWinner = _findCascadeWinner('background-image')
        if (bgWinner !== null) {
          const norm = (s: string) => s.replace(/\s+/g, ' ').trim().toLowerCase()
          if (norm(bgImageVal) !== norm(bgWinner)) {
            (values as any)['backgroundImage'] = bgWinner
          }
        }
      }

      // ── backgroundColor 兜底：组件 Less 无 background-color 时从 CSSOM 取实际生效值 ────
      // 场景：antd Button 的背景色由 `.ant-btn-variant-solid { background: #1677ff }` 设置，
      // 组件 Less 中无对应 background-color 规则，导致 getValues 返回空字符串，
      // colorPropMap 的 !val 守卫跳过级联扫描，样式面板背景区域显示空白。
      // 修复：当 values.backgroundColor 为空时，主动扫描 CSSOM 取实际生效的背景色，
      // 让用户能看到并覆盖外部库（如 antd）设置的默认背景。
      if (!(values as any)['backgroundColor'] && ((values as any)['backgroundImage'] === 'none' || (values as any)['backgroundImage'] === 'initial')) {
        // 优先用级联扫描（过滤伪类规则），兜底用 computedValues（处理 shorthand 展开失败的场景）
        let _bgColorCandidate = _findCascadeWinner('background-color')
        if (!_bgColorCandidate || !colorUtil.get(_bgColorCandidate)) {
          // _findCascadeWinner 返回了无法解析的 canonical shorthand 字符串（或 null），
          // 改用 computedValues.background-color，在初始选中（非 hover）状态下是安全的
          const _compBg = computedValues?.getPropertyValue('background-color') ?? ''
          if (_compBg) _bgColorCandidate = _compBg
        }
        if (_bgColorCandidate && _bgColorCandidate !== 'none') {
          const c = colorUtil.get(_bgColorCandidate)
          // 过滤掉透明色（rgba(0,0,0,0)）和无效值，只显示真实背景色
          if (c && !(c.value[0] === 0 && c.value[1] === 0 && c.value[2] === 0 && c.value[3] === 0)) {
            (values as any)['backgroundColor'] = _bgColorCandidate
          }
        }
      }
    }

    // ── hover 态级联校正：getValues 按特指度取最后规则，不考虑 !important，
    // 导致 antd 高特指度 hover 规则覆盖组件自身 hover 规则的值。
    // 修复：扫描所有以 :hover 结尾且 element（去掉:hover后）匹配的规则，
    // 按完整 CSS 级联（!important → 特指度 → 源码顺序）找出真正胜出的值并更新 values。
    if (element && _hasPseudo && /^.*:hover\s*$/i.test(primarySelector)) {
      const _isVarRefH = (v: any) => typeof v === 'string' && v.startsWith('var(')
      const HOVER_TAIL_RE = /:hover\s*$/i

      const _findHoverCascadeWinner = (hyphen: string): string | null => {
        let winnerValue: string | null = null
        let winnerSpec: any = null
        let winnerImportant = false
        try {
          const _root = getDocument()
          for (const sheet of Array.from(_root.styleSheets)) {
            try {
              for (const rule of Array.from(sheet.cssRules || [])) {
                if (!(rule instanceof CSSStyleRule)) continue
                if (!HOVER_TAIL_RE.test(rule.selectorText)) continue
                const ruleBase = rule.selectorText.replace(HOVER_TAIL_RE, '').trim()
                try { if (!ruleBase || !element.matches(ruleBase)) continue } catch { continue }

                let propVal = rule.style.getPropertyValue(hyphen)
                if (!propVal && hyphen.startsWith('background-')) {
                  const bgShorthand = rule.style.getPropertyValue('background')
                  if (bgShorthand) {
                    const hasGradient = bgShorthand.includes('gradient')
                    if (hyphen === 'background-image') {
                      propVal = hasGradient ? bgShorthand : 'none'
                    } else if (hyphen === 'background-color') {
                      if (!hasGradient) {
                        const colorMatch = bgShorthand.match(/^(rgba?\([^)]+\)|#[0-9a-f]{3,8}|hsla?\([^)]+\))/)
                        propVal = colorMatch ? colorMatch[1] : bgShorthand
                      }
                    }
                  }
                }
                if (hyphen === 'background-image' && propVal && /^(initial|unset|revert)$/i.test(propVal.trim())) {
                  propVal = 'none'
                }
                if (!propVal) continue

                const isImportant = rule.style.getPropertyPriority(hyphen) === 'important'
                  || rule.style.getPropertyPriority('background') === 'important'
                let ruleSpec: any
                try { ruleSpec = calculate(rule.selectorText) } catch { continue }

                if (winnerSpec === null) {
                  winnerSpec = ruleSpec; winnerValue = propVal; winnerImportant = isImportant
                } else if (winnerImportant && !isImportant) {
                  // 当前胜者是 !important，保持
                } else if (!winnerImportant && isImportant) {
                  winnerSpec = ruleSpec; winnerValue = propVal; winnerImportant = true
                } else if (compare(ruleSpec, winnerSpec) >= 0) {
                  winnerSpec = ruleSpec; winnerValue = propVal; winnerImportant = isImportant
                }
              }
            } catch {}
          }
        } catch {}
        return winnerValue
      }

      // 颜色属性校正
      const colorPropMapH: Array<[string, string]> = [
        ['color', 'color'],
        ['backgroundColor', 'background-color'],
        ['borderTopColor', 'border-top-color'],
        ['borderRightColor', 'border-right-color'],
        ['borderBottomColor', 'border-bottom-color'],
        ['borderLeftColor', 'border-left-color'],
      ]
      colorPropMapH.forEach(([camel, hyphen]) => {
        const val = (values as any)[camel]
        if (!val || _isVarRefH(val)) return
        const winnerValue = _findHoverCascadeWinner(hyphen)
        if (winnerValue === null) return
        const c1 = colorUtil.get(val)
        const c2 = colorUtil.get(winnerValue)
        if (c1 && c2 && c1.value.join(',') !== c2.value.join(',')) {
          (values as any)[camel] = winnerValue
        }
      })

      // 背景图属性校正
      const bgImageValH = (values as any)['backgroundImage']
      if (bgImageValH && bgImageValH !== 'none' && !_isVarRefH(bgImageValH)) {
        const bgWinnerH = _findHoverCascadeWinner('background-image')
        if (bgWinnerH !== null) {
          const norm = (s: string) => s.replace(/\s+/g, ' ').trim().toLowerCase()
          if (norm(bgImageValH) !== norm(bgWinnerH)) {
            (values as any)['backgroundImage'] = bgWinnerH
          }
        }
      }
      // 若 backgroundImage 被校正为真实渐变（说明组件 hover 规则以 !important 胜出），
      // 则 antd background 简写设置的 backgroundColor 在视觉上被渐变覆盖、不可见，
      // 清空以避免 parseLayers 渲染出冗余的第二背景图层。
      const _bgImageAfterH = (values as any)['backgroundImage']
      if (
        _bgImageAfterH !== bgImageValH &&
        _bgImageAfterH &&
        _bgImageAfterH !== 'none' &&
        _bgImageAfterH !== 'initial'
      ) {
        ;(values as any)['backgroundColor'] = ''
      }

      // backgroundColor 兜底：hover tab 下外部库覆盖时回显实际生效背景色
      if (!(values as any)['backgroundColor'] && ((values as any)['backgroundImage'] === 'none' || (values as any)['backgroundImage'] === 'initial')) {
        let _bgColorCandidateH = _findHoverCascadeWinner('background-color')
        if (!_bgColorCandidateH || !colorUtil.get(_bgColorCandidateH)) {
          const _compBg = computedValues?.getPropertyValue('background-color') ?? ''
          if (_compBg) _bgColorCandidateH = _compBg
        }
        if (_bgColorCandidateH && _bgColorCandidateH !== 'none') {
          const c = colorUtil.get(_bgColorCandidateH)
          if (c && !(c.value[0] === 0 && c.value[1] === 0 && c.value[2] === 0 && c.value[3] === 0)) {
            (values as any)['backgroundColor'] = _bgColorCandidateH
          }
        }
      }
    }
    // ────────────────────────────────────────────────────────────────────────

    // ── 内联 style 补丁：展开面板 + 用 element.style 原始值覆盖 ────────────────
    // 背景：element.style 里的属性不在任何 CSSStyleRule 中，
    //       getEffectedPanelsFromCssRules 无法感知，对应面板会保持折叠。
    //       同时 getValues 对 width/height 等属性使用静态 'auto' 兜底，
    //       会丢失内联 style 的真实值。
    const inlineEffectedPanels: string[] = [];
    if (element && element.style.length > 0) {
      const inlineBag: Record<string, any> = {};
      for (let i = 0; i < element.style.length; i++) {
        const kebabProp = element.style[i];
        const camelProp = toHump(kebabProp);
        const inlineVal = element.style.getPropertyValue(kebabProp);
        if (inlineVal) {
          (values as any)[camelProp] = inlineVal;
          inlineBag[camelProp] = inlineVal;
        }
      }
      // 补齐 webkit 读法，供文字渐变面板归属判断
      const webkitClip = element.style.getPropertyValue('-webkit-background-clip');
      const webkitFill = element.style.getPropertyValue('-webkit-text-fill-color');
      if (webkitClip) inlineBag.WebkitBackgroundClip = webkitClip;
      if (webkitFill) inlineBag.WebkitTextFillColor = webkitFill;

      const inlineStyleBag = { ...values, ...inlineBag };
      Object.keys(inlineBag).forEach((camelProp) => {
        const mapped = PANEL_MAP[camelProp];
        if (
          isMeaninglessStylePropForPanel(
            camelProp,
            inlineBag[camelProp],
            mapped,
            inlineStyleBag
          )
        ) {
          return;
        }
        const panel = refineEffectedPanel(camelProp, mapped, inlineStyleBag);
        if (panel === 'border' && !isBorderPanelMeaningfullyUsed(inlineStyleBag)) {
          return;
        }
        if (panel && !inlineEffectedPanels.includes(panel)) {
          inlineEffectedPanels.push(panel);
        }
      });
    }
    // ────────────────────────────────────────────────────────────────────────

    const effectedFromDirectParent = element ? getEffectedPanelsFromDirectParent(element, comId) : [];
    const finalEffectedPanels = Array.from(
      new Set([...(effectedFromRules as string[]), ...effectedFromDirectParent, ...inlineEffectedPanels])
    );

    // 当前编辑的选择器由 selectorArray 里多个 selector 共同描述（如 [".primary", ".actionBtn"]），
    // 每项取末尾段后，只有 selectorText 末尾同时满足所有末尾段的规则，才真正属于"当前编辑的状态"。
    // 例：selectorArray = [".userBtnGroup .primary", ".userBtnGroup .actionBtn"]
    //   → tailSegments = [".primary", ".actionBtn"]
    //   → ".u_VvteU .actionBtn.primary" 末尾含 ".primary" 且含 ".actionBtn" → 命中 ✅
    //   → ".u_VvteU .actionBtn"         末尾含 ".actionBtn" 但不含 ".primary" → 排除 ❌
    const tailSegments = selectorArray.map(sel =>
      sel.includes(' ') ? sel.slice(sel.lastIndexOf(' ') + 1) : sel
    ).filter(Boolean);

    const ruleMatchesTailSegment = (selectorText: string, tail: string): boolean => {
      if (selectorText === tail) return true;
      const idx = selectorText.lastIndexOf(tail);
      if (idx === -1) return false;
      if (idx + tail.length !== selectorText.length) return false;
      const charBefore = selectorText[idx - 1];
      return charBefore === ' ' || charBefore === '>' || charBefore === '+' || charBefore === '~';
    };

    const ownSelectorRules = tailSegments.length > 0
      ? finalRules.filter((rule: any) => {
          const st: string = rule.selectorText ?? '';
          return tailSegments.every(tail => {
            // 对于单段（无空格）的 tail，用末尾精确匹配
            // 对于包含空格的 tail（不应出现，做兜底），直接 endsWith
            if (ruleMatchesTailSegment(st, tail) || st.includes(tail)) return true;
            // CSS Modules 哈希类名兜底：tail=".myClass" 对应编译后 "pages_xxx_less-myClass"
            // 规则选择器末尾段中，若某个类以 "-{原始类名}" 结尾则视为命中
            if (tail.startsWith('.') && element) {
              const tailClass = tail.slice(1);
              const stLast = (st.trim().split(/\s+/).pop() || '');
              const stClasses = (stLast.match(/\.([^.#[:]+)/g) ?? []).map((c: string) => c.slice(1));
              const isHashedMatch = stClasses.some((c: string) => c === tailClass || c.endsWith('-' + tailClass));
              if (isHashedMatch) {
                try { return element.matches(st); } catch {}
              }
            }
            return false;
          });
        })
      : finalRules;
    // inlineEffectedPanels 也视为"自身拥有的样式"（用户通过编辑器写入的内联 style），
    // 加入 ownRulesPanels 后会进入 ownEffectedSet，使对应面板显示 - 删除按钮，
    // 而不是作为只读继承（'inherited'）展示。
    const ownRulesPanels = Array.from(new Set([
      ...(getEffectedPanelsFromCssRules(ownSelectorRules) as string[]),
      ...inlineEffectedPanels,
    ]));

    // 其他命中当前 DOM 但不属于当前编辑选择器的规则（如 .actionBtn 当编辑 .actionBtn.primary 时），
    // 产生的面板需要展开回显但不能有减号，单独返回供外层计算 readonlyExpandedOptions。
    const otherRules = finalRules.filter((rule: any) => !ownSelectorRules.includes(rule));
    const otherRulesPanels = getEffectedPanelsFromCssRules(otherRules) as string[];

    // ── 伪类（hover/focus 等）状态下，回填默认态的 var() 引用 ────────────────
    // hover 规则通常只定义覆盖属性（box-shadow、transform 等），未覆盖的属性
    // 在视觉上仍显示默认态的值。这里从默认态规则中找出 var() 引用回填到
    // hover 的 values 中，避免回显时降级为计算后的 rgb 值。
    // 回填的面板会加入 baseStateVarPanels，以 readonlyExpanded（无减号）方式展示。
    const baseStateVarPanels: string[] = [];
    if (element && primarySelector) {
      const pseudoMatch = primarySelector.match(/(:{1,2}[a-zA-Z\-]+(?:\([^)]*\))?)$/)
      if (pseudoMatch) {
        const baseSelector = primarySelector.replace(pseudoMatch[0], '').trim()
        if (baseSelector) {
          try {
            const { rules: baseRules } = getStyleRules(element, baseSelector)
            if (baseRules.length > 0) {
              const baseValues = getValues(baseRules, computedValues, new Set<CSSStyleRule>())
              const _isVarRef = (v: any) => typeof v === 'string' && v.startsWith('var(')
              Object.keys(baseValues as object).forEach(key => {
                const baseVal = (baseValues as any)[key]
                const curVal = (values as any)[key]
                if (_isVarRef(baseVal) && !_isVarRef(curVal)) {
                  (values as any)[key] = baseVal
                  const panel = PANEL_MAP[key]
                  if (panel && !baseStateVarPanels.includes(panel)) {
                    baseStateVarPanels.push(panel)
                  }
                }
              })
            }
          } catch {}
        }
      }
    }
    // ────────────────────────────────────────────────────────────────────────

    return [values, finalEffectedPanels, ownRulesPanels, [...effectedFromDirectParent, ...otherRulesPanels, ...baseStateVarPanels, ...inlineEffectedPanels]]
  } catch (e) {
    console.warn('[getEffectedCssPropertyAndOptions] 异常:', e)
    return [{}, []]
  }
}

// CSS 中可被子元素继承的属性集合（font 系列 + color + cursor + 少量文本属性）
// 用于父级规则纳入时的过滤：只允许这些属性从父级规则中读取，
// 防止 display / padding / margin 等非继承属性被误带入子元素面板。
const INHERITABLE_PROPS = new Set([
  'color', 'fontSize', 'fontWeight', 'fontFamily', 'fontStyle',
  'lineHeight', 'letterSpacing', 'textAlign', 'whiteSpace', 'cursor',
  'font-size', 'font-weight', 'font-family', 'font-style',
  'line-height', 'letter-spacing', 'text-align', 'white-space',
])

function getValues (rules: CSSStyleRule[], computedValues: CSSStyleDeclaration, inheritOnlyRules?: Set<CSSStyleRule>) {
  //'[getValues] 命中 rules selectors:', rules.map(r => r.selectorText))
  // TODO: 先一个个来吧，后面改一下
  /** font */
  let color // 继承属性
  let fontSize // 继承属性
  let textAlign // 继承属性
  let fontWeight // 继承属性
  let lineHeight // 继承属性
  let fontFamily // 继承属性
  let letterSpacing // 继承属性
  let linHeight // 继承属性
  let whiteSpace // 继承属性
  let textOverflow // 非继承属性
  let webkitLineClamp // 非继承属性
  let textDecoration // 非继承属性
  let fontStyle // 非继承属性
  let textTransform // 非继承属性
  let webkitTextFillColor // 非继承属性（文字渐变）
  let webkitBackgroundClip // 非继承属性（文字渐变 / 多角色 clip）
  /** font */

  /** padding */
  let paddingTop // 非继承属性
  let paddingRight // 非继承属性
  let paddingBottom // 非继承属性
  let paddingLeft // 非继承属性
  /** padding */

  /** margin */
  let marginTop // 非继承属性
  let marginRight // 非继承属性
  let marginBottom // 非继承属性
  let marginLeft // 非继承属性
  /** margin */

  /** background */
  let backgroundColor // 非继承属性
  let backgroundImage // 非继承属性
  let backgroundRepeat // 非继承属性
  let backgroundPosition // 非继承属性
  let backgroundSize // 非继承属性
  let backgroundOrigin // 非继承属性
  let backgroundClip: string | undefined // 非继承属性
  /** background */

  /** border */
  let borderTopColor: string | undefined // 非继承属性
  let borderRightColor: string | undefined // 非继承属性
  let borderBottomColor: string | undefined // 非继承属性
  let borderLeftColor: string | undefined // 非继承属性
  let borderTopLeftRadius // 非继承属性
  let borderTopRightRadius // 非继承属性
  let borderBottomRightRadius // 非继承属性
  let borderBottomLeftRadius // 非继承属性
  let borderTopStyle // 非继承属性
  let borderRightStyle // 非继承属性
  let borderBottomStyle // 非继承属性
  let borderLeftStyle // 非继承属性
  let borderTopWidth // 非继承属性
  let borderBottomWidth // 非继承属性
  let borderLeftWidth // 非继承属性
  let borderRightWidth // 非继承属性
  /** border */

  /** size */
  let width // 非继承属性
  let height // 非继承属性
  let maxWidth
  let maxHeight
  let minWidth
  let minHeight
  /** size */

  /** cursor */
  let cursor // 非继承属性
  /** cursor */

  /** boxshadow */
  let boxShadow // 非继承属性
  /** boxshadow */

  /** blur / effects */
  let filter: string | undefined // 非继承属性
  let backdropFilter: string | undefined // 非继承属性
  let webkitBackdropFilter: string | undefined // 非继承属性
  /** blur / effects */

  /** overflow */
  let overflowX // 非继承属性
  let overflowY // 非继承属性
  /** overflow */

  /** opacity */
  let opacity // 非继承属性
  /** opacity */

  /** zindex */
  let zIndex // 非继承属性
  /** zindex */

  /** rotation */
  let transform // 非继承属性
  /** rotation */

  /** layout */
  let display // 非继承属性
  let flexDirection // 非继承属性
  let alignItems // 非继承属性
  let justifyContent // 非继承属性
  let flexWrap // 非继承属性
  let rowGap // 非继承属性
  let columnGap // 非继承属性
  let position // 非继承属性
  let overflow // 非继承属性
  /** layout */

  rules.forEach((rule) => {
    const { style } = rule
    // 父级规则（继承来源）只允许提取可继承属性，跳过 display/padding/margin 等非继承属性
    const inheritOnly = !!(inheritOnlyRules?.has(rule))

    /** font */
    const {
      color: styleColor,
      fontSize: styleFontSize,
      textAlign: styleTextAlign,
      fontWeight: styleFontWeight,
      lineHeight: styleLineHeight,
      fontFamily: styleFontFamily,
      letterSpacing: styleLetterSpacing,
      whiteSpace: styleWhiteSpace
    } = style
    if (styleColor) {
      color = styleColor
    }
    if (styleFontSize) {
      fontSize = styleFontSize
    }
    if (styleTextAlign) {
      textAlign = styleTextAlign
    }
    if (styleFontWeight) {
      fontWeight = styleFontWeight
    }
    if (styleLineHeight) {
      lineHeight = styleLineHeight
    }
    if (styleFontFamily) {
      fontFamily = styleFontFamily
    }
    if (styleLetterSpacing) {
      letterSpacing = styleLetterSpacing
    }
    if (styleWhiteSpace) {
      whiteSpace = styleWhiteSpace
    }
    /** font */

    // 以下均为非继承属性，父级规则模式下跳过
    if (inheritOnly) return

    /** padding */
    const {
      paddingTop: stylePaddingTop,
      paddingRight: stylePaddingRight,
      paddingBottom: stylePaddingBottom,
      paddingLeft: stylePaddingLeft
    } = style
    if (stylePaddingTop) {
      paddingTop = stylePaddingTop
    }
    if (stylePaddingRight) {
      paddingRight = stylePaddingRight
    }
    if (stylePaddingBottom) {
      paddingBottom = stylePaddingBottom
    }
    if (stylePaddingLeft) {
      paddingLeft = stylePaddingLeft
    }
    /** padding */

    /** margin */
    const {
      marginTop: styleMarginTop,
      marginRight: styleMarginRight,
      marginBottom: styleMarginBottom,
      marginLeft: styleMarginLeft
    } = style
    if (styleMarginTop) {
      marginTop = styleMarginTop
    }
    if (styleMarginRight) {
      marginRight = styleMarginRight
    }
    if (styleMarginBottom) {
      marginBottom = styleMarginBottom
    }
    if (styleMarginLeft) {
      marginLeft = styleMarginLeft
    }
    /** margin */

    /** background */
    const {
      backgroundColor: styleBackgroundColor,
      backgroundImage: styleBackgroundImage,
      backgroundRepeat: styleBackgroundRepeat,
      backgroundPosition: styleBackgroundPosition,
      backgroundSize: styleBackgroundSize,
      backgroundOrigin: styleBackgroundOrigin,
      backgroundClip: styleBackgroundClip,
      background: styleBackground
    } = style
    if (styleBackgroundColor) {
      backgroundColor = styleBackgroundColor
    } else if (styleBackground && typeof styleBackground === 'string' && styleBackground.startsWith('var(')) {
      // AI 代码生成有时使用 background 简写（如 background: var(--xxx)）
      // Chrome 无法在解析期展开含 var() 的简写，rule.style.backgroundColor 会为空
      // 这里将整体 background 简写值作为 backgroundColor 处理，确保变量引用能正确回显
      backgroundColor = styleBackground
    }
    if (styleBackgroundImage) {
      backgroundImage = styleBackgroundImage
    }
    if (styleBackgroundRepeat) {
      backgroundRepeat = styleBackgroundRepeat
    }
    if (styleBackgroundPosition) {
      backgroundPosition = styleBackgroundPosition
    }
    if (styleBackgroundSize) {
      backgroundSize = styleBackgroundSize
    }
    if (styleBackgroundOrigin) {
      backgroundOrigin = styleBackgroundOrigin
    }
    if (styleBackgroundClip) {
      backgroundClip = styleBackgroundClip
    }
    /** background */

    /** border */
    const {
      borderTopColor: styleBorderTopColor,
      borderRightColor: styleBorderRightColor,
      borderBottomColor: styleBorderBottomColor,
      borderLeftColor: styleBorderLeftColor,
      borderTopLeftRadius: styleBorderTopLeftRadius,
      borderTopRightRadius: styleBorderTopRightRadius,
      borderBottomRightRadius: styleBorderBottomRightRadius,
      borderBottomLeftRadius: styleBorderBottomLeftRadius,
      borderTopStyle: styleBorderTopStyle,
      borderRightStyle: styleBorderRightStyle,
      borderBottomStyle: styleBorderBottomStyle,
      borderLeftStyle: styleBorderLeftStyle,
      borderTopWidth: styleBorderTopWidth,
      borderBottomWidth: styleBorderBottomWidth,
      borderLeftWidth: styleBorderLeftWidth,
      borderRightWidth: styleBorderRightWidth
    } = style
    if (styleBorderTopColor) {
      borderTopColor = styleBorderTopColor
    }
    if (styleBorderRightColor) {
      borderRightColor = styleBorderRightColor
    }
    if (styleBorderBottomColor) {
      borderBottomColor = styleBorderBottomColor
    }
    if (styleBorderLeftColor) {
      borderLeftColor = styleBorderLeftColor
    }
    // border-color 简写含 var() 时（如 border-color: var(--xxx)），
    // rule.style 中四个 longhand 均为空字符串，需通过 getPropertyValue 读取简写值兜底
    const styleBorderColorShorthand = style.getPropertyValue('border-color')
    if (styleBorderColorShorthand && styleBorderColorShorthand.trim().startsWith('var(')) {
      if (!borderTopColor)    borderTopColor    = styleBorderColorShorthand.trim()
      if (!borderRightColor)  borderRightColor  = styleBorderColorShorthand.trim()
      if (!borderBottomColor) borderBottomColor = styleBorderColorShorthand.trim()
      if (!borderLeftColor)   borderLeftColor   = styleBorderColorShorthand.trim()
    }
    // border 完整简写含 var() 时（如 border: 1px solid var(--xxx)），
    // rule.style 的所有 border longhand 均为空，需从 border 简写中提取颜色部分兜底
    const styleBorderShorthand = style.getPropertyValue('border')
    if (styleBorderShorthand && styleBorderShorthand.includes('var(')) {
      const varMatch = styleBorderShorthand.match(/var\(--[^)]+\)/)
      if (varMatch) {
        const varColor = varMatch[0]
        if (!borderTopColor)    borderTopColor    = varColor
        if (!borderRightColor)  borderRightColor  = varColor
        if (!borderBottomColor) borderBottomColor = varColor
        if (!borderLeftColor)   borderLeftColor   = varColor
      }
    }
    if (styleBorderTopLeftRadius) {
      borderTopLeftRadius = styleBorderTopLeftRadius
    }
    if (styleBorderTopRightRadius) {
      borderTopRightRadius = styleBorderTopRightRadius
    }
    if (styleBorderBottomRightRadius) {
      borderBottomRightRadius = styleBorderBottomRightRadius
    }
    if (styleBorderBottomLeftRadius) {
      borderBottomLeftRadius = styleBorderBottomLeftRadius
    }
    if (styleBorderTopStyle) {
      borderTopStyle = styleBorderTopStyle
    }
    if (styleBorderRightStyle) {
      borderRightStyle = styleBorderRightStyle
    }
    if (styleBorderBottomStyle) {
      borderBottomStyle = styleBorderBottomStyle
    }
    if (styleBorderLeftStyle) {
      borderLeftStyle = styleBorderLeftStyle
    }
    if (styleBorderTopWidth) {
      borderTopWidth = styleBorderTopWidth
    }
    if (styleBorderBottomWidth) {
      borderBottomWidth = styleBorderBottomWidth
    }
    if (styleBorderLeftWidth) {
      borderLeftWidth = styleBorderLeftWidth
    }
    if (styleBorderRightWidth) {
      borderRightWidth = styleBorderRightWidth
    }
    /** border */

    /** size */
    const {
      width: styleWidth,
      height: styleHeight,
      maxWidth: styleMaxWidth,
      maxHeight: styleMaxHeight,
      minWidth: styleMinWidth,
      minHeight: styleMinHeight,
    } = style
    if (styleWidth) {
      width = styleWidth
    }
    if (styleHeight) {
      height = styleHeight
    }
    if (styleMaxWidth) {
      maxWidth = styleMaxWidth
    }
    if (styleMaxHeight) {
      maxHeight = styleMaxHeight
    }
    if (styleMinWidth) {
      minWidth = styleMinWidth
    }
    if (styleMinHeight) {
      minHeight = styleMinHeight
    }
    /** size */

    /** cursor */
    const {
      cursor: styleCursor
    } = style
    if (styleCursor) {
      cursor = styleCursor
    } 
    /** cursor */

    /** boxShadow TODO:  */
    // const {
    //   boxShadow: styleBoxShadow
    // } = style
    // if (styleBoxShadow) {
    //     boxShadow = styleBoxShadow
    //   }
    /** boxShadow */

    /** blur */
    const {
      filter: styleFilter,
      backdropFilter: styleBackdropFilter,
    } = style
    if (styleFilter) {
      filter = styleFilter
    }
    if (styleBackdropFilter) {
      backdropFilter = styleBackdropFilter
    }
    const styleWebkitBackdropFilter = style.getPropertyValue?.('-webkit-backdrop-filter')
    if (styleWebkitBackdropFilter) {
      webkitBackdropFilter = styleWebkitBackdropFilter
      if (!backdropFilter) backdropFilter = styleWebkitBackdropFilter
    }
    /** blur */

    /** overflow */
    const {
      overflowX: styleOverflowX,
      overflowY: styleOverflowY
    } = style
    if (styleOverflowX) {
      overflowX = styleOverflowX
    }
    if (styleOverflowY) {
      overflowY = styleOverflowY
    }
    /** overflow */

    /** textOverflow */
    const { textOverflow: styleTextOverflow } = style
    if (styleTextOverflow) {
      textOverflow = styleTextOverflow
    }
    /** textOverflow */

    /** textDecoration */
    const { textDecoration: styleTextDecoration } = style
    if (styleTextDecoration && styleTextDecoration !== 'none') {
      textDecoration = styleTextDecoration
    }
    /** textDecoration */

    /** fontStyle */
    const { fontStyle: styleFontStyle } = style
    if (styleFontStyle && styleFontStyle !== 'normal') {
      fontStyle = styleFontStyle
    }
    /** fontStyle */

    /** textTransform */
    const { textTransform: styleTextTransform } = style
    if (styleTextTransform && styleTextTransform !== 'none') {
      textTransform = styleTextTransform
    }
    /** textTransform */

    /** webkitLineClamp */
    const styleWebkitLineClamp = style.webkitLineClamp
    if (styleWebkitLineClamp) {
      webkitLineClamp = styleWebkitLineClamp
    }
    /** webkitLineClamp */

    /** webkitTextFillColor / webkitBackgroundClip（文字渐变） */
    const styleWebkitTextFillColor =
      (style as any).webkitTextFillColor || (style as any).WebkitTextFillColor
    if (styleWebkitTextFillColor) {
      webkitTextFillColor = styleWebkitTextFillColor
    }
    const styleWebkitBackgroundClip =
      (style as any).webkitBackgroundClip || (style as any).WebkitBackgroundClip
    if (styleWebkitBackgroundClip) {
      webkitBackgroundClip = styleWebkitBackgroundClip
      if (!backgroundClip) {
        backgroundClip = styleWebkitBackgroundClip
      }
    }
    /** webkitTextFillColor / webkitBackgroundClip */

    /** opacity */
    const { opacity: styleOpacity } = style
    if (styleOpacity) {
      opacity = styleOpacity
    }
    /** opacity */

    /** zindex */
    const { zIndex: styleZIndex } = style
    if (styleZIndex) {
      zIndex = styleZIndex
    }
    /** zindex */

    /** rotation */
    const { transform: styleTransform } = style
    if (styleTransform) {
      transform = styleTransform
    }
    /** rotation */

    /** layout */
    const {
      display: styleDisplay,
      flexDirection: styleFlexDirection,
      alignItems: styleAlignItems,
      justifyContent: styleJustifyContent,
      flexWrap: styleFlexWrap,
      rowGap: styleRowGap,
      columnGap: styleColumnGap,
      position: stylePosition,
      overflow: styleOverflow,
    } = style
    if (styleDisplay) { display = styleDisplay }
    if (styleFlexDirection) { flexDirection = styleFlexDirection }
    if (styleAlignItems) { alignItems = styleAlignItems }
    if (styleJustifyContent) { justifyContent = styleJustifyContent }
    if (styleFlexWrap) { flexWrap = styleFlexWrap }
    if (styleRowGap) { rowGap = styleRowGap }
    if (styleColumnGap) { columnGap = styleColumnGap }
    if (stylePosition) { position = stylePosition }
    if (styleOverflow) { overflow = styleOverflow }
    /** layout */
  })

  const isNotSet = (v: any) => v === undefined || v === 'inherit';
  const isVarRef = (v: any) => typeof v === 'string' && v.startsWith('var(');

  /** font */
  if (!isVarRef(color) && (isNotSet(color) || !colorUtil.get(color || ''))) {
    color = computedValues.color
  }
  if (isNotSet(fontSize)) {
    fontSize = computedValues.fontSize
  }
  if (isNotSet(textAlign)) {
    textAlign = computedValues.textAlign
  }
  if (isNotSet(fontWeight)) {
    fontWeight = computedValues.fontWeight
  }
  if (isNotSet(lineHeight)) {
    lineHeight = computedValues.lineHeight
  }
  if (!fontFamily) {
    fontFamily = computedValues?.fontFamily || 'inherit'
  }
  if (isNotSet(letterSpacing)) {
    letterSpacing = computedValues.letterSpacing
  }
  if (isNotSet(whiteSpace)) {
    whiteSpace = computedValues.whiteSpace
  }
  /** font */

  /** padding */
  if (!paddingTop) {
    paddingTop = computedValues.paddingTop
  }
  if (!paddingRight) {
    paddingRight = computedValues.paddingRight
  }
  if (!paddingBottom) {
    paddingBottom = computedValues.paddingBottom
  }
  if (!paddingLeft) {
    paddingLeft = computedValues.paddingLeft
  }
  /** padding */

  /** margin */
  if (!marginTop) {
    marginTop = computedValues.marginTop
  }
  if (!marginRight) {
    marginRight = computedValues.marginRight
  }
  if (!marginBottom) {
    marginBottom = computedValues.marginBottom
  }
  if (!marginLeft) {
    marginLeft = computedValues.marginLeft
  }
  /** margin */


  /** background */
  // backgroundColor 是非继承属性；不用 computedStyle 兜底，避免元素处于 :hover 时污染非 hover 编辑器
  // （与 backgroundImage 处理保持一致：该属性也不使用 computedValues 兜底）
  if (!isVarRef(backgroundColor) && (!backgroundColor || !colorUtil.get(backgroundColor))) {
    backgroundColor = ''
  }
  if (!backgroundImage) {
    // backgroundImage = computedValues.backgroundImage
    backgroundImage = 'none'
  }
  if (!backgroundRepeat) {
    backgroundRepeat = computedValues.backgroundRepeat
  }
  if (!backgroundPosition) {
    // backgroundPosition = computedValues.backgroundPosition
    backgroundPosition = 'left top'
  }
  if (!backgroundSize) {
    backgroundSize = computedValues.backgroundSize
  }
  /** background */

  /** border */
  if (!isVarRef(borderTopColor) && (!borderTopColor || !colorUtil.get(borderTopColor))) {
    borderTopColor = computedValues.borderTopColor // 默认使用当前元素color,否则为浏览器默认颜色
  }
  if (!isVarRef(borderRightColor) && (!borderRightColor || !colorUtil.get(borderRightColor))) {
    borderRightColor = computedValues.borderRightColor
  }
  if (!isVarRef(borderBottomColor) && (!borderBottomColor || !colorUtil.get(borderBottomColor))) {
    borderBottomColor = computedValues.borderBottomColor
  }
  if (!isVarRef(borderLeftColor) && (!borderLeftColor || !colorUtil.get(borderLeftColor))) {
    borderLeftColor = computedValues.borderLeftColor
  }
  if (!borderTopLeftRadius) {
    borderTopLeftRadius = computedValues.borderTopLeftRadius
  }
  if (!borderTopRightRadius) {
    borderTopRightRadius = computedValues.borderTopRightRadius
  }
  if (!borderBottomRightRadius) {
    borderBottomRightRadius = computedValues.borderBottomRightRadius
  }
  if (!borderBottomLeftRadius) {
    borderBottomLeftRadius = computedValues.borderBottomLeftRadius
  }
  if (!borderTopStyle) {
    borderTopStyle = computedValues.borderTopStyle
  }
  if (!borderRightStyle) {
    borderRightStyle = computedValues.borderRightStyle
  }
  if (!borderBottomStyle) {
    borderBottomStyle = computedValues.borderBottomStyle
  }
  if (!borderLeftStyle) {
    borderLeftStyle = computedValues.borderLeftStyle
  }
  if (!borderTopWidth || borderTopWidth === 'initial') {
    borderTopWidth = computedValues.borderTopWidth
  }
  if (!borderBottomWidth || borderBottomWidth === 'initial') {
    borderBottomWidth = computedValues.borderBottomWidth
  }
  if (!borderLeftWidth || borderLeftWidth === 'initial') {
    borderLeftWidth = computedValues.borderLeftWidth
  }
  if (!borderRightWidth || borderRightWidth === 'initial') {
    borderRightWidth = computedValues.borderRightWidth
  }
  /** border */

  /** size */
  if (!width) {
    width = 'auto'
  }
  if (!height) {
    height = 'auto'
  }
  if (!maxWidth) {
    maxWidth = 'auto'
  }
  if (!maxHeight) {
    maxHeight = 'auto'
  }
  if (!minWidth) {
    minWidth = 'auto'
  }
  if (!minHeight) {
    minHeight = 'auto'
  }
  /** size */

  /** cursor */
  if (!cursor) {
    cursor = 'inherit'
  }
  /** cursor */

  /** boxshadow */
  if (!boxShadow) {
    boxShadow = computedValues.boxShadow;
  }
  /** boxshadow */

  /** blur */
  if (!filter) {
    filter = computedValues.filter;
  }
  if (!backdropFilter) {
    backdropFilter = computedValues.backdropFilter
      || computedValues.getPropertyValue?.('-webkit-backdrop-filter')
      || webkitBackdropFilter;
  }
  if (!webkitBackdropFilter) {
    webkitBackdropFilter = computedValues.getPropertyValue?.('-webkit-backdrop-filter') || backdropFilter;
  }
  /** blur */

  /** overflow */
  if (!overflowX) {
    overflowX = computedValues.overflowX
  }
  if (!overflowY) {
    overflowY = computedValues.overflowY
  }
  /** overflow */

  /** textOverflow */
  // text-overflow 不继承，无需兜底 computedValues（计算值始终为 'clip'，无法区分是否显式设置）
  /** textOverflow */

  /** webkitLineClamp */
  // -webkit-line-clamp 不继承，无需兜底 computedValues
  /** webkitLineClamp */

  /** opacity */
  if (!opacity) {
    opacity = 1
  }
  /** opacity */

  /** zindex */
  // zIndex 不兜底 computedValues（auto 无意义），未设置时保持 undefined
  /** zindex */

  /** rotation */
  // transform 不兜底 computedValues（计算值为 matrix，无法回显为角度），未设置时保持 undefined
  /** rotation */

  /** layout */
  // 若 CSS 规则里没有显式设置这些属性，则从 computedValues 读取当前计算值作为回显基准。
  // position 默认为 'static'（浏览器计算值），回显时直接使用即可。
  if (!display) { display = computedValues.display }
  if (!flexDirection) { flexDirection = computedValues.flexDirection }
  if (!alignItems) { alignItems = computedValues.alignItems }
  if (!justifyContent) { justifyContent = computedValues.justifyContent }
  if (!flexWrap) { flexWrap = computedValues.flexWrap }
  // 浏览器对非 flex/grid 容器的 gap 计算值是 'normal'，InputNumber 无法解析，统一归零
  if (!rowGap || rowGap === 'normal') { rowGap = computedValues.rowGap === 'normal' ? '0px' : (computedValues.rowGap || '0px') }
  if (!columnGap || columnGap === 'normal') { columnGap = computedValues.columnGap === 'normal' ? '0px' : (computedValues.columnGap || '0px') }
  if (!position) { position = computedValues.position }
  if (!overflow) { overflow = computedValues.overflow }
  /** layout */

  const rawValues = {
    color, fontSize, textAlign, fontWeight, lineHeight, fontFamily, letterSpacing, whiteSpace, textDecoration, fontStyle, textTransform,
    paddingTop, paddingRight, paddingBottom, paddingLeft,
    marginTop, marginRight, marginBottom, marginLeft,
    backgroundColor, backgroundImage, width, height,
    borderTopColor, borderTopStyle, borderTopWidth, borderTopLeftRadius,
    boxShadow, opacity, display, position,
  }

  const result = getRealValue({
    color,
    fontSize,
    textAlign,
    fontWeight,
    lineHeight,
    fontFamily,
    letterSpacing,
    whiteSpace,

    paddingTop,
    paddingRight,
    paddingBottom,
    paddingLeft,

    marginTop,
    marginRight,
    marginBottom,
    marginLeft,

    backgroundColor,
    backgroundImage,
    backgroundRepeat,
    backgroundPosition,
    backgroundSize,
    backgroundOrigin,
    backgroundClip,

    borderTopColor,
    borderBottomColor,
    borderLeftColor,
    borderRightColor,
    borderTopLeftRadius,
    borderTopRightRadius,
    borderBottomRightRadius,
    borderBottomLeftRadius,
    borderTopStyle,
    borderRightStyle,
    borderBottomStyle,
    borderLeftStyle,
    borderTopWidth,
    borderBottomWidth,
    borderLeftWidth,
    borderRightWidth,

    width,
    height,
    maxWidth,
    maxHeight,
    minWidth,
    minHeight,

    cursor,

    boxShadow,

    filter,
    backdropFilter,
    WebkitBackdropFilter: webkitBackdropFilter || backdropFilter,

    overflowX,
    overflowY,

    textOverflow,
    webkitLineClamp,
    textDecoration,
    fontStyle,
    textTransform,
    webkitTextFillColor,
    WebkitTextFillColor: webkitTextFillColor,
    webkitBackgroundClip,
    WebkitBackgroundClip: webkitBackgroundClip || backgroundClip,

    opacity,

    zIndex,

    transform,

    display,
    flexDirection,
    alignItems,
    justifyContent,
    flexWrap,
    rowGap,
    columnGap,
    position,
    overflow,
  }, computedValues)

  return result
}

// 修改getStyleRules函数以更好地处理伪类选择器

/** CSS Modules 哈希类名：规则末尾 class 必须属于当前 element，避免 ant-*-title 误匹配 .title */
function ruleLastClassBelongsToElement (
  element: HTMLElement | null,
  ruleLast: string,
  selLast: string
): boolean {
  if (!element) {
    return ruleLast === selLast || ruleLast.endsWith('-' + selLast)
  }
  const elementHasTargetClass = Array.from(element.classList).some(
    c => c === selLast || c.endsWith('-' + selLast)
  )
  if (elementHasTargetClass) {
    // element 已在目标类上（如 xxx--title）：规则末尾 class 必须精确归属该 element
    return Array.from(element.classList).some(c => c === ruleLast)
  }
  // 编辑尚未激活的状态类（如 formTabActive）：element 不含目标 class，保留 endsWith 宽松匹配
  return ruleLast === selLast || ruleLast.endsWith('-' + selLast)
}

function getStyleRules (element: HTMLElement | null, selector: string | null): { rules: CSSStyleRule[], inheritOnlyRules: Set<CSSStyleRule> } {
  const finalRules: CSSStyleRule[] = [] // 最终返回的规则
  // 标记哪些规则是"父级继承来源"——这些规则命中的原因是子元素（如 span）继承了父级样式，
  // getValues 中对这些规则只读可继承属性（color/font 系列），跳过 display/padding 等非继承属性。
  const inheritOnlyRules = new Set<CSSStyleRule>()
  const root = getDocument()
  const PSEUDO_REGEX = /(:{1,2}[a-zA-Z\-]+(?:\([^)]*\))?)$/    // 匹配选择器末尾的伪类/伪元素部分 如 :hover等


  // 提取目标 selector 末尾的伪类部分（如 :hover、:active、::before）
  const selectorPseudoMatch = selector ? selector.match(PSEUDO_REGEX) : null
  const selectorPseudo = selectorPseudoMatch ? selectorPseudoMatch[0] : null

  const isPseudoSelector = !!selectorPseudo
  const hasRealDom      = !!element

  // 预判：DOM 是否不处于 selector 描述的状态
  // 条件：无 CSS 伪类、有真实 DOM、selector 末尾段的某个 class 不在 element.classList 里
  // 典型场景1（复合类）：selector=".ant-tabs-tab.ant-tabs-tab-active"，DOM 只有 .ant-tabs-tab
  // 典型场景2（状态类）：selector=".formTabs .formTabActive"，DOM 只有 formTab（非激活项）
  // 这类情况下 element.matches 必然失败，需走字符串 endsWith 匹配来找激活态 CSS 规则
  const isStateSelector = !isPseudoSelector && hasRealDom && !!selector && (() => {
    const lastSeg = selector.trim().split(/\s+/).pop() || selector
    const classesInSel = (lastSeg.match(/\.([^.#\[:]+)/g) ?? []).map(c => c.slice(1))
    return classesInSel.length >= 1 && classesInSel.some(c => !element!.classList.contains(c))
  })()

  for (let i = 0; i < root.styleSheets.length; i++) {
    try {
      const sheet = root.styleSheets[i]
      const rules = sheet.cssRules ? sheet.cssRules : sheet.rules

      for (let j = 0; j < rules.length; j++) {
        const rule = rules[j]
        if (!(rule instanceof CSSStyleRule)) continue
        const { selectorText } = rule

        // ─── 情况1：编辑伪类态 + 有真实DOM ────────────────────────────────────
        // 例：selector=".mainBtn:hover"，element=<div class="mainBtn">
        // 策略：规则的伪类必须与目标相同，再剥掉伪类用 element.matches 验证基础选择器
        // 兜底（情况1.5）：selector 末尾段是纯标签名（如 span:hover），element 为该标签，
        // element.matches('.actionItem') 必然失败，但 span 会从父级 .actionItem:hover 继承，
        // 需把父级 :hover 规则纳入并标记 inheritOnly。
        if (isPseudoSelector && hasRealDom) {
          const rulePseudoMatch = selectorText.match(PSEUDO_REGEX)
          const rulePseudo = rulePseudoMatch ? rulePseudoMatch[0] : null
          if (rulePseudo !== selectorPseudo) continue
          const ruleBase = selectorText.slice(0, selectorText.length - (rulePseudo?.length ?? 0)).trim()
          let matched = false
          try {
            if (element.matches(ruleBase)) {
              finalRules.push(rule)
              matched = true
            }
          } catch {}
          // 情况1.5：末尾段是纯标签名时的父级伪类兜底
          if (!matched && selector) {
            const segs1 = selector.trim().split(/\s+/)
            const lastSeg1 = segs1[segs1.length - 1]
            const lastSeg1Base = lastSeg1.replace(/:{1,2}[a-zA-Z\-]+(\([^)]*\))?$/, '')
            const lastSeg1IsTag = /^[a-z][a-zA-Z0-9]*$/.test(lastSeg1Base)
            if (lastSeg1IsTag && segs1.length >= 2) {
              const parentSel1     = segs1.slice(0, -1).join(' ')
              const parentLastSeg1 = segs1[segs1.length - 2]
              const parentFull1    = parentSel1 + (selectorPseudo ?? '')
              const parentLast1    = parentLastSeg1 + (selectorPseudo ?? '')
              const isParentFull1  = selectorText === parentFull1 || selectorText.endsWith(' ' + parentFull1)
              const isParentLast1  = selectorText === parentLast1 || selectorText.endsWith(' ' + parentLast1)
              if (isParentFull1 || isParentLast1) {
                finalRules.push(rule)
                inheritOnlyRules.add(rule)
              }
            }
          }
          continue
        }

        // ─── 情况2：伪类态 + 无真实DOM ──────────────────────────────────────
        // 例：selector=".ant-btn:not(:disabled):hover"，element=null
        // 兼容带作用域前缀的用户规则和 antd 注入的全局规则
        // 同时支持末尾段匹配（样式表编译后路径与 selector 中间路径不同时兜底）
        if (isPseudoSelector && !hasRealDom && selector) {
          const isGlobalRule = selectorText === selector
          const isScopedRule = selectorText.endsWith(' ' + selector)
          const lastSeg = selector.trim().split(/\s+/).pop() || selector
          const isLastSegMatch = selectorText === lastSeg || selectorText.endsWith(' ' + lastSeg)

          // 父级伪类兜底（element=null 分支）：当末尾段是 "纯标签名:伪类"（如 "span:hover"）时，
          // 向上回溯父级末尾段 + 相同伪类（如 ".actionItem:hover"），将父级规则纳入，
          // 并标记为 inheritOnlyRules，getValues 只从中读取可继承属性。
          // 注：element 存在时同等逻辑由情况1.5 处理。
          let isParentPseudoMatch = false
          const lastSegBase   = lastSeg.replace(/:{1,2}[a-zA-Z\-]+(\([^)]*\))?$/, '')
          const lastSegPseudo = (lastSeg.match(/(:{1,2}[a-zA-Z\-]+(?:\([^)]*\))?)$/) || [])[1] || ''
          const lastSegIsTag  = /^[a-z][a-zA-Z0-9]*$/.test(lastSegBase)
          if (lastSegIsTag && lastSegPseudo) {
            const segs          = selector.trim().split(/\s+/)
            const parentSel     = segs.length > 1 ? segs.slice(0, -1).join(' ') : null
            const parentLastSeg = parentSel ? (parentSel.trim().split(/\s+/).pop() || parentSel) : null
            const parentFull    = parentSel     ? parentSel     + lastSegPseudo : null
            const parentLast    = parentLastSeg ? parentLastSeg + lastSegPseudo : null
            if (
              (parentFull && (selectorText === parentFull || selectorText.endsWith(' ' + parentFull))) ||
              (parentLast && (selectorText === parentLast || selectorText.endsWith(' ' + parentLast)))
            ) {
              isParentPseudoMatch = true
            }
          }

          if (isGlobalRule || isScopedRule || isLastSegMatch) {
            finalRules.push(rule)
          } else if (isParentPseudoMatch) {
            finalRules.push(rule)
            inheritOnlyRules.add(rule)
          }
          continue
        }

        // ─── 情况2.5：DOM 不处于目标状态（状态类/复合类）────────────────────
        // 例：selector=".formTabs .formTabActive"，element=<div class="formTab">（非激活项）
        // element.matches 对该 DOM 必然失败，改用 selector 末尾段做 endsWith 字符串匹配。
        // 用末尾段而非完整路径，是因为用户的 LESS 可能写扁平规则（.formTabActive），
        // 编译后 selectorText 不含中间层级，完整路径无法 endsWith 命中。
        // 同时过滤含伪类的规则，避免 .formTabActive:hover 等混入。
        if (isStateSelector && selector) {
          // 多文件 :where() 作用域规则：从末尾类名最后一个 '-' 截取真实类名与 selector 比对
          // 格式：:where(.u_wYqS8) .pages_StoreDecoration_index_less-pageContainer
          if (/^:where\(/.test(selectorText) && element) {
            const lastPart = selectorText.trim().split(/\s+/).pop() || ''
            const classWithoutDot = lastPart.replace(/^\./, '')
            const selectorLastClass = (selector.trim().split(/\s+/).pop() || selector).replace(/^\./, '')
            // 原始类名可能含连字符（如 frame-216），不能只取 lastIndexOf('-') 后面的部分
            // 改用 endsWith 检查：hashed class 以 "-{originalClass}" 结尾
            // 复合选择器（如 "bubble.aiBubble"）时，额外用最后一个 class token（"aiBubble"）回退，
            // 以便 CSS 只写了 .aiBubble（单类）时也能命中
            const lastToken = selectorLastClass.includes('.')
              ? (selectorLastClass.split('.').filter(Boolean).pop() ?? selectorLastClass)
              : selectorLastClass
            const isClassMatch = classWithoutDot === selectorLastClass ||
              classWithoutDot.endsWith('-' + selectorLastClass) ||
              (selectorLastClass !== lastToken && (
                classWithoutDot === lastToken || classWithoutDot.endsWith('-' + lastToken)
              ))
            if (isClassMatch) {
              try {
                if (element.matches(selectorText)) finalRules.push(rule)
              } catch {}
            }
            continue
          }

          const lastSeg = selector.trim().split(/\s+/).pop() || selector
          if (!/:[a-zA-Z\-]/.test(selectorText)) {
            const isGlobalRule = selectorText === lastSeg
            const isScopedRule = selectorText.endsWith(' ' + lastSeg)
            // 复合 selector（如 ".bubble.aiBubble"）时，CSS 只写单类（如 .aiBubble / .u_xxx .aiBubble）
            // 也应命中：用最后一个 class token 做 scoped 检查
            const lastSegLastToken = lastSeg.includes('.')
              ? ('.' + (lastSeg.split('.').filter(Boolean).pop() ?? ''))
              : lastSeg
            const isScopedRuleByLastToken = lastSeg !== lastSegLastToken && (
              selectorText === lastSegLastToken || selectorText.endsWith(' ' + lastSegLastToken)
            )

            // CSS Modules 哈希类名回退：编译后类名格式为 "{moduleHash}-{originalClass}"
            // isStateSelector 语义即"元素当前不在该状态"，element.matches 必然失败，
            // 只用末尾类名 endsWith 判断即可，无需 element.matches 守卫
            //
            // 同时支持复合选择器两种情形：
            // 情形A（CSS 也是复合）：".bubble.aiBubble" → ".pages_xxx-bubble.pages_xxx-aiBubble"
            //   → 按 '.' 拆分后对每段分别做 endsWith 匹配
            // 情形B（CSS 只有单类）：selector=".bubble.aiBubble"，CSS 只有 ".aiBubble"
            //   → 用复合 selector 的最后一个 class token（"aiBubble"）做回退匹配
            //   → 语义：".aiBubble" 规则是 ".bubble.aiBubble" 状态的"定态类"，应当包含
            let isHashedModuleMatch = false
            if (!isGlobalRule && !isScopedRule) {
              const ruleLast = (selectorText.split(/\s+/).pop() || '').replace(/^\./, '')
              const selLast = lastSeg.replace(/^\./, '')
              if (ruleLast === selLast || ruleLast.endsWith('-' + selLast)) {
                isHashedModuleMatch = ruleLastClassBelongsToElement(element, ruleLast, selLast)
              } else if (selLast.includes('.')) {
                const ruleClasses = ruleLast.split('.').filter(Boolean)
                const selClasses = selLast.split('.').filter(Boolean)
                if (ruleClasses.length === selClasses.length && selClasses.length > 1) {
                  // 情形A：CSS Modules 编译后的复合选择器，token 数相同，逐段匹配
                  isHashedModuleMatch = selClasses.every((sClass, i) => {
                    const rClass = ruleClasses[i]
                    return rClass === sClass || ruleLastClassBelongsToElement(element, rClass, sClass)
                  })
                }
                if (!isHashedModuleMatch && ruleClasses.length === 1) {
                  // 情形B：CSS 只写了单类（如 .aiBubble），用复合 selector 末尾 token 回退
                  const lastSelClass = selClasses[selClasses.length - 1]
                  isHashedModuleMatch = ruleLastClassBelongsToElement(element, ruleLast, lastSelClass)
                }
              }
            }

            if (isGlobalRule || isScopedRule || isScopedRuleByLastToken || isHashedModuleMatch) {
              finalRules.push(rule)
            }
          }
          continue
        }

        // ─── 情况2.7：无真实DOM + 无伪类（默认态，DOM 不在页面中）────────────
        // 例：selector=".userActions .actionItem span"，element=null
        // targetDom 未传入时通过末尾段做字符串匹配找 CSS 规则；
        // 若末尾段是纯标签名（如 span），还会向上找父级规则（如 .actionItem）
        // 并标记为 inheritOnly，getValues 只从中读取可继承属性。
        if (!hasRealDom && !isPseudoSelector && selector) {
          const segs    = selector.trim().split(/\s+/)
          const lastSeg = segs[segs.length - 1]
          if (!/:[a-zA-Z\-]/.test(selectorText)) {
            const isGlobalRule = selectorText === lastSeg
            const isScopedRule = selectorText.endsWith(' ' + lastSeg)
            if (isGlobalRule || isScopedRule) {
              finalRules.push(rule)
            } else {
              const lastSegIsTag  = /^[a-z][a-zA-Z0-9]*$/.test(lastSeg)
              if (lastSegIsTag && segs.length >= 2) {
                const parentSel     = segs.slice(0, -1).join(' ')
                const parentLastSeg = segs[segs.length - 2]
                const isParentFull  = selectorText === parentSel     || selectorText.endsWith(' ' + parentSel)
                const isParentLast  = selectorText === parentLastSeg || selectorText.endsWith(' ' + parentLastSeg)
                if (isParentFull || isParentLast) {
                  finalRules.push(rule)
                  inheritOnlyRules.add(rule)
                }
              }
            }

          }
          continue
        }

        // ─── 情况2.9：有真实DOM + 无伪类 + 末尾段是纯标签名（如 span）──────
        // 例：selector=".userActions .actionItem span"，element=<span>
        // span 无 class，情况3 的 element.matches('.actionItem') 必然失败；
        // 向上找父级规则（如 .actionItem），纳入 finalRules 并标记为 inheritOnly，
        // getValues 只从中提取 color/font 等可继承属性，display/padding 等不会带入。
        // 注：有伪类时（如 span:hover）同等逻辑由情况1.5 处理。
        if (hasRealDom && !isPseudoSelector && !isStateSelector && selector) {
          const segs29   = selector.trim().split(/\s+/)
          const lastSeg29 = segs29[segs29.length - 1]
          const lastSegIsTag29 = /^[a-z][a-zA-Z0-9]*$/.test(lastSeg29)
          if (lastSegIsTag29 && segs29.length >= 2) {
            if (!/:[a-zA-Z\-]/.test(selectorText)) {
              const parentSel29     = segs29.slice(0, -1).join(' ')
              const parentLastSeg29 = segs29[segs29.length - 2]
              const isParentFull29  = selectorText === parentSel29 || selectorText.endsWith(' ' + parentSel29)
              const isParentLast29  = selectorText === parentLastSeg29 || selectorText.endsWith(' ' + parentLastSeg29)
              if (isParentFull29 || isParentLast29) {
                finalRules.push(rule)
                inheritOnlyRules.add(rule)
                continue
              }
            }
          }
        }

        // ─── 情况3：默认态（selector 无伪类，DOM 处于该状态）────────────────
        // 例：selector=".tabItem"，element=<div class="tabItem">
        // 过滤①：跳过含伪类的规则，防止 :has()、:hover 等全局规则混入
        if (/:[a-zA-Z\-]/.test(selectorText)) continue

        // 过滤②：element.matches 会命中 DOM 上所有类的规则，
        // 需确认规则末尾 class token 与 selector 末尾 class token 一致，
        // 防止 ".tabItem.active" 在编辑 ".tabItem" 默认态时被误纳入
        try {
          if (!element || !element.matches(selectorText) || !selector) continue
          const lastSegment      = selectorText.split(' ').pop() || selectorText
          const classTokens      = lastSegment.split('.').filter(Boolean)
          const lastToken        = classTokens.length > 0 ? '.' + classTokens[classTokens.length - 1] : lastSegment
          const selectorLastSeg  = selector.split(' ').pop() || selector
          const selectorTokens   = selectorLastSeg.split('.').filter(Boolean)
          const selectorLastToken = selectorTokens.length > 0 ? '.' + selectorTokens[selectorTokens.length - 1] : selectorLastSeg
          if (lastToken === selectorLastToken) {
            finalRules.push(rule)
          }
        } catch {}
      }
    } catch {}
  }
  return { rules: finalRules, inheritOnlyRules }
}

// TODO: 之后的主题配置，按理说所有编辑器均需要做好兼容
function getRealValue(style: any, computedValues: CSSStyleDeclaration) {
  const finalStyle: any = {}

  Object.keys(style).forEach((key) => {
    const value = style[key]
    if (typeof value === 'string') {
      if (value.startsWith('var(')) {
        // 保留 var() 引用，让 ColorEditor 能识别并回显变量名
        finalStyle[key] = value
      } else {
        finalStyle[key] = value
      }
    } else {
      finalStyle[key] = value
    }
  })

  return finalStyle
}


const PANEL_MAP: Record<string, string> = {};
Object.keys(getDefaultValueFunctionMap2).forEach(panelType => {
  // @ts-ignore
  const properties = getDefaultValueFunctionMap2[panelType]();
  Object.keys(properties).forEach(property => {
    PANEL_MAP[property] = panelType
  })
})
/**
 * @description 从 css rules 中获取当前生效的插件，用于展示插件的是否默认折叠
 */
function cssRuleStyleToBag (style: CSSStyleDeclaration): Record<string, any> {
  const bag: Record<string, any> = {}
  // 遍历 style 声明，供文字渐变归属 / 边框空值判断使用
  for (let i = 0; i < style.length; i++) {
    const kebab = style[i]
    const camel = toHump(kebab)
    const val = style.getPropertyValue(kebab)
    if (val) bag[camel] = val
  }
  const webkitClip = style.getPropertyValue('-webkit-background-clip')
  const webkitFill = style.getPropertyValue('-webkit-text-fill-color')
  if (webkitClip) {
    bag.WebkitBackgroundClip = webkitClip
    if (!bag.backgroundClip) bag.backgroundClip = webkitClip
  }
  if (webkitFill) bag.WebkitTextFillColor = webkitFill
  return bag
}

/** 长度是否为 0（0 / 0px / 0%） */
function isZeroCssLength (value?: string): boolean {
  if (value == null || value === '') return true
  const s = String(value).trim().toLowerCase()
  return s === '0' || s === '0px' || s === '0%' || s === '0em' || s === '0rem'
}

/**
 * 边框面板是否「真正有内容」：
 * 点 - 号后会残留 border: 0px none ... / border-radius: 0px，
 * 这些不应再把边框面板算作生效（否则无法折叠）。
 */
function isBorderPanelMeaningfullyUsed (styleBag: Record<string, any> = {}): boolean {
  if (decomposeBackgroundStack(styleBag).borderLayer) return true

  const sides = ['Top', 'Right', 'Bottom', 'Left'] as const
  for (const side of sides) {
    const width = styleBag[`border${side}Width`]
    const style = styleBag[`border${side}Style`]
    if (!isZeroCssLength(width) && style && style !== 'none' && style !== 'hidden') {
      return true
    }
  }

  // shorthand: border / borderTop ...
  for (const key of ['border', 'borderTop', 'borderRight', 'borderBottom', 'borderLeft']) {
    const raw = styleBag[key]
    if (typeof raw !== 'string' || !raw.trim()) continue
    const s = raw.trim().toLowerCase()
    if (s === 'none' || s === '0' || s === '0px') continue
    // 0px none ... / none 0px ... → 视为已清除
    if (/^0(px)?\s+none\b/.test(s) || /^none\b/.test(s)) continue
    // 含非 0 宽度或非 none 的 style 才算有边框
    if (!/\b0(px)?\b/.test(s) || !/\bnone\b/.test(s)) {
      // 更严谨：若同时出现 0 宽度和 none，跳过；否则有实质边框
      const hasNone = /\bnone\b/.test(s)
      const hasZeroWidth = /(?:^|\s)0(?:px)?(?:\s|$)/.test(s)
      if (!(hasNone && hasZeroWidth)) return true
    }
  }

  for (const key of [
    'borderTopLeftRadius',
    'borderTopRightRadius',
    'borderBottomRightRadius',
    'borderBottomLeftRadius',
    'borderRadius',
  ]) {
    const raw = styleBag[key]
    if (raw == null || raw === '') continue
    // border-radius: 0 / 0px / 0px 0px 0px 0px
    const parts = String(raw).trim().split(/\s+/)
    if (parts.some((p) => !isZeroCssLength(p))) return true
  }

  const outline = styleBag.outline
  if (outline && outline !== 'none' && outline !== '0' && outline !== '0px') {
    const o = String(outline).toLowerCase()
    if (!(o.includes('none') && /(?:^|\s)0(?:px)?(?:\s|$)/.test(o))) {
      return true
    }
  }

  return false
}

/** 属性值是否等价于该面板空白基准（或对边框面板无视觉意义） */
function isMeaninglessStylePropForPanel (
  property: string,
  value: any,
  mappedPanel: string | undefined,
  styleBag: Record<string, any>
): boolean {
  if (value === null || value === undefined || value === '') return true
  const str = String(value).replace(/!important/gi, '').trim()
  if (!str) return true

  // 对照各面板空白基准
  // @ts-ignore
  const emptyBag = mappedPanel ? getDefaultValueFunctionMap2[mappedPanel]?.() : null
  if (emptyBag && property in emptyBag) {
    const emptyVal = emptyBag[property]
    const normalize = (v: any) => {
      if (v === '' || CSS_TRIVIAL_VALUES.has(v)) return null
      if (v === 'rgba(0, 0, 0, 0)' || v === 'rgba(0,0,0,0)') return null
      return String(v).replace(/\s+/g, '').toLowerCase()
    }
    if (normalize(str) === normalize(emptyVal)) return true
  }

  if (mappedPanel === 'border' || mappedPanel === 'appearance') {
    // 边框/圆角相关：单独无意义的颜色、0 宽度、none style 不算
    if (/^border(Top|Right|Bottom|Left)?Color$/i.test(property)) {
      return !isBorderPanelMeaningfullyUsed(styleBag)
    }
    if (/Width$/i.test(property) && /border/i.test(property)) {
      return isZeroCssLength(str)
    }
    if (/Style$/i.test(property) && /border/i.test(property)) {
      return str === 'none' || str === 'hidden'
    }
    if (/Radius$/i.test(property) || property === 'borderRadius') {
      return String(str).split(/\s+/).every((p) => isZeroCssLength(p))
    }
    if (
      property === 'border' ||
      property === 'borderTop' ||
      property === 'borderRight' ||
      property === 'borderBottom' ||
      property === 'borderLeft'
    ) {
      const s = str.toLowerCase()
      if (s === 'none') return true
      const hasNone = /\bnone\b/.test(s)
      const hasZeroWidth = /(?:^|\s)0(?:px)?(?:\s|$)/.test(s)
      return hasNone && hasZeroWidth
    }
  }

  return false
}

function getEffectedPanelsFromCssRules (rules: CSSStyleRule[]) {
  let effectedPanels = new Set<string>();
  rules.filter(rule => {
    if (rule.selectorText.indexOf('.desn-') === 0 && rule.selectorText.indexOf('*') > -1) {
      return false
    }
    return true
  }).forEach(rule => {
    const styleBag = cssRuleStyleToBag(rule.style)
    rule.styleMap.forEach((cssVal, key) => {
      const camel = toHump(key)
      const rawVal =
        typeof (cssVal as any)?.toString === 'function'
          ? (cssVal as any).toString()
          : styleBag[camel]
      const mapped = PANEL_MAP[camel]
      if (isMeaninglessStylePropForPanel(camel, rawVal, mapped, styleBag)) {
        return
      }
      const panel = refineEffectedPanel(camel, mapped, styleBag)
      if (panel) {
        // 边框面板额外总检：全是 0/none 残留时不展开
        if (panel === 'border' && !isBorderPanelMeaningfullyUsed(styleBag)) {
          return
        }
        effectedPanels.add(panel)
      }
    })
  })
  return Array.from(effectedPanels)
}

// CSS "无语义"值集合：这些值等价于"未设置"，不应触发 inherited 展开态
// 供 UA 检测（normalize）和父级规则扫描（getEffectedPanelsFromDirectParent）共用
const CSS_TRIVIAL_VALUES = new Set([
  'none', 'normal', 'auto', 'initial', 'unset', 'revert',
  'default', // cursor 特有的无语义默认值
  'transparent', // 颜色透明值，语义上等同于未设置
])

// CSS 规范中默认可继承的属性（驼峰），用于祖先规则扫描时过滤出真正会向下传递的属性
const CSS_INHERITABLE_PROPS = new Set([
  'color', 'fontSize', 'fontWeight', 'fontFamily', 'fontStyle', 'fontVariant',
  'lineHeight', 'letterSpacing', 'textAlign', 'textIndent', 'textTransform',
  'whiteSpace', 'wordSpacing', 'cursor', 'visibility', 'direction',
  'listStyleType', 'listStylePosition', 'listStyleImage',
  'borderCollapse', 'borderSpacing', 'captionSide', 'emptyCells',
]);

/**
 * 扫描直接父元素上命中的 CSS 可继承属性，返回对应的面板名列表。
 * 用于判断面板是否因父级样式继承而展开（显示为 inherited 无减号状态）。
 * 只看一层，避免 .container 等远距离根容器的通用样式影响所有后代。
 */
function getEffectedPanelsFromDirectParent (element: HTMLElement, comId?: string): string[] {
  const panelsSet = new Set<string>();
  const parent = element.parentElement;

  if (!parent || parent.id === comId || parent === document.body) {
    return [];
  }

  const root = getDocument();
  for (let i = 0; i < root.styleSheets.length; i++) {
    try {
      const rules = root.styleSheets[i].cssRules ?? (root.styleSheets[i] as any).rules;
      for (let j = 0; j < rules.length; j++) {
        const rule = rules[j];
        if (!(rule instanceof CSSStyleRule)) continue;
        if (/:[a-zA-Z\-]/.test(rule.selectorText)) continue;
        if (!parent.matches(rule.selectorText)) continue;

        rule.styleMap.forEach((val: any, key: string) => {
          const camelKey = toHump(key);
          if (CSS_INHERITABLE_PROPS.has(camelKey) && PANEL_MAP[camelKey]) {
            const rawVal = typeof val?.toString === 'function' ? val.toString().trim() : String(val).trim();
            if (!CSS_TRIVIAL_VALUES.has(rawVal)) {
              panelsSet.add(PANEL_MAP[camelKey]);
            }
          }
        });
      }
    } catch {}
  }

  return Array.from(panelsSet);
}