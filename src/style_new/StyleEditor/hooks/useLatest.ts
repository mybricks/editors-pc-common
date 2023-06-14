import { useRef } from 'react'

export function useLatest<T>(value: T) {
  const ref = useRef<T>(value)

  ref.current = value

  return ref
}
