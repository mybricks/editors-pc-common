import { findCssFunctionCalls } from '../../../core/css-functions'
import type { CssFunctionCall } from '../../../core/css-functions'

type Edit = { start: number; end: number; value: string }
type Axis = 'x' | 'y'

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
  if (name === 'scalex') return axis === 'x' ? 0 : null
  if (name === 'scaley') return axis === 'y' ? 0 : null
  return axis === 'x' ? 0 : 1
}

export function readFlips(value?: string | null) {
  let flipX = false, flipY = false
  for (const call of readTransform(value).calls) {
    const scale = readScale(call)
    if (!scale) continue
    const x = axisIndex(call, 'x'), y = axisIndex(call, 'y')
    if (x != null && scale[x] < 0) flipX = !flipX
    if (y != null && scale[y] < 0) flipY = !flipY
  }
  return { flipX, flipY }
}

function scaleText(call: CssFunctionCall, values: number[]): string {
  return values.every(value => value === 1) ? '' : `${call.name}(${values.join(', ')})`
}

/** 只切换对应轴的符号，保留原有缩放幅度。 */
export function toggleFlip(value: string | null | undefined, axis: Axis): string | null {
  for (const call of readTransform(value).calls.reverse()) {
    const scale = readScale(call)
    const index = axisIndex(call, axis)
    if (!scale || index == null || scale[index] === 0) continue
    scale[index] *= -1
    return applyEdits(value, [{ ...call, value: scaleText(call, scale) }])
  }
  return applyEdits(value, [], axis === 'x' ? 'scaleX(-1)' : 'scaleY(-1)')
}

/** 面板减号重置旋转/翻转，但保留位移、缩放幅度、矩阵和其他变换。 */
export function clearRotationAndFlips(value?: string | null): string | null {
  const edits: Edit[] = []
  for (const call of readTransform(value).calls) {
    if (isRotation(call)) edits.push({ ...call, value: '' })
    else {
      const scale = readScale(call)
      if (!scale) continue
      // scale3d 的 z 轴不属于本面板的水平/垂直翻转。
      const planar = call.name.toLowerCase() === 'scale3d' ? scale.slice(0, 2) : scale
      if (planar.some(number => number < 0)) {
        const positive = scale.map((number, index) => index < planar.length ? Math.abs(number) : number)
        edits.push({ ...call, value: scaleText(call, positive) })
      }
    }
  }
  return edits.length ? applyEdits(value, edits) : value || null
}
