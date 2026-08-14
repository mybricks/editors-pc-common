/**
 * @module get-values
 * @input  rules, computedValues, inheritOnlyRules?
 * @output 面板回显用的样式对象（含 Webkit 别名）
 * @invariant inheritOnly 规则只读 inherit:true 的属性；backgroundColor/Image 不随意用 computed 兜底
 */
// @ts-ignore
import colorUtil from 'color-string'

import {
  applyPostHooks,
  applyRuleHooks,
  buildExportBag,
  type ValuesAcc,
} from './get-values-hooks'
import { PROP_SPECS, type PropSpec } from './prop-specs'

function isVarRef(v: any) {
  return typeof v === 'string' && v.startsWith('var(')
}

function isUnset(value: any, spec: PropSpec): boolean {
  if (spec.treatAsUnset && value != null && spec.treatAsUnset.includes(String(value))) {
    return true
  }
  if (spec.unsetMode === 'notSet') {
    return value === undefined || value === 'inherit'
  }
  // falsy：与旧代码 `if (!x)` 一致（含 ''、0、false）
  return !value
}

function camelToKebab(name: string) {
  return name.replace(/[A-Z]/g, (m) => `-${m.toLowerCase()}`)
}

/** cssText 里是否出现独立的 flex: 简写（不含 flex-grow 等） */
function cssTextHasFlexShorthand(cssText: string): boolean {
  return /(?:^|;)\s*flex\s*:/.test(cssText)
}

/** cssText 里是否出现 flex 长写 */
function cssTextHasFlexLonghand(cssText: string): boolean {
  return (
    /(?:^|;)\s*flex-grow\s*:/.test(cssText) ||
    /(?:^|;)\s*flex-shrink\s*:/.test(cssText) ||
    /(?:^|;)\s*flex-basis\s*:/.test(cssText)
  )
}

function readFromStyle(style: CSSStyleDeclaration, spec: PropSpec): any {
  const key = spec.styleKey ?? spec.camel
  let cssText = ''
  try {
    cssText = style.cssText || ''
  } catch {}

  const hasShort = cssTextHasFlexShorthand(cssText)
  const hasLong = cssTextHasFlexLonghand(cssText)

  // 写了长写：忽略 CSSOM 合成的 style.flex，避免单独配置被误判成比例
  if (spec.camel === 'flex' && (hasLong || !hasShort)) {
    return ''
  }
  // 仅写了 flex 简写：不读浏览器展开出来的长写
  // 注意：Chrome 会把长写也折叠成 cssText=`flex:…`，此时单靠 CSSOM 无法区分，模式以 Less/value.get 为准
  if (
    (spec.camel === 'flexGrow' || spec.camel === 'flexShrink' || spec.camel === 'flexBasis') &&
    hasShort &&
    !hasLong
  ) {
    return ''
  }

  const direct = (style as any)[key]
  if (direct) return direct
  // 部分浏览器对规则里的 flex 简写只暴露 kebab / 长写，补一次 getPropertyValue
  try {
    const fromProp = style.getPropertyValue?.(camelToKebab(key))
    if (fromProp) return fromProp
  } catch {}
  return direct
}

function applyFallback(
  spec: PropSpec,
  acc: ValuesAcc,
  computedValues: CSSStyleDeclaration
) {
  const cur = acc[spec.camel]

  switch (spec.fallback) {
    case 'none':
      return
    case 'static':
      if (isUnset(cur, spec)) {
        acc[spec.camel] = spec.staticValue
      }
      return
    case 'empty':
      // backgroundColor：非 var 且空/非法 → ''
      if (!isVarRef(cur) && (!cur || !colorUtil.get(cur))) {
        acc[spec.camel] = ''
      }
      return
    case 'computedIfInvalid':
      if (!isVarRef(cur) && (isUnset(cur, spec) || !colorUtil.get(cur || ''))) {
        // 规则已写颜色函数（含现代 rgb 空格语法），不要用元素 computed 盖掉——
        // computed 是整元素级联赢家，切 ZoneTab 时会串进兄弟 class 的色值
        const raw = String(cur || '').trim()
        if (/^(rgb|rgba|hsl|hsla|hwb|lab|lch|oklab|oklch|color)\(/i.test(raw)) {
          return
        }
        acc[spec.camel] = (computedValues as any)[spec.camel]
      }
      return
    case 'fontFamily':
      if (!cur) {
        acc[spec.camel] = (computedValues as any)?.fontFamily || 'inherit'
      }
      return
    case 'gap': {
      // 浏览器对非 flex/grid 容器的 gap 计算值是 'normal'，InputNumber 无法解析，统一归零
      if (!cur || cur === 'normal') {
        const computedGap = (computedValues as any)[spec.camel]
        acc[spec.camel] = computedGap === 'normal' ? '0px' : (computedGap || '0px')
      }
      return
    }
    case 'computed':
    default:
      if (isUnset(cur, spec)) {
        acc[spec.camel] = (computedValues as any)[spec.camel]
      }
  }
}

export function getValues(
  rules: CSSStyleRule[],
  computedValues: CSSStyleDeclaration,
  inheritOnlyRules?: Set<CSSStyleRule>
) {
  const acc: ValuesAcc = {}

  rules.forEach((rule) => {
    const inheritOnly = !!(inheritOnlyRules?.has(rule))
    const { style } = rule

    for (const spec of PROP_SPECS) {
      if (spec.readFromRule === false) continue
      if (inheritOnly && !spec.inherit) continue

      const v = readFromStyle(style, spec)
      if (!v) continue
      if (spec.skipValues && spec.skipValues.includes(v)) continue
      acc[spec.camel] = v
    }

    applyRuleHooks(rule, acc, inheritOnly)
  })

  for (const spec of PROP_SPECS) {
    applyFallback(spec, acc, computedValues)
  }

  applyPostHooks(acc, computedValues)

  return getRealValue(buildExportBag(acc), computedValues)
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
