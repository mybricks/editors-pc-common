// eslint-disable-next-line @typescript-eslint/no-var-requires
const opentype = require('./ir-to-figma/vendors/opentype');

import type { FontContext } from '../types';

type NonNullFontContext = NonNullable<FontContext>;

let _cachedFontCtx: NonNullFontContext | null = null;
let _fontLoadingPromise: Promise<NonNullFontContext | null> | null = null;

export async function loadFontContext(): Promise<NonNullFontContext | null> {
  if (_cachedFontCtx) return _cachedFontCtx;
  if (_fontLoadingPromise) return _fontLoadingPromise;

  _fontLoadingPromise = (async () => {
    try {
      let fontBuffer: ArrayBuffer | null = null;

      if ('queryLocalFonts' in window) {
        try {
          const fonts: any[] = await (window as any).queryLocalFonts();
          const pingfang = fonts.find(
            (f: any) =>
              f.postscriptName === 'PingFangSC-Regular' ||
              (f.family === 'PingFang SC' && f.style === 'Regular')
          );
          if (pingfang) {
            const blob = await pingfang.blob();
            fontBuffer = await blob.arrayBuffer();
          }
        } catch (_) {
          /* permission denied or API unavailable */
        }
      }

      if (!fontBuffer) {
        const fontUrl = (window as any).__PINGFANG_FONT_URL__;
        if (fontUrl) {
          try {
            const resp = await fetch(fontUrl);
            if (resp.ok) fontBuffer = await resp.arrayBuffer();
          } catch (_) {}
        }
      }

      if (!fontBuffer) {
        console.warn('[字体加载] 未找到 PingFang SC，文本粘贴后需双击显示');
        return null;
      }

      const font = opentype.parse(fontBuffer);
      const digest = new Uint8Array(await crypto.subtle.digest('SHA-1', fontBuffer));

      _cachedFontCtx = { font, fontDigest: digest };
      return _cachedFontCtx;
    } catch (err) {
      console.warn('[字体加载] 失败，文本将需要双击显示', err);
      return null;
    } finally {
      _fontLoadingPromise = null;
    }
  })();

  return _fontLoadingPromise;
}
