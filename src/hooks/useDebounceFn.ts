import { useRef } from 'react'
import { debounce } from '../util/lodash';

/**
 * 防抖（函数）
 * @param fn    需要防抖处理的函数
 * @param delay 延迟时间
 * @returns     经过防抖处理的函数
 */
export function useDebounceFn(fn: any, delay: number): any {
  const fnRef = useRef<any>(debounce(
    (...args: any[]) => {
      fn(...args)
    },
    delay
  ))

  return fnRef.current
}