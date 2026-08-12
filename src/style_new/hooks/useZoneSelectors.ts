import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

import {
  buildZoneSelectorsFromCssom,
  fallbackZoneSelectorsFromClassnames,
} from '../core/build-zone-selectors-from-cssom'
import { getDocument } from '../core/dom'
import { elMatchesSelectorTail } from '../core/css-modules-match'
import { scanPseudoSelectors } from '../core/scan-pseudo-selectors'

/** 收集组件样式表中出现过的 class，用于过滤动态 class 噪音 */
function collectClassesInStyleSheet(comId: string): Set<string> {
  const classesInStyleSheet = new Set<string>()
  if (!comId) return classesInStyleSheet

  const root = getDocument()
  const styleEls = Array.from((root as any).querySelectorAll?.('style') || []) as HTMLStyleElement[]
  for (const styleEl of styleEls) {
    let rules: CSSRuleList | null = null
    try {
      rules = styleEl.sheet?.cssRules ?? null
    } catch {
      continue
    }
    if (!rules) continue
    for (const rule of Array.from(rules)) {
      const selectorText = (rule as CSSStyleRule).selectorText
      if (!selectorText || !selectorText.includes(comId)) continue
      const matches = selectorText.match(/\.([a-zA-Z_][a-zA-Z0-9_-]*)/g)
      if (matches) matches.forEach((m) => classesInStyleSheet.add(m.slice(1)))
    }
  }
  return classesInStyleSheet
}

function getKnownClassesFromLoc(dom: Element): string[] {
  try {
    return JSON.parse(dom?.getAttribute?.('data-loc') ?? '{}')?.cn ?? []
  } catch {
    return []
  }
}

function getDynamicClasses(
  dom: Element,
  comId: string,
  classesInStyleSheet: Set<string>
): string[] {
  if (!comId) return []
  const knownClasses = getKnownClassesFromLoc(dom)
  // CSS module 混淆名：以 "-已知短名" 结尾且前缀含 _，视为静态 class
  const isMangledKnown = (c: string) =>
    knownClasses.some(
      (kc) => c.endsWith(`-${kc}`) && c.slice(0, c.length - kc.length - 1).includes('_')
    )

  return Array.from(dom.classList ?? []).filter(
    (c) =>
      !knownClasses.includes(c) &&
      !isMangledKnown(c) &&
      classesInStyleSheet.has(c)
  )
}

export function useZoneSelectors(editConfig: any, targetDom: any, _open: boolean) {
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

  const zoneSelectorList = useMemo(() => {
    const domList =
      Object.prototype.toString.call(targetDom) === '[object NodeList]'
        ? Array.from(targetDom as NodeList)
        : targetDom
          ? [targetDom as Element]
          : []

    const classesInStyleSheet = collectClassesInStyleSheet(comId)
    const result: string[] = []
    const baseSelectors: string[] = []

    for (const dom of domList as Element[]) {
      // 主路径：CSSOM + matches；空则用 classnames / loc 兜底（不读 data-zone-selector）
      let bases = comId ? buildZoneSelectorsFromCssom(dom, comId) : []
      // #region agent log
      let __source: 'cssom' | 'fallback' | 'empty' = bases.length ? 'cssom' : 'empty'
      // #endregion
      if (bases.length === 0) {
        bases = fallbackZoneSelectorsFromClassnames(dom)
        // #region agent log
        if (bases.length) __source = 'fallback'
        // #endregion
      }

      for (const s of bases) {
        if (!baseSelectors.includes(s)) baseSelectors.push(s)
        if (!result.includes(s)) result.push(s)
      }

      const dynamicClasses = getDynamicClasses(dom, comId, classesInStyleSheet)
      // 动态 class 与基础选择器拼复合选择器，插到最前以便默认回显实际生效样式
      // #region agent log
      const __compounds: string[] = []
      // #endregion
      if (dynamicClasses.length > 0 && bases.length > 0) {
        const compoundSelectors: string[] = []
        for (const dc of dynamicClasses) {
          for (const sel of bases) {
            const lastSegment = sel.trim().split(/\s+/).pop() ?? ''
            if (lastSegment.includes(`.${dc}`)) continue
            const compound = `${sel}.${dc}`
            if (!result.includes(compound) && !compoundSelectors.includes(compound)) {
              compoundSelectors.push(compound)
            }
          }
        }
        // #region agent log
        __compounds.push(...compoundSelectors)
        // #endregion
        result.unshift(...compoundSelectors)
      }
      // #region agent log
      fetch('http://127.0.0.1:7661/ingest/56232cca-6b04-41f0-85bf-f22ce073d642', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Debug-Session-Id': '74b899' },
        body: JSON.stringify({
          sessionId: '74b899',
          runId: 'rich-input-source',
          hypothesisId: 'C',
          location: 'useZoneSelectors.ts:zoneSelectorList',
          message: 'zone list assembly',
          data: {
            comId,
            tag: (dom as Element).tagName,
            classList: Array.from((dom as Element).classList || []),
            source: __source,
            bases,
            dynamicClasses,
            compounds: __compounds,
            finalBeforePseudo: [...result],
          },
          timestamp: Date.now(),
        }),
      }).catch(() => {})
      // #endregion
    }

    for (const pseudo of scanPseudoSelectors(baseSelectors, comId)) {
      if (!result.includes(pseudo) && !/:nth-child\(\d+\)$/.test(pseudo)) {
        result.push(pseudo)
      }
    }
    return result
  }, [targetDom, comId])

  // 按 DOM class 对齐 activeZoneIdx：
  // - 仅在「未手动选 tab」时做初始/列表变化对齐
  // - class 真实变化时（MutationObserver）始终对齐，并清除手动选择标记
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
        const lastPart = sel.trim().split(/\s+/).pop() || ''
        if (/:{1,2}[a-zA-Z\-]+(?:\([^)]*\))?$/.test(lastPart)) return false
        const base = sel.replace(/:{1,2}[a-zA-Z\-]+(\([^)]*\))?/g, '').trim()
        return !!base && elMatchesSelectorTail(el as Element, base)
      })
      setActiveZoneIdx(idx >= 0 ? idx : 0)
    }

    if (!userSelectedRef.current) {
      syncActiveIdx()
    } else {
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
