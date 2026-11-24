import ColorUtil from 'color'
import { readAuthoredBackgroundDeclarations } from './get-values-background'
import { resolveCssPaintPreview } from './resolve-css-var-color'
import type { StyleSourceCandidate } from './style-property'

/**
 * 判断能否把颜色改动写回原 background 简写；不能时继续使用 background-color 长写。
 *
 * 例：.test { background: var(--bg); } 只改颜色 → .test { background: blue; }
 * .test { background: url("a.png") red; } 无法确认只有纯色 → 仍写 background-color。
 */
export function getBackgroundShorthandWrite(
  source: StyleSourceCandidate | null,
  target: HTMLElement | null
): { deletions: string[]; important: boolean } | null {
  if (!source?.currentState || source.inline || !source.source) return null

  // CSSOM 会由 longhand 合成 background，必须查源码才能确定原来使用了哪种写法。
  const declarations = readAuthoredBackgroundDeclarations(source.source.rule)
  if (declarations.length !== 1) return null
  const authored = declarations[0]
  const background = authored.background
  if (!background) return null

  const resolved = resolveCssPaintPreview(background, target)
  let isColor = resolved.toLowerCase() === 'currentcolor'
  try {
    new ColorUtil(resolved)
    isColor = true
  } catch {
    // 支持浏览器认识、color 库尚未覆盖的色值，例如 oklch()。
    const css = target?.ownerDocument?.defaultView?.CSS
    if (!/var\s*\(/i.test(resolved)) isColor ||= !!css?.supports('color', resolved)
  }
  if (!isColor) return null

  // 旧版本改色可能已经追加过 background-color，写回简写时一并删除，避免它继续覆盖颜色。
  return {
    deletions: authored['background-color'] ? ['backgroundColor'] : [],
    // 同规则还有 background-color 时，颜色 winner 来自长写，优先级仍需从原 background 简写读取。
    important: source.source.rule.style.getPropertyPriority('background') === 'important',
  }
}
