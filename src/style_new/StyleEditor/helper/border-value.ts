/** 未配置宽度不等于 0：solid + 默认宽度仍然是可见边框。 */
export function hasNoVisibleBorderLine(style: unknown, width: unknown): boolean {
  const line = String(style ?? '').trim().toLowerCase()
  const size = String(width ?? '').trim().toLowerCase()
  return line === 'none' || line === 'hidden' || /^(0|0px|0%)$/.test(size)
}

export function getBorderSideKeys(key: string): string[] {
  const side = /^border(Top|Right|Bottom|Left)(?:Width|Style|Color)?$/.exec(key)?.[1]
  return side ? ['Width', 'Style', 'Color'].map(part => `border${side}${part}`) : []
}

/** 统一配置只清空宽度，保留线型/颜色；单独配置清空一行时删除整条边。 */
export function buildBorderWidthChange(
  current: Record<string, any>,
  widthKeys: readonly string[],
  value: any,
  getPreview: (key: string) => unknown
) {
  const changes: Record<string, any> = {}
  widthKeys.forEach(key => {
    const styleKey = key.replace(/Width$/, 'Style')
    changes[key] = value
    if (value == null) {
      if (widthKeys.length === 1) {
        // 单独配置的一行代表整条边；清空时不能遗留 style/color 让默认宽度重新显现。
        getBorderSideKeys(key).forEach(name => { changes[name] = null })
      }
      return
    }
    const line = String(current[styleKey] ?? getPreview(styleKey) ?? '').trim().toLowerCase()
    if (!line || line === 'none' || line === 'hidden') {
      changes[styleKey] = 'solid'
    }
  })
  return { changes }
}
