import { useStyleEditorContext } from '../context'

const CSS_KEYWORD = /^(inherit|initial|unset|revert|revert-layer)$/i

/** 只读回显来源；不改变当前 Tab 的配置值和写入目标。 */
export function useStyleDisplayValue(key: string) {
  const context = useStyleEditorContext()
  const item = context?.effectiveStyle?.[key]
  const hasDeclaration = !!item && item.type !== 'computed'
  const configuredValue = hasDeclaration ? item?.value : undefined
  const keyword = typeof configuredValue === 'string' && CSS_KEYWORD.test(configuredValue.trim())
  const isConfigured = hasDeclaration && !(typeof configuredValue === 'string' && /^unset$/i.test(configuredValue.trim()))
  const computedPreview = !hasDeclaration ? context?.getStyleDisplayPreview?.(key) : undefined
  const displayValue = hasDeclaration
    ? keyword && /^unset$/i.test(String(configuredValue).trim())
      ? item?.computedValue
      : configuredValue
    : computedPreview ?? item?.value

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
