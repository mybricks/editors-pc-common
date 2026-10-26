/**
 * 引擎 value.get() 可能丢失画布 br 对应的换行，从目标 DOM 补齐回显。
 * 原值已包含换行时直接沿用，兼容引擎修复后的读取结果。
 */
export function restoreInlineLineBreaks(value: string, dom?: HTMLElement): string {
  if (!dom || /[\r\n]/.test(value)) return value

  let text = ''
  let hasLineBreak = false
  const nodes = dom.childNodes

  // 只还原纯文本与显式 br，不根据布局推断换行，也不修改画布 DOM。
  for (let index = 0; index < nodes.length; index++) {
    const node = nodes[index]
    if (node.nodeType === 3) {
      text += node.textContent || ''
    } else if (node.nodeName === 'BR') {
      text += '\n'
      hasLineBreak = true
    } else {
      // 嵌套元素等复杂结构沿用原值，避免将非文案内容拼入编辑结果。
      return value
    }
  }

  return hasLineBreak ? text : value
}
