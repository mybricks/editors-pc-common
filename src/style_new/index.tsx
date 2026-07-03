import React, {CSSProperties, useCallback, useMemo, useRef, useState,useEffect} from 'react'
import {createPortal} from "react-dom";

// @ts-ignore
import colorUtil from 'color-string'
// @ts-ignore
import {toCSS, toJSON} from 'cssjson';
// @ts-ignore
import {calculate, compare} from 'specificity';

import {message, Tooltip} from "antd";

import {AppstoreOutlined, CaretRightOutlined, CodeOutlined, CopyOutlined, ReloadOutlined,DeleteOutlined} from '@ant-design/icons'
// @ts-ignore
import MonacoEditor from "@mybricks/code-editor";

import {copyText, deepCopy} from '../utils'
import StyleEditor, {DEFAULT_OPTIONS, StyleEditorProvider} from './StyleEditor'

import {getSuggestOptionsByElement, mergeCSSProperties, splitCSSProperties} from './StyleEditor/helper'
import {
  initLiveStyle,
  preserveGradientBorderLayer,
} from './StyleEditor/helper/gradient-border'

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
  }, [open, editMode, titleContent])

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

  // zoneSelectorList 变化（targetDom / 伪类扫描结果更新）时，重置激活下标到第 0 项
  useEffect(() => {
    setActiveZoneIdx(0)
  }, [zoneSelectorList])

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
        <Style editConfig={resolvedEditConfig} {...activeStyleProps}/>
      )
    } else {
      return (
        <CssEditor {...editConfig} selector={':root'} onChange={(value: any) => {
          // console.log("value",value)
          editConfig.value.set(deepCopy(value))
        }}/>
      )
    }
  }, [editMode, key, activeZoneIdx])

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
        {zoneSelectorList.length > 0 && zoneTabBar}
        {zoneSelectorList.length > 0 && affectedCount !== null && affectedCount > 1 && (
          <div className={css.affectedHint} style={{marginTop: zoneSelectorList.length > 1 ? '10px' : '0'}}>
            修改当前样式会影响 {affectedCount} 个区域
          </div>
        )}
        {title}
        <div key={`${key}_${activeZoneIdx}`} style={{display: open ? 'block' : 'none'}}>
          {show && editor}
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

function Style ({editConfig, options, setValue, collapsedOptions, readonlyExpandedOptions, autoCollapseWhenUnusedProperty, finnalExcludeOptions, defaultValue }: StyleProps) {
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
    const changeItems = preserveGradientBorderLayer(
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

    //在这里把selector放在了第二个参数
    // console.log("编辑器透传selector",selector)
    // debugger
    editConfig.value.set(mergedCssProperties, selector ? { selector } : undefined)
  }, [editConfig, options, collapsedOptions])

  const editorContext = useMemo(() => {
    const dom = (!editConfig.options || Array.isArray(editConfig.options))
      ? null
      : (editConfig.options as any).targetDom ?? null
    const realDom = (
      Object.prototype.toString.call(dom) === '[object NodeList]' && dom?.length
        ? dom[0]
        : dom
    ) as HTMLElement | null
    return {
      editConfig,
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

      effctedOptions = options;
      effectedFromRulesOnly = ownRulesPanels as string[] ?? [];
      effectedFromAncestorsOnly = ancestorPanels as string[] ?? [];
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
  Object.keys(splitedSetValue).forEach(property => {
    if (PANEL_MAP[property]) {
      setValueEffectedPanels.add(PANEL_MAP[property])
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
  boxshadow(values: CSSProperties, config: any) {
    return {
      boxShadow: values.boxShadow
    }
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
  boxshadow() {
    return {
      boxShadow: 'none'
    }
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

    // ── 内联 style 补丁：展开面板 + 用 element.style 原始值覆盖 ────────────────
    // 背景：element.style 里的属性不在任何 CSSStyleRule 中，
    //       getEffectedPanelsFromCssRules 无法感知，对应面板会保持折叠。
    //       同时 getValues 对 width/height 等属性使用静态 'auto' 兜底，
    //       会丢失内联 style 的真实值。
    const inlineEffectedPanels: string[] = [];
    if (element && element.style.length > 0) {
      for (let i = 0; i < element.style.length; i++) {
        const kebabProp = element.style[i];
        const camelProp = toHump(kebabProp);
        const panel = PANEL_MAP[camelProp];
        if (panel && !inlineEffectedPanels.includes(panel)) {
          inlineEffectedPanels.push(panel);
        }
        const inlineVal = element.style.getPropertyValue(kebabProp);
        if (inlineVal) {
          (values as any)[camelProp] = inlineVal;
        }
      }
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
  let backgroundClip // 非继承属性
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

    /** webkitLineClamp */
    const styleWebkitLineClamp = style.webkitLineClamp
    if (styleWebkitLineClamp) {
      webkitLineClamp = styleWebkitLineClamp
    }
    /** webkitLineClamp */

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
  if (!isVarRef(backgroundColor) && (!backgroundColor || !colorUtil.get(backgroundColor))) {
    backgroundColor = computedValues.backgroundColor
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
    color, fontSize, textAlign, fontWeight, lineHeight, fontFamily, letterSpacing, whiteSpace, textDecoration,
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

    overflowX,
    overflowY,

    textOverflow,
    webkitLineClamp,
    textDecoration,

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
                isHashedModuleMatch = true
              } else if (selLast.includes('.')) {
                const ruleClasses = ruleLast.split('.').filter(Boolean)
                const selClasses = selLast.split('.').filter(Boolean)
                if (ruleClasses.length === selClasses.length && selClasses.length > 1) {
                  // 情形A：CSS Modules 编译后的复合选择器，token 数相同，逐段匹配
                  isHashedModuleMatch = selClasses.every((sClass, i) => {
                    const rClass = ruleClasses[i]
                    return rClass === sClass || rClass.endsWith('-' + sClass)
                  })
                }
                if (!isHashedModuleMatch && ruleClasses.length === 1) {
                  // 情形B：CSS 只写了单类（如 .aiBubble），用复合 selector 末尾 token 回退
                  const lastSelClass = selClasses[selClasses.length - 1]
                  isHashedModuleMatch = ruleLast === lastSelClass || ruleLast.endsWith('-' + lastSelClass)
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
function getEffectedPanelsFromCssRules (rules: CSSStyleRule[]) {
  let effectedPanels = new Set();
  rules.filter(rule => {
    if (rule.selectorText.indexOf('.desn-') === 0 && rule.selectorText.indexOf('*') > -1) {
      return false
    }
    return true
  }).forEach(rule => {
    rule.styleMap.forEach((_, key) => {
      if (PANEL_MAP[toHump(key)]) {
        effectedPanels.add(PANEL_MAP[toHump(key)])
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