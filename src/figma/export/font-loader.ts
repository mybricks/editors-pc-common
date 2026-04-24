// eslint-disable-next-line @typescript-eslint/no-var-requires
const opentype = require('./ir-to-figma/vendors/opentype');

import type { FontContext, FontContextMap, FontContextByWeight } from '../types';

type NonNullFontContext = NonNullable<FontContext>;

// ─── 已知品牌/内部字体：CSS PostScript 名 → 本机字体族/样式 映射规则 ───
// 与 ir-to-figma.js 中的 KNOWN_FONT_RULES 保持同步
// altFamilies：同一套字体在不同 OS/安装包里可能注册为不同 family 名（如中文名），查本机字体时逐一尝试
// fontUrls：本机查不到时直接 fetch 的 CDN 备用 URL 表，key 为 CSS PostScript 名
const KNOWN_CSS_FONT_RULES: Array<{
  pattern: RegExp;
  family: string;
  altFamilies?: string[];
  style: (m: RegExpMatchArray) => string;
  fontUrls?: Record<string, string>;
}> = [
  {
    // 阿里巴巴普惠体 2.0 / 3.0
    // CSS PostScript: AlibabaPuHuiTi-65-Medium / AlibabaPuHuiTi2.0-115-Black
    // Figma family:   "Alibaba PuHuiTi 3.0"
    // 本机可能注册为: "Alibaba PuHuiTi 3.0"（英文安装包）或 "阿里巴巴普惠体 3.0"（中文安装包）
    pattern: /^AlibabaPuHuiTi(?:2\.0)?-(\d+)-(.+)$/i,
    family: 'Alibaba PuHuiTi 3.0',
    altFamilies: ['阿里巴巴普惠体 3.0', '阿里巴巴普惠体 2.0'],
    style: (m) => `${m[1]} ${m[2]}`,
    fontUrls: {
      'AlibabaPuHuiTi-35-Thin':     'https://p2-ec.eckwai.com/kos/nlav12333/fangzhou/pub/custom-fonts/AlibabaPuHuiTi-3-35-Thin_1772618685822.ttf',
      'AlibabaPuHuiTi-45-Light':    'https://p2-ec.eckwai.com/kos/nlav12333/fangzhou/pub/custom-fonts/AlibabaPuHuiTi-3-45-Light_1772618711431.ttf',
      'AlibabaPuHuiTi-55-Regular':  'https://p2-ec.eckwai.com/kos/nlav12333/fangzhou/pub/custom-fonts/AlibabaPuHuiTi-3-55-Regular_1772618723981.ttf',
      'AlibabaPuHuiTi-65-Medium':   'https://p2-ec.eckwai.com/kos/nlav12333/fangzhou/pub/custom-fonts/AlibabaPuHuiTi-3-65-Medium_1772618738141.ttf',
      'AlibabaPuHuiTi-75-SemiBold': 'https://p2-ec.eckwai.com/kos/nlav12333/fangzhou/pub/custom-fonts/AlibabaPuHuiTi-3-75-SemiBold_1772618748292.ttf',
      'AlibabaPuHuiTi-85-Bold':     'https://p2-ec.eckwai.com/kos/nlav12333/fangzhou/pub/custom-fonts/AlibabaPuHuiTi-3-85-Bold_1772618758406.ttf',
      'AlibabaPuHuiTi-95-ExtraBold':'https://p2-ec.eckwai.com/kos/nlav12333/fangzhou/pub/custom-fonts/AlibabaPuHuiTi-3-95-ExtraBold_1772618771975.ttf',
      'AlibabaPuHuiTi-105-Heavy':   'https://p2-ec.eckwai.com/kos/nlav12333/fangzhou/pub/custom-fonts/AlibabaPuHuiTi-3-105-Heavy_1772618784747.ttf',
      'AlibabaPuHuiTi-115-Black':   'https://p2-ec.eckwai.com/kos/nlav12333/fangzhou/pub/custom-fonts/AlibabaPuHuiTi-3-115-Black_1772618801664.ttf',
    },
  },
];

function resolveKnownCssFont(cssName: string): {
  family: string;
  altFamilies: string[];
  style: string;
  fontUrl: string | null;
} | null {
  for (const rule of KNOWN_CSS_FONT_RULES) {
    const m = cssName.match(rule.pattern);
    if (m) return {
      family: rule.family,
      altFamilies: rule.altFamilies ?? [],
      style: rule.style(m),
      fontUrl: rule.fontUrls?.[cssName] ?? null,
    };
  }
  return null;
}

