import { findCssClosingParenthesis, findCssFunctionCalls } from '../../../core/css-functions'
import { collectCssVarOptions, parseCssVar, resolveCssVar } from '../../../core/css-var'
import type { CssFunctionCall } from '../../../core/css-functions'
import type { CssVarOption } from '../../../core/css-var'

type Edit = { start: number; end: number; value: string }
type Axis = 'x' | 'y'
/** 轴分量：字面量解析成数字，单个 var() 保留原文，其它表达式不参与面板编辑。 */
type Component = number | string
export type TransformAxisType = 'translate' | 'scale'
export type IndividualTransformKey = TransformAxisType | 'rotate'

/** 单个变量引用（可带 fallback）才渲染胶囊；calc()/多值等表达式由 UI 走只读路径。 */
export function isSimpleVarComponent(value?: string | null): value is string {
  return typeof value === 'string' && parseCssVar(value) != null
}

/** 角度变量：必须带角度单位，避免 --z-modal: 1000 这类无单位数字进列表。 */
const ANGLE_VALUE_RE = /^[-+]?(?:\d+\.?\d*|\.\d+)(?:e[-+]?\d+)?(?:deg|rad|grad|turn)$/i
/** 缩放变量：无单位数字或百分比。 */
const SCALE_VALUE_RE = /^[-+]?(?:\d+\.?\d*|\.\d+)(?:e[-+]?\d+)?%?$/i
/** 纯数字字面量（无单位），用于区分「数值」与「变量引用」 */
const NUMERIC_RE = /^[-+]?(?:\d+\.?\d*|\.\d+)(?:e[-+]?\d+)?$/i

const isAngleValue = (value: string) => ANGLE_VALUE_RE.test(String(value).trim())
export const isScaleValue = (value: string) => SCALE_VALUE_RE.test(String(value).trim())

export const getCssVarAngleOptions = (scopeEl?: Element | null): CssVarOption[] =>
  collectCssVarOptions(scopeEl, isAngleValue)
export const getCssVarScaleOptions = (scopeEl?: Element | null): CssVarOption[] =>
  collectCssVarOptions(scopeEl, isScaleValue)

/** 角度变量统一折算成面板使用的度；解析不到时返回 null。 */
export function resolveAngleVar(value: string, scopeEl?: Element | null): string | null {
  const resolved = resolveCssVar(value, scopeEl, isAngleValue)
  const angle = resolved == null ? null : parseAngle(resolved)
  return angle == null ? null : `${angle}deg`
}

/** 缩放变量统一折算成面板使用的百分比；解析不到时返回 null。 */
export function resolveScaleVar(value: string, scopeEl?: Element | null): string | null {
  const resolved = resolveCssVar(value, scopeEl, isScaleValue)
  if (resolved == null) return null
  const raw = resolved.trim()
  return raw.endsWith('%') ? raw : `${Number((Number(raw) * 100).toFixed(6))}%`
}

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
const isSkew = (call: CssFunctionCall) => /^(skew|skewx|skewy)$/i.test(call.name)
const ANGLE_TO_DEG: Record<string, number> = { deg: 1, rad: 180 / Math.PI, grad: 0.9, turn: 360 }

/** 只认数值 + 角度单位，var()/calc() 返回 null，由调用方决定覆盖还是忽略。 */
function parseAngle(text: string): number | null {
  const match = text.trim().match(/^([-+]?(?:\d+\.?\d*|\.\d+)(?:e[-+]?\d+)?)(deg|rad|grad|turn)?$/i)
  if (!match) return null
  const unit = match[2]?.toLowerCase() || 'deg'
  const degrees = Number(match[1]) * ANGLE_TO_DEG[unit]
  if (!Number.isFinite(degrees)) return null
  // 只有换算单位才收敛小数；deg 是作者原样写的，保留其精度，less 里的两位小数不会被吃掉。
  return unit === 'deg' ? degrees : Number(degrees.toFixed(1))
}

export function readRotation(value?: string | null) {
  const call = readTransform(value).calls.find(isRotation)
  const angle = call ? parseAngle(call.arguments) : null
  return {
    hasRotation: !!call,
    angle,
    // 单个 var() 保留原文供胶囊回显；calc()/多值等表达式仍由 UI 走只读路径。
    raw: call && angle == null && isSimpleVarComponent(call.arguments) ? call.arguments.trim() : null,
  }
}

