import { parseLayers } from '../../StyleEditor/plugins/Background/layers'
import { readAuthoredBackgroundDeclarations } from '../get-values-background'
import { cssPropertyName } from '../style-property'
import { createStyleWriteTargetResolver } from '../style-write-target'
import type { StyleChangeItem, StyleRemovalPlan } from '../apply-style-change'
import type { StyleResolution } from '../style-property'
import type { ZoneTab } from '../zone-tab'

const IMPORTANT_SUFFIX_RE = /!important\s*$/i

/**
 * 作用：颜色切图片/渐变时，一次删除旧颜色/简写并写入新值，解决旧 background 残留。
 * 范围：当前 CSS 来源能生成颜色层，且颜色与图片属性写入同一 selector。
 * 沿用旧链路：普通改色、保留底色的加图/调图、减号/清空；透明底色、inline、跨 selector 的请求。
 * 保留：其他背景层、配套设置、原优先级和非背景样式；不写透明色覆盖旧颜色。
 * 示例（省略配套属性）：.test { background: linear-gradient(red, blue), #fff; }
 *                  → .test { background-image: linear-gradient(red, blue), url("a.png"); }
 */
export function createBackgroundReplacementPlan(
  changes: StyleChangeItem[], resolution: StyleResolution, tab: ZoneTab, target: HTMLElement | null
): StyleRemovalPlan | null {
  const imageKeys = ['backgroundImage', 'backgroundSize', 'backgroundRepeat', 'backgroundPosition']
  // 入口：清除颜色 + 写入完整图片属性。普通改色、单项删除和整体清空不匹配。
  if (changes.length !== 5 || !changes.some(item => item.key === 'backgroundColor' && item.value === null) ||
    !imageKeys.every(key => changes.some(item => item.key === key && item.value != null))) return null

  const colorSource = resolution.get('backgroundColor').winner
  // 只接管当前状态的 CSS 来源；inline 和基础态回显仍走旧链路。
  if (!colorSource?.currentState || colorSource.inline || !colorSource.source) return null
  // 透明色/unset 等没有颜色行：新增或编辑图片仍走旧链路。
  // 复用面板解析排除这些来源，避免误删屏蔽声明、露出下层底色。
  if (!parseLayers(undefined, colorSource.value).length) return null
  const selector = colorSource.label
  const resolveWriteTarget = createStyleWriteTargetResolver(tab, target, resolution)
  const imageChanges = changes.filter(item => item.key !== 'backgroundColor')
  // 复用原选址；图片属性与颜色不在同一 selector 时，不接管此次写入。
  if (!selector || imageChanges.some(item => resolveWriteTarget(item.key, item.target).selector !== selector)) return null

  // 读源码确认实际声明，避免把 CSSOM 合成的 background 当成源码简写删除。
  const declarations = readAuthoredBackgroundDeclarations(colorSource.source.rule)
  if (declarations.length !== 1) return null
  const authored = declarations[0]
  if (!authored.background && !authored['background-color']) return null

  const style: Record<string, any> = {}
  // 独立颜色长写只删 background-color；源码存在 background 时才拆分简写。
  const deletions = ['backgroundColor']
  const sourceStyle = colorSource.source.rule.style
  if (authored.background) {
    deletions.unshift('background')
    // 保留原规则的裁剪、定位区域和滚动设置，不复制其他规则的值。
    ;['backgroundOrigin', 'backgroundClip', 'backgroundAttachment'].forEach(key => {
      const property = cssPropertyName(key)
      const value = sourceStyle.getPropertyValue(property)
      if (value) style[key] = value + (sourceStyle.getPropertyPriority(property) === 'important' ? ' !important' : '')
    })
  }
  // 新图层列表使用面板提交值，保留原属性的 !important，避免拆分后优先级下降。
  imageChanges.forEach(({ key, value }) => {
    const important = sourceStyle.getPropertyPriority(cssPropertyName(key)) === 'important'
    style[key] = important && !IMPORTANT_SUFFIX_RE.test(String(value)) ? `${value} !important` : value
  })

  // 复用原执行器一次提交删除和新值，避免分开提交产生额外历史记录。
  return { groups: [{ selector, style, deletions }], canClear: true }
}
