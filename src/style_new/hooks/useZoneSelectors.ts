import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

import { getDocument } from '../core/dom'
import { elMatchesSelectorTail } from '../core/css-modules-match'
import { scanPseudoSelectors } from '../core/scan-pseudo-selectors'

export function useZoneSelectors(editConfig: any, targetDom: any, open: boolean) {
  const [pseudoSelectorList, setPseudoSelectorList] = useState<string[]>([])
  const [activeZoneIdx, setActiveZoneIdx] = useState(0)
  // 用户手动点 tab 后，禁止被「按 DOM class 对齐」立刻打回基础态（:hover / 状态类等）
  const userSelectedRef = useRef(false)

  const comId = useMemo(() => {
    if (!editConfig.options || Array.isArray(editConfig.options)) return ''
    return (editConfig.options as any).comId ?? ''
  }, [editConfig])

  // 换选中元素时，恢复自动对齐
  useEffect(() => {
    userSelectedRef.current = false
  }, [targetDom])

  useEffect(() => {
    if (!open) return

    // 提取基础选择器列表（不含伪类的条目）
    const domList =
      Object.prototype.toString.call(targetDom) === '[object NodeList]'
        ? Array.from(targetDom as NodeList)
        : targetDom
          ? [targetDom as Element]
          : []

    const baseSelectors: string[] = []
    for (const dom of domList as Element[]) {
      const raw = dom?.getAttribute?.('data-zone-selector')
      if (raw) {
        try {
          const parsed: string[] = JSON.parse(raw)
          if (Array.isArray(parsed)) {
            parsed.forEach((s) => {
              // 只取不含伪类的基础选择器
              if (!s.includes(':') && !baseSelectors.includes(s)) {
                baseSelectors.push(s)
              }
            })
          }
        } catch {}
      }
    }

    setPseudoSelectorList((prev) => {
      const next = scanPseudoSelectors(baseSelectors, comId)
      if (prev.length === next.length && prev.every((v, i) => v === next[i])) return prev
      return next
    })
  }, [open, targetDom, comId])

  const zoneSelectorList = useMemo(() => {
    const domList =
      Object.prototype.toString.call(targetDom) === '[object NodeList]'
        ? Array.from(targetDom as NodeList)
        : targetDom
          ? [targetDom as Element]
          : []
    const result: string[] = []

    // 预先收集当前组件样式表中所有出现过的 class 名，用于过滤动态 class 噪音
    const classesInStyleSheet = new Set<string>()
    if (comId) {
      const root = getDocument()
      const styleEls = Array.from((root as any).querySelectorAll?.('style') || [])
      for (const styleEl of styleEls as HTMLStyleElement[]) {
        let rules: CSSRuleList | null = null
        try {
          rules = (styleEl as HTMLStyleElement).sheet?.cssRules ?? null
        } catch {
          continue
        }
        if (!rules) continue
        for (const rule of Array.from(rules)) {
          const selectorText = (rule as CSSStyleRule).selectorText
          if (!selectorText || !selectorText.includes(comId)) continue
          // 提取选择器中所有 .className 片段
          const matches = selectorText.match(/\.([a-zA-Z_][a-zA-Z0-9_-]*)/g)
          if (matches) matches.forEach((m) => classesInStyleSheet.add(m.slice(1)))
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
        try {
          return JSON.parse(dom?.getAttribute?.('data-loc') ?? '{}')?.cn ?? []
        } catch {
          return []
        }
      })()
      // 运行时实际 class 与静态 class 的差集 = 动态 class（如 iconUser）
      // comId 为空时跳过，避免无样式表过滤依据时产生噪音
      // 再过滤：只保留在组件样式表中真实存在的 class，排除平台注入的噪音 class

      // CSS module 会将 class 名混淆为 "<模块路径>-<真实class名>" 的形式（如 pages_Foo_less-text-container-213），
      // 而 knownClasses（来自 data-loc.cn）只存储短名（如 text-container-213），两者格式不同无法精确匹配。
      // isMangledKnown 用"带答案找问题"的方式：直接检查 DOM class 是否以 "-已知短名" 结尾，
      // 且前缀部分含下划线（模块路径特征），是则认定为静态 class 的混淆版本，在 filter 阶段直接排除。
      const isMangledKnown = (c: string) =>
        knownClasses.some(
          (kc) => c.endsWith(`-${kc}`) && c.slice(0, c.length - kc.length - 1).includes('_')
        )

      const dynamicClasses = comId
        ? Array.from((dom as Element)?.classList ?? []).filter(
            (c) =>
              !knownClasses.includes(c) && // 精确匹配（短名直接挂在 DOM 上时）
              !isMangledKnown(c) && // 混淆名反向匹配（CSS module 编译后的长名）
              classesInStyleSheet.has(c)
          )
        : []

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
  }, [targetDom, pseudoSelectorList, comId])

  // 按 DOM class 对齐 activeZoneIdx：
  // - 仅在「未手动选 tab」时做初始/列表变化对齐
  // - class 真实变化时（MutationObserver）始终对齐，并清除手动选择标记
  // 否则点 :hover / 状态类 tab 会被 findIndex 打回第一个基础选择器。
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

    function syncActiveIdx() {
      const idx = zoneSelectorList.findIndex((sel) => {
        const base = sel.replace(/:{1,2}[a-zA-Z\-]+(\([^)]*\))?/g, '').trim()
        return !!base && elMatchesSelectorTail(el as Element, base)
      })
      setActiveZoneIdx(idx >= 0 ? idx : 0)
    }

    if (!userSelectedRef.current) {
      syncActiveIdx()
    } else {
      // 列表变短时仅做边界钳制，不覆盖用户当前选中的 tab
      setActiveZoneIdx((prev) => (prev >= zoneSelectorList.length ? 0 : prev))
    }

    const observer = new MutationObserver(() => {
      userSelectedRef.current = false
      syncActiveIdx()
    })
    observer.observe(el, { attributes: true, attributeFilter: ['class'] })
    return () => observer.disconnect()
  }, [targetDom, zoneSelectorList])

  const setActiveZoneIdxByUser = useCallback((idx: number) => {
    userSelectedRef.current = true
    setActiveZoneIdx(idx)
  }, [])

  return {
    zoneSelectorList,
    activeZoneIdx,
    setActiveZoneIdx: setActiveZoneIdxByUser,
  }
}
