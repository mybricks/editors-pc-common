export type ShorthandChangeItem = { key: string; value: any }

export type ShorthandNormalizeResult = {
  style: Record<string, any>
  deletions: string[]
}

type SimpleGroup = {
  shorthand: string
  longhands: string[]
  serialize: (values: string[]) => string | null
}

type ParsedPriority = {
  value: string
  important: boolean
}

const IMPORTANT_RE = /\s*!important\s*$/i

const BOX_GROUPS: SimpleGroup[] = [
  {
    shorthand: 'padding',
    longhands: ['paddingTop', 'paddingRight', 'paddingBottom', 'paddingLeft'],
    serialize: serializeFourValues,
  },
  {
    shorthand: 'margin',
    longhands: ['marginTop', 'marginRight', 'marginBottom', 'marginLeft'],
    serialize: serializeFourValues,
  },
  {
    shorthand: 'overflow',
    longhands: ['overflowX', 'overflowY'],
    serialize: serializeTwoValues,
  },
  {
    shorthand: 'gap',
    longhands: ['rowGap', 'columnGap'],
    serialize: serializeTwoValues,
  },
  {
    shorthand: 'borderRadius',
    longhands: [
      'borderTopLeftRadius',
      'borderTopRightRadius',
      'borderBottomRightRadius',
      'borderBottomLeftRadius',
    ],
    serialize: serializeBorderRadius,
  },
]

const BORDER_SIDES = ['Top', 'Right', 'Bottom', 'Left'] as const
const BORDER_DETAIL_KEYS = BORDER_SIDES.flatMap((side) => [
  `border${side}Width`,
  `border${side}Style`,
  `border${side}Color`,
])
const BORDER_SHORTHAND_KEYS = [
  'border',
  'borderTop',
  'borderRight',
  'borderBottom',
  'borderLeft',
  'borderWidth',
  'borderStyle',
  'borderColor',
]
const BORDER_KEYS = [...BORDER_SHORTHAND_KEYS, ...BORDER_DETAIL_KEYS]
const SIMPLE_KEYS = BOX_GROUPS.flatMap(({ shorthand, longhands }) => [shorthand, ...longhands])
const SNAPSHOT_GROUPS = [
  ...BOX_GROUPS.map(({ shorthand, longhands }) => [shorthand, ...longhands]),
  BORDER_KEYS,
]

export const SHORTHAND_OWNED_KEYS = Array.from(new Set([...SIMPLE_KEYS, ...BORDER_KEYS]))

/**
 * CSS 代码编辑器仍以 diff 提交；当 diff 命中 shorthand 分组时，补齐编辑器当前的
 * 同组字段，避免内存中已规范化为 shorthand 后只改一个 longhand 导致其他值丢失。
 */
export function expandShorthandSnapshotChanges(
  snapshot: Record<string, any>,
  changes: ShorthandChangeItem[],
  isValid: (item: ShorthandChangeItem) => boolean = () => true
): ShorthandChangeItem[] {
  const changeMap = new Map(changes.map(({ key, value }) => [key, value]))

  SNAPSHOT_GROUPS.forEach((keys) => {
    if (!keys.some((key) => changeMap.has(key))) return

    const snapshotItems = keys
      .filter((key) => Object.prototype.hasOwnProperty.call(snapshot, key))
      .map((key) => ({key, value: snapshot[key]}))
    if (snapshotItems.some((item) => !isValid(item))) {
      keys.forEach((key) => changeMap.delete(key))
      return
    }
    snapshotItems.forEach(({key, value}) => changeMap.set(key, value))
  })

  return Array.from(changeMap, ([key, value]) => ({key, value}))
}

function hasValue(style: Record<string, any>, key: string): boolean {
  if (!Object.prototype.hasOwnProperty.call(style, key)) return false
  const value = style[key]
  return value !== null && typeof value !== 'undefined' && String(value).trim() !== ''
}

function parsePriority(raw: unknown): ParsedPriority {
  const source = String(raw).trim()
  return {
    value: source.replace(IMPORTANT_RE, '').trim(),
    important: IMPORTANT_RE.test(source),
  }
}

