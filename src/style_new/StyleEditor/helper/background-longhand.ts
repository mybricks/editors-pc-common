import { splitBackgroundLayers } from './gradient-border'

// background 简写中省略的成员使用这些 CSS 初始值，例如省略 image 表示 none。
const BACKGROUND_LAYER_INITIAL_VALUES: Record<string, string> = {
  'background-image': 'none',
  'background-size': 'auto',
  'background-repeat': 'repeat',
  'background-origin': 'padding-box',
  'background-clip': 'border-box',
  'background-attachment': 'scroll',
}

/**
 * 将可读 background 简写的 CSSOM 分项转换成可独立写回的长写值。
 * 例如 background: linear-gradient(red, blue), #fff，Chromium 可能返回：
 *   background-image: linear-gradient(red, blue), initial
 *   background-size: initial, initial
 * initial 可以作为整条属性的值，却不能作为逗号列表中的一项；这里分别转为
 * linear-gradient(red, blue), none 和 auto, auto，让删除 #fff 后仍能保留渐变。
 * 只转换当前规则的值，实际删除和写回仍由原有删除计划完成。
 */
export function normalizeBackgroundLonghandValue(
  style: CSSStyleDeclaration, key: string, value: string | undefined
): string | undefined {
  if (key === 'background-position' && !value) {
    // position 可能为空，但同一规则仍能读到各层的 x/y；按层配对，保留显式位置。
    // 例如 x = "10px, initial"、y = "20px, initial" → "10px 20px, 0% 0%"。
    const x = splitBackgroundLayers(style.getPropertyValue('background-position-x'))
    const y = splitBackgroundLayers(style.getPropertyValue('background-position-y'))
    value = x.map((part, index) =>
      `${part === 'initial' ? '0%' : part} ${y[index] === 'initial' ? '0%' : y[index]}`
    ).join(', ')
  } else if (value && BACKGROUND_LAYER_INITIAL_VALUES[key]) {
    const layers = splitBackgroundLayers(value)
    // 只替换多层列表中的 initial，例如 "no-repeat, initial" → "no-repeat, repeat"；
    // 单独的 initial 是合法 CSS，已有的具体值也保持原样。
    if (layers.length > 1 && layers.includes('initial')) {
      value = layers.map(layer => layer === 'initial' ? BACKGROUND_LAYER_INITIAL_VALUES[key] : layer).join(', ')
    }
  }
  return value
}