// PingFang SC 在 macOS 上的全部 6 个字重变体
const PINGFANG_VARIANTS: Array<{ weight: number; postscript: string; style: string }> = [
  { weight: 100, postscript: 'PingFangSC-Ultralight', style: 'Ultralight' },
  { weight: 200, postscript: 'PingFangSC-Thin',       style: 'Thin'       },
  { weight: 300, postscript: 'PingFangSC-Light',      style: 'Light'      },
  { weight: 400, postscript: 'PingFangSC-Regular',    style: 'Regular'    },
  { weight: 500, postscript: 'PingFangSC-Medium',     style: 'Medium'     },
  { weight: 600, postscript: 'PingFangSC-Semibold',   style: 'Semibold'   },
];

/** 将 style 名转换为 CSS font-weight 数值（用于建立通用字体的 weight 索引） */
function styleNameToWeight(style: string): number {
  const s = style.toLowerCase();
  if (/extra[\s-]?light|ultra[\s-]?light/.test(s)) return 200;
  if (/thin|hairline/.test(s)) return 100;
  if (/light/.test(s)) return 300;
  if (/semi[\s-]?bold|demi/.test(s)) return 600;
  if (/extra[\s-]?bold|ultra[\s-]?bold/.test(s)) return 800;
  if (/black|heavy/.test(s)) return 900;
  if (/bold/.test(s)) return 700;
  if (/medium/.test(s)) return 500;
  return 400; // Regular / Normal / fallback
}

async function loadSingleVariant(
  localFonts: any[],
  postscript: string,
  style: string,
  family?: string,
  figmaFamily?: string,
  figmaStyle?: string,
): Promise<NonNullFontContext | null> {
  try {
    const match = localFonts.find(
      (f: any) =>
        f.postscriptName === postscript ||
        (family && f.family === family && f.style === style),
    );
    if (!match) return null;
    const blob = await match.blob();
    const fontBuffer = await blob.arrayBuffer();
    const font = opentype.parse(fontBuffer);
    const fontDigest = new Uint8Array(await crypto.subtle.digest('SHA-1', fontBuffer));
    const ctx: NonNullFontContext = {
      font,
      fontDigest,
      style,
      postscript: match.postscriptName || postscript,
    };
    // 当 CSS font-family 是 PostScript 名时，记录实际 Figma 字体族/样式名，供 ir-to-figma 使用
    if (figmaFamily) ctx.figmaFamily = figmaFamily;
    if (figmaStyle)  ctx.figmaStyle  = figmaStyle;
    return ctx;
  } catch (_) {
    return null;
  }
}

// ─── 全局缓存（按 family 名分 key） ───

let _cachedFontCtxMap: FontContextMap | null = null;
let _fontMapLoadingPromise: Promise<FontContextMap> | null = null;

/**
 * 收集页面（含 MyBricks Shadow DOM）所有 @font-face 规则，返回指定 CSS font-family 名的字体文件 URL。
 * 字体只在 Figma 预装而未安装到本地 OS 时，用此路径获取字体二进制做字形测量。
 */
