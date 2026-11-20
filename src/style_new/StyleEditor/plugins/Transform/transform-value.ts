import { findCssClosingParenthesis, findCssFunctionCalls } from '../../../core/css-functions'
import type { CssFunctionCall } from '../../../core/css-functions'

type Edit = { start: number; end: number; value: string }
type Axis = 'x' | 'y'
export type TransformAxisType = 'translate' | 'scale'
export type IndividualTransformKey = TransformAxisType | 'rotate'

function readTransform(value?: string | null) {
  const raw = value?.trim() || ''
  const priority = raw.match(/\s*!important\s*$/i)?.[0] || ''
  const body = raw.slice(0, raw.length - priority.length)
  const source = /^(none|unset|initial|inherit|revert|revert-layer)$/i.test(body) ? '' : body
  // 所有外层函数都是扫描目标，避免误改 var()/calc() 参数里的函数。
  const names = source.match(/[a-z_-][\w-]*(?=\()/gi) || []
  return { source, priority, calls: findCssFunctionCalls(source, names) }
}

function applyEdits(value: string | null | undefined, edits: Edit[], append = ''): string | null {
  const { source, priority } = readTransform(value)
  let result = source
  for (const edit of [...edits].sort((a, b) => b.start - a.start)) {
    result = result.slice(0, edit.start) + edit.value + result.slice(edit.end)
  }
  result = `${result.trim()}${append ? ` ${append}` : ''}`.trim()
  return result ? result + priority : null
}

const isRotation = (call: CssFunctionCall) => /^(rotate|rotatez)$/i.test(call.name)

export function readRotation(value?: string | null) {
  const call = readTransform(value).calls.find(isRotation)
  const match = call?.arguments.trim().match(/^([-+]?(?:\d+\.?\d*|\.\d+)(?:e[-+]?\d+)?)(deg|rad|grad|turn)?$/i)
  let angle: number | null = null
  if (match) {
    const factors: Record<string, number> = { deg: 1, rad: 180 / Math.PI, grad: 0.9, turn: 360 }
    const degrees = Number(match[1]) * factors[match[2]?.toLowerCase() || 'deg']
    if (Number.isFinite(degrees)) angle = Number(degrees.toFixed(6))
  }
  return { hasRotation: !!call, angle }
}

/** 原位替换旋转；清空时只移除平面旋转，其他函数及顺序原样保留。 */
export function setRotation(value: string | null | undefined, angle: number | null): string | null {
  const calls = readTransform(value).calls.filter(isRotation)
  if (angle == null) {
    if (!calls.length) return value || null
    return applyEdits(value, calls.map(call => ({ ...call, value: '' })))
  }
  const rotation = `rotate(${angle}deg)`
  return calls.length
    ? applyEdits(value, [{ ...calls[0], value: rotation }])
    : applyEdits(value, [], rotation)
}

function readScale(call: CssFunctionCall): number[] | null {
  const name = call.name.toLowerCase()
  if (!['scale', 'scalex', 'scaley', 'scale3d'].includes(name)) return null
  const args = call.arguments.trim().split(/\s*,\s*|\s+/)
  if (args.some(arg => !/^[-+]?(?:\d+\.?\d*|\.\d+)(?:e[-+]?\d+)?$/i.test(arg))) return null
  const values = args.map(Number)
  if (!values.every(Number.isFinite)) return null
  if (name === 'scale' && (values.length === 1 || values.length === 2)) return [values[0], values[1] ?? values[0]]
  if (name === 'scale3d' && values.length === 3) return values
  if ((name === 'scalex' || name === 'scaley') && values.length === 1) return values
  return null
}

function axisIndex(call: CssFunctionCall, axis: Axis): number | null {
  const name = call.name.toLowerCase()
  if (name === 'scalex' || name === 'translatex') return axis === 'x' ? 0 : null
  if (name === 'scaley' || name === 'translatey') return axis === 'y' ? 0 : null
  return axis === 'x' ? 0 : 1
}

function readTranslate(call: CssFunctionCall): string[] {
  const args: string[] = []
  let start = 0
  // 只拆外层逗号，另一轴的 var()/calc() 参数必须原样保留。
  for (let i = 0; i < call.arguments.length; i++) {
    if (call.arguments[i] === '(') {
      i = findCssClosingParenthesis(call.arguments, i)
    } else if (call.arguments[i] === ',') {
      args.push(call.arguments.slice(start, i).trim())
      start = i + 1
    }
  }
  args.push(call.arguments.slice(start).trim())
  if (call.name.toLowerCase() === 'translate' && args.length === 1) args.push('0px')
  return args
}

function getAxisCalls(value: string | null | undefined, type: TransformAxisType, axis: Axis) {
  const names = type === 'translate' ? /^(translate|translatex|translatey|translate3d)$/i : /^(scale|scalex|scaley|scale3d)$/i
  return readTransform(value).calls.filter(call => names.test(call.name) && axisIndex(call, axis) != null)
}

function scaleAxisSign(calls: CssFunctionCall[], axis: Axis) {
  let sign = 1
  for (const call of calls) {
    const index = axisIndex(call, axis)
    if (index != null && (readScale(call)?.[index] ?? 0) < 0) sign = -sign
  }
  return sign
}

/** 百分比沿用首个缩放分量的幅度，符号包含后续同轴翻转，与翻转按钮一致。 */
export function readTransformAxis(value: string | null | undefined, type: TransformAxisType, axis: Axis) {
  const calls = getAxisCalls(value, type, axis)
  const call = calls[0]
  const values = call ? type === 'translate' ? readTranslate(call) : readScale(call) : null
  const component = call ? values?.[axisIndex(call, axis)!] ?? null : null
  return {
    hasValue: !!call,
    value: typeof component === 'number' ? component * scaleAxisSign(calls.slice(1), axis) : component,
  }
}

/** 修改对应轴，保留另一轴及函数所在位置；清空时恢复默认幅度，保留原翻转。 */
export function setTransformAxis(value: string | null | undefined, type: TransformAxisType, axis: Axis, next: string | null): string | null {
  const calls = getAxisCalls(value, type, axis)
  if (!calls.length) {
    if (next == null) return value || null
    const added = `${type}${axis.toUpperCase()}(${next})`
    // 新位移放在最前，避免被已有旋转/缩放改变方向和距离；新缩放放在末尾。
    return type === 'translate'
      ? applyEdits(value, [{ start: 0, end: 0, value: `${added} ` }])
      : applyEdits(value, [], added)
  }
  const edits: Edit[] = []
  for (const call of next == null ? calls : calls.slice(0, 1)) {
    const index = axisIndex(call, axis)!
    if (type === 'translate') {
      const values = readTranslate(call)
      values[index] = next ?? '0px'
      const text = values.every(part => /^[-+]?0(?:\.0+)?(?:[a-z%]+)?$/i.test(part))
        ? '' : `${call.name}(${values.join(', ')})`
      edits.push({ ...call, value: text })
    } else {
      const values = readScale(call)
      if (!values) continue
      // 输入的符号对应整个轴；改写第一段时抵消后续缩放的符号。
      values[index] = next == null
        ? (values[index] < 0 ? -1 : 1)
        : Number(next) * scaleAxisSign(calls.slice(1), axis)
      edits.push({ ...call, value: scaleText(call, values, next == null ? null : value) })
    }
  }
  return edits.length ? applyEdits(value, edits) : value || null
}

export function readFlips(value?: string | null) {
  const calls = readTransform(value).calls
  return { flipX: scaleAxisSign(calls, 'x') < 0, flipY: scaleAxisSign(calls, 'y') < 0 }
}

function scaleText(call: CssFunctionCall, values: number[], transform?: string | null): string {
  if (values.every(value => value === 1)) {
    // 删除首段 100% 会让面板改读后面的缩放，scale(x,y) 的两个轴都要核对。
    const keepIdentity = transform && (['x', 'y'] as const).some(axis => {
      if (axisIndex(call, axis) == null) return false
      const calls = getAxisCalls(transform, 'scale', axis)
      return calls.length > 1 && calls[0].start === call.start
    })
    if (!keepIdentity) return ''
  }
  return `${call.name}(${values.join(', ')})`
}

/** 只切换对应轴的符号，保留原有缩放幅度。 */
export function toggleFlip(value: string | null | undefined, axis: Axis): string | null {
  for (const call of readTransform(value).calls.reverse()) {
    const scale = readScale(call)
    const index = axisIndex(call, axis)
    if (!scale || index == null || scale[index] === 0) continue
    scale[index] *= -1
    return applyEdits(value, [{ ...call, value: scaleText(call, scale, value) }])
  }
  return applyEdits(value, [], axis === 'x' ? 'scaleX(-1)' : 'scaleY(-1)')
}

/** 面板减号清理二维变换；3D 函数只恢复 x/y，保留 z 轴、矩阵和其他变换。 */
export function clearTransform(value?: string | null): string | null {
  const edits: Edit[] = []
  for (const call of readTransform(value).calls) {
    if (isRotation(call) || /^(translate|translatex|translatey)$/i.test(call.name)) {
      edits.push({ ...call, value: '' })
    } else if (/^translate3d$/i.test(call.name)) {
      const values = readTranslate(call)
      // 只留下 Z，避免重新选中时把已经清除的 X/Y 再识别成面板配置。
      edits.push({ ...call, value: /^[-+]?0(?:\.0+)?(?:[a-z]+)?$/i.test(values[2]) ? '' : `translateZ(${values[2]})` })
    } else {
      const scale = readScale(call)
      if (!scale) continue
      const remaining = call.name.toLowerCase() === 'scale3d' && scale[2] !== 1 ? `scaleZ(${scale[2]})` : ''
      edits.push({ ...call, value: remaining })
    }
  }
  return edits.length ? applyEdits(value, edits) : value || null
}

/** 独立属性仅适配二维数值，借用现有函数编辑；null 表示第一期不支持的表达式或三维值。 */
export function readIndividualTransform(key: IndividualTransformKey, value: string): string | null {
  const raw = value.replace(/\s*!important\s*$/i, '').trim()
  const priority = value.match(/\s*!important\s*$/i)?.[0] || ''
  if (/^(none|unset|initial)$/i.test(raw)) return `none${priority}`
  const parts = raw.split(/\s+/)
  if (key === 'rotate') {
    const transform = `rotate(${raw})${priority}`
    return readRotation(transform).angle == null ? null : transform
  }
  if (parts.length > 2) return null
  const transform = `${key}(${parts.join(', ')})${priority}`
  if (key === 'scale') return readScale(readTransform(transform).calls[0]) ? transform : null
  return parts.every(part => /^[-+]?(?:\d+\.?\d*|\.\d+)(?:e[-+]?\d+)?(?:[a-z]+|%)?$/i.test(part))
    ? transform : null
}

/** 编辑结果仍写回独立属性；缺少的轴补默认值，避免 scaleX(-1) 被写成双轴 scale: -1。 */
export function serializeIndividualTransform(key: IndividualTransformKey, value: string | null): string | null {
  if (value == null) return null
  const { priority } = readTransform(value)
  if (key === 'rotate') return `${readRotation(value).angle}deg${priority}`
  const fallback = key === 'scale' ? 1 : '0px'
  const x = readTransformAxis(value, key, 'x').value ?? fallback
  const y = readTransformAxis(value, key, 'y').value ?? fallback
  return `${x} ${y}${priority}`
}
