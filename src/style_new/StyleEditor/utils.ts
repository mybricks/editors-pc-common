/**
 * 将字符串拆分为数值和单位。
 *
 * @param {string} value - 要拆分的字符串。
 * @return {string[]} 一个包含两个元素的数组，数值和单位。
 */
export function splitValueAndUnit(value: string | number) {
  if (typeof value === "number") {
    if (!!isNaN(value)) {
      return [String(value), null];
    }
    return [null, null];
  }

  let num: number | string = parseFloat(value);

  if (isNaN(num)) {
    return [null, null];
  }

  num = String(num);

  return [num, value.replace(num, "")];
}

const LENGTH_EXPR_RE = /^(?:calc|min|max|clamp)\(/i

function toCompactPx(computed?: string | null): string | undefined {
  if (!computed) return undefined
  const n = parseFloat(String(computed))
  return isNaN(n) ? undefined : String(Math.round(n))
}

/**
 * 长度值的胶囊文案：px 省略单位（24px → 24）。
 * calc/min/max/clamp 或过长表达式优先显示计算后的 px，避免胶囊被撑破；
 * 没有计算值时只露函数名。完整表达式应放在 hover tip 里。
 */
export function formatLengthDisplay(
  value?: string | null,
  computedPx?: string | null
): string | undefined {
  if (!value && !computedPx) return undefined
  const trimmed = (value || '').trim()

  if (/^-?[\d.]+px$/i.test(trimmed)) {
    return trimmed.replace(/px$/i, '')
  }

  const isExpr = LENGTH_EXPR_RE.test(trimmed)
  const tooLong = trimmed.length > 8
  if (isExpr || tooLong) {
    const compact = toCompactPx(computedPx)
    if (compact) return compact
    if (isExpr) return trimmed.match(/^(calc|min|max|clamp)/i)?.[1] || 'calc'
  }

  return trimmed || toCompactPx(computedPx)
}

/**
 * 返回键映射对象中的真实键，如果不存在则返回原始键。
 *
 * @param {object} keyMap - 在其中查找键的键映射对象。
 * @param {string} key - 在键映射对象中查找的键。
 * @return {string} 键映射对象中键的值，如果键映射对象中不存在则为原始键。
 */
export function getRealKey(keyMap: { [key: string]: string }, key: string) {
  return keyMap[key] || key;
}

/**
 * 确定给定数组中的所有元素是否相等。
 *
 * @param {Array<any>} arr - 检查是否相等的数组。
 * @return {boolean} 如果数组中的所有元素都相等则返回 true，否则返回 false。
 */
export function allEqual(arr: Array<any>) {
  return new Set(arr).size === 1;
}

/**
 * 函数输入 haxColor、rgba、rgb 格式的颜色，返回 rgba 格式的颜色
*/
export function color2rgba(color: string): string {
  if (color.startsWith('rgba')) {
    return color
  }
  if (color.startsWith('rgb')) {
    return color.replace('rgb', 'rgba').replace(')', ',1)')
  }
  if (color.startsWith('#')) {
    const r = parseInt(color.slice(1, 3), 16)
    const g = parseInt(color.slice(3, 5), 16)
    const b = parseInt(color.slice(5, 7), 16)
    let a = "1";
    if (color.length === 9) {
      a = (parseInt(color.slice(7, 9), 16) / 255).toFixed(2)
    }
    return `rgba(${r},${g},${b},${a})`
  }
  return color
}