import { splitTopLevelTrackTokens, splitTopLevelArguments, readFunctionParts } from './track-list';
import { parseTrackSize } from './track-size';
import type { Track } from './types';

/** 只展开有限整数 repeat；动态重复、命名线及未知结构交回调用方保留整条原文。 */
export function expandRepeatToken(token: string, available: number): Track[] | null {
  const parts = readFunctionParts(token);
  if (!parts || parts.name !== 'repeat') {
    const track = parseTrackSize(token);
    return track && available >= 1 ? [track] : null;
  }
  const args = splitTopLevelArguments(parts.arguments);
  if (!args || args.length !== 2 || !/^\+?\d+$/.test(args[0])) return null;
  const count = Number(args[0]);
  const tokens = splitTopLevelTrackTokens(args[1]);
  if (!tokens?.length || count < 1 || count * tokens.length > available) return null;
  const pattern: Track[] = [];
  for (const item of tokens) {
    const track = parseTrackSize(item);
    if (!track) return null;
    pattern.push(track);
  }
  // 节点按不可变值使用，编辑时替换目标节点，不原地改重复模式。
  return Array.from({ length: count }, () => pattern).flat();
}
