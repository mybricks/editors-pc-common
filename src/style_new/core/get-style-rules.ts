import { getDocument } from './dom'
import { ruleLastClassBelongsToElement } from './css-modules-match'
import {
  filterSelectorParts,
  somePartEqualsOrEndsWith,
  someSelectorPart,
} from './selector-utils'

const HAS_PSEUDO_RE = /:[a-zA-Z\-]/

/** 取选择器末尾 class token（如 ".a .b.c" → ".c"；兼容 CSS Modules 哈希比对交给调用方） */
function getSelectorLastClassToken(selectorPart: string): string {
  const lastSegment = selectorPart.trim().split(/\s+/).pop() || selectorPart
  const classTokens = lastSegment.split('.').filter(Boolean)
  return classTokens.length > 0 ? '.' + classTokens[classTokens.length - 1] : lastSegment
}

/** 规则末尾 class 是否对应当前编辑的 selector 末尾 class（含 CSS Modules 哈希后缀） */
function lastClassTokenMatches(rulePart: string, selectorLastToken: string): boolean {
  const lastToken = getSelectorLastClassToken(rulePart)
  if (lastToken === selectorLastToken) return true
  const ruleClass = lastToken.replace(/^\./, '')
  const selClass = selectorLastToken.replace(/^\./, '')
  return !!selClass && (ruleClass === selClass || ruleClass.endsWith('-' + selClass))
}

/** 状态类场景下，单分支是否命中 lastSeg（含 CSS Modules / 复合类） */
function statePartMatchesLastSeg(
  part: string,
  lastSeg: string,
  lastSegLastToken: string,
  element: HTMLElement | null
): boolean {
  const isGlobalRule = part === lastSeg
  const isScopedRule = part.endsWith(' ' + lastSeg)
  const isScopedRuleByLastToken = lastSeg !== lastSegLastToken && (
    part === lastSegLastToken || part.endsWith(' ' + lastSegLastToken)
  )

  let isHashedModuleMatch = false
  if (!isGlobalRule && !isScopedRule) {
    const ruleLast = (part.split(/\s+/).pop() || '').replace(/^\./, '')
    const selLast = lastSeg.replace(/^\./, '')
    if (ruleLast === selLast || ruleLast.endsWith('-' + selLast)) {
      isHashedModuleMatch = ruleLastClassBelongsToElement(element, ruleLast, selLast)
    } else if (selLast.includes('.')) {
      const ruleClasses = ruleLast.split('.').filter(Boolean)
      const selClasses = selLast.split('.').filter(Boolean)
      if (ruleClasses.length === selClasses.length && selClasses.length > 1) {
        isHashedModuleMatch = selClasses.every((sClass, i) => {
          const rClass = ruleClasses[i]
          return rClass === sClass || ruleLastClassBelongsToElement(element, rClass, sClass)
        })
      }
      if (!isHashedModuleMatch && ruleClasses.length === 1) {
        const lastSelClass = selClasses[selClasses.length - 1]
        isHashedModuleMatch = ruleLastClassBelongsToElement(element, ruleLast, lastSelClass)
      }
    }
  }

  return isGlobalRule || isScopedRule || isScopedRuleByLastToken || isHashedModuleMatch
}

