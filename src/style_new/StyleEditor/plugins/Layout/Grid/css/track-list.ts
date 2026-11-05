import { findCssClosingParenthesis } from '../../../../../core/css-functions';

/** 轨道空白和函数参数逗号使用同一套边界规则；函数内容交给现有括号扫描器。 */
function splitTopLevel(source: string, separator: 'space' | 'comma', separateLineNames = false): string[] | null {
  const values: string[] = [];
  let start = 0;
  let brackets = 0;
  const push = (end: number) => {
    const value = source.slice(start, end).trim();
    if (value || separator === 'comma') values.push(value);
  };

  for (let index = 0; index < source.length; index++) {
    const char = source[index];
    if (char === '/' && source[index + 1] === '*') {
      const end = source.indexOf('*/', index + 2);
      if (end === -1) return null;
      if (separator === 'space' && brackets === 0) {
        push(index);
        start = end + 2;
      }
      index = end + 1;
      continue;
    }
    if (char === '"' || char === "'") {
      const quote = char;
      for (index++; index < source.length; index++) {
        if (source[index] === '\\') index++;
        else if (source[index] === quote) break;
      }
      if (index >= source.length) return null;
      continue;
    }
    if (char === '\\') { index++; continue; }
    if (char === '(') {
      index = findCssClosingParenthesis(source, index);
      if (index === -1) return null;
      continue;
    }
    if (char === ')') return null;
    if (char === '[') {
      if (separateLineNames && brackets === 0) { push(index); start = index; }
      brackets++;
    }
    if (char === ']' && --brackets < 0) return null;
    if (char === ']' && separateLineNames && brackets === 0) { push(index + 1); start = index + 1; }
    if (brackets === 0 && (separator === 'space' ? /\s/.test(char) : char === ',')) {
      push(index);
      start = index + 1;
    }
  }
  if (brackets !== 0) return null;
  push(source.length);
  return values;
}

export const splitTopLevelTrackTokens = (source: string) => splitTopLevel(source, 'space');
// 回显允许跳过命名线，包括 [start]1fr[end]；可编辑解析仍保留完整结构。
export const splitPreviewTrackTokens = (source: string) => splitTopLevel(source, 'space', true);
export const splitTopLevelArguments = (source: string) => splitTopLevel(source, 'comma');

export function readFunctionParts(source: string): { name: string; arguments: string } | null {
  const match = source.match(/^([a-z-]+)\(/i);
  if (!match) return null;
  const open = match[0].length - 1;
  if (findCssClosingParenthesis(source, open) !== source.length - 1) return null;
  return { name: match[1].toLowerCase(), arguments: source.slice(open + 1, -1) };
}
