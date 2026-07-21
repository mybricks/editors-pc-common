/**
 * getValues 特例：从原命令式实现剪切，语义保持不变。
 */

export type ValuesAcc = Record<string, any>

/** rule 遍历阶段：background / border 的 var() 简写、webkit 读写 */
export function applyRuleHooks(
  rule: CSSStyleRule,
  acc: ValuesAcc,
  inheritOnly: boolean
) {
  if (inheritOnly) return

  const { style } = rule

  // AI 代码生成有时使用 background 简写（如 background: var(--xxx)）
  // Chrome 无法在解析期展开含 var() 的简写，rule.style.backgroundColor 会为空
  // 这里将整体 background 简写值作为 backgroundColor 处理，确保变量引用能正确回显
  if (!acc.backgroundColor) {
    const styleBackground = (style as any).background
    if (styleBackground && typeof styleBackground === 'string' && styleBackground.startsWith('var(')) {
      acc.backgroundColor = styleBackground
    }
  }

  // border-color 简写含 var() 时（如 border-color: var(--xxx)），
  // rule.style 中四个 longhand 均为空字符串，需通过 getPropertyValue 读取简写值兜底
  const styleBorderColorShorthand = style.getPropertyValue('border-color')
  if (styleBorderColorShorthand && styleBorderColorShorthand.trim().startsWith('var(')) {
    const v = styleBorderColorShorthand.trim()
    if (!acc.borderTopColor) acc.borderTopColor = v
    if (!acc.borderRightColor) acc.borderRightColor = v
    if (!acc.borderBottomColor) acc.borderBottomColor = v
    if (!acc.borderLeftColor) acc.borderLeftColor = v
  }
  // border 完整简写含 var() 时（如 border: 1px solid var(--xxx)），
  // rule.style 的所有 border longhand 均为空，需从 border 简写中提取颜色部分兜底
  const styleBorderShorthand = style.getPropertyValue('border')
  if (styleBorderShorthand && styleBorderShorthand.includes('var(')) {
    const varMatch = styleBorderShorthand.match(/var\(--[^)]+\)/)
    if (varMatch) {
      const varColor = varMatch[0]
      if (!acc.borderTopColor) acc.borderTopColor = varColor
      if (!acc.borderRightColor) acc.borderRightColor = varColor
      if (!acc.borderBottomColor) acc.borderBottomColor = varColor
      if (!acc.borderLeftColor) acc.borderLeftColor = varColor
    }
  }

  // webkit backdrop-filter
  const styleWebkitBackdropFilter = style.getPropertyValue?.('-webkit-backdrop-filter')
  if (styleWebkitBackdropFilter) {
    acc.webkitBackdropFilter = styleWebkitBackdropFilter
    if (!acc.backdropFilter) acc.backdropFilter = styleWebkitBackdropFilter
  }

  // webkitTextFillColor / webkitBackgroundClip（文字渐变）
  // 注意：表驱动已从 styleKey 读 webkit*；此处补 Webkit 大写别名与 backgroundClip 回填
  const styleWebkitTextFillColor =
    (style as any).webkitTextFillColor || (style as any).WebkitTextFillColor
  if (styleWebkitTextFillColor) {
    acc.webkitTextFillColor = styleWebkitTextFillColor
  }
  const styleWebkitBackgroundClip =
    (style as any).webkitBackgroundClip || (style as any).WebkitBackgroundClip
  if (styleWebkitBackgroundClip) {
    acc.webkitBackgroundClip = styleWebkitBackgroundClip
    if (!acc.backgroundClip) {
      acc.backgroundClip = styleWebkitBackgroundClip
    }
  }
}

/**
 * fallback 之后：backdropFilter 的 computed / webkit 兜底，以及出口别名。
 */
