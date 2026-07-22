// @ts-ignore
import colorUtil from 'color-string'
// @ts-ignore
import { compare } from 'specificity'

import { refineEffectedPanel } from '../StyleEditor/helper/paint-stack'
import { findCascadeWinner } from './cascade-winner'
import { toHump } from './css-code-codec'
import { elementHasClassOrHashed } from './css-modules-match'
import { getDocument } from './dom'
import { getStyleRules } from './get-style-rules'
import { getValues } from './get-values'
import { PANEL_MAP } from './panel-defaults'
import { calculateSafeSpecificity, someSelectorPart } from './selector-utils'
import {
  getEffectedPanelsFromCssRules,
  getEffectedPanelsFromDirectParent,
  isBorderPanelMeaningfullyUsed,
  isMeaninglessStylePropForPanel,
} from './panel-effected'

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
export function getEffectedCssPropertyAndOptions (element: HTMLElement | null, selector: string | string[], comId?: string) {
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

        const { rules, inheritOnlyRules } = getStyleRules(queryEl, sel);

        rules.forEach((rule: any) => {
          if (!rulesMap.has(rule.selectorText)) {
            rulesMap.set(rule.selectorText, rule);
          }
        });
        inheritOnlyRules.forEach(r => allInheritOnlyRules.add(r))
      }

      finalRules = Array.from(rulesMap.values()).filter((finalRule: any) => {
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
        const pseudoSelector = primarySelector.split(':')[1]
        computedValues = window.getComputedStyle(computedElement, pseudoSelector)
      } else if (!selectorHasPseudo) {
        // 默认 tab：点击后元素常处于 :focus，必须先中和焦点再快照 computed，
        // 否则 getValues 的 color/background 等 fallback 会回显 :focus 样式。
        computedValues = snapshotComputedWithoutFocus(computedElement)
      } else {
        computedValues = window.getComputedStyle(computedElement)
      }
    } else if (primarySelector) {

      // 无真实 DOM（伪类如 :hover、:disabled 等，或 span 等无 class 的子标签）
      const { rules: rawRules, inheritOnlyRules } = getStyleRules(null, primarySelector)
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
      const _findCascadeWinner = (hyphen: string): string | null => findCascadeWinner(element, hyphen, 'default')

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
        // 优先用级联扫描（过滤伪类规则），兜底用已中和 :focus 的 computed 快照
        let _bgColorCandidate = _findCascadeWinner('background-color')
        if (!_bgColorCandidate || !colorUtil.get(_bgColorCandidate)) {
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

      const _findHoverCascadeWinner = (hyphen: string): string | null => findCascadeWinner(element, hyphen, 'hover')

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
              if (ruleMatchesTailSegment(part, tail) || part.includes(tail)) return true;
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