import { getTextBackgroundShorthandWrite } from '../text-background-write'
import { readAuthoredBackgroundDeclarations } from '../get-values-background'
import type { StyleProperty } from '../style-property'

/** 背景业务统一入口，当前接入纯色变量简写删除，后续背景处理逐步迁入。 */
export function backgroundCore(key: string, property: StyleProperty, target: HTMLElement | null) {
  return getBackgroundColorShorthandRemoval(key, property, target)
}

/** 删除纯色变量简写及同规则的颜色长写，保留独立写出的背景图片。 */
function getBackgroundColorShorthandRemoval(
  key: string,
  property: StyleProperty,
  target: HTMLElement | null
): { deletions: string[] } | null {
  if (key !== 'backgroundColor') return null
  const source = property.winner
  if (!source?.source) return null
  // 复用已有的源码读取和纯色判断；变量为图片、渐变或未解析时继续走原拆分流程。
  const shorthand = getTextBackgroundShorthandWrite(source, target)
  if (!shorthand) return null
  // 改色后 CSSOM 只暴露颜色长写，需要从源码识别被遮住的变量简写。
  const [authored] = readAuthoredBackgroundDeclarations(source.source.rule)
  if (!/^var\s*\(/i.test(authored.background)) return null
  return { deletions: ['background', ...shorthand.deletions] }
}
