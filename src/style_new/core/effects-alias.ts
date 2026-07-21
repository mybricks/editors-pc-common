/** 旧 boxshadow / blur 与 effects 统一别名 */
const EFFECTS_ALIASES = new Set(['effects', 'boxshadow', 'blur'])

export function mapPanelAliasToEffects(panel: string): string {
  return EFFECTS_ALIASES.has(panel) && panel !== 'effects' ? 'effects' : panel
}

export function mapEffectedPanels(panels: string[] | null | undefined): string[] {
  return Array.from(new Set((panels ?? []).map(mapPanelAliasToEffects)))
}

/** 将旧的 boxshadow / blur 插件配置归一为 effects，避免双面板 */
export function normalizeEffectOptions(options: any): any {
  if (!Array.isArray(options)) return options
  let hasEffects = false
  const result: any[] = []
  for (const option of options) {
    const type = (typeof option === 'string' ? option : option?.type)?.toLowerCase?.()
    if (type && EFFECTS_ALIASES.has(type)) {
      if (!hasEffects) {
        hasEffects = true
        result.push(typeof option === 'string' ? 'effects' : { ...option, type: 'effects' })
      }
      continue
    }
    result.push(option)
  }
  return result
}
