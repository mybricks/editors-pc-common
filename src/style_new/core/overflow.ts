import { createDirectionalWritePlans } from './four-side-write'
import type { StyleChangeItem } from './apply-style-change'
import type { StyleResolution } from './style-property'

export const OVERFLOW_AXIS_KEYS = ['overflowX', 'overflowY'] as const
export const isOverflowProperty = (key: string) => key === 'overflow' ||
  OVERFLOW_AXIS_KEYS.includes(key as typeof OVERFLOW_AXIS_KEYS[number])

/** 一轴可滚动时，另一轴的 visible/clip 分别计算为 auto/hidden。只用于提示。 */
export function getOverflowAdjustment(value: string | undefined, other: string | undefined) {
  const current = value || 'visible'
  if (!['auto', 'scroll', 'hidden'].includes(other || 'visible')) return undefined
  if (current === 'visible') return 'auto'
  if (current === 'clip') return 'hidden'
  return undefined
}

export function createOverflowWritePlans(
  changes: StyleChangeItem[],
  resolution: Pick<StyleResolution, 'get'>,
  target: HTMLElement | null,
  resolveSelector: (change: StyleChangeItem) => string | null
) {
  return createDirectionalWritePlans('overflow', changes, resolution, target, resolveSelector)
}
