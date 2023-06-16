
/**
 * 将字符串拆分为数值和单位
 *
 * @param {string} value - 要拆分的字符串
 * @return {string[]} 一个包含两个元素的数组，数值和单位
 */
export function splitValueAndUnit (value: string | number) {
  if (typeof value === 'number') {
    if (!!isNaN(value)) {
      return [String(value), null]
    }
    return [null, null]
  }

  let num: number | string = parseFloat(value)

  if (isNaN(num)) {
    return [null, null]
  }

  num = String(num)

  return [num, value.replace(num, '')]
}