/** 二维矩阵按 translate → rotate → skewX → scale 拆解，保留完整精度供写回使用。 */
function parseMatrix(value?: string | null) {
  const raw = value?.trim() || ''
  if (!raw.startsWith('matrix(') || !raw.endsWith(')')) return null
  const args = raw.slice(7, -1).split(',')
  if (args.length !== 6 || args.some(arg => !arg.trim() || !Number.isFinite(Number(arg)))) return null

  const [a, b, c, d, translateX, translateY] = args.map(Number)
  const scaleX = Math.hypot(a, b)
  const det = a * d - b * c
  const scaleY = scaleX === 0 ? Math.hypot(c, d) : det / scaleX
  const rotate = (scaleX === 0 ? Math.atan2(-c, d) : Math.atan2(b, a)) * 180 / Math.PI
  // tanθ = (a·c + b·d) / det；除以 scaleX² 只在等比缩放时成立。
  const skewX = det === 0 ? 0 : Math.atan((a * c + b * d) / det) * 180 / Math.PI
  return { translateX, translateY, rotate, scaleX, scaleY, skewX }
}

/** 矩阵回显：位移为 px、角度为度、缩放为百分比，最多一位小数。 */
export function readTransformMatrix(value?: string | null) {
  const matrix = parseMatrix(value)
  if (!matrix) return null
  return {
    translateX: Number(matrix.translateX.toFixed(1)),
    translateY: Number(matrix.translateY.toFixed(1)),
    rotate: Number(matrix.rotate.toFixed(1)),
    scaleX: Number((matrix.scaleX * 100).toFixed(1)),
    scaleY: Number((matrix.scaleY * 100).toFixed(1)),
    skewX: Number(matrix.skewX.toFixed(1)),
  }
}

/** 手写 matrix() 展开成等价函数链，后续读写在函数链上进行；顺序必须是 translate → rotate → skewX → scale。 */
export function matrixToFunctions(value?: string | null): string | null {
  const matrix = parseMatrix(value)
  if (!matrix) return null
  // 保留一位小数：位移和角度直接取整；缩放按面板的百分比口径取整，1.732 保留为 173.2% 而不是 170%。
  const round1 = (input: number) => Number(input.toFixed(1))
  const roundPercent = (input: number) => round1(input * 100) / 100
  const parts = [
    round1(matrix.translateX) || round1(matrix.translateY) ? `translate(${round1(matrix.translateX)}px, ${round1(matrix.translateY)}px)` : '',
    round1(matrix.rotate) ? `rotate(${round1(matrix.rotate)}deg)` : '',
    round1(matrix.skewX) ? `skewX(${round1(matrix.skewX)}deg)` : '',
    roundPercent(matrix.scaleX) !== 1 || roundPercent(matrix.scaleY) !== 1 ? `scale(${roundPercent(matrix.scaleX)}, ${roundPercent(matrix.scaleY)})` : '',
  ]
  return parts.filter(Boolean).join(' ') || 'none'
}

/** 原位替换旋转；清空时只移除平面旋转，其他函数及顺序原样保留。 */
export function setRotation(value: string | null | undefined, angle: number | string | null): string | null {
  const calls = readTransform(value).calls.filter(isRotation)
  if (angle == null) {
    if (!calls.length) return value || null
    return applyEdits(value, calls.map(call => ({ ...call, value: '' })))
  }
  // 变量按原文写入；数字（含数字字符串）补 deg，避免拼出 var(--r)deg 或 rotate(15)。
  const text = typeof angle === 'number' || NUMERIC_RE.test(angle.trim())
    ? `${Number(angle)}deg`
    : angle.trim()
  const rotation = `rotate(${text})`
  return calls.length
    ? applyEdits(value, [{ ...calls[0], value: rotation }])
    : applyEdits(value, [], rotation)
}

/** 只拆外层逗号/空白，var(--a, 4px) 这类带 fallback 的参数必须原样保留。 */
function splitComponents(text: string): string[] {
  const parts: string[] = []
  let start = 0
  let depth = 0
  for (let i = 0; i < text.length; i++) {
    const char = text[i]
    if (char === '(') depth++
    else if (char === ')') depth--
    else if (depth === 0 && (char === ',' || /\s/.test(char))) {
      if (i > start) parts.push(text.slice(start, i).trim())
      start = i + 1
    }
  }
  if (start < text.length) parts.push(text.slice(start).trim())
  return parts.filter(Boolean)
}

/** 角度分量：字面量折算成度，单个 var() 保留原文，其它表达式返回 null。 */
function readAngleComponent(text: string): Component | null {
  const angle = parseAngle(text)
  if (angle != null) return angle
  return isSimpleVarComponent(text) ? text.trim() : null
}