function withCommonPriority(
  rawValues: unknown[],
  serialize: (values: string[]) => string | null
): string | null {
  const parsed = rawValues.map(parsePriority)
  if (parsed.some(({ value }) => !value)) return null
  if (parsed.some(({ important }) => important !== parsed[0].important)) return null
  const value = serialize(parsed.map((item) => item.value))
  if (!value) return null
  return `${value}${parsed[0].important ? '!important' : ''}`
}

function compactFour(values: string[]): string[] {
  const compact = values.slice(0, 4)
  if (compact[3] === compact[1]) compact.pop()
  if (compact.length === 3 && compact[2] === compact[0]) compact.pop()
  if (compact.length === 2 && compact[1] === compact[0]) compact.pop()
  return compact
}

function serializeFourValues(values: string[]): string | null {
  return values.length === 4 ? compactFour(values).join(' ') : null
}

function serializeTwoValues(values: string[]): string | null {
  if (values.length !== 2) return null
  return values[0] === values[1] ? values[0] : values.join(' ')
}

function splitTopLevelComponents(value: string): string[] | null {
  const result: string[] = []
  let current = ''
  let depth = 0
  let quote = ''

  const flush = () => {
    const token = current.trim()
    if (token) result.push(token)
    current = ''
  }

  for (let index = 0; index < value.length; index += 1) {
    const char = value[index]
    const next = value[index + 1]

    if (char === '\\') {
      current += char
      if (typeof next !== 'undefined') {
        current += next
        index += 1
      }
      continue
    }

    if (quote) {
      current += char
      if (char === quote) quote = ''
      continue
    }

    if (char === '"' || char === "'") {
      quote = char
      current += char
      continue
    }

    if (char === '/' && next === '*') {
      const commentEnd = value.indexOf('*/', index + 2)
      if (commentEnd < 0) return null
      index = commentEnd + 1
      continue
    }

    if (char === '(') {
      depth += 1
      current += char
      continue
    }

    if (char === ')') {
      if (depth < 1) return null
      depth -= 1
      current += char
      continue
    }

    if (depth === 0 && (char === '/' || char === ',')) return null
    if (depth === 0 && /\s/.test(char)) {
      flush()
      continue
    }
    current += char
  }

  if (depth !== 0 || quote) return null
  flush()
  return result
}

/** border-radius longhand 每角允许一个或两个半径，shorthand 需用 `/` 分隔两组轴。 */
function serializeBorderRadius(values: string[]): string | null {
  if (values.length !== 4) return null
  const corners = values.map(splitTopLevelComponents)
  if (corners.some((parts) => !parts || parts.length < 1 || parts.length > 2)) return null

  const horizontal = corners.map((parts) => parts![0])
  const vertical = corners.map((parts) => parts![1] ?? parts![0])
  const horizontalValue = compactFour(horizontal).join(' ')
  const sameAxes = horizontal.every((value, index) => value === vertical[index])
  if (sameAxes) return horizontalValue
  return `${horizontalValue} / ${compactFour(vertical).join(' ')}`
}

function addDeletion(deletions: string[], key: string) {
  if (!deletions.includes(key)) deletions.push(key)
}

function replaceGroup(
  style: Record<string, any>,
  output: Record<string, any>,
  keys: string[],
  deletions: string[]
) {
  keys.forEach((key) => {
    if (!Object.prototype.hasOwnProperty.call(output, key)) addDeletion(deletions, key)
    delete style[key]
  })
  Object.assign(style, output)
}

function normalizeSimpleGroup(
  style: Record<string, any>,
  group: SimpleGroup,
  changedKeys: Set<string>,
  deletions: string[]
) {
  const { shorthand, longhands, serialize } = group
  const allKeys = [shorthand, ...longhands]
  const touched = allKeys.some((key) => changedKeys.has(key))
  if (touched) {
    allKeys.forEach((key) => {
      if (!Object.prototype.hasOwnProperty.call(style, key) || hasValue(style, key)) return
      delete style[key]
      addDeletion(deletions, key)
    })
  }
  const completeLonghands = longhands.every((key) => hasValue(style, key))

  if (completeLonghands) {
    const shorthandValue = withCommonPriority(
      longhands.map((key) => style[key]),
      serialize
    )
    if (shorthandValue) {
      replaceGroup(style, { [shorthand]: shorthandValue }, allKeys, deletions)
    } else {
      if (hasValue(style, shorthand)) addDeletion(deletions, shorthand)
      delete style[shorthand]
    }
    return
  }

  const shorthandChanged = changedKeys.has(shorthand)
  const longhandChanged = longhands.some((key) => changedKeys.has(key))
  if (shorthandChanged && hasValue(style, shorthand)) {
    longhands.forEach((key) => {
      delete style[key]
      addDeletion(deletions, key)
    })
  } else if (longhandChanged) {
    delete style[shorthand]
    addDeletion(deletions, shorthand)
  }

  if (touched && !allKeys.some((key) => hasValue(style, key))) {
    allKeys.forEach((key) => addDeletion(deletions, key))
  }
}

