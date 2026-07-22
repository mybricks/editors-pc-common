import { getDocument, escapeRegExp } from './dom'
import { forEachSelectorPart } from './selector-utils'

/**
 * 伪类的展示优先级顺序。
 * 扫描到的伪类按此列表排序，不在列表里的排到末尾。
 */
export const PSEUDO_ORDER = [':hover', ':focus', ':focus-visible', ':focus-within', ':active', ':disabled', ':checked', ':placeholder-shown']

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
export function scanPseudoSelectors(baseSelectors: string[], comId: string): string[] {
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
        // 逗号合并选择器由 forEachSelectorPart 统一拆分；否则 $ 锚定只会命中末段伪类
        let matchedSelf = false
        forEachSelectorPart(selectorText, (part) => {
          const match = part.match(regex)
          if (match) {
            pseudoMap.get(sel)!.add(match[1])
            matchedSelf = true
          }
        })
        if (matchedSelf) continue

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
            forEachSelectorPart(selectorText, (part) => {
              const parentMatch = part.match(parentPseudoRegex)
              if (parentMatch) {
                pseudoMap.get(sel)!.add(parentMatch[1])
              }
            })
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