function findFontUrlFromFontFace(cssName: string): string | null {
  const sheets: CSSStyleSheet[] = [];

  // 1. 文档顶层 stylesheets
  try {
    for (let i = 0; i < document.styleSheets.length; i++) {
      sheets.push(document.styleSheets[i]);
    }
  } catch (_) {}

  // 2. MyBricks Shadow DOM 内的 stylesheets
  try {
    const shadowHost = document.getElementById('_mybricks-geo-webview_');
    const shadowRoot = shadowHost?.shadowRoot as any;
    if (shadowRoot) {
      // adoptedStyleSheets（Chrome 73+）
      const adopted: CSSStyleSheet[] = shadowRoot.adoptedStyleSheets || [];
      sheets.push(...adopted);
      // <style> 元素内嵌的 sheet
      shadowRoot.querySelectorAll('style').forEach((el: HTMLStyleElement) => {
        if (el.sheet) sheets.push(el.sheet);
      });
    }
  } catch (_) {}

  for (const sheet of sheets) {
    try {
      for (const rule of Array.from(sheet.cssRules)) {
        if (rule instanceof CSSFontFaceRule) {
          const family = rule.style.getPropertyValue('font-family').replace(/['"]/g, '').trim();
          if (family === cssName) {
            const src = rule.style.getPropertyValue('src');
            const m = src.match(/url\(['"]?([^'")\s]+)['"]?\)/);
            if (m) return m[1];
          }
        }
      }
    } catch (_) {}
  }
  return null;
}

/**
 * 加载指定字体族列表的各字重字体，返回 { [family]: { [weight]: FontContext } } 映射。
 * - PingFang SC 走精确 6 字重匹配
 * - 其他字体用 queryLocalFonts 枚举所有 style 变体并按名称推算 weight
 * 结果按 family 合并到全局缓存（同一字体不重复加载）。
 */
export async function loadFontContextMapForFamilies(
  families: string[],
  /** 外部传入的字体 URL 表，key 为 CSS font-family 名（如 "AlibabaPuHuiTi-65-Medium"），value 为字体文件 URL */
  externalFontUrlMap: Record<string, string> = {},
): Promise<FontContextMap> {
  // 已全部缓存则直接返回（需覆盖所有请求的字体）
  if (_cachedFontCtxMap) {
    const allCached = families.every(f => f in _cachedFontCtxMap!);
    if (allCached) return _cachedFontCtxMap;
  }

  if (!('queryLocalFonts' in window)) {
    _cachedFontCtxMap = _cachedFontCtxMap || {};
    return _cachedFontCtxMap;
  }

  let localFonts: any[] = [];
  try {
    const _raw = await (window as any).queryLocalFonts();
    // 用 for 循环收集，兼容浏览器返回稀疏/特殊 ArrayLike 的情况
    for (let _i = 0; _i < _raw.length; _i++) {
      const _f = _raw[_i];
      if (_f) {
        localFonts.push(_f);
      }
    }
  } catch (err) {
    _cachedFontCtxMap = _cachedFontCtxMap || {};
    return _cachedFontCtxMap;
  }

  const result: FontContextMap = { ...(_cachedFontCtxMap || {}) };

  await Promise.all(
    families.map(async (family) => {
      if (result[family]) return; // 已缓存

      if (family === 'PingFang SC') {
        // PingFang SC 精确 6 字重加载
        const settled = await Promise.all(
          PINGFANG_VARIANTS.map(({ weight, postscript, style }) =>
            loadSingleVariant(localFonts, postscript, style, 'PingFang SC').then(ctx => ({ weight, ctx })),
          ),
        );
        const subMap: FontContextByWeight = {};
        for (const { weight, ctx } of settled) {
          if (ctx) subMap[weight] = ctx;
        }
        if (Object.keys(subMap).length > 0) {
          result[family] = subMap;
        }
      } else {
        // ── Path A：已知品牌字体 ──
        // 按以下优先级查 localFonts：
        // 1) CSS 名直接当 family / postscriptName 查
        // 2) 规则映射的英文 family 名（如 "Alibaba PuHuiTi 3.0"）+ style
        // 3) 规则映射的备用 family 名（如 "阿里巴巴普惠体 3.0"，中文安装包）+ style
        const knownMapping = resolveKnownCssFont(family);
        if (knownMapping) {
          const { family: realFamily, altFamilies, style: realStyle } = knownMapping;

          // 1) CSS 名直接命中
          let match: any = localFonts.find(
            (f: any) => f.family === family || f.postscriptName === family,
          );

          // 2) 英文 family 名 + style
          if (!match) {
            match = localFonts.find(
              (f: any) => f.family === realFamily && f.style === realStyle,
            );
          }

          // 3) 备用 family 名（中文名等）+ style
          if (!match) {
            for (const alt of altFamilies) {
              match = localFonts.find(
                (f: any) => f.family === alt && f.style === realStyle,
              );
              if (match) break;
            }
          }

          // 4) 全量查询未命中时，用 PostScript 名精确过滤再查一次
          //    （Chrome 在某些 macOS 版本中全量查询会漏字体，精确查询有时能找到）
          if (!match) {
            try {
              const _specific = await (window as any).queryLocalFonts({ postscriptNames: [family] });
              if (_specific && _specific.length > 0) {
                match = _specific[0];
              }
            } catch (_) {}
          }

          if (match) {
            const ctx = await loadSingleVariant(
              localFonts,
              match.postscriptName,
              match.style,
              match.family,
              realFamily,
              realStyle,
            );
            if (ctx) {
              const weight = styleNameToWeight(realStyle);
              result[family] = { [weight]: ctx };
            }
          } else {
            // 本机未找到，按优先级尝试远程加载：① 外部配置 URL → ② 规则内置 CDN URL → ③ @font-face 声明 URL
            const remoteUrl = externalFontUrlMap[family] ?? knownMapping.fontUrl ?? findFontUrlFromFontFace(family);
            if (remoteUrl) {
              try {
                const resp = await fetch(remoteUrl);
                const fontBuffer = await resp.arrayBuffer();
                const font = opentype.parse(fontBuffer);
                const fontDigest = new Uint8Array(await crypto.subtle.digest('SHA-1', fontBuffer));
                result[family] = {
                  [styleNameToWeight(realStyle)]: {
                    font, fontDigest,
                    style: realStyle,
                    postscript: family,
                    figmaFamily: realFamily,
                    figmaStyle: realStyle,
                  },
                };
              } catch (err) {
              }
            }
          }
          return;
        }

        // ── Path B：通用字体 —— 先按 family 名枚举，找不到则尝试 PostScript 名兜底 ──
        let variants = localFonts.filter((f: any) => f.family === family);
        let isPostscriptLookup = false;

        if (variants.length === 0) {
          // 尝试把 family 当 PostScript 名来匹配单个字体变体
          const byPostscript = localFonts.find((f: any) => f.postscriptName === family);
          if (byPostscript) {
            variants = [byPostscript];
            isPostscriptLookup = true;
          }
        }

        if (variants.length === 0) {
          // @font-face 兜底
          const fontUrl = findFontUrlFromFontFace(family);
          if (fontUrl) {
            try {
              const resp = await fetch(fontUrl);
              const fontBuffer = await resp.arrayBuffer();
              const font = opentype.parse(fontBuffer);
              const fontDigest = new Uint8Array(await crypto.subtle.digest('SHA-1', fontBuffer));
              const _rawStyle = font.names?.fontSubfamily?.en || 'Regular';
              const _ps = font.names?.postScriptName?.en || family;
              result[family] = { 400: { font, fontDigest, style: _rawStyle, postscript: _ps } };
            } catch (err) {
            }
          }
          return;
        }

        const settled = await Promise.all(
          variants.map(async (f: any) => {
            const weight = styleNameToWeight(f.style || '');
            const ctx = await loadSingleVariant(
              localFonts,
              f.postscriptName,
              f.style,
              f.family,
              isPostscriptLookup ? f.family : undefined,
              isPostscriptLookup ? f.style  : undefined,
            );
            return { weight, ctx };
          }),
        );
        const subMap: FontContextByWeight = {};
        for (const { weight, ctx } of settled) {
          if (ctx && !subMap[weight]) subMap[weight] = ctx;
        }
        if (Object.keys(subMap).length > 0) {
          result[family] = subMap;
        }
      }
    }),
  );

  _cachedFontCtxMap = result;
  return result;
}

// ─── 兼容旧 API ───

let _legacyLoadingPromise: Promise<FontContextMap> | null = null;

/**
 * 加载 PingFang SC 各字重字体，返回新格式 FontContextMap（{ 'PingFang SC': { weight: ctx } }）。
 * 向后兼容：旧调用者直接传给 convertIRToFigmaClipboardHtml 仍可用。
 */
export async function loadFontContextMap(): Promise<FontContextMap> {
  if (_cachedFontCtxMap?.['PingFang SC']) return _cachedFontCtxMap;
  if (_legacyLoadingPromise) return _legacyLoadingPromise;

  _legacyLoadingPromise = loadFontContextMapForFamilies(['PingFang SC']).finally(() => {
    _legacyLoadingPromise = null;
  });

  return _legacyLoadingPromise;
}

/**
 * @deprecated 请改用 loadFontContextMap() 或 loadFontContextMapForFamilies()
 */
export async function loadFontContext(): Promise<NonNullFontContext | null> {
  try {
    const map = await loadFontContextMap();
    return map['PingFang SC']?.[400] || null;
  } catch (err) {
    return null;
  }
}

/**
 * 从 IR payload 中收集所有用到的字体族名（去重）。
 * 供 useExportToFigma.ts 在 DOM→IR 后调用，以便按需加载对应字体。
 */
export function collectFontFamiliesFromIR(irPayload: any): string[] {
  const families = new Set<string>();
  function walk(node: any) {
    if (!node) return;
    const fontFamily = node?.style?.fontFamily;
    if (fontFamily && typeof fontFamily === 'string') families.add(fontFamily);
    if (Array.isArray(node.children)) node.children.forEach(walk);
  }
  const content = irPayload?.page?.content;
  if (Array.isArray(content)) content.forEach(walk);
  // 始终包含 PingFang SC（系统字体 fallback 及字形测量兜底）
  families.add('PingFang SC');
  return Array.from(families);
}
