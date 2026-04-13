// eslint-disable-next-line @typescript-eslint/no-var-requires
const opentype = require('./ir-to-figma/vendors/opentype');

import type { FontContext, FontContextMap } from '../types';

type NonNullFontContext = NonNullable<FontContext>;

// PingFang SC 在 macOS 上的全部 6 个字重变体
const PINGFANG_VARIANTS: Array<{ weight: number; postscript: string; style: string }> = [
  { weight: 100, postscript: 'PingFangSC-Ultralight', style: 'Ultralight' },
  { weight: 200, postscript: 'PingFangSC-Thin',       style: 'Thin'       },
  { weight: 300, postscript: 'PingFangSC-Light',      style: 'Light'      },
  { weight: 400, postscript: 'PingFangSC-Regular',    style: 'Regular'    },
  { weight: 500, postscript: 'PingFangSC-Medium',     style: 'Medium'     },
  { weight: 600, postscript: 'PingFangSC-Semibold',   style: 'Semibold'   },
];

let _cachedFontCtxMap: FontContextMap | null = null;
let _fontMapLoadingPromise: Promise<FontContextMap> | null = null;

async function loadSingleVariant(
  localFonts: any[],
  postscript: string,
  style: string,
): Promise<NonNullFontContext | null> {
  try {
    const match = localFonts.find(
      (f: any) =>
        f.postscriptName === postscript ||
        (f.family === 'PingFang SC' && f.style === style),
    );
    if (!match) return null;
    const blob = await match.blob();
    const fontBuffer = await blob.arrayBuffer();
    const font = opentype.parse(fontBuffer);
    const fontDigest = new Uint8Array(await crypto.subtle.digest('SHA-1', fontBuffer));
    return { font, fontDigest, style, postscript };
  } catch (_) {
    return null;
  }
}

/**
 * 加载 PingFang SC 各字重字体，返回 weight → FontContext 映射。
 * 并行加载 Light / Regular / Medium / Semibold，结果全局缓存。
 */
export async function loadFontContextMap(): Promise<FontContextMap> {
  if (_cachedFontCtxMap) return _cachedFontCtxMap;
  if (_fontMapLoadingPromise) return _fontMapLoadingPromise;

  _fontMapLoadingPromise = (async (): Promise<FontContextMap> => {
    const result: FontContextMap = {};

    if (!('queryLocalFonts' in window)) {
      console.warn('[字体加载] queryLocalFonts 不可用，字形将需要双击显示');
      return result;
    }

    try {
      const localFonts: any[] = await (window as any).queryLocalFonts();
      const settled = await Promise.all(
        PINGFANG_VARIANTS.map(({ weight, postscript, style }) =>
          loadSingleVariant(localFonts, postscript, style).then(ctx => ({ weight, ctx })),
        ),
      );
      for (const { weight, ctx } of settled) {
        if (ctx) result[weight] = ctx;
      }
      if (Object.keys(result).length === 0) {
        console.warn('[字体加载] 未找到任何 PingFang SC 变体，字形将需要双击显示');
      } else {
        console.log('[字体加载] 已加载字重:', Object.keys(result).join(', '));
      }
    } catch (err) {
      console.warn('[字体加载] 失败', err);
    }

    _cachedFontCtxMap = result;
    return result;
  })();

  const map = await _fontMapLoadingPromise;
  _fontMapLoadingPromise = null;
  return map;
}

// ─── 兼容旧 API ───

let _cachedFontCtx: NonNullFontContext | null = null;
let _fontLoadingPromise: Promise<NonNullFontContext | null> | null = null;

/** @deprecated 请改用 loadFontContextMap()，支持多字重 */
export async function loadFontContext(): Promise<NonNullFontContext | null> {
  if (_cachedFontCtx) return _cachedFontCtx;
  if (_fontLoadingPromise) return _fontLoadingPromise;

  _fontLoadingPromise = (async () => {
    try {
      const map = await loadFontContextMap();
      const ctx = map[400] || null;
      _cachedFontCtx = ctx;
      return ctx;
    } catch (err) {
      console.warn('[字体加载] 失败，文本将需要双击显示', err);
      return null;
    } finally {
      _fontLoadingPromise = null;
    }
  })();

  return _fontLoadingPromise;
}
