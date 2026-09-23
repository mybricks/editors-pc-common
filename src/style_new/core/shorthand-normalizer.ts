export type ShorthandChangeItem = { key: string; value: any }

export type ShorthandNormalizeResult = {
  style: Record<string, any>
  deletions: string[]
}

export type ShorthandNormalizeOptions = {
  /** 增量写入时只处理 changes 命中的属性组；默认保留全量快照归一化。 */
  changedGroupsOnly?: boolean
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
  if (values.length !== 4) return null
  // CSS-wide 关键字只能单独使用，不能生成 `0 unset 0 0` 这样的无效简写。
  if (values.some(value => /^(initial|inherit|unset|revert|revert-layer)$/i.test(value))) {
    return values.every(value => value === values[0]) ? values[0] : null
  }
  return compactFour(values.map(value =>
    /^[-+]?0+(?:\.0+)?(?:px|em|rem|%|vh|vw|vmin|vmax|cm|mm|in|pt|pc)?$/i.test(value) ? '0' : value
  )).join(' ')
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

/** 将 padding/margin 四值简写展开，同时保留 var() 和 !important。 */
export function expandFourShorthand(raw: unknown): string[] | null {
  if (raw == null || String(raw).trim() === '') return null
  const {value, important} = parsePriority(raw)
  const parts = splitTopLevelComponents(value)
  if (!parts || parts.length < 1 || parts.length > 4) return null

  const [top, right = top, bottom = top, left = right] = parts
  const values = parts.length === 1
    ? [top, top, top, top]
    : parts.length === 2
      ? [top, right, top, right]
      : parts.length === 3
        ? [top, right, bottom, right]
        : [top, right, bottom, left]

  return values.map((item) => `${item}${important ? '!important' : ''}`)
}

function expandShorthandForLonghandChange(
  style: Record<string, any>,
  shorthand: string,
  longhands: string[],
  changedKeys: Set<string>,
  deletions: string[]
) {
  if (
    longhands.length !== 4 ||
    !hasValue(style, shorthand) ||
    !longhands.some((key) => changedKeys.has(key))
  ) return

  const expanded = expandFourShorthand(style[shorthand])
  if (!expanded || expanded.length !== longhands.length) return

  longhands.forEach((key, index) => {
    // 本次直接修改的方向以新值（或删除）为准，其他方向由旧 shorthand 展开保留。
    if (!changedKeys.has(key) && !hasValue(style, key)) {
      style[key] = expanded[index]
    }
  })
  delete style[shorthand]
  addDeletion(deletions, shorthand)
}

function normalizeSimpleGroup(
  style: Record<string, any>,
  group: SimpleGroup,
  changedKeys: Set<string>,
  deletions: string[],
  clearedKeys: Set<string>
) {
  const { shorthand, longhands, serialize } = group
  const allKeys = [shorthand, ...longhands]
  const touched = allKeys.some((key) => changedKeys.has(key))
  const hasGroupValue = allKeys.some((key) => hasValue(style, key))
  // 显式设置简写时，新简写优先于快照里残留的旧 longhand。
  if (changedKeys.has(shorthand) && hasValue(style, shorthand) &&
    !longhands.some(key => changedKeys.has(key))) {
    const expanded = longhands.length === 4 ? expandFourShorthand(style[shorthand]) : null
    const value = expanded ? withCommonPriority(expanded, serialize) : null
    replaceGroup(style, { [shorthand]: value ?? style[shorthand] }, allKeys, deletions)
    return
  }
  // 编辑单一方向时，先将已有 shorthand 展开。否则删除一个 longhand 会直接移除
  // shorthand，导致未编辑方向的 margin/padding 也一并丢失。
  expandShorthandForLonghandChange(style, shorthand, longhands, changedKeys, deletions)
  // liveStyle 可能已经把 shorthand 展开成四个 longhand。此时清除其中一边
  // 不会再经过 shorthand 展开逻辑，需要用 CSS 初始值补回该边，才能保留其他边。
  if (touched && hasGroupValue) {
    const existingValues = longhands
      .filter((key) => hasValue(style, key))
      .map((key) => parsePriority(style[key]))
    const preserveImportant =
      existingValues.length > 0 && existingValues.every(({ important }) => important)
    longhands.forEach((key) => {
      if (clearedKeys.has(key) && !hasValue(style, key)) {
        style[key] = preserveImportant ? '0px!important' : '0px'
      }
    })
  }
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
  changes: ShorthandChangeItem[] = [],
  clearedKeys: Set<string> = new Set(),
  options: ShorthandNormalizeOptions = {}
): ShorthandNormalizeResult {
  const style = { ...(input || {}) }
  const deletions: string[] = []
  const changedKeys = new Set(changes.map(({ key }) => key))
  const shouldNormalize = (keys: string[]) =>
    !options.changedGroupsOnly || keys.some((key) => changedKeys.has(key))

  BOX_GROUPS.forEach((group) => {
    if (!shouldNormalize([group.shorthand, ...group.longhands])) return
    normalizeSimpleGroup(style, group, changedKeys, deletions, clearedKeys)
  })
  if (shouldNormalize(BORDER_KEYS)) {
    normalizeBorder(style, changedKeys, deletions)
  }

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
