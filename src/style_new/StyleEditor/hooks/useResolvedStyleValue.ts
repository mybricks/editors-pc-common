import { useStyleEditorContext } from '../context'
import { resolveCssVarLength } from '../../core/resolve-css-var-length'
import { isCssVarValue } from './useLengthVarBinding'

const VIEWPORT_VALUE = /^[+-]?(?:\d+\.?\d*|\.\d+)(?:vw|vh|vmin|vmax|dvw|dvh|svw|svh|lvw|lvh)$/i
const EXPRESSION_VALUE = /^(?:calc|min|max|clamp)\(/i
const NUMERIC_VALUE = /^([+-]?(?:\d+\.?\d*|\.\d+))([a-z%]*)$/i

export interface ResolvedStyleValue {
  /** 当前字段绑定的 CSS 变量引用；非变量值为空。 */
  varRef?: string
  /** 当前字段用于回显和编辑的值。 */
  resolvedValue?: string
}

/** 按属性批量解析尺寸、间距、字号等数值；仅提供读值，不修改样式。 */
export function useResolvedStyleValue<Key extends string>(sources: Record<Key, string | undefined>) {
  const context = useStyleEditorContext()
  const target = context?.targetDom
  const resolvedValues = {} as Record<Key, ResolvedStyleValue>
  let refreshed = false
  let computed: CSSStyleDeclaration | undefined

  const readComputed = (property: Key) => {
    if (context?.getStylePreview) {
      // 视口或变量变化时刷新；同一轮其余字段复用公共预览缓存。
      const value = context.getStylePreview(property, !refreshed)
      refreshed = true
      return value
    }
    const options = context?.editConfig.options
    const pseudo = options && 'zoneTab' in options ? options.zoneTab?.pseudo : null
    // 独立面板没有预览接口时读取目标文档；伪类不借用普通态的计算值。
    if (!target || pseudo) return undefined
    computed = computed || target.ownerDocument.defaultView?.getComputedStyle(target)
    return computed?.getPropertyValue(property.replace(/[A-Z]/g, letter => `-${letter.toLowerCase()}`))
  }

  (Object.keys(sources) as Key[]).forEach(property => {
    const source = sources[property]
    const varRef = isCssVarValue(source) ? source : undefined
    let value = varRef ? resolveCssVarLength(varRef, target) ?? undefined : source
    // 普通 px、% 和关键字保留原值；变量解析为视口单位或公式时走同一条计算链路。
    if (value && (VIEWPORT_VALUE.test(value.trim()) || EXPRESSION_VALUE.test(value.trim()))) {
      const numeric = readComputed(property)?.trim().match(NUMERIC_VALUE)
      // 浏览器仍返回公式时保留原值；规范化数字可避免仅聚焦就因 12.00px / 12px 差异回写。
      if (numeric) value = `${Number(numeric[1])}${numeric[2]}`
    }
    resolvedValues[property] = { varRef, resolvedValue: value }
  })

  return resolvedValues
}
