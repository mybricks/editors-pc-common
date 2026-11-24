import { decomposeBackgroundStack } from '../StyleEditor/helper/paint-stack'
import { hasFallbackStyleCandidate } from './style-property'
import type { StyleResolution } from './style-property'
import { getTextBackgroundShorthandWrite } from './text-background-write'
import { isComponentScopedSelector } from './build-zone-selectors-from-cssom'
import { readAuthoredBackgroundDeclarations } from './get-values-background'
import { resolveCssVarColor } from './resolve-css-var-color'
import type { StyleChangeItem, StyleRemovalPlan } from './apply-style-change'

/**
 * 例：选中当前组件的 .demo，--bg-color 是有效颜色，没有其他规则提供底色。
 *
 * 点击「+」前：
 * .demo { background-color: var(--bg-color); }
 *
 * 点击「+」时：
 * 1. 本函数找到 .demo 的旧颜色 var(--bg-color)，确认可以替换这条颜色声明。
 * 2. 填充编辑器把新白色放在上面，把 var(--bg-color) 包成同色渐变放在下面。
 * 3. 执行器在 .demo 中写入这两层图片，同时删除原 background-color。
 *
 * 点击「+」后：
 * .demo {
 *   background-image: linear-gradient(#FFFFFF, #FFFFFF),
 *                     linear-gradient(var(--bg-color), var(--bg-color));
 *   background-size: auto, auto;
 *   background-repeat: no-repeat, no-repeat;
 *   background-position: 0% 0%, 0% 0%;
 * }
 *
 * 如果点击前是 .demo { background: var(--bg-color); }，最终 CSS 也如上，
 * 但第 3 步删除的是原 background。变量引用仍在，之后改 --bg-color 仍能改变旧颜色层。
 */
export function getBackgroundColorMigration(
  resolution: Pick<StyleResolution, 'get'>,
  target: HTMLElement | null,
  comId: string
) {
  const color = resolution.get('backgroundColor')
  const source = color.winner
  // .demo { background-color: red; } 在当前页面或组件源码中 → 可以继续判断。
  // .library-button { background-color: red; } 只在外部组件库中 → 返回 null，不删库里的颜色。
  if (!source?.source || !source.label || (!source.source.isPageStyle &&
    !isComponentScopedSelector(source.source.selectorPart, comId))) return null
  // .demo { background: red; } → 可以把 red 变成渐变，再删 background。
  // .demo { background: red url("old.png"); } → 不在这里拆这条简写，返回原有添加流程。
  const shorthand = getTextBackgroundShorthandWrite(source, target)
  if (!shorthand) {
    // .demo { background-color: red; }，但当前选中的是 .demo:hover：保留 .demo 的红色。
    if (!source.currentState || source.inline) return null
    // 看源码原文决定删什么：.demo { background-color: red; } 应删 background-color。
    // 即使浏览器把其他配套长写一起合成为 background，也不能据此误删整组背景。
    const declarations = readAuthoredBackgroundDeclarations(source.source.rule)
    if (declarations.length !== 1 || declarations[0].background) return null
    const authoredColor = declarations[0]['background-color']
    // .demo { background-color: var(--missing); }，变量未定义 → 保留这条声明，不转成渐变。
    if (!authoredColor || !resolveCssVarColor(authoredColor, target)) return null
  }

  // 元素同时匹配 .demo { background-color: red; } 和 .picture { background-image: url("old.png"); }：
  // 返回 null，不把 .picture 中的图片一起搬进 .demo。
  const image = resolution.get('backgroundImage').winner
  if (image && image.value !== 'none' && (image.label !== source.label || image.inline !== source.inline)) return null
  const stack = decomposeBackgroundStack({
    backgroundImage: image?.value,
    backgroundClip: resolution.get('backgroundClip').winner?.value,
    WebkitBackgroundClip: resolution.get('WebkitBackgroundClip').winner?.value,
    backgroundOrigin: resolution.get('backgroundOrigin').winner?.value,
  })
  // .demo { background-image: linear-gradient(red, blue); background-clip: text; } 是文字渐变，
  // 这里返回 null，保留它的文字用途；渐变边框同样处理。
  if (stack.textLayer || stack.borderLayer) return null

  const hasFallbackColor = hasFallbackStyleCandidate(color)
  return {
    selector: source.label,
    value: source.value,
    important: source.important,
    hasFallbackColor,
    // .demo { background-color: red; } 搬完后删除 background-color。
    // 若还匹配 .base { background-color: blue; }，则改写成 unset，完整例子见下方。
    deletions: [...(shorthand ? ['background'] : []), ...(!hasFallbackColor ? ['backgroundColor'] : [])],
  }
}

/**
 * 把上面的 .demo 例子交给执行器一次写完。
 *
 * 点击前：.demo { background-color: var(--bg-color); }
 * 点击 + 后，填充编辑器提交：
 *   backgroundImage = "linear-gradient(#FFFFFF, #FFFFFF), linear-gradient(var(--bg-color), var(--bg-color))"
 *   backgroundColor = null，background = null，以及两层图片的 size/repeat/position。
 *
 * 本函数确认原来写的是 background-color，就返回：在 .demo 写入新图片，删除 backgroundColor。
 * 执行后得到上面的两层图片 CSS；撤销一次，就回到 .demo { background-color: var(--bg-color); }。
 * 如果只是 .demo { width: 10px; } 改成 .demo { width: 20px; }，本函数返回 null，交回原流程。
 */
export function createBackgroundColorMigrationPlan(
  items: StyleChangeItem[], changes: StyleChangeItem[], resolution: Pick<StyleResolution, 'get'>,
  target: HTMLElement | null, comId: string
): StyleRemovalPlan | null {
  // .demo { background-color: red; } 点 + → 有新图片列表，也有 background: null，可以继续。
  // .demo { background-color: red; } 改成 blue → 没有迁移请求，返回 null；同时改 height 也返回 null。
  const isBackgroundColorMigration = items.some(item => item.key === 'background' && item.value === null) &&
    items.some(item => item.key === 'backgroundImage' && item.value != null) &&
    items.every(item => ['background', 'backgroundColor', 'backgroundImage',
      'backgroundSize', 'backgroundRepeat', 'backgroundPosition'].includes(item.key))
  if (!isBackgroundColorMigration) return null

  const migration = getBackgroundColorMigration(resolution, target, comId)
  if (!migration) return null

  // 点击前：.demo { background-color: red !important; }
  // 点击后（仅列颜色）：.demo { background-image: linear-gradient(#FFFFFF, #FFFFFF), linear-gradient(red, red) !important; }
  const style = Object.fromEntries(changes.filter(item => item.value != null).map(({ key, value }) =>
    [key, migration.important && !/!important\s*$/i.test(String(value)) ? `${value} !important` : value]))
  // 例：<div class="base demo">，点击前：
  // .base { background-color: blue; }
  // .demo { background-color: rgba(255, 0, 0, 0.5); }
  // 点击后（仅列颜色；.base 保留原样）：
  // .demo {
  //   background-image: linear-gradient(#FFFFFF, #FFFFFF), linear-gradient(rgba(255, 0, 0, 0.5), rgba(255, 0, 0, 0.5));
  //   background-color: unset;
  // }
  // 如果只删除原 background-color，.base 的蓝色会重新生效；之后移走白色层，红色渐变下面就会透出蓝色。
  if (migration.hasFallbackColor) {
    style.backgroundColor = migration.important ? 'unset !important' : 'unset'
  }
  return {
    canClear: true,
    groups: [{ selector: migration.selector, style, deletions: migration.deletions }],
  }
}
