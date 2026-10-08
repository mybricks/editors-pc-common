import ColorUtil from 'color'

import { isBoxShadowLayer, isShadowLayer } from './layers'
import type { EffectLayer, ShadowEffectType } from './layers'

interface ShadowPreset {
  id: string
  label: string
  offsetY: string
  blurRadius: string
  color: string
}

export const SHADOW_PRESETS: ShadowPreset[] = [
  { id: 'subtle', label: '轻微', offsetY: '1px', blurRadius: '2px', color: 'rgba(0, 0, 0, 0.08)' },
  { id: 'soft', label: '柔和', offsetY: '2px', blurRadius: '6px', color: 'rgba(0, 0, 0, 0.12)' },
  { id: 'floating', label: '悬浮', offsetY: '4px', blurRadius: '12px', color: 'rgba(0, 0, 0, 0.16)' },
  { id: 'strong', label: '强烈', offsetY: '8px', blurRadius: '24px', color: 'rgba(0, 0, 0, 0.20)' },
]

/** 只生成当前层的参数补丁，保留 id、类型和排序。 */
export function getPresetPatch(preset: ShadowPreset, type: ShadowEffectType) {
  return {
    offsetX: '0px',
    offsetY: preset.offsetY,
    blurRadius: preset.blurRadius,
    color: preset.color,
    ...(type === 'textShadow' ? {} : { spreadRadius: '0px' }),
  }
}

function readPixels(value: string): number | null {
  const match = value.trim().match(/^([+-]?(?:\d+(?:\.\d+)?|\.\d+))(px)?$/i)
  if (!match) return null
  const number = Number(match[1])
  return Number.isFinite(number) && (match[2] || number === 0) ? number : null
}

/** 高亮从已保存参数推导；变量、表达式和非 px 长度不参与匹配。 */
export function findMatchingPreset(layer: EffectLayer): ShadowPreset | undefined {
  if (!isShadowLayer(layer)) return undefined
  if (readPixels(layer.offsetX) !== 0) return undefined
  if (isBoxShadowLayer(layer) && readPixels(layer.spreadRadius) !== 0) return undefined

  try {
    // 与颜色编辑器保持一致，按 8 位 alpha 归一化 RGBA / HEX 等价写法。
    const color = new ColorUtil(layer.color.trim()).hexa()
    const offsetY = readPixels(layer.offsetY)
    const blurRadius = readPixels(layer.blurRadius)
    return SHADOW_PRESETS.find((preset) =>
      offsetY === readPixels(preset.offsetY) &&
      blurRadius === readPixels(preset.blurRadius) &&
      color === new ColorUtil(preset.color).hexa()
    )
  } catch {
    return undefined
  }
}
