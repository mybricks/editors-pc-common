import { useStyleEditorContext } from '../context'

const CSS_KEYWORD = /^(inherit|initial|unset|revert|revert-layer)$/i

/** 只读回显来源；不改变当前 Tab 的配置值和写入目标。 */
export function useStyleDisplayValue(key: string, options?: {
  /** none 不用常规态或浏览器计算值补齐回显。 */
  preview?: 'computed' | 'none'
}) {
  const context = useStyleEditorContext()
  const item = context?.effectiveStyle?.[key]
  const previewEnabled = options?.preview !== 'none'
  const hasDeclaration = !!item && item.type !== 'computed'
  const configuredValue = hasDeclaration ? item?.value : undefined
  const keyword = typeof configuredValue === 'string' && CSS_KEYWORD.test(configuredValue.trim())
  const isConfigured = hasDeclaration && !(typeof configuredValue === 'string' && /^unset$/i.test(configuredValue.trim()))
  const computedPreview = previewEnabled && !hasDeclaration ? context?.getStyleDisplayPreview?.(key) : undefined
  const displayValue = hasDeclaration
    ? keyword && /^unset$/i.test(String(configuredValue).trim())
      ? previewEnabled ? item?.computedValue : undefined
      : configuredValue
    : computedPreview ?? (previewEnabled ? item?.value : undefined)

  return {
    configuredValue,
    hasDeclaration,
    isConfigured,
    computedPreview,
    displayValue,
    displaySource: hasDeclaration ? (keyword ? 'keyword' : 'configured')
      : computedPreview !== undefined ? 'normal-computed' : 'unavailable',
  } as const
}
