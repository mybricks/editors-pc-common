export type EffectType = 'dropShadow' | 'innerShadow' | 'layerBlur' | 'backgroundBlur'

export type ShadowEffectType = 'dropShadow' | 'innerShadow'
export type BlurEffectType = 'layerBlur' | 'backgroundBlur'

export interface ShadowEffectLayer {
  id: string
  type: ShadowEffectType
  offsetX: string
  offsetY: string
  blurRadius: string
  spreadRadius: string
  color: string
}

export interface BlurEffectLayer {
  id: string
  type: BlurEffectType
  blurRadius: string
}

export type EffectLayer = ShadowEffectLayer | BlurEffectLayer

export type CssEffectsBundle = {
  boxShadow?: string
  filter?: string
  backdropFilter?: string
  WebkitBackdropFilter?: string
}

export const EFFECT_TYPE_LABELS: Record<EffectType, string> = {
  dropShadow: '外阴影',
  innerShadow: '内阴影',
  layerBlur: '图层模糊',
  backgroundBlur: '背景模糊',
}

const DEFAULT_SHADOW_COLOR = 'rgba(0, 0, 0, 0.25)'

export function generateEffectId(): string {
  return `fx_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`
}

export function createDefaultLayer(type: EffectType): EffectLayer {
  if (type === 'layerBlur' || type === 'backgroundBlur') {
    return {
      id: generateEffectId(),
      type,
      blurRadius: '4px',
    }
  }
  return {
    id: generateEffectId(),
    type,
    offsetX: '0px',
    offsetY: '4px',
    blurRadius: '4px',
    spreadRadius: '0px',
    color: DEFAULT_SHADOW_COLOR,
  }
}

export function isShadowType(type: EffectType): type is ShadowEffectType {
  return type === 'dropShadow' || type === 'innerShadow'
}

export function isBlurType(type: EffectType): type is BlurEffectType {
  return type === 'layerBlur' || type === 'backgroundBlur'
}

export function isShadowLayer(layer: EffectLayer): layer is ShadowEffectLayer {
  return isShadowType(layer.type)
}

export function isBlurLayer(layer: EffectLayer): layer is BlurEffectLayer {
  return isBlurType(layer.type)
}

/** 规范顺序：阴影 → 图层模糊 → 背景模糊 */
export function normalizeLayerOrder(layers: EffectLayer[]): EffectLayer[] {
  return [
    ...layers.filter(isShadowLayer),
    ...layers.filter((l) => l.type === 'layerBlur'),
    ...layers.filter((l) => l.type === 'backgroundBlur'),
  ]
}

/** 逗号拆分 CSS 列表，忽略括号内逗号（如 rgba） */
export function splitCssList(value: string): string[] {
  const parts: string[] = []
  let depth = 0
  let current = ''
  for (let i = 0; i < value.length; i++) {
    const ch = value[i]
    if (ch === '(') depth++
    else if (ch === ')') depth = Math.max(0, depth - 1)
    if (ch === ',' && depth === 0) {
      const trimmed = current.trim()
      if (trimmed) parts.push(trimmed)
      current = ''
      continue
    }
    current += ch
  }
  const trimmed = current.trim()
  if (trimmed) parts.push(trimmed)
  return parts
}

function isZeroLength(value: string | undefined): boolean {
  if (value == null || value === '') return true
  return parseFloat(value) === 0
}

/** Border inside 形：inset + offset/blur 为 0 + spread > 0 */
function isBorderLikeShadowLayer(layer: ShadowEffectLayer): boolean {
  return (
    layer.type === 'innerShadow' &&
    isZeroLength(layer.offsetX) &&
    isZeroLength(layer.offsetY) &&
    isZeroLength(layer.blurRadius) &&
    !isZeroLength(layer.spreadRadius)
  )
}

/**
 * Border inside 形：inset 0 0 0 Npx color（offset/blur 为 0、spread > 0）
 * 不应进入 Effects 层，serialize 时需原样保留。
 */
export function isBorderLikeInsetShadow(part: string): boolean {
  const parsed = parseSingleBoxShadowRaw(part)
  return !!parsed && isBorderLikeShadowLayer(parsed)
}

export function extractBorderLikeShadows(boxShadow: string | undefined): string[] {
  if (!boxShadow || boxShadow === 'none') return []
  return splitCssList(boxShadow).filter(isBorderLikeInsetShadow)
}

export function parseBlurRadius(cssFilter: string | undefined): string | null {
  if (!cssFilter || cssFilter === 'none') return null
  const match = String(cssFilter).match(/blur\(\s*([^)]+)\s*\)/i)
  if (!match) return null
  const raw = match[1].trim()
  if (!raw) return null
  return /^-?\d+\.?\d*$/.test(raw) ? `${raw}px` : raw
}

/**
 * 将 blur 合并进既有 filter/backdrop-filter，保留非 blur 函数。
 * blurRadius 为 null 时仅移除 blur()，其余片段保留。
 */
export function mergeBlurIntoFilter(
  previous: string | undefined,
  blurRadius: string | null
): string | null {
  const prev = previous && previous !== 'none' ? String(previous).trim() : ''
  if (!prev) {
    return blurRadius != null ? `blur(${blurRadius || '0px'})` : null
  }

  if (/blur\s*\(/i.test(prev)) {
    if (blurRadius != null) {
      return prev.replace(/blur\s*\(\s*[^)]*\s*\)/i, `blur(${blurRadius || '0px'})`).trim()
    }
    return prev.replace(/\s*blur\s*\(\s*[^)]*\s*\)/gi, '').replace(/\s+/g, ' ').trim() || null
  }

  if (blurRadius != null) {
    return `${prev} blur(${blurRadius || '0px'})`.trim()
  }
  return prev
}

