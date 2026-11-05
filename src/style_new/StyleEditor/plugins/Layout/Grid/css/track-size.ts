import { splitTopLevelArguments, readFunctionParts } from './track-list';
import type { Breadth, Dimension, Track } from './types';

const DIMENSION = /^([+]?(?:\d+(?:\.\d*)?|\.\d+)(?:e[+-]?\d+)?)(px|fr|%|r?em|r?lh|r?ex|r?ch|r?cap|r?ic|[sld]?v(?:w|h|i|b|min|max)|cq(?:w|h|i|b|min|max)|cm|mm|q|in|pt|pc)?$/i;
const MATH_FUNCTIONS = ['calc', 'min', 'max', 'clamp'];

function parseBreadth(raw: string, allowFlex: boolean): Breadth | null {
  const token = raw.trim();
  const dimension = token.match(DIMENSION);
  if (dimension) {
    const value = Number(dimension[1]);
    const unit = (dimension[2] || '').toLowerCase();
    if (!Number.isFinite(value) || (!unit && value !== 0) || (unit === 'fr' && !allowFlex)) return null;
    return { kind: 'dimension', value, unit, raw: token };
  }
  if (/^(auto|min-content|max-content)$/i.test(token)) {
    return { kind: 'keyword', value: token.toLowerCase() as 'auto' | 'min-content' | 'max-content', raw: token };
  }
  const fn = readFunctionParts(token);
  // 参数位置的变量只能替换一个 breadth；顶层 var 则可能展开成整个轨道列表。
  if (fn && fn.arguments.trim() && [...MATH_FUNCTIONS, 'var', 'env'].includes(fn.name)) {
    return { kind: 'expression', raw: token };
  }
  return null;
}

export function parseTrackSize(raw: string): Track | null {
  const token = raw.trim();
  const fn = readFunctionParts(token);
  if (fn?.name === 'var' || fn?.name === 'env') return null;
  if (fn?.name === 'minmax') {
    const args = splitTopLevelArguments(fn.arguments);
    if (!args || args.length !== 2) return null;
    const min = parseBreadth(args[0], false);
    const max = parseBreadth(args[1], true);
    return min && max ? { kind: 'minmax', min, max, raw: token } : null;
  }
  if (fn?.name === 'fit-content' && fn.arguments.trim()) return { kind: 'expression', raw: token };
  return parseBreadth(token, true);
}

export function serializeTrack(track: Track): string {
  if (track.raw !== undefined) return track.raw;
  switch (track.kind) {
    case 'dimension': return `${track.value}${track.unit}`;
    case 'keyword': return track.value;
    case 'minmax': return `minmax(${serializeTrack(track.min)}, ${serializeTrack(track.max)})`;
    case 'expression': return track.raw;
  }
}

export function createTrack(mode: 'fixed' | 'fill' | 'hug', value = mode === 'fixed' ? 100 : 1): Track {
  return mode === 'hug' ? { kind: 'keyword', value: 'max-content' }
    : { kind: 'dimension', value, unit: mode === 'fill' ? 'fr' : 'px' };
}

// 尺寸输入只修改 minmax 的上限；切换尺寸模式由 createTrack 明确替换整条轨道。
export function updateTrackValue(track: Track, value: number, mode: 'fixed' | 'fill' | 'percent'): Track {
  const next: Dimension = { kind: 'dimension', value, unit: mode === 'fill' ? 'fr' : mode === 'percent' ? '%' : 'px' };
  return track.kind === 'minmax' ? { ...track, max: next, raw: undefined } : next;
}
