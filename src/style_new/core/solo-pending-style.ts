import { getShorthandFamily } from './style-shorthand-groups'
import { cssPropertyName } from './style-property'

export type PendingSoloValue = {
  value: unknown
  sourceKey: string
  sourceValue: unknown
}

export function recordPendingSoloValues(
  pending: Map<string, PendingSoloValue>,
  changes: readonly { key: string; value: unknown }[],
  previousStyle: Record<string, unknown>,
  nextStyle: Record<string, unknown>
) {
  changes.forEach(({ key, value }) => {
    if (value == null) {
      pending.delete(key)
      return
    }

    const normalizedValue = nextStyle[key]
    if (normalizedValue !== undefined) {
      pending.set(key, { value: normalizedValue, sourceKey: key, sourceValue: normalizedValue })
      return
    }

    // 长写被折叠成简写后，使用实际写入的简写判断源码何时完成回写。
    const property = cssPropertyName(key)
    const shorthand = Object.keys(nextStyle)
      .filter(candidate => nextStyle[candidate] !== previousStyle[candidate] &&
        getShorthandFamily(cssPropertyName(candidate)).includes(property))
      .sort((a, b) => getShorthandFamily(cssPropertyName(a)).length -
        getShorthandFamily(cssPropertyName(b)).length)[0]
    pending.set(key, {
      value,
      sourceKey: shorthand || key,
      sourceValue: shorthand ? nextStyle[shorthand] : value,
    })
  })
}

export function reconcilePendingSoloValues(
  pending: Map<string, PendingSoloValue>,
  sourceStyle: Record<string, unknown> | undefined,
  liveStyle: Record<string, unknown>
) {
  pending.forEach((entry, key) => {
    if (sourceStyle?.[entry.sourceKey] === entry.sourceValue) pending.delete(key)
    else liveStyle[key] = entry.value
  })
}
