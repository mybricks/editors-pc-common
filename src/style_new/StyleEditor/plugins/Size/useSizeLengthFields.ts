import { useStyleEditorContext } from '../../context'
import { isCssVarValue } from '../../hooks/useLengthVarBinding'
import { resolveCssVarLength } from '../../../core/resolve-css-var-length'
import { needsComputedLength, resolveLengthValue } from '../../../core/resolve-length-value'

type SizeFieldKey = 'width' | 'height' | 'minWidth' | 'maxWidth' | 'minHeight' | 'maxHeight'

/** 六个尺寸字段共用的只读入口；源值用于模式/绑定，解析值用于回显和编辑起点。 */
export function useSizeLengthFields(values: Partial<Record<SizeFieldKey, string>>) {
  const context = useStyleEditorContext()
  const target = context?.targetDom
  let refreshed = false
  let computed: CSSStyleDeclaration | undefined

  // 读取该属性的浏览器计算值；例如 minHeight 读 min-height，不拿元素实际高度代替。
  const readComputed = (field: SizeFieldKey) => {
    if (context?.getStylePreview) {
      // 一轮读取只刷新一次，后续字段复用上下文的计算样式缓存。
      const value = context.getStylePreview(field, !refreshed)
      refreshed = true
      return value
    }
    // 独立面板的普通态可直接读取；伪类仍遵守上下文的预览边界。
    if (!target || (context?.editConfig.options as any)?.zoneTab?.pseudo) return undefined
    computed = computed || target.ownerDocument.defaultView?.getComputedStyle(target)
    return computed?.getPropertyValue(field.replace(/[A-Z]/g, letter => `-${letter.toLowerCase()}`))
  }

  const readField = (field: SizeFieldKey) => {
    const source = values[field]
    const varRef = isCssVarValue(source) ? source : undefined
    const value = varRef ? resolveCssVarLength(varRef, target) : source
    const resolvedValue = resolveLengthValue(value, needsComputedLength(value) ? readComputed(field) : undefined)
    return {
      source, // 输入的原声明，如 100vh；保留给模式判断使用。
      varRef, // 变量引用，如 var(--size)；非变量时为空，用来判断是否显示变量胶囊。
      resolvedValue, // 回显及编辑起点，如 1121px；未得到数值时保留解析前的值。
    }
  }

  return {
    width: readField('width'),
    height: readField('height'),
    minWidth: readField('minWidth'),
    maxWidth: readField('maxWidth'),
    minHeight: readField('minHeight'),
    maxHeight: readField('maxHeight'),
  }
}
