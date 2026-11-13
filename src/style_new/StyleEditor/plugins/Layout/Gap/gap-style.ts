import { expandTwoShorthand } from '../../../../core/shorthand-normalizer'
import { resolveEffectiveStyleSource } from '../../../../core/style-property'
import type { StyleProperty } from '../../../../core/style-property'
import type { EffectiveStyleValue } from '../../../../core/zone-tab'

/** 只补 Gap 控件的原始声明，不修改公共来源索引或写入计划。 */
export function resolveGapField({ key, effectiveStyle, getStyleProperty }: {
  key: 'rowGap' | 'columnGap'
  effectiveStyle?: Record<string, EffectiveStyleValue>
  getStyleProperty?: (key: string) => StyleProperty
}) {
  const field = effectiveStyle?.[key]
  let hasDeclaration = !!field && field.type !== 'computed'
  let rawValue = hasDeclaration ? field?.value : undefined
  const position = key === 'rowGap' ? 0 : 1

  if (getStyleProperty) {
    const axes = getStyleProperty(key).candidates
    // var() 简写的 CSSOM 长写可能为空；先局部展开，再沿用原来源优先级。
    const shorthands = getStyleProperty('gap').candidates.flatMap(candidate => {
      if (!candidate.value.includes('var(')) return []
      const value = expandTwoShorthand(candidate.value)?.[position]
      return value == null ? [] : [{ ...candidate, value }]
    })
    // 可读简写代表该来源的完整两轴。刚绑定变量时公共索引可能仍留着旧数字轴，
    // 此处以新简写为准；其他来源的独立行/列声明仍参与优先级比较。
    const independentAxes = axes.filter(axis => !shorthands.some(candidate =>
      axis.source === candidate.source && axis.label === candidate.label && axis.inline === candidate.inline
    ))
    const winner = resolveEffectiveStyleSource([...shorthands, ...independentAxes])
    // 基础态只作预览；索引已删除的声明也不能从尚未刷新的 effectiveStyle 恢复。
    hasDeclaration = !!winner?.currentState
    rawValue = hasDeclaration ? winner?.value : undefined
  } else if (!hasDeclaration) {
    const gap = effectiveStyle?.gap
    if (gap && gap.type !== 'computed') {
      rawValue = expandTwoShorthand(gap.value)?.[position]
      hasDeclaration = rawValue != null
    }
  }

  return {
    hasDeclaration,
    rawValue: typeof rawValue === 'number' ? rawValue
      : typeof rawValue === 'string' && !/^unset(?:\s*!important)?$/i.test(rawValue.trim()) ? rawValue
        : undefined,
  }
}