function parseSingleBoxShadowRaw(boxShadow: string): ShadowEffectLayer | null {
  const args = boxShadow.trim().split(/\s(?![^(]*\))/)
  if (args.length < 2) return null

  let inset = false
  if (args[0] === 'inset') {
    inset = true
    args.shift()
  } else if (args.at(-1) === 'inset') {
    inset = true
    args.pop()
  }

  let color = DEFAULT_SHADOW_COLOR
  if (args.length && isNaN(parseFloat(args[0]))) {
    color = args[0]
    args.shift()
  } else if (args.length && isNaN(parseFloat(args.at(-1) as string))) {
    color = args.at(-1) as string
    args.pop()
  }

  const [offsetX = '0px', offsetY = '0px', blurRadius = '0px', spreadRadius = '0px'] = args

  return {
    id: generateEffectId(),
    type: inset ? 'innerShadow' : 'dropShadow',
    offsetX,
    offsetY,
    blurRadius,
    spreadRadius,
    color,
  }
}

function parseSingleBoxShadow(boxShadow: string): ShadowEffectLayer | null {
  const layer = parseSingleBoxShadowRaw(boxShadow)
  if (!layer || isBorderLikeShadowLayer(layer)) return null
  return layer
}

export function parseEffects(css: CssEffectsBundle): EffectLayer[] {
  const layers: EffectLayer[] = []

  const boxShadow = css.boxShadow
  if (boxShadow && boxShadow !== 'none') {
    for (const part of splitCssList(boxShadow)) {
      if (isBorderLikeInsetShadow(part)) continue
      const layer = parseSingleBoxShadow(part)
      if (layer) layers.push(layer)
    }
  }

  const layerBlur = parseBlurRadius(css.filter)
  if (layerBlur != null) {
    layers.push({
      id: generateEffectId(),
      type: 'layerBlur',
      blurRadius: layerBlur,
    })
  }

  const backdrop = css.backdropFilter || css.WebkitBackdropFilter
  const bgBlur = parseBlurRadius(backdrop)
  if (bgBlur != null) {
    layers.push({
      id: generateEffectId(),
      type: 'backgroundBlur',
      blurRadius: bgBlur,
    })
  }

  return normalizeLayerOrder(layers)
}

function composeShadow(layer: ShadowEffectLayer): string {
  const inset = layer.type === 'innerShadow' ? 'inset ' : ''
  return `${inset}${layer.offsetX} ${layer.offsetY} ${layer.blurRadius} ${layer.spreadRadius} ${layer.color}`
}

export type StyleChangeItem = { key: string; value: string | null }

/**
 * 序列化效果层。传入 previous 时可：
 * - 保留 filter/backdrop 中的非 blur 函数
 * - 保留 Border inside 形 inset boxShadow
 */
export function serializeEffects(
  layers: EffectLayer[],
  previous?: CssEffectsBundle
): StyleChangeItem[] {
  // 不 normalize：保留列表中阴影的相对顺序（模糊夹在中间时不影响 boxShadow 序）
  const shadows = layers.filter(isShadowLayer).map(composeShadow)
  const borderLike = extractBorderLikeShadows(previous?.boxShadow)
  const allShadows = [...shadows, ...borderLike]

  const layerBlur = layers.find((l) => l.type === 'layerBlur') as BlurEffectLayer | undefined
  const bgBlur = layers.find((l) => l.type === 'backgroundBlur') as BlurEffectLayer | undefined

  const filterValue = mergeBlurIntoFilter(
    previous?.filter,
    layerBlur ? (layerBlur.blurRadius || '0px') : null
  )
  const backdropPrev = previous?.backdropFilter || previous?.WebkitBackdropFilter
  const backdropValue = mergeBlurIntoFilter(
    backdropPrev,
    bgBlur ? (bgBlur.blurRadius || '0px') : null
  )

  return [
    { key: 'boxShadow', value: allShadows.length > 0 ? allShadows.join(', ') : null },
    { key: 'filter', value: filterValue },
    { key: 'backdropFilter', value: backdropValue },
    { key: 'WebkitBackdropFilter', value: backdropValue },
  ]
}

/** 指纹：用于外部 CSS ↔ 本地 layers 同步去重 */
export function fingerprintEffects(css: CssEffectsBundle): string {
  return [
    css.boxShadow || '',
    css.filter || '',
    css.backdropFilter || css.WebkitBackdropFilter || '',
  ].join('||')
}

export function fingerprintFromChanges(items: StyleChangeItem[]): string {
  const map = Object.fromEntries(items.map((i) => [i.key, i.value || '']))
  return fingerprintEffects({
    boxShadow: map.boxShadow,
    filter: map.filter,
    backdropFilter: map.backdropFilter,
    WebkitBackdropFilter: map.WebkitBackdropFilter,
  })
}

export function fingerprintLayers(
  layers: EffectLayer[],
  previous?: CssEffectsBundle
): string {
  return fingerprintFromChanges(serializeEffects(layers, previous))
}

export function hasEffectType(layers: EffectLayer[], type: EffectType): boolean {
  return layers.some((l) => l.type === type)
}
