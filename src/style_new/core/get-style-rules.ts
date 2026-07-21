import { getDocument } from './dom'
import { ruleLastClassBelongsToElement } from './css-modules-match'

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
