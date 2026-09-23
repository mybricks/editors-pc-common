const SIDES = ['top', 'right', 'bottom', 'left']

/** 属性索引、整组清空和缓存清理共用的简写关系；值均为最终 longhand。 */
export const STYLE_SHORTHANDS: Record<string, string[]> = {
  font: ['font-family', 'font-size', 'font-weight', 'font-style', 'font-stretch', 'font-variant', 'line-height'],
  background: ['background-color', 'background-image', 'background-size', 'background-position', 'background-repeat', 'background-origin', 'background-clip', 'background-attachment'],
  border: SIDES.flatMap(side => ['width', 'style', 'color'].map(key => `border-${side}-${key}`)),
  'border-color': SIDES.map(side => `border-${side}-color`),
  'border-width': SIDES.map(side => `border-${side}-width`),
  'border-style': SIDES.map(side => `border-${side}-style`),
  ...Object.fromEntries(SIDES.map(side => [
    `border-${side}`,
    ['width', 'style', 'color'].map(key => `border-${side}-${key}`),
  ])),
  'border-radius': ['border-top-left-radius', 'border-top-right-radius', 'border-bottom-right-radius', 'border-bottom-left-radius'],
  margin: SIDES.map(side => `margin-${side}`),
  padding: SIDES.map(side => `padding-${side}`),
  gap: ['row-gap', 'column-gap'],
  overflow: ['overflow-x', 'overflow-y'],
  flex: ['flex-grow', 'flex-shrink', 'flex-basis'],
  'text-decoration': ['text-decoration-line', 'text-decoration-color', 'text-decoration-style', 'text-decoration-thickness'],
}

/** 先匹配覆盖范围大的组，避免整个 border 被提前拆成各边/颜色/宽度。 */
export const BATCH_CLEAR_SHORTHANDS = [
  'border',
  ...SIDES.map(side => `border-${side}`),
  'border-color', 'border-width', 'border-style',
  'border-radius', 'margin', 'padding',
]

export const stylePropertyKey = (property: string) => property.startsWith('--')
  ? property
  : property.replace(/-([a-z])/g, (_, letter) => letter.toUpperCase())

/** 包含自身、范围内的子简写和 longhand；border 不包含 border-radius。 */
export function getShorthandFamily(property: string): string[] {
  const longhands = STYLE_SHORTHANDS[property]
  if (!longhands) return [property]
  const children = Object.keys(STYLE_SHORTHANDS).filter(name =>
    name !== property && STYLE_SHORTHANDS[name].every(key => longhands.includes(key))
  )
  return [property, ...children, ...longhands]
}