/** skew(a) 只斜 X，skew(a,b) 两轴独立；skewX/skewY 只提供本轴。 */
function readSkew(call: CssFunctionCall) {
  const name = call.name.toLowerCase()
  const raw = splitComponents(call.arguments)
  if (name === 'skewx' || name === 'skewy') {
    const angle = raw.length === 1 ? readAngleComponent(raw[0]) : null
    return angle == null ? null : { x: name === 'skewx' ? angle : null, y: name === 'skewy' ? angle : null, raw }
  }
  if (!raw.length || raw.length > 2) return null
  const x = readAngleComponent(raw[0])
  const y = raw.length === 2 ? readAngleComponent(raw[1]) : 0
  return x == null || y == null ? null : { x, y, raw }
}

/** skewX() 与 skewY() 会同时存在，同一轴靠后的函数优先，读和写用同一套定位。 */
function findSkewForAxis(calls: CssFunctionCall[], axis: Axis) {
  for (let i = calls.length - 1; i >= 0; i--) {
    const call = calls[i]
    if (!isSkew(call)) continue
    const skew = readSkew(call)
    if (skew && skew[axis] != null) return { call, skew }
  }
  return null
}

/** skew 没有独立属性，只从 transform 的函数列表读；skewX 的 Y 为空，skew(a) 的 Y 视为 0。 */
export function readSkewAxis(value: string | null | undefined, axis: Axis) {
  const target = findSkewForAxis(readTransform(value).calls, axis)
  const component = target ? target.skew[axis] : null
  return { hasValue: component != null, value: component }
}

/** tan 周期 180°，先折回 (-90, 90)；±90 处无界，收到邻近可渲染值。 */
function normalizeSkewAngle(angle: number) {
  let next = angle % 180
  if (next > 90) next -= 180
  else if (next < -90) next += 180
  if (next > 89.9) next = 89.9
  else if (next < -89.9) next = -89.9
  return Number(next.toFixed(3))
}

const angleText = (angle: number | string) => typeof angle === 'number' ? `${angle}deg` : angle
const skewText = (axis: Axis, angle: number | string) => `skew${axis.toUpperCase()}(${angleText(angle)})`

/** 原位改写倾斜，另一轴沿用原文；新增追加单轴函数，清空一轴后另一轴退化为单轴形式。 */
export function setSkewAxis(value: string | null | undefined, axis: Axis, next: number | string | null): string | null {
  // 变量按原文写入；只有数字（含数字字符串）才做 ±90° 归一化。
  const angle = next == null
    ? null
    : typeof next === 'number' || NUMERIC_RE.test(next.trim()) ? normalizeSkewAngle(Number(next)) : next.trim()
  const calls = readTransform(value).calls
  const target = findSkewForAxis(calls, axis)
  if (!target) {
    // 只替换无法解析且可能属于本轴的函数；skewY(var()) 与拖拽 X 无关，保留它并追加新函数。
    const sameAxis = `skew${axis}`
    const unparsed = calls.filter(isSkew).find(call =>
      readSkew(call) == null && [sameAxis, 'skew'].includes(call.name.toLowerCase()))
    if (angle == null) return value || null
    // var()/calc() 参数无法局部改写，整体替换成本轴函数，与旋转输入一致。
    return unparsed
      ? applyEdits(value, [{ ...unparsed, value: skewText(axis, angle) }])
      : applyEdits(value, [], skewText(axis, angle))
  }
  const { call, skew } = target
  const other: Axis = axis === 'x' ? 'y' : 'x'
  // skewX/skewY 的 raw 只有本轴一个参数，不能按 skew(a, b) 的下标去取另一轴。
  const otherRaw = call.name.toLowerCase() === 'skew' ? skew.raw[axis === 'x' ? 1 : 0] : null
  if (angle == null) {
    // 清空单轴函数直接整段删掉；skew(a) 的 Y 是隐含 0：清 X 删整段，清 Y 退化为 skewX。
    const text = call.name.toLowerCase() !== 'skew'
      ? ''
      : skew.raw.length === 1
        ? (axis === 'x' ? '' : skewText('x', skew.raw[0]))
        : (otherRaw == null ? '' : skewText(other, otherRaw))
    return applyEdits(value, [{ ...call, value: text }])
  }
  if (call.name.toLowerCase() !== 'skew') return applyEdits(value, [{ ...call, value: skewText(axis, angle) }])
  const x = angleText(axis === 'x' ? angle : skew.raw[0])
  const y = angleText(axis === 'y' ? angle : (otherRaw ?? '0deg'))
  // 单参 skew() 只在写 X 时保持单参写法。
  return applyEdits(value, [{ ...call, value: skew.raw.length === 1 && axis === 'x' ? `skew(${x})` : `skew(${x}, ${y})` }])
}

