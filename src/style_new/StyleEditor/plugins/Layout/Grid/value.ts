import { expandRepeatToken, parseAutoRepeat } from './css/repeat';
import { splitTopLevelTrackTokens } from './css/track-list';
import { createTrack, serializeTrack } from './css/track-size';
import { MAX_EDITABLE_TRACKS } from './css/types';
import { resolveGridVariable } from './css/variable';
import type { Track, TrackListResult, TrackWriteResult } from './css/types';

export type { Track, TrackListResult } from './css/types';
export { createTrack, updateTrackValue } from './css/track-size';
export { MAX_EDITABLE_TRACKS } from './css/types';

export function parseTrackList(value?: string | null): TrackListResult {
  const source = value ?? '';
  if (!source.trim() || source.trim().toLowerCase() === 'none') return { kind: 'empty', source, tracks: [] };
  const tokens = splitTopLevelTrackTokens(source);
  const tracks: Track[] = [];
  if (tokens?.length) {
    for (const token of tokens) {
      const expanded = expandRepeatToken(token, MAX_EDITABLE_TRACKS - tracks.length);
      if (!expanded) return { kind: 'readonly', source, tracks: [] };
      tracks.push(...expanded);
    }
    return { kind: 'tracks', source, tracks };
  }
  return { kind: 'readonly', source, tracks: [] };
}

// 仅供实际行数预览；写入入口必须保留 parseTrackList 返回的结构状态。
export function parseTracks(value?: string | null): Track[] {
  return parseTrackList(value).tracks;
}

/** computed 只提供数量，轨道尺寸沿用源码模板；主动提交前不改写动态规则。 */
export function resolveAutoRepeat(list: TrackListResult, computedValue: string): TrackListResult {
  const repeat = parseAutoRepeat(list.source);
  if (!repeat) return list;
  const count = parseTracks(computedValue).length;
  if (!count) return list;
  return { kind: 'auto-repeat', source: list.source, tracks: Array.from({ length: count }, () => repeat) };
}

/** 只展开可理解的变量内容；浏览器计算值仅用于动态 repeat 的数量。 */
export function resolveVariableTracks(list: TrackListResult, target: Element, computedValue: string): TrackListResult {
  const variableValue = resolveGridVariable(list.source, target);
  if (variableValue === null) return list;
  let resolved = parseTrackList(variableValue);
  if (resolved.kind === 'readonly') resolved = resolveAutoRepeat(resolved, computedValue);
  if (resolved.kind !== 'tracks' && resolved.kind !== 'auto-repeat') return list;
  return { ...resolved, source: list.source, variableValue };
}

export function serializeTracks(tracks: Track[]): string {
  return tracks.map(serializeTrack).join(' ');
}

export function serializeTrackList(list: TrackListResult, tracks: Track[]): TrackWriteResult {
  if (list.kind === 'readonly') return { kind: 'unsupported' };
  return { kind: 'change', value: serializeTracks(tracks) };
}

export function resizeTracks(tracks: Track[], count: number, repeatTrack?: Track): Track[] {
  return Array.from({ length: count }, (_, index) => tracks[index] || repeatTrack || createTrack('fill', 1));
}

export function getTrackDisplay(
  track: Track,
): { mode: 'fixed' | 'fill' | 'hug' | 'raw'; value?: number; text: string } {
  const size = track.kind === 'minmax' ? track.max : track;
  if (size.kind === 'dimension' && ['px', 'fr', '%', ''].includes(size.unit)) {
    return {
      mode: size.unit === 'fr' ? 'fill' : 'fixed',
      value: size.value,
      text: `${size.value}${size.unit === 'fr' || size.unit === '%' ? size.unit : ''}`,
    };
  }
  if (track.kind === 'keyword' && track.value === 'max-content') return { mode: 'hug', text: 'max-content' };
  return { mode: 'raw', text: serializeTrack(track) };
}
