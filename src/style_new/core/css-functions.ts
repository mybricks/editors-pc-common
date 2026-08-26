export interface CssFunctionCall {
  name: string
  value: string
  arguments: string
  start: number
  /** 函数调用在 source 中的结束位置（exclusive） */
  end: number
}

const isNameStart = (char: string) => /[a-z_-]/i.test(char)
const isNameChar = (char: string) => /[a-z0-9_-]/i.test(char)

function skipQuoted(source: string, start: number): number {
  const quote = source[start]
  let escaped = false
  for (let i = start + 1; i < source.length; i++) {
    if (escaped) {
      escaped = false
      continue
    }
    if (source[i] === '\\') {
      escaped = true
      continue
    }
    if (source[i] === quote) return i + 1
  }
  return source.length
}

function skipComment(source: string, start: number): number {
  const end = source.indexOf('*/', start + 2)
  return end === -1 ? source.length : end + 2
}

/** 查找 CSS 函数右括号，忽略字符串、转义字符和注释中的括号。 */
export function findCssClosingParenthesis(source: string, openIndex: number): number {
  if (source[openIndex] !== '(') return -1

  let depth = 0
  for (let i = openIndex; i < source.length; i++) {
    const char = source[i]
    if (char === '"' || char === "'") {
      i = skipQuoted(source, i) - 1
      continue
    }
    if (char === '/' && source[i + 1] === '*') {
      i = skipComment(source, i) - 1
      continue
    }
    if (char === '(') depth++
    else if (char === ')') {
      depth--
      if (depth === 0) return i
    }
  }
  return -1
}

/**
 * 提取指定 CSS 函数，支持嵌套函数、字符串和注释。
 * 命中目标函数后返回完整外层调用，不再重复返回它内部的目标函数。
 */
export function findCssFunctionCalls(
  source: string,
  names: readonly string[]
): CssFunctionCall[] {
  if (typeof source !== 'string' || source.length === 0 || names.length === 0) return []

  const expectedNames = new Set(names.map((name) => name.toLowerCase()))
  const calls: CssFunctionCall[] = []

  for (let i = 0; i < source.length;) {
    const char = source[i]
    if (char === '"' || char === "'") {
      i = skipQuoted(source, i)
      continue
    }
    if (char === '/' && source[i + 1] === '*') {
      i = skipComment(source, i)
      continue
    }
    if (!isNameStart(char)) {
      i++
      continue
    }

    let nameEnd = i + 1
    while (nameEnd < source.length && isNameChar(source[nameEnd])) nameEnd++
    if (source[nameEnd] !== '(') {
      i = nameEnd
      continue
    }

    const closeIndex = findCssClosingParenthesis(source, nameEnd)
    if (closeIndex === -1) {
      i = nameEnd + 1
      continue
    }

    const name = source.slice(i, nameEnd)
    if (expectedNames.has(name.toLowerCase())) {
      calls.push({
        name,
        value: source.slice(i, closeIndex + 1),
        arguments: source.slice(nameEnd + 1, closeIndex),
        start: i,
        end: closeIndex + 1,
      })
      i = closeIndex + 1
      continue
    }

    // 外层函数不是目标时继续扫描其参数，以便找到 linear-gradient(var(...)) 中的 var。
    i = nameEnd + 1
  }

  return calls
}
