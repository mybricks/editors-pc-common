const VIEWPORT_LENGTH = /^-?[\d.]+(?:vw|vh|vmin|vmax|dvw|dvh|svw|svh|lvw|lvh)$/i
const LENGTH_EXPRESSION = /^(?:calc|min|max|clamp)\(/i
const NUMERIC_LENGTH = /^(-?(?:\d+\.?\d*|\.\d+))([a-z%]*)$/i

/** 视口单位和公式由浏览器计算；px、% 和关键字沿用声明值。 */
export function needsComputedLength(value?: string | null): boolean {
  return !!value && (VIEWPORT_LENGTH.test(value.trim()) || LENGTH_EXPRESSION.test(value.trim()))
}

/**
 * 只选择长度的回显值，不读 DOM、不写样式。
 * 浏览器已给出数值时规范化数字，避免仅聚焦就因 1121.00px / 1121px 差异回写。
 * 浏览器仍返回表达式时沿用原值，百分比基准不在此推断。
 */
export function resolveLengthValue(value?: string | null, computedValue?: string): string | undefined {
  if (needsComputedLength(value)) {
    const numeric = computedValue?.trim().match(NUMERIC_LENGTH)
    if (numeric) return `${Number(numeric[1])}${numeric[2]}`
  }
  return value ?? undefined
}
