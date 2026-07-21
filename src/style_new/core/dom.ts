export function getDocument() {
  const root = document.getElementById('_mybricks-geo-webview_')?.shadowRoot || document
  return root
}

/** 将字符串中的正则特殊字符转义，用于把 CSS 选择器安全地嵌入 RegExp */
export function escapeRegExp(str: string) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}
