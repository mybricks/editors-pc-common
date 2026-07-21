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

function readFromStyle(style: CSSStyleDeclaration, spec: PropSpec): any {
  const key = spec.styleKey ?? spec.camel
  return (style as any)[key]
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
