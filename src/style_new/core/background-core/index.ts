import { getTextBackgroundShorthandWrite } from '../text-background-write'
import { readAuthoredBackgroundDeclarations } from '../get-values-background'
import { parseLayers } from '../../StyleEditor/plugins/Background/layers'
import { cssPropertyName } from '../style-property'
import { createStyleWriteTargetResolver } from '../style-write-target'
import type { StyleChangeItem, StyleRemovalPlan } from '../apply-style-change'
import type { StyleProperty, StyleResolution } from '../style-property'
import type { ZoneTab } from '../zone-tab'

/**
 * 背景规则统一出口：只生成删除/替换计划，实际写入仍由 applyStyleRemoval 完成。
 * 原有变量纯色删除改为对象方法调用，规则不变；本次新增颜色切图片/渐变的替换计划。
 */
export const backgroundCore = {
  getBackgroundColorShorthandRemoval,
  createBackgroundReplacementPlan,
}

/**
 * 沿用 master 原有的变量纯色删除，本次仅调整对外调用方式。
 * --bg 为 red 时：.test { background: var(--bg); background-image: url("a.png"); }
 * 删除颜色后：.test { background-image: url("a.png"); }
 */
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

/**
 * 颜色切图片/渐变：之前只追加 background-image，旧 background/底色仍留在源码中。
 * 换图前：.test { background: linear-gradient(red, blue), #fff; }
 * 换图后：.test { background-image: linear-gradient(red, blue), url("a.png"); }
 * 示例省略配套属性；本方法将旧声明删除和新图层放在同一份计划中，由原执行器一次写入。
 */
function createBackgroundReplacementPlan(
  changes: StyleChangeItem[], resolution: StyleResolution, tab: ZoneTab, target: HTMLElement | null
): StyleRemovalPlan | null {
  const imageKeys = ['backgroundImage', 'backgroundSize', 'backgroundRepeat', 'backgroundPosition']
  // 仅匹配序列化后的五项替换：清除颜色 + 写入 image/size/repeat/position。
  // 普通改色、保留底色的加图和减号不匹配，继续原流程。
  if (changes.length !== 5 || !changes.some(item => item.key === 'backgroundColor' && item.value === null) ||
    !imageKeys.every(key => changes.some(item => item.key === key && item.value != null))) return null

  // 只处理当前状态的样式规则；内联样式及其他状态的颜色继续原链路。
  const source = resolution.get('backgroundColor').winner
  if (!source?.currentState || source.inline || !source.source) return null
  // 透明色/unset 上的普通加图、调图也可能提交颜色清空，此处排除，保留原有屏蔽声明。
  if (!parseLayers(undefined, source.value).length) return null
  const imageChanges = changes.filter(item => item.key !== 'backgroundColor')
  const resolveWriteTarget = createStyleWriteTargetResolver(tab, target, resolution)
  // 删颜色和写图片必须落在同一 selector，例如只改 .test:hover，不删除 .test 的底色。
  if (!source.label || imageChanges.some(item => resolveWriteTarget(item.key, item.target).selector !== source.label)) return null

  // CSSOM 会由长写合成 background，需从源码确认简写是否真实存在。
  // 只处理唯一的匹配规则；同 selector 多条规则继续原链路，不在这里合并。
  const declarations = readAuthoredBackgroundDeclarations(source.source.rule)
  if (declarations.length !== 1) return null
  const authored = declarations[0]
  if (!authored.background && !authored['background-color']) return null

  const style: Record<string, any> = {}
  // .test { background-color: #fff; } 只删颜色；源码存在 background 时才额外删除简写。
  const deletions = ['backgroundColor']
  const sourceStyle = source.source.rule.style
  if (authored.background) {
    deletions.unshift('background')
    // 删除简写也会清掉 origin/clip/attachment，需补回原值；image/size/repeat/position 使用新图层列表。
    // 例如 background: #fff fixed content-box，换图后仍保留 fixed 及 origin/clip 的 content-box。
    ;['backgroundOrigin', 'backgroundClip', 'backgroundAttachment'].forEach(key => {
      const property = cssPropertyName(key)
      const value = sourceStyle.getPropertyValue(property)
      if (value) style[key] = value + (sourceStyle.getPropertyPriority(property) === 'important' ? ' !important' : '')
    })
  }
  // 保留原规则各属性的优先级，例如 background: #fff !important 换图后图片仍带 !important。
  imageChanges.forEach(({ key, value }) => {
    const important = sourceStyle.getPropertyPriority(cssPropertyName(key)) === 'important'
    style[key] = important && !/!important\s*$/i.test(String(value)) ? `${value} !important` : value
  })
  return { groups: [{ selector: source.label, style, deletions }], canClear: true }
}
