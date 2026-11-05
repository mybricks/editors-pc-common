import { expandRepeatToken } from './repeat';
import { readFunctionParts, splitPreviewTrackTokens, splitTopLevelArguments } from './track-list';
import { parseTrackSize } from './track-size';
import { MAX_EDITABLE_TRACKS, Track } from './types';

/** 只读回显可忽略命名线来识别尺寸，结果不进入可编辑轨道模型。 */
function readAuthoredPreview(source: string): Track[] | null {
  const tokens = splitPreviewTrackTokens(source);
  if (!tokens?.length) return null;
  const tracks: Track[] = [];
  for (let token of tokens) {
    if (token.startsWith('[')) continue;
    const fn = readFunctionParts(token);
    if (fn?.name === 'repeat') {
      const args = splitTopLevelArguments(fn.arguments);
      if (!args || args.length !== 2) return null;
      const pattern = splitPreviewTrackTokens(args[1]);
      if (!pattern) return null;
      token = `repeat(${args[0]}, ${pattern.filter(item => !item.startsWith('[')).join(' ')})`;
    }
    const expanded = expandRepeatToken(token, MAX_EDITABLE_TRACKS - tracks.length);
    if (!expanded) return null;
    tracks.push(...expanded);
  }
  return tracks.length ? tracks : null;
}

/** CSSOM 中命名线不占轨道；subgrid 只提供网格线数量，不提供像素尺寸。 */
export function readComputedTrackSizes(source: string): (number | undefined)[] {
  const tokens = splitPreviewTrackTokens(source);
  if (!tokens?.length || source === 'none') return [];
  if (tokens[0] === 'subgrid') {
    return Array.from({ length: Math.max(0, tokens.length - 2) }, () => undefined);
  }
  const sizes: number[] = [];
  for (const token of tokens) {
    if (token.startsWith('[')) continue;
    const track = parseTrackSize(token);
    if (track?.kind !== 'dimension' || !['px', ''].includes(track.unit)) return [];
    sizes.push(track.value);
  }
  return sizes;
}

export function getReadonlyTrackPreview(source: string, actualSizes: (number | undefined)[]): {
  tracks: (Track | undefined)[]; measured: boolean;
} {
  const authored = readAuthoredPreview(source);
  if (authored && (!actualSizes.length || authored.length === actualSizes.length)) {
    return { tracks: authored, measured: false };
  }
  // 无法逐项对应源码时，只展示实际尺寸；缺失尺寸用空值表示，不猜测 Fixed/Fill。
  return { tracks: actualSizes.map(value => value === undefined ? undefined : { kind: 'dimension', value, unit: 'px' }), measured: true };
}