export function applyPostHooks(acc: ValuesAcc, computedValues: CSSStyleDeclaration) {
  if (!acc.backdropFilter) {
    acc.backdropFilter =
      (computedValues as any).backdropFilter ||
      computedValues.getPropertyValue?.('-webkit-backdrop-filter') ||
      acc.webkitBackdropFilter
  }
  if (!acc.webkitBackdropFilter) {
    acc.webkitBackdropFilter =
      computedValues.getPropertyValue?.('-webkit-backdrop-filter') || acc.backdropFilter
  }
}

/** 组装 getRealValue 入参（含 Webkit 出口别名） */
export function buildExportBag(acc: ValuesAcc): Record<string, any> {
  return {
    color: acc.color,
    fontSize: acc.fontSize,
    textAlign: acc.textAlign,
    fontWeight: acc.fontWeight,
    lineHeight: acc.lineHeight,
    fontFamily: acc.fontFamily,
    letterSpacing: acc.letterSpacing,
    whiteSpace: acc.whiteSpace,

    paddingTop: acc.paddingTop,
    paddingRight: acc.paddingRight,
    paddingBottom: acc.paddingBottom,
    paddingLeft: acc.paddingLeft,

    marginTop: acc.marginTop,
    marginRight: acc.marginRight,
    marginBottom: acc.marginBottom,
    marginLeft: acc.marginLeft,

    backgroundColor: acc.backgroundColor,
    backgroundImage: acc.backgroundImage,
    backgroundRepeat: acc.backgroundRepeat,
    backgroundPosition: acc.backgroundPosition,
    backgroundSize: acc.backgroundSize,
    backgroundOrigin: acc.backgroundOrigin,
    backgroundClip: acc.backgroundClip,

    borderTopColor: acc.borderTopColor,
    borderBottomColor: acc.borderBottomColor,
    borderLeftColor: acc.borderLeftColor,
    borderRightColor: acc.borderRightColor,
    borderTopLeftRadius: acc.borderTopLeftRadius,
    borderTopRightRadius: acc.borderTopRightRadius,
    borderBottomRightRadius: acc.borderBottomRightRadius,
    borderBottomLeftRadius: acc.borderBottomLeftRadius,
    borderTopStyle: acc.borderTopStyle,
    borderRightStyle: acc.borderRightStyle,
    borderBottomStyle: acc.borderBottomStyle,
    borderLeftStyle: acc.borderLeftStyle,
    borderTopWidth: acc.borderTopWidth,
    borderBottomWidth: acc.borderBottomWidth,
    borderLeftWidth: acc.borderLeftWidth,
    borderRightWidth: acc.borderRightWidth,

    width: acc.width,
    height: acc.height,
    maxWidth: acc.maxWidth,
    maxHeight: acc.maxHeight,
    minWidth: acc.minWidth,
    minHeight: acc.minHeight,

    cursor: acc.cursor,

    boxShadow: acc.boxShadow,

    filter: acc.filter,
    backdropFilter: acc.backdropFilter,
    WebkitBackdropFilter: acc.webkitBackdropFilter || acc.backdropFilter,

    overflowX: acc.overflowX,
    overflowY: acc.overflowY,

    textOverflow: acc.textOverflow,
    webkitLineClamp: acc.webkitLineClamp,
    textDecoration: acc.textDecoration,
    fontStyle: acc.fontStyle,
    textTransform: acc.textTransform,
    webkitTextFillColor: acc.webkitTextFillColor,
    WebkitTextFillColor: acc.webkitTextFillColor,
    webkitBackgroundClip: acc.webkitBackgroundClip,
    WebkitBackgroundClip: acc.webkitBackgroundClip || acc.backgroundClip,

    opacity: acc.opacity,

    zIndex: acc.zIndex,

    transform: acc.transform,

    display: acc.display,
    flexDirection: acc.flexDirection,
    alignItems: acc.alignItems,
    justifyContent: acc.justifyContent,
    flexWrap: acc.flexWrap,
    rowGap: acc.rowGap,
    columnGap: acc.columnGap,
    position: acc.position,
    overflow: acc.overflow,
  }
}
