import ColorUtil from 'color'
import { readAuthoredBackgroundDeclarations } from './get-values-background'
import { resolveCssPaintPreview } from './resolve-css-var-color'
import type { StyleSourceCandidate } from './style-property'

/** 只改纯色 background 的原声明；复杂简写继续使用颜色长写，保留其他背景配置。 */
export function getTextBackgroundShorthandWrite(
  source: StyleSourceCandidate | null,
  target: HTMLElement | null
): { deletions: string[] } | null {
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

  return { deletions: authored['background-color'] ? ['backgroundColor'] : [] }
}
