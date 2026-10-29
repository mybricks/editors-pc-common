/** 单行双击编辑时，左右越界仍按水平方向延伸选区，避免 textarea 的跨行规则反转选区。 */
export function limitSingleLineSelection(textarea: HTMLTextAreaElement): () => void {
  const doc = textarea.ownerDocument
  let finishDrag = () => {}

  const startDrag = (event: MouseEvent) => {
    finishDrag()
    if (event.button !== 0 || event.detail !== 1 || /[\r\n]/.test(textarea.value)) return

    const style = getComputedStyle(textarea)

    // 用同宽的一行副本判断实际折行；原框可能被拉高，不能用它的高度推断行数。
    const measure = textarea.cloneNode() as HTMLTextAreaElement
    measure.value = textarea.value
    measure.rows = 1
    Object.assign(measure.style, {
      position: 'absolute', visibility: 'hidden',
      width: style.width, height: 'auto',
      overflow: 'hidden',
    })
    textarea.parentElement!.appendChild(measure)
    // 字形可能高于 line-height，不能据此判定折行，也不能让测量副本的滚动条挤窄文字。
    const wrappedHeight = measure.scrollHeight
    measure.style.whiteSpace = 'pre'
    const singleLine = wrappedHeight === measure.scrollHeight
    measure.remove()
    if (!singleLine) return

    let anchor: number | undefined
    let lastX = event.clientX
    let selecting = false
    let frame = 0

    const clampSelection = () => {
      if (anchor === undefined) return
      if (textarea.selectionStart !== textarea.selectionEnd) selecting = true
      // 缩放手柄不会产生文字选区，继续保留原生 resize。
      if (!selecting) return
      const rect = textarea.getBoundingClientRect()
      if (lastX < rect.left && (textarea.selectionStart !== 0 || textarea.selectionEnd !== anchor)) {
        textarea.setSelectionRange(0, anchor, 'backward')
      } else if (lastX > rect.right && (textarea.selectionStart !== anchor || textarea.selectionEnd !== textarea.value.length)) {
        textarea.setSelectionRange(anchor, textarea.value.length, 'forward')
      }
    }
    const move = (event: MouseEvent) => {
      if (!(event.buttons & 1)) {
        finishDrag()
        return
      }
      if (anchor === undefined) {
        // 此时 mousedown 的原生定位已经完成；拖动已有选区仍交给浏览器。
        if (textarea.selectionStart !== textarea.selectionEnd) {
          finishDrag()
          return
        }
        anchor = textarea.selectionStart
      }
      lastX = event.clientX
      cancelAnimationFrame(frame)
      frame = requestAnimationFrame(clampSelection)
    }
    const up = () => {
      clampSelection()
      finishDrag()
    }
    finishDrag = () => {
      cancelAnimationFrame(frame)
      doc.removeEventListener('mousemove', move, true)
      doc.removeEventListener('mouseup', up, true)
      doc.removeEventListener('selectionchange', clampSelection)
      textarea.removeEventListener('blur', finishDrag)
    }
    doc.addEventListener('mousemove', move, true)
    doc.addEventListener('mouseup', up, true)
    doc.addEventListener('selectionchange', clampSelection)
    textarea.addEventListener('blur', finishDrag)
  }

  textarea.addEventListener('mousedown', startDrag)
  return () => {
    finishDrag()
    textarea.removeEventListener('mousedown', startDrag)
  }
}
