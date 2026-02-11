import { useRef, useCallback, useEffect } from 'react'

interface DragState {
  isDragging: boolean
  startX: number
  startValue: number
  inputEl: HTMLInputElement | null
  rafId: number | null
  /** 标记 onDragStart 是否覆盖了起始值（如单位从 auto 切换到 px） */
  useCustomEnd: boolean
}

interface DragNumberOptions {
  /** 最小值，默认 0 */
  min?: number
  /** 最大值，默认 Infinity */
  max?: number
  /** 灵敏度，鼠标移动多少像素改变 1，默认 1 */
  sensitivity?: number
  /** 是否在拖拽过程中持续提交值，默认 false（只在松手时提交） */
  continuous?: boolean
  /** 拖拽开始时的回调，可返回数字覆盖起始值 */
  onDragStart?: (currentValue: any, inputEl: HTMLInputElement | null) => number | void
  /** 拖拽结束时的回调，当 onDragStart 返回了覆盖值时调用（替代 blur 提交） */
  onDragEnd?: (finalValue: number) => void
}

/**
 * 拖拽调整数值的 Hook（类似 Figma 的交互）
 * 
 * 在图标上按住鼠标左右拖动，可以调整旁边 InputNumber 的值。
 * 拖拽过程中直接操作 DOM 更新显示值，松手时触发 input 的 blur 提交最终值。
 * 
 * @example
 * const getDragProps = useDragNumber()
 * 
 * <div {...getDragProps('0px', '拖拽调整左边距')}>
 *   <PaddingLeftOutlined/>
 * </div>
 * <InputNumber defaultValue={...} onChange={...} />
 */
export function useDragNumber(options: DragNumberOptions = {}) {
  const { min = 0, max = Infinity, sensitivity = 1, continuous = false, onDragStart, onDragEnd } = options

  // 用 ref 保存回调，避免 handler 因回调变化而重建
  const onDragStartRef = useRef(onDragStart)
  onDragStartRef.current = onDragStart
  const onDragEndRef = useRef(onDragEnd)
  onDragEndRef.current = onDragEnd

  const dragStateRef = useRef<DragState>({
    isDragging: false,
    startX: 0,
    startValue: 0,
    inputEl: null,
    rafId: null,
    useCustomEnd: false
  })

  const findInputEl = useCallback((iconEl: HTMLElement): HTMLInputElement | null => {
    // 向上查找包含 input 的容器
    let current: HTMLElement | null = iconEl
    let maxDepth = 5 // 最多向上查找5层
    
    while (current && maxDepth > 0) {
      const input = current.querySelector('input')
      if (input) return input
      current = current.parentElement
      maxDepth--
    }
    
    return null
  }, [])

  const handleMouseDown = useCallback((e: React.MouseEvent, currentValue: any) => {
    e.preventDefault()
    
    const iconEl = e.currentTarget as HTMLElement
    const inputEl = findInputEl(iconEl)

    // 优先从 DOM input 读取最新值（上次拖拽/输入的结果），避免因父组件未及时回传而使用过期的 props 值
    let startValue = parseFloat(currentValue) || 0
    if (inputEl) {
      const domValue = parseFloat(inputEl.value)
      if (!isNaN(domValue)) {
        startValue = domValue
      }
    }

    let useCustomEnd = false

    if (onDragStartRef.current) {
      const overrideValue = onDragStartRef.current(currentValue, inputEl)
      if (typeof overrideValue === 'number') {
        startValue = overrideValue
        useCustomEnd = true
      }
    }

    dragStateRef.current = {
      isDragging: true,
      startX: e.clientX,
      startValue,
      inputEl,
      rafId: null,
      useCustomEnd
    }
    document.body.style.cursor = 'ew-resize'
    document.body.style.userSelect = 'none'
  }, [findInputEl])

  const handleMouseMove = useCallback((e: MouseEvent) => {
    const state = dragStateRef.current
    if (!state.isDragging) return

    const deltaX = e.clientX - state.startX
    const newValue = Math.min(max, Math.max(min, Math.round(state.startValue + deltaX * sensitivity)))
    const newValueStr = String(newValue)

    // 直接操作 DOM 更新输入框显示值
    if (state.inputEl) {
      state.inputEl.value = newValueStr
      
      // 如果开启了持续提交模式，使用 RAF 节流提交值
      if (continuous) {
        if (state.rafId !== null) {
          cancelAnimationFrame(state.rafId)
        }
        state.rafId = requestAnimationFrame(() => {
          if (state.inputEl) {
            state.inputEl.focus()
            state.inputEl.blur()
          }
          state.rafId = null
        })
      }
    }
  }, [min, max, sensitivity, continuous])

  const handleMouseUp = useCallback(() => {
    const state = dragStateRef.current
    if (!state.isDragging) return

    // 取消未完成的 RAF
    if (state.rafId !== null) {
      cancelAnimationFrame(state.rafId)
      state.rafId = null
    }

    if (state.useCustomEnd && onDragEndRef.current) {
      // 当 onDragStart 覆盖了起始值时（如单位从 auto 切到 px），
      // 由外部回调直接提交最终值，绕过 InputNumber 内部可能还未同步的 unit 状态
      const finalValue = state.inputEl ? (parseFloat(state.inputEl.value) || 0) : state.startValue
      onDragEndRef.current(finalValue)
    } else {
      // 触发 input 的 focus -> blur，让 InputNumber 内部走 onBlur 逻辑提交值
      if (state.inputEl) {
        state.inputEl.focus()
        state.inputEl.blur()
      }
    }

    state.isDragging = false
    state.inputEl = null
    document.body.style.cursor = ''
    document.body.style.userSelect = ''
  }, [])

  // 全局事件监听
  useEffect(() => {
    document.addEventListener('mousemove', handleMouseMove)
    document.addEventListener('mouseup', handleMouseUp)

    return () => {
      document.removeEventListener('mousemove', handleMouseMove)
      document.removeEventListener('mouseup', handleMouseUp)
    }
  }, [handleMouseMove, handleMouseUp])

  /**
   * 获取需要绑定到图标元素上的 props
   * @param currentValue 当前值（如 '0px'、10 等，会自动 parseFloat）
   * @param tip tooltip 提示文字
   */
  const getDragProps = useCallback((currentValue: any, tip?: string) => {
    return {
      style: { cursor: 'ew-resize' } as React.CSSProperties,
      'data-mybricks-tip': tip,
      onMouseDown: (e: React.MouseEvent) => handleMouseDown(e, currentValue)
    }
  }, [handleMouseDown])

  return getDragProps
}
