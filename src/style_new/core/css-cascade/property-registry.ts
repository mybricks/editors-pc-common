const BOX_SIDES = ['top', 'right', 'bottom', 'left'] as const
const BORDER_PARTS = ['width', 'style', 'color'] as const

const SHORTHANDS_BY_LONGHAND = new Map<string, string[]>()

function register(shorthand: string, longhands: string[]): void {
  longhands.forEach((longhand) => {
    const current = SHORTHANDS_BY_LONGHAND.get(longhand) || []
    if (!current.includes(shorthand)) current.push(shorthand)
    SHORTHANDS_BY_LONGHAND.set(longhand, current)
  })
}

register('padding', BOX_SIDES.map((side) => `padding-${side}`))
register('margin', BOX_SIDES.map((side) => `margin-${side}`))
register('gap', ['row-gap', 'column-gap'])
register('overflow', ['overflow-x', 'overflow-y'])
register('font', [
  'font-style',
  'font-variant',
  'font-weight',
  'font-stretch',
  'font-size',
  'line-height',
  'font-family',
])
register('flex', ['flex-grow', 'flex-shrink', 'flex-basis'])
register('outline', ['outline-color', 'outline-style', 'outline-width'])
register('inset', BOX_SIDES.map((side) => side))
register('background', [
  'background-color',
  'background-image',
  'background-repeat',
  'background-position',
  'background-size',
  'background-origin',
  'background-clip',
  'background-attachment',
])
register('border-radius', [
  'border-top-left-radius',
  'border-top-right-radius',
  'border-bottom-right-radius',
  'border-bottom-left-radius',
])

BORDER_PARTS.forEach((part) => {
  const sideLonghands = BOX_SIDES.map((side) => `border-${side}-${part}`)
  register(`border-${part}`, sideLonghands)
  register('border', sideLonghands)
})

BOX_SIDES.forEach((side) => {
  register(
    `border-${side}`,
    BORDER_PARTS.map((part) => `border-${side}-${part}`)
  )
})

export function normalizeCssProperty(property: string): string {
  const trimmed = String(property || '').trim()
  if (trimmed.startsWith('--')) return trimmed
  return trimmed.replace(/([A-Z])/g, '-$1').toLowerCase()
}

export function getPropertyShorthands(property: string): string[] {
  return SHORTHANDS_BY_LONGHAND.get(normalizeCssProperty(property)) || []
}

export function declarationAffectsProperty(
  authoredProperty: string,
  property: string
): boolean {
  const authored = normalizeCssProperty(authoredProperty)
  const target = normalizeCssProperty(property)
  return authored === target || getPropertyShorthands(target).includes(authored)
}
