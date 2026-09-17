import ColorUtil from 'color'
import { isComponentScopedSelector } from './build-zone-selectors-from-cssom'
import { getOrderedZoneSourceRules } from './zone-tab'
import type { ZoneTab } from './zone-tab'

export type BackgroundLayerOwnership = {
  backgroundImage: boolean
  backgroundColor: boolean
}

/** 与面板回显值核对，避免把 computed/inline 覆盖后的外部值归到页面规则上。 */
function sameValue(key: string, source: string, displayed: unknown): boolean {
  if (typeof displayed !== 'string') return false
  const normalize = (value: string) => value.replace(/\s+/g, ' ').trim().toLowerCase()
  if (normalize(source) === normalize(displayed)) return true
  if (key === 'backgroundColor') {
    try { return new ColorUtil(source).hexa() === new ColorUtil(displayed).hexa() } catch {}
  }
  return false
}

function readBackgroundDeclaration(
  style: CSSStyleDeclaration,
  key: 'backgroundImage' | 'backgroundColor',
): string {
  const property = key === 'backgroundImage' ? 'background-image' : 'background-color'
  const direct = style.getPropertyValue(property).trim()
  if (direct) return direct
  const shorthand = style.getPropertyValue('background').trim()
  if (!shorthand) return ''
  const imageLike = /gradient\s*\(|url\s*\(/i.test(shorthand)
  if (key === 'backgroundImage') return imageLike ? shorthand : 'none'
  if (imageLike) return ''
  return shorthand.match(/^(rgba?\([^)]+\)|#[0-9a-f]{3,8}|hsla?\([^)]+\)|[a-z-]+)\b/i)?.[1] || shorthand
}

/** background-image 的逗号列表由同一条声明拥有，background-color 独立归属。 */
export function getBackgroundLayerOwnership(
  displayed: Record<string, any>,
  options?: { comId?: string; zoneTab?: ZoneTab } | null,
): BackgroundLayerOwnership | undefined {
  if (!options?.zoneTab && !options?.comId) {
    // 不带画布来源上下文的普通编辑器维持原行为。
    return undefined
  }

  const ownership: BackgroundLayerOwnership = { backgroundImage: false, backgroundColor: false }
  const sources = options.zoneTab ? getOrderedZoneSourceRules(options.zoneTab) : []
  for (const source of sources) {
    const style = source.rule.style
    for (const key of ['backgroundImage', 'backgroundColor'] as const) {
      // CSSOM 对普通 background 简写可展开；含 var() 的简写也在这里保留原值。
      const declared = readBackgroundDeclaration(style, key)
      if (!declared) continue
      // sourceRules 已按级联顺序排列；同一属性后出现的声明才是当前 layer 的来源。
      ownership[key] = !!source.sourceSelector &&
        source.isPageStyle &&
        isComponentScopedSelector(source.selectorPart, options.comId || '') &&
        sameValue(key, declared, displayed[key])
    }
  }
  return ownership
}