const SCALE_FUNCTIONS = ['scale', 'scalex', 'scaley', 'scale3d']

/** 缩放分量：数字转成 number，单个 var() 保留原文；其它表达式返回 null。 */
function readScaleParts(call: CssFunctionCall): Component[] | null {
  const name = call.name.toLowerCase()
  if (!SCALE_FUNCTIONS.includes(name)) return null
  const args = splitComponents(call.arguments)
  if (!args.length) return null
  const values: Component[] = []
  for (const arg of args) {
    if (NUMERIC_RE.test(arg)) {
      // 正则放行 1e999，但 Number 会溢出成 Infinity，写回去会拼出 scale(Infinity)
      const value = Number(arg)
      if (!Number.isFinite(value)) return null
      values.push(value)
    } else if (isSimpleVarComponent(arg)) values.push(arg.trim())
    else return null
  }
  if (name === 'scale' && (values.length === 1 || values.length === 2)) return [values[0], values[1] ?? values[0]]
  if (name === 'scale3d' && values.length === 3) return values
  if ((name === 'scalex' || name === 'scaley') && values.length === 1) return values
  return null
}

/** 只有全部是数字的缩放才能参与翻转/清空等数值运算。 */
function readScale(call: CssFunctionCall): number[] | null {
  const values = readScaleParts(call)
  return values && values.every(value => typeof value === 'number') ? values as number[] : null
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
  const values = call ? type === 'translate' ? readTranslate(call) : readScaleParts(call) : null
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
      const values = readScaleParts(call)
      if (!values) continue
      const component = values[index]
      // 输入的符号对应整个轴；改写第一段时抵消后续缩放的符号。
      // 变量分量原样覆盖；清空时落成 1，原符号只在能读到数字时保留。
      values[index] = next == null
        ? (typeof component === 'number' && component < 0 ? -1 : 1)
        : NUMERIC_RE.test(next) ? Number(next) * scaleAxisSign(calls.slice(1), axis) : next.trim()
      const numeric = values.every(item => typeof item === 'number')
      edits.push({
        ...call,
        value: numeric
          ? scaleText(call, values as number[], next == null ? null : value)
          : scalePartsText(call, values),
      })
    }
  }
  return edits.length ? applyEdits(value, edits) : value || null
}

export function readFlips(value?: string | null) {
  const calls = readTransform(value).calls
  // 同轴翻转两次会抵消，合并后的符号为负才算翻转。
  return { flipX: scaleAxisSign(calls, 'x') < 0, flipY: scaleAxisSign(calls, 'y') < 0 }
}

function scaleText(call: CssFunctionCall, values: number[], transform?: string | null): string {
  if (values.every(value => value === 1)) {
    // 后面还有同轴缩放时，保留首段 100%，避免面板改读后面的值。
    const keepIdentity = transform && (['x', 'y'] as const).some(axis => {
      if (axisIndex(call, axis) == null) return false
      const calls = getAxisCalls(transform, 'scale', axis)
      return calls.length > 1 && calls[0].start === call.start
    })
    if (!keepIdentity) return ''
  }
  return `${call.name}(${values.join(', ')})`
}

/** 含变量分量的缩放无法走数值归一化，只做原文拼接。 */
function scalePartsText(call: CssFunctionCall, values: Component[]): string {
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
    if (isRotation(call) || isSkew(call) || /^(translate|translatex|translatey)$/i.test(call.name)) {
      edits.push({ ...call, value: '' })
    } else if (/^translate3d$/i.test(call.name)) {
      const values = readTranslate(call)
      // 只留下 Z，避免重新选中时把已经清除的 X/Y 再识别成面板配置。
      edits.push({ ...call, value: /^[-+]?0(?:\.0+)?(?:[a-z]+)?$/i.test(values[2]) ? '' : `translateZ(${values[2]})` })
    } else {
      const scale = readScale(call)
      if (!scale) {
        // 含变量分量的缩放无法做符号归一化，但重置同样要能清掉。
        if (readScaleParts(call)) edits.push({ ...call, value: '' })
        continue
      }
      const remaining = call.name.toLowerCase() === 'scale3d' && scale[2] !== 1 ? `scaleZ(${scale[2]})` : ''
      edits.push({ ...call, value: remaining })
    }
  }
  return edits.length ? applyEdits(value, edits) : value || null
}

