/**
 * 单行双击编辑时，左右越界仍按水平方向延伸选区。
 * 原生 textarea 会把越界点按纵向位置映射到文首或文末，导致选区反转。
 */
export function limitSingleLineSelection(textarea: HTMLTextAreaElement): () => void {
  const doc = textarea.ownerDocument
  let finishDrag = () => {}

  const startDrag = (event: MouseEvent) => {
    finishDrag()
    // 第一次 mousedown 启动拖选；双击的后续 mousedown 留给原生词语选中逻辑。
    if (event.button !== 0 || event.detail !== 1 || /[\r\n]/.test(textarea.value)) return

    const style = getComputedStyle(textarea)

    // 原框可能被拉高，所以用同宽副本判断文字是否实际自动折行。
    const measure = textarea.cloneNode() as HTMLTextAreaElement
    measure.value = textarea.value
    measure.rows = 1
    Object.assign(measure.style, {
      position: 'absolute', visibility: 'hidden',
      width: style.width, height: 'auto',
      overflow: 'hidden',
    })
    textarea.parentElement!.appendChild(measure)
    // hidden 防止滚动条挤窄测量宽度；比较 pre-wrap 与不换行高度，避免把字形高度误判为折行。
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
      // 缩放手柄没有文字选区，保持 textarea 原生 resize 行为。
      if (!selecting) return
      const rect = textarea.getBoundingClientRect()
      if (lastX < rect.left && (textarea.selectionStart !== 0 || textarea.selectionEnd !== anchor)) {
        textarea.setSelectionRange(0, anchor, 'backward')
      } else if (lastX > rect.right && (textarea.selectionStart !== anchor || textarea.selectionEnd !== textarea.value.length)) {
        textarea.setSelectionRange(anchor, textarea.value.length, 'forward')
      }
    }
    const move = (event: MouseEvent) => {
      // 拖动离开 textarea 后仍由 document 接收 mousemove；释放鼠标后立即结束本次监听。
      if (!(event.buttons & 1)) {
        finishDrag()
        return
      }
      if (anchor === undefined) {
        // 等原生 mousedown 完成定位，再读取真正的锚点；已有选区继续交给浏览器。
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
    // 同一套清理供 mouseup、失焦、下一次按下和组件卸载复用，避免 document 监听累积。
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
