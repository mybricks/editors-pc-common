import type { StyleChangeItem } from './apply-style-change'
import {
  cssPropertyName, readInlineStyleProperties, readStaticInlineStyleInfo, resolveEffectiveStyleSource,
} from './style-property'
import type { StyleResolution } from './style-property'
import { splitAncestorState, splitZoneSelectorState } from './zone-tab'

const LONGHAND_KEYS = ['flexGrow', 'flexShrink', 'flexBasis'] as const
const IMPORTANT = /!important\s*$/i

/** 高级弹性字段按各自来源写入；拆简写时只携带同一来源的其余值。 */
export function createFlexLonghandWritePlans(
  changes: StyleChangeItem[],
  resolution: Pick<StyleResolution, 'get'>,
  target: HTMLElement | null,
  resolveSelector: (change: StyleChangeItem) => string | null
) {
  const groups = new Map<string, StyleChangeItem[]>()
  changes.filter(change => LONGHAND_KEYS.includes(change.key as typeof LONGHAND_KEYS[number])).forEach(change => {
    const winner = resolveEffectiveStyleSource(resolution.get(change.key).candidates.filter(item => item.currentState))
    if (change.value == null && !winner) return
    const selector = change.value == null ? winner?.label || '' : resolveSelector(change) || ''
    const group = groups.get(selector) || []
    group.push(change)
    groups.set(selector, group)
  })

  const inlineProperties = readInlineStyleProperties(target)
  return Array.from(groups, ([selector, groupChanges]) => {
    const source = (key: string) => resolveEffectiveStyleSource(resolution.get(key).candidates.filter(item =>
      item.currentState && item.label === selector
    ))
    const shorthand = source('flex')
    // 连续编辑时 CSSOM 可能尚未刷新，仍可从长写的来源标记识别原简写。
    const hasShorthand = !!shorthand || LONGHAND_KEYS.some(key => source(key)?.property === 'flex')
    const style: Record<string, any> = {}
    if (hasShorthand) {
      LONGHAND_KEYS.forEach(key => {
        const candidate = source(key)
        if (candidate) style[key] = `${candidate.value}${candidate.important ? ' !important' : ''}`
      })
    }
    const deletions = hasShorthand ? ['flex'] : []
    groupChanges.forEach(({ key, value }) => {
      if (value == null) {
        delete style[key]
        deletions.push(key)
      } else {
        const important = source(key)?.important
        style[key] = important && !IMPORTANT.test(String(value)) ? `${value} !important` : value
      }
    })

    let unsupported = !selector
    // 不透明简写不能在只拿到部分字段时被删除。
    unsupported ||= hasShorthand && LONGHAND_KEYS.some(key => !source(key) &&
      !groupChanges.some(change => change.key === key))
    let requiredDeletions = deletions
    if (selector === 'inline') {
      requiredDeletions = deletions.filter(key => inlineProperties.has(cssPropertyName(key)))
      const splittingShorthand = requiredDeletions.includes('flex') && readStaticInlineStyleInfo(target, 'flex', true)
      unsupported ||= requiredDeletions.some(key => !readStaticInlineStyleInfo(target, key, true)) ||
        Object.keys(style).some(key => !readStaticInlineStyleInfo(target, key) &&
          !(splittingShorthand && !inlineProperties.has(cssPropertyName(key)))) ||
        Object.values(style).some(value => IMPORTANT.test(String(value)))
    } else if (!(splitAncestorState(selector) || splitZoneSelectorState(selector)).pseudo) {
      // 普通样式要改的属性如果也写在 inline 里，先阻止修改，避免最后改到 inline。
      // 父级 Hover 时的样式要单独写 CSS；子级 inline 已有 flex，不代表这次 Hover 修改不能执行。
      unsupported ||= [...Object.keys(style), ...requiredDeletions].some(key => inlineProperties.has(cssPropertyName(key)))
    }
    return { property: 'flex' as const, selector, style, deletions: requiredDeletions, clearedKeys: [] as string[], unsupported }
  })
}
