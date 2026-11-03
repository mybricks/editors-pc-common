export type Track = { mode: 'fixed' | 'fill' | 'hug'; value?: number };

// 读取显式轨道及整数 repeat 声明，不使用 computed 像素值替代轨道尺寸。
export function parseTracks(value?: string | null): Track[] {
  if (!value || value === 'none') return [];
  const expanded = value.replace(/repeat\(\s*(\d+)\s*,\s*([^()]+)\)/g,
    (_, count, tracks) => Array(Number(count)).fill(tracks.trim()).join(' '));
  return expanded.trim().split(/\s+/).map(track => {
    if (track === 'max-content') return { mode: 'hug' };
    return { mode: track.endsWith('fr') ? 'fill' : 'fixed', value: parseFloat(track) };
  });
}

export function serializeTracks(tracks: Track[]): string {
  return tracks.map(track => track.mode === 'hug'
    ? 'max-content'
    : `${track.value}${track.mode === 'fill' ? 'fr' : 'px'}`
  ).join(' ');
}

export function resizeTracks(tracks: Track[], count: number): Track[] {
  return Array.from({ length: count }, (_, index) => tracks[index] || { mode: 'fill', value: 1 });
}
