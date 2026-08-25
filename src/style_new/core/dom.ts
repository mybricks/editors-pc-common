export function getDocument() {
  const root = document.getElementById('_mybricks-geo-webview_')?.shadowRoot || document
  return root
}

function isElement(value: unknown): value is Element {
  return !!value && typeof value === 'object' && (value as { nodeType?: unknown }).nodeType === 1
}

export function toElementArray(value: unknown): Element[] {
  if (!value) return []
  if (isElement(value)) return [value]
  if (typeof (value as { length?: unknown }).length !== 'number') return []
  return Array.from(value as ArrayLike<unknown>).filter(isElement)
}

/** 将字符串中的正则特殊字符转义，用于把 CSS 选择器安全地嵌入 RegExp */
export function escapeRegExp(str: string) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}