function buildBorderOutput(style: Record<string, any>): Record<string, any> | null {
  if (!BORDER_DETAIL_KEYS.every((key) => hasValue(style, key))) return null

  const sides = BORDER_SIDES.map((side) => {
    const raw = [
      style[`border${side}Width`],
      style[`border${side}Style`],
      style[`border${side}Color`],
    ]
    const parsed = raw.map(parsePriority)
    if (parsed.some(({ value }) => !value)) return null
    if (parsed.some(({ important }) => important !== parsed[0].important)) return null
    const [width, borderStyle] = parsed.map(({value}) => value)
    return {
      value: parsed.map(({ value }) => value).join(' '),
      important: parsed[0].important,
      visible:
        !/^[+-]?(?:0+(?:\.0*)?|\.0+)(?:[a-z%]+)?$/i.test(width) &&
        borderStyle !== 'none' &&
        borderStyle !== 'hidden',
    }
  })
  if (sides.some((side) => !side)) return null

  const normalizedSides = sides as Array<{ value: string; important: boolean; visible: boolean }>
  // computedStyle 会补出 0px none currentColor；全部不可见时不要生成 authored border。
  if (normalizedSides.every((side) => !side.visible)) return null
  const first = normalizedSides[0]
  if (normalizedSides.every((side) => side.value === first.value && side.important === first.important)) {
    return { border: `${first.value}${first.important ? '!important' : ''}` }
  }

  const output: Record<string, any> = {}
  normalizedSides.forEach((side, index) => {
    output[`border${BORDER_SIDES[index]}`] = `${side.value}${side.important ? '!important' : ''}`
  })
  return output
}

function normalizeBorder(
  style: Record<string, any>,
  changedKeys: Set<string>,
  deletions: string[]
) {
  const touched = BORDER_KEYS.some((key) => changedKeys.has(key))
  if (touched) {
    BORDER_KEYS.forEach((key) => {
      if (!Object.prototype.hasOwnProperty.call(style, key) || hasValue(style, key)) return
      delete style[key]
      addDeletion(deletions, key)
    })
  }
  const output = buildBorderOutput(style)
  if (output) {
    replaceGroup(style, output, BORDER_KEYS, deletions)
    return
  }

  const borderChanged = changedKeys.has('border')
  const detailChanged = BORDER_DETAIL_KEYS.some((key) => changedKeys.has(key))
  if (borderChanged && hasValue(style, 'border')) {
    BORDER_KEYS.forEach((key) => {
      if (key === 'border') return
      delete style[key]
      addDeletion(deletions, key)
    })
  } else if (detailChanged) {
    BORDER_SHORTHAND_KEYS.forEach((key) => {
      delete style[key]
      addDeletion(deletions, key)
    })
  }
}

export function normalizeStyleShorthands(
  input: Record<string, any>,
  changes: ShorthandChangeItem[] = []
): ShorthandNormalizeResult {
  const style = { ...(input || {}) }
  const deletions: string[] = []
  const changedKeys = new Set(changes.map(({ key }) => key))

  BOX_GROUPS.forEach((group) => normalizeSimpleGroup(style, group, changedKeys, deletions))
  normalizeBorder(style, changedKeys, deletions)

  return { style, deletions }
}

/** mergeCSSProperties 之后把通用 merge 可能改写的 shorthand 组恢复成纯函数的最终形态。 */
export function overlayNormalizedShorthands(
  mergedStyle: Record<string, any>,
  normalizedStyle: Record<string, any>
): Record<string, any> {
  const result = { ...(mergedStyle || {}) }
  SHORTHAND_OWNED_KEYS.forEach((key) => {
    delete result[key]
    if (Object.prototype.hasOwnProperty.call(normalizedStyle, key)) {
      result[key] = normalizedStyle[key]
    }
  })
  return result
}
