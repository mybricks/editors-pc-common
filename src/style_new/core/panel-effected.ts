import {
  decomposeBackgroundStack,
  refineEffectedPanel,
} from '../StyleEditor/helper/paint-stack'
import { toHump } from './css-code-codec'
import { getDocument } from './dom'
import { getDefaultValueFunctionMap2, PANEL_MAP } from './panel-defaults'

/**
 * @description 从 css rules 中获取当前生效的插件，用于展示插件的是否默认折叠
 */
export function cssRuleStyleToBag (style: CSSStyleDeclaration): Record<string, any> {
  const bag: Record<string, any> = {}
  // 遍历 style 声明，供文字渐变归属 / 边框空值判断使用
  for (let i = 0; i < style.length; i++) {
    const kebab = style[i]
    const camel = toHump(kebab)
    const val = style.getPropertyValue(kebab)
    if (val) bag[camel] = val
  }
  // Chrome：background 简写含 var() 时 longhand 值为空，但 style.length 仍列出子属性。
  // 从简写回填，避免「有渐变却不展开背景面板 / 回显丢失」。
  const bgShorthand = (style.getPropertyValue('background') || '').trim()
  if (bgShorthand) {
    const isImageLike =
      /gradient\s*\(/i.test(bgShorthand) || /url\s*\(/i.test(bgShorthand)
    if (!bag.backgroundImage && isImageLike) {
      bag.backgroundImage = bgShorthand
    } else if (
      !bag.backgroundColor &&
      !isImageLike &&
      bgShorthand.toLowerCase().startsWith('var(')
    ) {
      bag.backgroundColor = bgShorthand
    }
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
export function isZeroCssLength (value?: string): boolean {
  if (value == null || value === '') return true
  const s = String(value).trim().toLowerCase()
  return s === '0' || s === '0px' || s === '0%' || s === '0em' || s === '0rem'
}

/**
 * 边框面板是否「真正有内容」：
 * 点 - 号后会残留 border: 0px none ... / border-radius: 0px，
 * 这些不应再把边框面板算作生效（否则无法折叠）。
 */
export function isBorderPanelMeaningfullyUsed (styleBag: Record<string, any> = {}): boolean {
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

type BoxModelPanel = 'padding' | 'margin'
type AuthoredDeclarationSource = CSSStyleDeclaration | Record<string, any>

/**
 * 判断 box-model 面板是否存在用户明确写入的声明。
 *
 * 这里只检查声明列表/原始对象的字段，不读取 computedStyle；否则浏览器补出的
 * 0px 会和用户写入的 0px 无法区分。CSSStyleDeclaration 的 length 列表只包含
 * 规则中直接写入的属性，因此可以保留 shorthand 信息。
 */
export function hasAuthoredBoxModelDeclaration (
  source: AuthoredDeclarationSource | null | undefined,
  panel: BoxModelPanel
): boolean {
  if (!source) return false

  const declarations = panel === 'padding'
    ? ['padding', 'padding-top', 'padding-right', 'padding-bottom', 'padding-left']
    : ['margin', 'margin-top', 'margin-right', 'margin-bottom', 'margin-left']

  if (typeof (source as any).getPropertyValue === 'function') {
    const style = source as CSSStyleDeclaration
    for (let i = 0; i < style.length; i++) {
      if (declarations.includes(style[i])) return true
    }
    // CSSOM 实现或测试桩可能无法枚举 length，但 cssText 仍保留原始声明。
    const cssText = String((style as any).cssText || '')
    if (cssText) {
      return declarations.some((property) =>
        new RegExp(`(?:^|;)\\s*${property}\\s*:`, 'i').test(cssText)
      )
    }
    return false
  }

  const record = source as Record<string, any>
  return declarations.some((property) => {
    const camel = toHump(property)
    const key = Object.prototype.hasOwnProperty.call(record, camel)
      ? camel
      : Object.prototype.hasOwnProperty.call(record, property)
        ? property
        : null
    if (!key) return false
    const value = record[key]
    return value !== null && value !== undefined && value !== ''
  })
}

/** 属性值是否等价于该面板空白基准（或对边框面板无视觉意义） */
export function isMeaninglessStylePropForPanel (
  property: string,
  value: any,
  mappedPanel: string | undefined,
  styleBag: Record<string, any>,
  authoredSource?: AuthoredDeclarationSource | null
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
    if (normalize(str) === normalize(emptyVal)) {
      // 用户明确写入的 padding/margin: 0px 仍属于有效面板内容；只有
      // 没有原始声明、仅由 computed/default 补出的 0px 才应被折叠。
      if (
        (mappedPanel === 'padding' || mappedPanel === 'margin') &&
        hasAuthoredBoxModelDeclaration(authoredSource, mappedPanel)
      ) {
        return false
      }
      return true
    }
  }

  if (mappedPanel === 'border') {
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

export function getEffectedPanelsFromCssRules (
  rules: CSSStyleRule[],
  effectiveStyleBag?: Record<string, any>,
  ignoredRules?: Set<CSSStyleRule>
) {
  let effectedPanels = new Set<string>();
  rules.filter(rule => {
    if (rule.selectorText.indexOf('.desn-') === 0 && rule.selectorText.indexOf('*') > -1) {
      return false
    }
    return true
  }).forEach(rule => {
    const styleBag = cssRuleStyleToBag(rule.style)
    // 属性是否属于文字 / 内容 / 边框，取决于元素最终形成的完整 paint stack，
    // 不能只看当前单条规则（文字渐变经常被拆在多个 classname 中）。
    const classificationBag = effectiveStyleBag
      ? { ...styleBag, ...effectiveStyleBag }
      : styleBag
    rule.styleMap.forEach((cssVal, key) => {
      const camel = toHump(key)
      // styleMap 对「含 var() 的 background 简写」会给出空的 pending 值，
      // 需回退到 cssRuleStyleToBag 已从简写回填的 bag。
      const fromMap =
        typeof (cssVal as any)?.toString === 'function'
          ? String((cssVal as any).toString()).trim()
          : ''
      // 当前规则确实列出该属性，但 CSSOM 因 background:var(...) 给出空 pending 值时，
      // 允许使用 DOM 校正后、仍属于当前 Zone 的原始值。
      const rawVal = fromMap || styleBag[camel] || effectiveStyleBag?.[camel]
      // reconcileEffectiveTextFill 只会清掉被误放进 backgroundColor 的
      // `background: var(...)`。面板归属也必须使用这个校正结果。
      const valueForMeaning =
        camel === 'backgroundColor' &&
        effectiveStyleBag &&
        !effectiveStyleBag.backgroundColor
          ? effectiveStyleBag.backgroundColor
          : rawVal
      const mapped = PANEL_MAP[camel]
      // inheritOnly 规则只应贡献 CSS 继承属性；祖先的 margin/padding、尺寸等
      // 非继承声明不能算作当前元素自己的生效面板。
      if (ignoredRules?.has(rule) && !CSS_INHERITABLE_PROPS.has(camel)) {
        return
      }
      if (
        isMeaninglessStylePropForPanel(
          camel,
          valueForMeaning,
          mapped,
          classificationBag,
          rule.style
        )
      ) {
        return
      }
      const panel = refineEffectedPanel(camel, mapped, classificationBag)
      if (panel) {
        // 边框面板额外总检：全是 0/none 残留时不展开
        if (panel === 'border' && !isBorderPanelMeaningfullyUsed(classificationBag)) {
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
export const CSS_TRIVIAL_VALUES = new Set([
  'none', 'normal', 'auto', 'initial', 'unset', 'revert',
  'default', // cursor 特有的无语义默认值
  'transparent', // 颜色透明值，语义上等同于未设置
])

// CSS 规范中默认可继承的属性（驼峰），用于祖先规则扫描时过滤出真正会向下传递的属性
export const CSS_INHERITABLE_PROPS = new Set([
  'color', 'fontSize', 'fontWeight', 'fontFamily', 'fontStyle', 'fontVariant',
  'lineHeight', 'letterSpacing', 'textAlign', 'textIndent', 'textTransform',
  'textShadow',
  'whiteSpace', 'wordSpacing', 'cursor', 'visibility', 'direction',
  'listStyleType', 'listStylePosition', 'listStyleImage',
  'borderCollapse', 'borderSpacing', 'captionSide', 'emptyCells',
]);

/**
 * 扫描直接父元素上命中的 CSS 可继承属性，返回对应的面板名列表。
 * 用于判断面板是否因父级样式继承而展开（显示为 inherited 无减号状态）。
 * 只看一层，避免 .container 等远距离根容器的通用样式影响所有后代。
 */
export function getEffectedPanelsFromDirectParent (element: HTMLElement, comId?: string): string[] {
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