/** 独立属性仅适配二维值，借用现有函数编辑；变量分量原样保留，其它表达式返回 null。 */
export function readIndividualTransform(key: IndividualTransformKey, value: string): string | null {
  const raw = value.replace(/\s*!important\s*$/i, '').trim()
  const priority = value.match(/\s*!important\s*$/i)?.[0] || ''
  if (/^(none|unset|initial)$/i.test(raw)) return `none${priority}`
  if (key === 'rotate') {
    const transform = `rotate(${raw})${priority}`
    return readRotation(transform).angle == null && !isSimpleVarComponent(raw) ? null : transform
  }
  const parts = raw.split(/\s+/)
  if (parts.length > 2) return null
  const transform = `${key}(${parts.join(', ')})${priority}`
  if (key === 'scale') return readScaleParts(readTransform(transform).calls[0]) ? transform : null
  return parts.every(part => /^[-+]?(?:\d+\.?\d*|\.\d+)(?:e[-+]?\d+)?(?:[a-z]+|%)?$/i.test(part) || isSimpleVarComponent(part))
    ? transform : null
}

/** 编辑结果仍写回独立属性；缺少的轴补默认值，避免 scaleX(-1) 被写成双轴 scale: -1。 */
export function serializeIndividualTransform(key: IndividualTransformKey, value: string | null): string | null {
  if (value == null) return null
  const { priority } = readTransform(value)
  if (key === 'rotate') {
    const rotation = readRotation(value)
    // 变量绑定原样落盘，不拼成 var(--r)deg。
    return `${rotation.raw ?? `${rotation.angle}deg`}${priority}`
  }
  const fallback = key === 'scale' ? 1 : '0px'
  const x = readTransformAxis(value, key, 'x').value ?? fallback
  const y = readTransformAxis(value, key, 'y').value ?? fallback
  return `${x} ${y}${priority}`
}

/** clamp/calc/min/max 表达式或裸视口单位：面板展示前需要向浏览器求值。 */
// 不引用 StyleEditor/utils.ts 的 LENGTH_EXPR_RE：那个只判断「胶囊文案是否过长」，
// 且未导出；这里还要覆盖裸 vw/vh（6vw 不是函数调用，但同样拿不到数值）。
const EXPRESSION_RE = /^(?:calc|min|max|clamp)\(/i
const VIEWPORT_UNIT_RE = /^-?[\d.]+(?:vw|vh|vmin|vmax|dvw|dvh|svw|svh|lvw|lvh)$/i

export function isTransformExpression(value?: string | null): boolean {
  const text = String(value ?? '').trim()
  return EXPRESSION_RE.test(text) || VIEWPORT_UNIT_RE.test(text)
}

/**
 * 位移分量表达式求值，例如 clamp(24px, 5vw, 64px) → 64px。
 *
 * 为什么不直接读元素自己的计算值（getComputedStyle(targetDom).transform /
 * effectiveStyle.transform.computedValue）：
 * 1. 面板读的是声明里该分量「那一个参数」（readTransformAxis 取第一个匹配函数），
 *    而元素的计算矩阵是整条 transform 合并的结果。同一轴有多个 translate，或
 *    translate 排在 rotate/scale 之后时（rotate(15deg) translateX(64px) 的矩阵
 *    m41 = cos15°×64 ≈ 61.8），矩阵里的位移已经不等于该参数本身。
 * 2. 元素处于 hover 等状态时，zone-tab 会把 computedValue 换回声明原文，
 *    不保证拿到的是 matrix。
 * 所以只能把该参数单独丢给探针求值；矩阵解析仍复用上面的 readTransformMatrix，
 * 不重复实现一套 matrix 拆解。
 */
export function resolveTransformComponentPx(
  expression: string,
  axis: 'x' | 'y',
  scopeEl: Element,
): string | null {
  try {
    const doc = scopeEl.ownerDocument
    const view = doc.defaultView
    if (!view) return null
    const probe = doc.createElement('div')
    // 取目标元素尺寸，calc(50% - 10px) 这类百分比才按元素自身宽度换算，而不是按 0 算
    const rect = scopeEl.getBoundingClientRect()
    probe.style.cssText = 'position:absolute;left:0;top:0;visibility:hidden;pointer-events:none;'
      + `width:${rect.width}px;height:${rect.height}px`
    probe.style.transform = `translate${axis.toUpperCase()}(${expression})`
    doc.body.appendChild(probe)
    const computed = view.getComputedStyle(probe).transform
    probe.remove()
    const matrix = readTransformMatrix(computed)
    if (!matrix) return null
    return `${axis === 'x' ? matrix.translateX : matrix.translateY}px`
  } catch {
    return null
  }
}
