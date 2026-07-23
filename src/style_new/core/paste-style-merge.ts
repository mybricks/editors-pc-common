/**
 * 合并粘贴时清理简写 / longhand 冲突。
 * 例：已有 backgroundImage，再粘贴 background → 删掉 backgroundImage，避免双渐变并存。
 */

type ShorthandGroup = {
  shorthand: string
  longhands: string[]
}

const PASTE_SHORTHAND_GROUPS: ShorthandGroup[] = [
  {
    shorthand: 'background',
    longhands: [
      'backgroundImage',
      'backgroundColor',
      'backgroundRepeat',
      'backgroundPosition',
      'backgroundSize',
      'backgroundOrigin',
      'backgroundClip',
      'backgroundAttachment',
      'webkitBackgroundClip',
      'WebkitBackgroundClip',
    ],
  },
  {
    shorthand: 'borderRadius',
    longhands: [
      'borderTopLeftRadius',
      'borderTopRightRadius',
      'borderBottomRightRadius',
      'borderBottomLeftRadius',
    ],
  },
  {
    shorthand: 'padding',
    longhands: ['paddingTop', 'paddingRight', 'paddingBottom', 'paddingLeft'],
  },
  {
    shorthand: 'margin',
    longhands: ['marginTop', 'marginRight', 'marginBottom', 'marginLeft'],
  },
  {
    shorthand: 'gap',
    longhands: ['rowGap', 'columnGap'],
  },
  {
    shorthand: 'overflow',
    longhands: ['overflowX', 'overflowY'],
  },
  {
    shorthand: 'border',
    longhands: [
      'borderTop',
      'borderRight',
      'borderBottom',
      'borderLeft',
      'borderWidth',
      'borderStyle',
      'borderColor',
      'borderTopWidth',
      'borderRightWidth',
      'borderBottomWidth',
      'borderLeftWidth',
      'borderTopStyle',
      'borderRightStyle',
      'borderBottomStyle',
      'borderLeftStyle',
      'borderTopColor',
      'borderRightColor',
      'borderBottomColor',
      'borderLeftColor',
    ],
  },
]

function hasOwnValue(style: Record<string, any>, key: string): boolean {
  if (!Object.prototype.hasOwnProperty.call(style, key)) return false
  const v = style[key]
  return v !== null && typeof v !== 'undefined' && v !== ''
}

/**
 * Figma 常导出 `background: linear-gradient(...)`。
 * 编辑器 / less 链路以 backgroundImage、backgroundColor longhand 为主，
 * 粘贴时先拆开，避免简写与 longhand 冲突清理时互相踩踏。
 */
export function normalizePastedBackgroundShorthand(
  style: Record<string, any>
): Record<string, any> {
  const out: Record<string, any> = { ...(style || {}) }
  if (!hasOwnValue(out, 'background')) return out

  const bg = String(out.background).trim()
  if (/gradient\s*\(/i.test(bg) || /url\s*\(/i.test(bg)) {
    if (!hasOwnValue(out, 'backgroundImage')) {
      out.backgroundImage = bg
    }
    delete out.background
    return out
  }

  if (
    !hasOwnValue(out, 'backgroundColor') &&
    (/^(#|rgba?\(|hsla?\(|var\()/i.test(bg) || /^[a-zA-Z]+$/i.test(bg))
  ) {
    out.backgroundColor = bg
    delete out.background
  }

  return out
}

/** 粘贴包内部：简写与 longhand 同时存在时，保留简写（贴近 Figma Style 片段） */
export function dedupePastedShorthands(pasted: Record<string, any>): Record<string, any> {
  const out = normalizePastedBackgroundShorthand(pasted || {})
  for (const group of PASTE_SHORTHAND_GROUPS) {
    if (!hasOwnValue(out, group.shorthand)) continue
    for (const key of group.longhands) {
      delete out[key]
    }
  }
  return out
}

/**
 * 当前样式 ∪ 粘贴样式，并按粘贴侧意图清理冲突项：
 * - 粘贴了简写 → 去掉对应 longhand（含当前已有的）
 * - 只粘贴了 longhand → 去掉对应简写
 */
export function mergeStylesWithPasteConflicts(
  current: Record<string, any>,
  pasted: Record<string, any>
): Record<string, any> {
  const pastedClean = dedupePastedShorthands(pasted)
  const merged: Record<string, any> = { ...(current || {}), ...pastedClean }

  for (const group of PASTE_SHORTHAND_GROUPS) {
    const pastedShorthand = hasOwnValue(pastedClean, group.shorthand)
    const pastedLonghand = group.longhands.some((key) => hasOwnValue(pastedClean, key))

    if (pastedShorthand) {
      for (const key of group.longhands) {
        delete merged[key]
      }
    } else if (pastedLonghand) {
      delete merged[group.shorthand]
    }
  }

  return merged
}

/**
 * 把冲突清理展开为 applyStyleChange 可用的 null 删除项（给 CSSPaste 面板用）。
 * 在已有 changes 基础上追加需要清掉的冲突 key。
 */
export function expandPasteConflictClears(
  changes: Array<{ key: string; value: any }>
): Array<{ key: string; value: any }> {
  const byKey = new Map<string, any>()
  for (const item of changes || []) {
    byKey.set(item.key, item.value)
  }

  const pastedLike: Record<string, any> = {}
  byKey.forEach((value, key) => {
    if (value !== null) pastedLike[key] = value
  })
  const pastedClean = dedupePastedShorthands(pastedLike)

  // 先按去重后的粘贴包重建
  const next = new Map<string, any>()
  Object.entries(pastedClean).forEach(([key, value]) => next.set(key, value))

  for (const group of PASTE_SHORTHAND_GROUPS) {
    const pastedShorthand = hasOwnValue(pastedClean, group.shorthand)
    const pastedLonghand = group.longhands.some((key) => hasOwnValue(pastedClean, key))

    if (pastedShorthand) {
      for (const key of group.longhands) {
        if (!next.has(key)) next.set(key, null)
      }
    } else if (pastedLonghand) {
      if (!next.has(group.shorthand)) next.set(group.shorthand, null)
    }
  }

  return Array.from(next.entries()).map(([key, value]) => ({ key, value }))
}