export function getStyleRules (element: HTMLElement | null, selector: string | null): { rules: CSSStyleRule[], inheritOnlyRules: Set<CSSStyleRule> } {
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
          // 逗号合并（如 ".a:hover, .a:focus"）由 someSelectorPart 统一拆分后再取伪类
          const matched = someSelectorPart(selectorText, (part) => {
            const rulePseudoMatch = part.match(PSEUDO_REGEX)
            const rulePseudo = rulePseudoMatch ? rulePseudoMatch[0] : null
            if (rulePseudo !== selectorPseudo) return false
            const ruleBase = part.slice(0, part.length - (rulePseudo?.length ?? 0)).trim()
            try {
              return element.matches(ruleBase)
            } catch {
              return false
            }
          })
          if (matched) {
            finalRules.push(rule)
            continue
          }
          // 情况1.5：末尾段是纯标签名时的父级伪类兜底
          if (selector) {
            const segs1 = selector.trim().split(/\s+/)
            const lastSeg1 = segs1[segs1.length - 1]
            const lastSeg1Base = lastSeg1.replace(/:{1,2}[a-zA-Z\-]+(\([^)]*\))?$/, '')
            const lastSeg1IsTag = /^[a-z][a-zA-Z0-9]*$/.test(lastSeg1Base)
            if (lastSeg1IsTag && segs1.length >= 2) {
              const parentSel1     = segs1.slice(0, -1).join(' ')
              const parentLastSeg1 = segs1[segs1.length - 2]
              const parentFull1    = parentSel1 + (selectorPseudo ?? '')
              const parentLast1    = parentLastSeg1 + (selectorPseudo ?? '')
              if (
                somePartEqualsOrEndsWith(selectorText, parentFull1) ||
                somePartEqualsOrEndsWith(selectorText, parentLast1)
              ) {
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
          const lastSeg = selector.trim().split(/\s+/).pop() || selector

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
              (parentFull && somePartEqualsOrEndsWith(selectorText, parentFull)) ||
              (parentLast && somePartEqualsOrEndsWith(selectorText, parentLast))
            ) {
              isParentPseudoMatch = true
            }
          }

          if (
            somePartEqualsOrEndsWith(selectorText, selector) ||
            somePartEqualsOrEndsWith(selectorText, lastSeg)
          ) {
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
          if (someSelectorPart(selectorText, (p) => /^:where\(/.test(p)) && element) {
            const selectorLastClass = (selector.trim().split(/\s+/).pop() || selector).replace(/^\./, '')
            const lastToken = selectorLastClass.includes('.')
              ? (selectorLastClass.split('.').filter(Boolean).pop() ?? selectorLastClass)
              : selectorLastClass
            const matchedWhere = someSelectorPart(selectorText, (part) => {
              if (!/^:where\(/.test(part)) return false
              const lastPart = part.trim().split(/\s+/).pop() || ''
              const classWithoutDot = lastPart.replace(/^\./, '')
              const isClassMatch = classWithoutDot === selectorLastClass ||
                classWithoutDot.endsWith('-' + selectorLastClass) ||
                (selectorLastClass !== lastToken && (
                  classWithoutDot === lastToken || classWithoutDot.endsWith('-' + lastToken)
                ))
              if (!isClassMatch) return false
              try {
                return element.matches(selectorText) || element.matches(part)
              } catch {
                return false
              }
            })
            if (matchedWhere) finalRules.push(rule)
            continue
          }

          const lastSeg = selector.trim().split(/\s+/).pop() || selector
          // 含伪类的规则整段跳过（逗号列表里任一段含伪类也跳过，避免 :hover 混入默认态）
          if (!someSelectorPart(selectorText, (p) => HAS_PSEUDO_RE.test(p))) {
            const lastSegLastToken = lastSeg.includes('.')
              ? ('.' + (lastSeg.split('.').filter(Boolean).pop() ?? ''))
              : lastSeg

            if (someSelectorPart(selectorText, (part) =>
              statePartMatchesLastSeg(part, lastSeg, lastSegLastToken, element)
            )) {
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
          if (!someSelectorPart(selectorText, (p) => HAS_PSEUDO_RE.test(p))) {
            if (somePartEqualsOrEndsWith(selectorText, lastSeg)) {
              finalRules.push(rule)
            } else {
              const lastSegIsTag  = /^[a-z][a-zA-Z0-9]*$/.test(lastSeg)
              if (lastSegIsTag && segs.length >= 2) {
                const parentSel     = segs.slice(0, -1).join(' ')
                const parentLastSeg = segs[segs.length - 2]
                if (
                  somePartEqualsOrEndsWith(selectorText, parentSel) ||
                  somePartEqualsOrEndsWith(selectorText, parentLastSeg)
                ) {
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
            if (!someSelectorPart(selectorText, (p) => HAS_PSEUDO_RE.test(p))) {
              const parentSel29     = segs29.slice(0, -1).join(' ')
              const parentLastSeg29 = segs29[segs29.length - 2]
              if (
                somePartEqualsOrEndsWith(selectorText, parentSel29) ||
                somePartEqualsOrEndsWith(selectorText, parentLastSeg29)
              ) {
                finalRules.push(rule)
                inheritOnlyRules.add(rule)
                continue
              }
            }
          }
        }

        // ─── 情况3：默认态（selector 无伪类，DOM 处于该状态）────────────────
        // 例：selector=".tabItem"，element=<div class="tabItem">
        // 过滤①：只考虑无伪类的分支，防止 :has()、:hover 等混入默认态
        // 逗号合并如 ".resetBtn, .queryBtn:hover" 仍应让 .resetBtn 分支在默认态命中
        const nonPseudoParts = filterSelectorParts(selectorText, (p) => !HAS_PSEUDO_RE.test(p))
        if (nonPseudoParts.length === 0) continue

        // 过滤②：element.matches 会命中 DOM 上所有类的规则，
        // 需确认规则（逗号列表中无伪类分支）末尾 class token 与 selector 末尾 class token 一致，
        // 防止 ".tabItem.active" 在编辑 ".tabItem" 默认态时被误纳入；
        // 同时让 ".resetBtn, .queryBtn" 在编辑任一分支时都能命中。
        try {
          if (!element || !selector) continue
          const selectorLastToken = getSelectorLastClassToken(selector)
          const matched = nonPseudoParts.some((part) => {
            try {
              return element.matches(part) && lastClassTokenMatches(part, selectorLastToken)
            } catch {
              return false
            }
          })
          if (matched) {
            finalRules.push(rule)
          }
        } catch {}
      }
    } catch {}
  }
  return { rules: finalRules, inheritOnlyRules }
}
