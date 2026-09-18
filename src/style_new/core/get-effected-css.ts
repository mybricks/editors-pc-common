// @ts-ignore
import { compare } from 'specificity'

import { refineEffectedPanel } from '../StyleEditor/helper/paint-stack'
import {
  createCssCascadeSession,
  resolveCascadeRuleSources,
} from './css-cascade'
import type { CascadeCandidate, CascadeRuleSource } from './css-cascade'
import { toHump, toLine } from './css-code-codec'
import { elementHasClassOrHashed } from './css-modules-match'
import { getDocument } from './dom'
import { getStyleRules } from './get-style-rules'
import type { StyleRulesScanCache } from './get-style-rules'
import { getValues } from './get-values'
import { reconcileEffectiveTextFill } from './effective-text-fill'
import { PANEL_MAP } from './panel-defaults'
import { calculateSafeSpecificity, someSelectorPart } from './selector-utils'
import { hasCssVarReference } from './css-var'
import {
  cssRuleStyleToBag,
  getEffectedPanelsFromCssRules,
  getEffectedPanelsFromDirectParent,
  isBorderPanelMeaningfullyUsed,
  isMeaninglessStylePropForPanel,
} from './panel-effected'
import { getOrderedZoneSourceRules } from './zone-tab'
import type { ZoneTab } from './zone-tab'

/** 穿透 shadowRoot 取真正的 activeElement（画布常在 webview shadow 内） */
function getDeepActiveElement(): HTMLElement | null {
  let el: Element | null = document.activeElement
  while (el instanceof HTMLElement && el.shadowRoot?.activeElement) {
    el = el.shadowRoot.activeElement
  }
  return el instanceof HTMLElement ? el : null
}

/**
 * 默认态回显时，点击会使元素处于 :focus，getComputedStyle 会混入 :focus 规则值。
 * getComputedStyle 返回 live 对象，必须在 blur 期间把属性快照下来，再恢复焦点。
 *
 * 注意：不能只 blur document.activeElement——shadow 画布里 activeElement 往往是 host，
 * 必须直接对匹配 :focus 的目标 element 调用 blur。
 */
function snapshotComputedWithoutFocus(element: HTMLElement): CSSStyleDeclaration {
  let matchedFocus = false
  try {
    matchedFocus = element.matches(':focus') || element.matches(':focus-visible')
  } catch {}
  const deepActive = getDeepActiveElement()
  const needBlur = matchedFocus || deepActive === element

  if (needBlur) {
    try {
      element.blur()
    } catch {}
  }
  try {
    const live = window.getComputedStyle(element)
    const camelBag: Record<string, string> = {}
    const kebabBag: Record<string, string> = {}
    // 快照 getValues / 级联兜底会读到的关键属性（含 camel 与 kebab）
    for (let i = 0; i < live.length; i++) {
      const kebab = live[i]
      const val = live.getPropertyValue(kebab)
      kebabBag[kebab] = val
      camelBag[toHump(kebab)] = val
    }
    // webkit 前缀属性不一定出现在 live.length 枚举里
    ;['-webkit-background-clip', '-webkit-text-fill-color', '-webkit-backdrop-filter'].forEach(
      (kebab) => {
        const val = live.getPropertyValue(kebab)
        if (val) {
          kebabBag[kebab] = val
          camelBag[toHump(kebab)] = val
        }
      }
    )

    return {
      ...camelBag,
      length: live.length,
      getPropertyValue: (name: string) =>
        kebabBag[name] ?? camelBag[toHump(name)] ?? '',
      getPropertyPriority: () => '',
    } as unknown as CSSStyleDeclaration
  } finally {
    if (needBlur && element.isConnected) {
      try {
        element.focus({ preventScroll: true })
      } catch {}
    }
  }
}

/**
 * 在 comId 组件根节点内，找到一个当前持有目标 rawClass（或其 CSS Modules 哈希变体）的元素。
 * 搜索范围严格限定在 #comId 以内，不做祖先链遍历，不跨组件实例，不做全局搜索。
 */
