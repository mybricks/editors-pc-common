import { useRef } from 'react'

import { useDragNumber } from './useDragNumber'

/** 数值图标拖拽直接提交编辑值，不依赖输入框的 focus/blur 推断。 */
export function useLengthInputDrag(
  value: string | number | null | undefined,
  onChange: (next: string) => void,
  options?: { min?: number },
) {
  const startRef = useRef(0)
  const lastSubmittedRef = useRef<number | null>(null)
  const unitRef = useRef('px')

  const commit = (next: number) => {
    if (lastSubmittedRef.current === null && next === startRef.current) return
    if (lastSubmittedRef.current === next) return
    lastSubmittedRef.current = next
    onChange(`${next}${unitRef.current}`)
  }

  return useDragNumber({
    min: options?.min,
    endWithLastDraggedValue: true,
    onDragStart: (currentValue, inputEl) => {
      const source = String(value ?? currentValue ?? '').trim()
      const match = source.match(/^(-?(?:\d+(?:\.\d+)?|\.\d+))([a-z%]*)$/i)
      unitRef.current = match?.[2] ?? 'px'
      const displayed = parseFloat(inputEl?.value ?? '')
      const sourceNumber = parseFloat(source)
      const currentNumber = parseFloat(String(currentValue ?? ''))
      startRef.current = Number.isFinite(displayed) ? displayed
        : Number.isFinite(sourceNumber) ? sourceNumber
          : Number.isFinite(currentNumber) ? currentNumber : 0
      lastSubmittedRef.current = null
      return startRef.current
    },
    onDragChange: commit,
    onDragEnd: commit,
  })
}