export function findElementInState(
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
export function getEffectedCssPropertyAndOptions (
  element: HTMLElement | null,
  selector: string | string[],
  comId?: string,
  zoneTab?: ZoneTab | null,
) {
  // 多类名时传数组，对每个 selector 分别查规则后去重合并；单个 selector 行为不变
  const selectorArray = Array.isArray(selector) ? selector : [selector];
  const primarySelector = selectorArray[selectorArray.length - 1] ?? '';
  const _selectorStr = Array.isArray(selector) ? selector.join(',') : (selector ?? '');
  // 伪类回填基础态变量时会再次查 CSSOM；同一次计算复用规则快照，避免重复读取所有 stylesheet。
  // 默认态单 selector 只有一次规则查询，不额外创建缓存。
  const styleRulesScanCache: StyleRulesScanCache | undefined = element && (
    selectorArray.length > 1 || /:{1,2}[a-zA-Z\-]+(?:\([^)]*\))?$/.test(primarySelector)
  ) ? {} : undefined
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

      // 有 tab 元数据时按 CSSRule 身份 + 原始分支去重；不能按 selectorText 去重，
      // 因为 antd/emotion 常会连续注入同名规则，后写规则仍然参与级联。
      const metadataRules = zoneTab ? getOrderedZoneSourceRules(zoneTab) : []
      if (metadataRules.length) {
        finalRules = metadataRules.map((item) => item.rule)
      }

      const rulesMap = new Map<CSSStyleRule, CSSStyleRule>();
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
          : elementHasClassOrHashed(element, rawClass)

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

        const { rules, inheritOnlyRules } = getStyleRules(queryEl, sel, styleRulesScanCache);

        rules.forEach((rule: any) => rulesMap.set(rule, rule));
        inheritOnlyRules.forEach(r => allInheritOnlyRules.add(r))
      }

      if (!metadataRules.length) finalRules = Array.from(rulesMap.values()).filter((finalRule: any) => {
        // calculate 不支持逗号合并选择器，需走 calculateSafeSpecificity
        const tempCompare = calculateSafeSpecificity(finalRule.selectorText, computedElement)

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
      const selectorHasPseudo = /:{1,2}[a-zA-Z\-]+(?:\([^)]*\))?$/.test(primarySelector)
      if (isPseudoElement) {
        const pseudoMatch = primarySelector.match(/::?(before|after|first-line|first-letter)\s*$/i)
        computedValues = window.getComputedStyle(computedElement, pseudoMatch ? `::${pseudoMatch[1]}` : '::after')
      } else if (!selectorHasPseudo) {
        // 默认 tab：点击后元素常处于 :focus，必须先中和焦点再快照 computed，
        // 否则 getValues 的 color/background 等 fallback 会回显 :focus 样式。
        computedValues = snapshotComputedWithoutFocus(computedElement)
      } else {
        computedValues = window.getComputedStyle(computedElement)
      }
    } else if (primarySelector) {

      // 无真实 DOM（伪类如 :hover、:disabled 等，或 span 等无 class 的子标签）
      const { rules: rawRules, inheritOnlyRules } = getStyleRules(null, primarySelector, styleRulesScanCache)
      inheritOnlyRules.forEach(r => allInheritOnlyRules.add(r))
      finalRules = rawRules.filter((finalRule: any) => {
        // calculate 不支持逗号合并选择器，需走 calculateSafeSpecificity
        const tempCompare = calculateSafeSpecificity(finalRule.selectorText, null)

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

    const values = getValues(finalRules, computedValues, allInheritOnlyRules);

    const _hasPseudo = /:{1,2}[a-zA-Z\-]+(?:\([^)]*\))?$/.test(primarySelector)
    // 伪类/伪元素 Tab 编辑的是状态规则，不把元素自身的 style="" 复制进状态回显。
    // inline 仍会在普通 classname Tab 中参与真实级联优先级计算。
    const isStateTab = zoneTab ? !!zoneTab.pseudo : _hasPseudo
    const allowInlineEcho = !isStateTab
    const cascadeSession = element
      ? createCssCascadeSession(element, { computedStyle: computedValues })
      : null

    const panelProperties = Object.keys(PANEL_MAP).map((camel) => ({
      camel,
      property: toLine(camel),
    }))
    const orderedZoneSources = zoneTab ? getOrderedZoneSourceRules(zoneTab) : []
    const authoredSources: CascadeRuleSource[] = orderedZoneSources.length > 0
      ? orderedZoneSources.map((source) => ({
          rule: source.rule,
          selectorPart: source.selectorPart,
          target: source.target,
          sourceOrder: source.sourceOrder,
        }))
      : finalRules
          .filter((rule) => !allInheritOnlyRules.has(rule))
          .map((rule, sourceOrder) => ({
            rule,
            selectorPart: rule.selectorText,
            target: element,
            sourceOrder,
          }))
    const authoredWinnerCache = new Map<string, CascadeCandidate | null>()
    const getAuthoredWinner = (property: string): CascadeCandidate | null => {
      if (!authoredWinnerCache.has(property)) {
        authoredWinnerCache.set(
          property,
          authoredSources.length > 0
            ? resolveCascadeRuleSources(authoredSources, property)
            : null
        )
      }
      return authoredWinnerCache.get(property) || null
    }

    /**
     * 面板显示策略：
     * 1. 普通 classname Tab 有 inline 声明时，显示整个元素真正的级联赢家；
     * 2. 伪类/伪元素 Tab 不引入 inline，只显示状态规则的 authored 赢家；
     * 3. 其他情况优先显示当前 Zone Tab 自己的 authored 赢家；
     * 4. 普通 Tab 当前 Zone 未声明时显示元素级赢家；状态 Tab 保留规则/computed 兜底。
     */
    panelProperties.forEach(({ camel, property }) => {
      const authoredWinner = getAuthoredWinner(property)
      const elementInlineCandidate = cascadeSession?.getInlineCandidate(property) || null
      const inlineCandidate = allowInlineEcho
        ? elementInlineCandidate
        : null
      const effectiveWinner = allowInlineEcho
        ? cascadeSession?.resolve(property, 'default') || null
        : null
      const winner = inlineCandidate
        ? effectiveWinner
        : (authoredWinner || effectiveWinner)
      if (winner?.value) {
        ;(values as any)[camel] = winner.value
      } else if (!allowInlineEcho && elementInlineCandidate) {
        // getValues 的 computed fallback 也可能带入 inline；状态规则没有对应声明时清掉它。
        delete (values as any)[camel]
      }
    })

    // inline 不属于 CSSStyleRule：单独展开面板并记录 authored 数据。
    // 通过声明候选展开 shorthand，使 background/gap/border 能映射到对应 longhand 面板字段。
    const inlineEffectedPanels: string[] = []
    const inlineAuthoredStyle: Record<string, any> = allowInlineEcho && element
      ? cssRuleStyleToBag(element.style)
      : {}
    if (allowInlineEcho && element && element.style.length > 0 && cascadeSession) {
      const inlineBag: Record<string, any> = { ...inlineAuthoredStyle }
      panelProperties.forEach(({ camel, property }) => {
        const candidate = cascadeSession.getInlineCandidate(property)
        if (candidate?.value) inlineBag[camel] = candidate.value
      })

      const inlineStyleBag = { ...values, ...inlineBag }
      Object.keys(inlineBag).forEach((camelProp) => {
        const mapped = PANEL_MAP[camelProp]
        if (
          isMeaninglessStylePropForPanel(
            camelProp,
            inlineBag[camelProp],
            mapped,
            inlineStyleBag,
            element.style
          )
        ) {
          return
        }
        const panel = refineEffectedPanel(camelProp, mapped, inlineStyleBag)
        if (panel === 'border' && !isBorderPanelMeaningfullyUsed(inlineStyleBag)) {
          return
        }
        if (panel && !inlineEffectedPanels.includes(panel)) {
          inlineEffectedPanels.push(panel)
        }
      })
    }

    // 文字渐变可能由多个 classname 共同组成。规则扫描保持 Zone 所有权边界，
    // 仅在面板消费前用 computedStyle 补齐实际绘制角色。
    if (element && !_hasPseudo) {
      reconcileEffectiveTextFill(values as Record<string, any>, computedValues, finalRules)
    }

    const effectedFromRules = getEffectedPanelsFromCssRules(
      finalRules,
      values as Record<string, any>,
      allInheritOnlyRules
    );

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
      return charBefore === ' ' || charBefore === '>' || charBefore === '+' || charBefore === '~' || charBefore === ',';
    };

    const ownSelectorRules = tailSegments.length > 0
      ? finalRules.filter((rule: any) => {
          const st: string = rule.selectorText ?? '';
          // 逗号合并选择器由 someSelectorPart 统一拆分后逐段判断
          return tailSegments.every(tail =>
            someSelectorPart(st, (part) => {
              // 对于单段（无空格）的 tail，用末尾精确匹配
              // 对于包含空格的 tail（不应出现，做兜底），直接 endsWith
              // 必须按选择器边界匹配；`part.includes(tail)` 会把 `.bubbleSales`
              // 错当成 `.bubble`，从而把兄弟 classname 的面板标为当前 tab 自有。
              if (ruleMatchesTailSegment(part, tail)) return true;
              // CSS Modules 哈希类名兜底：tail=".myClass" 对应编译后 "pages_xxx_less-myClass"
              // 规则选择器末尾段中，若某个类以 "-{原始类名}" 结尾则视为命中
              if (tail.startsWith('.') && element) {
                const tailClass = tail.slice(1);
                const stLast = (part.trim().split(/\s+/).pop() || '');
                const stClasses = (stLast.match(/\.([^.#[:]+)/g) ?? []).map((c: string) => c.slice(1));
                const isHashedMatch = stClasses.some((c: string) => c === tailClass || c.endsWith('-' + tailClass));
                if (isHashedMatch) {
                  try { return element.matches(st); } catch {}
                }
              }
              return false;
            })
          );
        })
      : finalRules;
    // inlineEffectedPanels 也视为"自身拥有的样式"（用户通过编辑器写入的内联 style），
    // 加入 ownRulesPanels 后会进入 ownEffectedSet，使对应面板显示 - 删除按钮，
    // 而不是作为只读继承（'inherited'）展示。
    const ownRulesPanels = Array.from(new Set([
      ...(getEffectedPanelsFromCssRules(
        ownSelectorRules,
        values as Record<string, any>,
        allInheritOnlyRules
      ) as string[]),
      ...inlineEffectedPanels,
    ]));
    const zoneAuthoredStyle = ownSelectorRules.reduce<Record<string, any>>(
      (result, rule) => Object.assign(result, cssRuleStyleToBag(rule.style)),
      {}
    )
    // inline 是元素自身最后的 authored 来源，不能再被 Zone 规则覆盖。
    const ownAuthoredStyle = {
      ...zoneAuthoredStyle,
      ...inlineAuthoredStyle,
    }

    // 其他命中当前 DOM 但不属于当前编辑选择器的规则（如 .actionBtn 当编辑 .actionBtn.primary 时），
    // 产生的面板需要展开回显但不能有减号，单独返回供外层计算 readonlyExpandedOptions。
    const otherRules = finalRules.filter((rule: any) => !ownSelectorRules.includes(rule));
    const otherRulesPanels = getEffectedPanelsFromCssRules(
      otherRules,
      values as Record<string, any>,
      allInheritOnlyRules
    ) as string[];

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
            const { rules: baseRules } = getStyleRules(element, baseSelector, styleRulesScanCache)
            if (baseRules.length > 0) {
              const baseValues = getValues(baseRules, computedValues, new Set<CSSStyleRule>())
              Object.keys(baseValues as object).forEach(key => {
                const baseVal = (baseValues as any)[key]
                const curVal = (values as any)[key]
                if (hasCssVarReference(baseVal) && !hasCssVarReference(curVal)) {
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

    return [
      values,
      finalEffectedPanels,
      ownRulesPanels,
      [...effectedFromDirectParent, ...otherRulesPanels, ...baseStateVarPanels, ...inlineEffectedPanels],
      ownAuthoredStyle,
    ]
  } catch (e) {
    console.warn('[getEffectedCssPropertyAndOptions] 异常:', e)
    return [{}, []]
  }
}
