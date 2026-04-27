/**
 * ir-to-figma-clipboard.js
 *
 * 将 dom-to-figma 产出的 IR JSON 直接转为 Figma 剪切板 HTML（fig-kiwi binary），
 * 粘贴到 Figma 后无需插件即可生成设计稿。
 *
 * 依赖：pako（deflateRaw）、kiwi-schema（compileSchema）
 * 数据：figma-schema-data.js（预生成的 schema 常量）
 */

var _pako = require('../../shared/vendors/pako');
var _kiwiSchema = require('../../shared/vendors/kiwi-schema');
var _schemaData = require('./schema-data');
var _svgPathDataLib = require('./vendors/svg-pathdata');

// 组件库映射模板（可选），缺失时降级为普通 frame 绘制
var _componentTemplate = null;
try { _componentTemplate = require('./figma-component-template'); } catch (e) {}

var _compiledSchema = null;
var _schemaChunkBytes = null;

function _getCompiled() {
  if (_compiledSchema) return _compiledSchema;
  var sd = _schemaData || (typeof window !== 'undefined' && window.__FIGMA_SCHEMA_DATA__);
  var ks = _kiwiSchema || (typeof window !== 'undefined' && window.kiwiSchema);
  if (!sd || !ks) throw new Error('Missing kiwi-schema or figma-schema-data');
  _compiledSchema = ks.compileSchema(sd.COMPILABLE_SCHEMA);
  return _compiledSchema;
}

function _getSchemaChunk() {
  if (_schemaChunkBytes) return _schemaChunkBytes;
  var sd = _schemaData || (typeof window !== 'undefined' && window.__FIGMA_SCHEMA_DATA__);
  if (!sd) throw new Error('Missing figma-schema-data');
  if (typeof atob === 'function') {
    var bin = atob(sd.SCHEMA_CHUNK_BASE64);
    _schemaChunkBytes = new Uint8Array(bin.length);
    for (var i = 0; i < bin.length; i++) _schemaChunkBytes[i] = bin.charCodeAt(i);
  } else {
    _schemaChunkBytes = new Uint8Array(Buffer.from(sd.SCHEMA_CHUNK_BASE64, 'base64'));
  }
  return _schemaChunkBytes;
}

function _getPako() {
  return _pako || (typeof window !== 'undefined' && window.pako);
}

// ─── Color helpers ───

function parseRgbaString(s) {
  if (!s || typeof s !== 'string') return null;
  s = s.trim();
  var m = s.match(/^rgba?\(\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)\s*(?:,\s*([\d.]+))?\s*\)$/);
  if (m) {
    return {
      r: parseFloat(m[1]) / 255,
      g: parseFloat(m[2]) / 255,
      b: parseFloat(m[3]) / 255,
      a: m[4] != null ? parseFloat(m[4]) : 1,
    };
  }
  var hex = s.match(/^#([0-9A-Fa-f]{3,8})$/);
  if (hex) {
    var h = hex[1];
    var r, g, b, a = 1;
    if (h.length === 3) {
      r = parseInt(h[0] + h[0], 16) / 255;
      g = parseInt(h[1] + h[1], 16) / 255;
      b = parseInt(h[2] + h[2], 16) / 255;
    } else if (h.length === 6) {
      r = parseInt(h.slice(0, 2), 16) / 255;
      g = parseInt(h.slice(2, 4), 16) / 255;
      b = parseInt(h.slice(4, 6), 16) / 255;
    } else if (h.length === 8) {
      r = parseInt(h.slice(0, 2), 16) / 255;
      g = parseInt(h.slice(2, 4), 16) / 255;
      b = parseInt(h.slice(4, 6), 16) / 255;
      a = parseInt(h.slice(6, 8), 16) / 255;
    } else {
      return null;
    }
    return { r: r, g: g, b: b, a: a };
  }
  return null;
}

function irColorToFigma(c) {
  if (!c) return null;
  if (typeof c === 'string') return parseRgbaString(c);
  if (typeof c === 'object' && c.r != null) {
    if (c.r > 1 || c.g > 1 || c.b > 1) {
      return { r: c.r / 255, g: c.g / 255, b: c.b / 255, a: c.a != null ? c.a : 1 };
    }
    return { r: c.r, g: c.g, b: c.b, a: c.a != null ? c.a : 1 };
  }
  return null;
}

function makeSolidPaint(color, opacity) {
  if (!color) return null;
  var c = irColorToFigma(color);
  if (!c) return null;
  var paintOpacity = (opacity != null) ? opacity : c.a;
  return {
    type: 'SOLID',
    color: { r: c.r, g: c.g, b: c.b, a: 1 },
    opacity: paintOpacity,
    visible: true,
    blendMode: 'NORMAL',
  };
}

// ─── Font helpers ───

// PingFang SC 在 macOS 上的全部 6 个字重，且无任何 Italic 变体。
// 700+ 一律降级到 Semibold，italic 一律忽略，避免 Figma 弹出 "Missing font" 弹窗。
// Ultralight(100) 比 Thin(200) 更细，与 CSS font-weight 数值从小到大对应。
var PINGFANG_WEIGHT_MAP = {
  100: 'Ultralight',
  200: 'Thin',
  300: 'Light',
  400: 'Regular',
  500: 'Medium',
  600: 'Semibold',
};

// 通用字体字重映射（适用于非 PingFang SC 字体）
var GENERIC_WEIGHT_MAP = {
  100: 'Thin',       200: 'Extra Light', 300: 'Light',
  400: 'Regular',    500: 'Medium',      600: 'Semibold',
  700: 'Bold',       800: 'Extra Bold',  900: 'Black',
};
var GENERIC_WEIGHT_KEYS = [100, 200, 300, 400, 500, 600, 700, 800, 900];

// ─── 已知品牌/内部字体映射规则 ───
// CSS font-family 有时直接使用 PostScript 名（如 "AlibabaPuHuiTi-115-Black"），
// 无法通过字符串本身推导出 Figma 的 family/style，需要在此维护静态规则。
// 规则格式：{ pattern: RegExp, family: string, style: fn(match) => string }
//   - pattern 匹配 CSS font-family 字符串（通常是 PostScript 名）
//   - family  对应 Figma 中的字体族名
//   - style   根据正则捕获组生成 Figma style 名的函数
// 新增字体族只需在此追加一条规则即可。
var KNOWN_FONT_RULES = [
  {
    // 阿里巴巴普惠体 2.0 / 3.0
    // PostScript: AlibabaPuHuiTi-115-Black / AlibabaPuHuiTi2.0-115-Black
    // Figma:      "Alibaba PuHuiTi 3.0" / "115 Black"
    pattern: /^AlibabaPuHuiTi(?:2\.0)?-(\d+)-(.+)$/i,
    family: 'Alibaba PuHuiTi 3.0',
    style: function(m) { return m[1] + ' ' + m[2]; },
  },
  // 示例：后续内部字体在此追加
  // {
  //   pattern: /^DingTalkJinBuTi(.*)$/i,
  //   family: 'DingTalk JinBuTi',
  //   style: function() { return 'Regular'; },
  // },
];

/** 尝试用已知规则匹配 PostScript 名，命中则返回 { family, style, postscript }，否则返回 null */
function resolveKnownFont(postscriptName) {
  if (!postscriptName) return null;
  for (var _ki = 0; _ki < KNOWN_FONT_RULES.length; _ki++) {
    var _rule = KNOWN_FONT_RULES[_ki];
    var _m = postscriptName.match(_rule.pattern);
    if (_m) {
      return { family: _rule.family, style: _rule.style(_m), postscript: postscriptName };
    }
  }
  return null;
}

function resolveFontName(family, weight, italic) {
  var w = weight || 400;
  var resolvedFamily = family || 'PingFang SC';

  if (!resolvedFamily || resolvedFamily === 'PingFang SC') {
    // PingFang SC 特殊处理：精确字重映射，忽略 italic（PingFang SC 无 Italic 变体）
    if (w > 600) w = 600;
    var styleName = PINGFANG_WEIGHT_MAP[w] || 'Regular';
    return { family: 'PingFang SC', style: styleName, postscript: 'PingFangSC-' + styleName.replace(/\s+/g, '') };
  }

  // 优先查已知品牌字体规则表（不依赖 queryLocalFonts，字体装在 Figma 即可）
  var _known = resolveKnownFont(resolvedFamily);
  if (_known) return _known;

  // 其他字体：用通用字重映射，找最近档位
  var _closest = GENERIC_WEIGHT_KEYS.reduce(function(a, b) {
    return Math.abs(b - w) < Math.abs(a - w) ? b : a;
  });
  var _styleName = GENERIC_WEIGHT_MAP[_closest] || 'Regular';
  if (italic) _styleName = (_styleName === 'Regular') ? 'Italic' : (_styleName + ' Italic');
  var _postscript = resolvedFamily.replace(/\s+/g, '') +
    (_styleName === 'Regular' ? '' : ('-' + _styleName.replace(/\s+/g, '')));
  return { family: resolvedFamily, style: _styleName, postscript: _postscript };
}

// ─── GUID allocator ───

var _nextLocalId = 2;
function resetGuidCounter() { _nextLocalId = 2; }
function nextGuid() { return { sessionID: 1, localID: _nextLocalId++ }; }

// ─── Position string for sibling ordering ───

function positionForIndex(idx) {
  return String.fromCharCode(33 + idx); // '!', '"', '#', '$', ...
}

function sortChildrenByZIndex(children, parentLayoutMode) {
  if (!children || children.length <= 1) return children || [];
  // Auto Layout 容器中，子节点顺序决定主轴排布顺序（上下/左右）。
  // 若按 z-index 全量重排，会把“视觉层级”误当作“布局顺序”，导致节点上下颠倒。
  // 这里优先保留 DOM 原顺序，避免 tab/input 等场景位置反转。
  if (parentLayoutMode) return children;
  var withIndex = [];
  var hasExplicitZIndex = false;
  for (var i = 0; i < children.length; i++) {
    var child = children[i];
    var style = child && child.style ? child.style : {};
    var z = (style && typeof style.zIndex === 'number' && isFinite(style.zIndex)) ? style.zIndex : null;
    if (z !== null) hasExplicitZIndex = true;
    withIndex.push({ child: child, index: i, zIndex: z });
  }
  if (!hasExplicitZIndex) return children;
  withIndex.sort(function(a, b) {
    var az = a.zIndex;
    var bz = b.zIndex;
    // 未声明 z-index 视为 0；同级时保持 DOM 原顺序（稳定排序）
    if (az == null) az = 0;
    if (bz == null) bz = 0;
    if (az !== bz) return az - bz;
    return a.index - b.index;
  });
  var result = [];
  for (var j = 0; j < withIndex.length; j++) result.push(withIndex[j].child);
  return result;
}

// ─── Transform helper ───

function makeTransform(x, y, rotationDeg) {
  if (!rotationDeg) {
    return { m00: 1, m01: 0, m02: x || 0, m10: 0, m11: 1, m12: y || 0 };
  }
  var rad = (rotationDeg * Math.PI) / 180;
  var cos = Math.cos(rad);
  var sin = Math.sin(rad);
  return { m00: cos, m01: sin, m02: x || 0, m10: -sin, m11: cos, m12: y || 0 };
}

// ─── Sync tag helpers (DOM class selector ↔ Figma node name) ───

function _isSimpleClassSelector(sel) {
  return !!(sel && /^\.[A-Za-z0-9_-]+$/.test(sel));
}

function _normalizeSelectorCandidate(sel) {
  if (!sel || typeof sel !== 'string') return null;
  var s = sel.trim();
  if (!s) return null;
  if (_isSimpleClassSelector(s)) return s;
  // 兼容 ",", ":hover", " .a .b " 等复杂选择器：只收敛到单 class 才用于同步 tag
  var first = s.split(',')[0].trim();
  if (_isSimpleClassSelector(first)) return first;
  return null;
}

function _pickSyncSelectorFromIr(irNode) {
  if (!irNode) return null;
  if (typeof irNode.figmaSyncSelector === 'string') {
    var _fs = irNode.figmaSyncSelector.trim();
    if (_isSimpleClassSelector(_fs)) return _fs;
  }
  var cands = [];
  if (Array.isArray(irNode.selectors)) {
    for (var i = 0; i < irNode.selectors.length; i++) cands.push(irNode.selectors[i]);
  }
  if (typeof irNode.className === 'string' && irNode.className.trim()) {
    var parts = irNode.className.trim().split(/\s+/);
    for (var j = 0; j < parts.length; j++) cands.push('.' + parts[j]);
  }
  var best = null;
  var bestScore = -1;
  for (var k = 0; k < cands.length; k++) {
    var normalized = _normalizeSelectorCandidate(cands[k]);
    if (!normalized) continue;
    var score = 0;
    if (normalized.indexOf('_less-') !== -1) score += 4; // 多文件选择器优先
    if (normalized.indexOf('pages_') !== -1) score += 2; // css module 常见前缀
    if (normalized.length <= 120) score += 1;
    if (score > bestScore) {
      best = normalized;
      bestScore = score;
    }
  }
  return best;
}

function withSyncTag(baseName, irNode, fallbackName) {
  var rawBase = (baseName == null ? '' : String(baseName)).trim();
  var name = rawBase || fallbackName || 'Node';
  if (/\[mb:[^\]]+\]/.test(name)) return name;
  var selector = _pickSyncSelectorFromIr(irNode);
  if (!selector) return name;
  return name + ' [mb:' + selector + ']';
}

// ─── IR fills → Figma fillPaints ───

function normalizeImageScaleMode(mode) {
  var m = (mode || '').toString().toUpperCase();
  if (m === 'FIT' || m === 'FILL' || m === 'TILE' || m === 'STRETCH') return m;
  return 'FILL';
}

function base64ToUint8Array(base64) {
  if (!base64) return null;
  try {
    if (typeof Buffer !== 'undefined') {
      return new Uint8Array(Buffer.from(base64, 'base64'));
    }
    if (typeof atob === 'function') {
      var bin = atob(base64);
      var out = new Uint8Array(bin.length);
      for (var i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
      return out;
    }
  } catch (_e) {
    console.warn('[DBG base64] 解码抛出异常', { inputLen: base64 ? base64.length : 0, error: _e && _e.message });
  }
  return null;
}

function textToUint8Array(text) {
  if (text == null) return new Uint8Array(0);
  if (typeof TextEncoder !== 'undefined') return new TextEncoder().encode(String(text));
  if (typeof Buffer !== 'undefined') return new Uint8Array(Buffer.from(String(text), 'utf8'));
  var s = unescape(encodeURIComponent(String(text)));
  var out = new Uint8Array(s.length);
  for (var i = 0; i < s.length; i++) out[i] = s.charCodeAt(i);
  return out;
}

function parseDataUrlToBytes(dataUrl) {
  if (!dataUrl || typeof dataUrl !== 'string') return null;
  var s = dataUrl.trim();
  if (s.indexOf('data:') !== 0) return null;
  var comma = s.indexOf(',');
  if (comma < 0) return null;
  var header = s.slice(5, comma);
  var body = s.slice(comma + 1);
  var isBase64 = /;base64/i.test(header);
  var mime = (header.split(';')[0] || 'application/octet-stream').toLowerCase();
  if (isBase64) {
    var bytes = base64ToUint8Array(body);
    if (!bytes) {
      console.warn('[DBG parseDataUrl] base64ToUint8Array 返回 null，解码失败');
    }
    return bytes ? { bytes: bytes, mime: mime } : null;
  }
  try {
    return { bytes: textToUint8Array(decodeURIComponent(body)), mime: mime };
  } catch (_e) {
    return null;
  }
}

function uint8ToHex(u8) {
  var hex = '';
  for (var i = 0; i < u8.length; i++) {
    var h = u8[i].toString(16);
    hex += h.length === 1 ? '0' + h : h;
  }
  return hex;
}

function imageHashHexToBytes(hashHex) {
  if (!hashHex || typeof hashHex !== 'string') return null;
  var clean = hashHex.toLowerCase();
  if (clean.length % 2 !== 0) return null;
  var out = new Uint8Array(clean.length / 2);
  for (var i = 0; i < out.length; i++) {
    var byteHex = clean.slice(i * 2, i * 2 + 2);
    var val = parseInt(byteHex, 16);
    if (!isFinite(val)) return null;
    out[i] = val;
  }
  return out;
}

function computeImageHashHex(bytes) {
  // 对齐 figma-api.ts 的 computeImageHash，确保剪贴板图片 hash 可被识别。
  var h1 = 0x811c9dc5 >>> 0;
  var h2 = 0x811c9dc5 >>> 0;
  var h3 = 0x811c9dc5 >>> 0;
  var h4 = 0x811c9dc5 >>> 0;
  var h5 = 0x811c9dc5 >>> 0;
  for (var i = 0; i < bytes.length; i++) {
    var b = bytes[i] >>> 0;
    switch (i % 5) {
      case 0:
        h1 ^= b; h1 = Math.imul(h1, 0x01000193) >>> 0; break;
      case 1:
        h2 ^= b; h2 = Math.imul(h2, 0x01000193) >>> 0; break;
      case 2:
        h3 ^= b; h3 = Math.imul(h3, 0x01000193) >>> 0; break;
      case 3:
        h4 ^= b; h4 = Math.imul(h4, 0x01000193) >>> 0; break;
      case 4:
        h5 ^= b; h5 = Math.imul(h5, 0x01000193) >>> 0; break;
    }
  }
  var hs = [h1, h2, h3, h4, h5];
  var hex = '';
  for (var j = 0; j < hs.length; j++) {
    var part = (hs[j] >>> 0).toString(16);
    while (part.length < 8) part = '0' + part;
    hex += part;
  }
  return hex;
}

function extFromMime(mime) {
  if (!mime) return 'bin';
  if (mime.indexOf('png') >= 0) return 'png';
  if (mime.indexOf('jpeg') >= 0 || mime.indexOf('jpg') >= 0) return 'jpg';
  if (mime.indexOf('webp') >= 0) return 'webp';
  if (mime.indexOf('gif') >= 0) return 'gif';
  if (mime.indexOf('svg') >= 0) return 'svg';
  return 'bin';
}

/**
 * 注册一张图片（base64 data URL）到 blobs 数组，返回图片注册 entry。
 * @param {string} dataUrl - base64 data URL
 * @param {Array} blobs - Message.blobs 数组（共享引用）
 * @param {object} imageCtx - 图片注册上下文，含 byHash 缓存
 * @param {string} [optionalHashHex] - 可选的预计算 SHA-1 hash（40位hex），若提供则优先使用，覆盖 FNV
 */
function registerImageFromDataUrl(dataUrl, blobs, imageCtx, optionalHashHex) {
  var parsed = parseDataUrlToBytes(dataUrl);
  if (!parsed || !parsed.bytes || !parsed.bytes.length) {
    console.warn('[DBG ir-to-figma] registerImageFromDataUrl: parseDataUrlToBytes 失败，data URL 解码为 null', {
      dataUrlPrefix: dataUrl ? dataUrl.slice(0, 60) : 'null/undefined',
      dataUrlLen: dataUrl ? dataUrl.length : 0,
    });
    return null;
  }
  // 优先使用外部预计算的 SHA-1 hash（由 image-inline.js 在 async 阶段计算），
  // 回退到 5×FNV（figma-api.ts computeImageHash 参考实现）。
  var hashHex = (optionalHashHex && optionalHashHex.length === 40) ? optionalHashHex : computeImageHashHex(parsed.bytes);
  var hashBytes = imageHashHexToBytes(hashHex);
  if (!hashBytes) return null;
  var key = hashHex;
  if (imageCtx.byHash[key]) return imageCtx.byHash[key];

  var dataBlobIndex = blobs.length;
  blobs.push({ bytes: parsed.bytes });

  var entry = {
    key: key,
    hashHex: hashHex,
    hashBytes: hashBytes,
    dataBlob: dataBlobIndex,
    name: 'clipboard-image-' + key.slice(0, 12) + '.' + extFromMime(parsed.mime),
  };
  imageCtx.byHash[key] = entry;
  return entry;
}

// ─── Gradient transform helpers ───

function modDeg360(angleDeg) {
  var x = (angleDeg || 0) % 360;
  return x < 0 ? x + 360 : x;
}

/**
 * CSS linear-gradient 角度（0°=上、顺时针）→ Figma GRADIENT_LINEAR 的 transform。
 * CSS 角度到 Figma 线性渐变矩阵映射。
 * 这里采用与当前导出视觉一致的方向基：
 * - 当业务侧反馈“方向整体反向”时，可在此处切换副轴符号实现全局校正。
 */
function cssAngleToGradientTransform(angleDeg) {
  var rad = modDeg360(angleDeg) * Math.PI / 180;
  var s = Math.sin(rad);
  var c = Math.cos(rad);
  return {
    m00: s,
    m01: -c,
    m02: 0.5 * (1 - s + c),
    m10: c,
    m11: s,
    m12: 0.5 * (1 - c - s),
  };
}

function radialGradientTransform(cx, cy) {
  return {
    m00: 1, m01: 0, m02: (cx || 0.5) - 0.5,
    m10: 0, m11: 1, m12: (cy || 0.5) - 0.5,
  };
}

function irGradientStopsToFigma(stops) {
  if (!stops || !stops.length) return [];
  var result = [];
  for (var i = 0; i < stops.length; i++) {
    var gs = stops[i];
    var col = irColorToFigma(gs.color) || { r: 0, g: 0, b: 0, a: 1 };
    result.push({ color: col, position: gs.position != null ? gs.position : (i / Math.max(stops.length - 1, 1)) });
  }
  return result;
}

function irFillsToFigmaPaints(fills, blobs, imageCtx, imageImportList, imageImportSet) {
  if (!fills || !fills.length) return undefined;
  var paints = [];
  for (var i = 0; i < fills.length; i++) {
    var f = fills[i];
    if (typeof f === 'string') {
      var p = makeSolidPaint(f);
      if (p) paints.push(p);
    } else if (f && f.type === 'IMAGE') {
      var imageData = (typeof f.content === 'string' && f.content.indexOf('data:') === 0) ? f.content : null;
      var imageEntry = (imageData && blobs && imageCtx) ? registerImageFromDataUrl(imageData, blobs, imageCtx, f.imageHashHex) : null;
      if (!imageEntry) {
        console.warn('[DBG ir-to-figma] IMAGE fill 注册失败（imageEntry 为 null），将降级为灰色占位块', { hasImageData: !!imageData });
      }
      if (imageEntry) {
        paints.push({
          type: 'IMAGE',
          image: { hash: imageEntry.hashBytes, name: imageEntry.name, dataBlob: imageEntry.dataBlob },
          imageScaleMode: normalizeImageScaleMode(f.scaleMode),
          color: { r: 0, g: 0, b: 0, a: 0 },
          opacity: 1,
          visible: true,
          blendMode: 'NORMAL',
        });
        if (imageImportList && imageImportSet && !imageImportSet[imageEntry.key]) {
          imageImportSet[imageEntry.key] = true;
          imageImportList.push({
            name: imageEntry.name,
            image: {
              hash: imageEntry.hashBytes,
              name: imageEntry.name,
              dataBlob: imageEntry.dataBlob,
            },
          });
        }
      } else {
        paints.push({
          type: 'SOLID',
          color: { r: 0.85, g: 0.85, b: 0.85, a: 1 },
          opacity: 1,
          visible: true,
          blendMode: 'NORMAL',
        });
      }
    } else if (f && f.type === 'GRADIENT_LINEAR' && f.gradientStops) {
      paints.push({
        type: 'GRADIENT_LINEAR',
        stops: irGradientStopsToFigma(f.gradientStops),
        transform: cssAngleToGradientTransform(f.angle),
        opacity: 1,
        visible: true,
        blendMode: 'NORMAL',
      });
    } else if (f && f.type === 'GRADIENT_RADIAL' && f.gradientStops) {
      paints.push({
        type: 'GRADIENT_RADIAL',
        stops: irGradientStopsToFigma(f.gradientStops),
        transform: radialGradientTransform(f.centerX, f.centerY),
        opacity: 1,
        visible: true,
        blendMode: 'NORMAL',
      });
    } else if (f && (f.type === 'linearGradient' || f.type === 'radialGradient')) {
      paints.push({
        type: 'SOLID',
        color: { r: 0.9, g: 0.9, b: 0.9, a: 1 },
        opacity: 1,
        visible: true,
        blendMode: 'NORMAL',
      });
    } else if (f && typeof f === 'object') {
      var p2 = makeSolidPaint(f);
      if (p2) paints.push(p2);
    }
  }
  return paints.length ? paints : undefined;
}

// ─── IR shadows → Figma effects ───

function irShadowsToEffects(shadows, innerShadows) {
  var effects = [];
  if (shadows && shadows.length) {
    for (var i = 0; i < shadows.length; i++) {
      var s = shadows[i];
      var color = irColorToFigma(s.color) || { r: 0, g: 0, b: 0, a: 0.25 };
      effects.push({
        type: 'DROP_SHADOW',
        color: color,
        offset: { x: s.offsetX || 0, y: s.offsetY || 0 },
        radius: s.blur || 0,
        spread: s.spread || 0,
        visible: true,
        blendMode: 'NORMAL',
        showShadowBehindNode: false,
      });
    }
  }
  if (innerShadows && innerShadows.length) {
    for (var j = 0; j < innerShadows.length; j++) {
      var is = innerShadows[j];
      var ic = irColorToFigma(is.color) || { r: 0, g: 0, b: 0, a: 0.25 };
      effects.push({
        type: 'INNER_SHADOW',
        color: ic,
        offset: { x: is.offsetX || 0, y: is.offsetY || 0 },
        radius: is.blur || 0,
        spread: is.spread || 0,
        visible: true,
        blendMode: 'NORMAL',
      });
    }
  }
  return effects.length ? effects : undefined;
}

// ─── IR stroke → Figma stroke paints ───

function irStrokeToFigma(style) {
  if (!style) return {};
  var result = {};
  var color = style.strokeColor;
  if (!color) return result;
  var c = irColorToFigma(color);
  if (!c) return result;

  var paint = {
    type: 'SOLID',
    color: { r: c.r, g: c.g, b: c.b, a: 1 },
    opacity: c.a,
    visible: true,
    blendMode: 'NORMAL',
  };

  var hasPerSide = style.strokeTopWeight != null || style.strokeRightWeight != null ||
                   style.strokeBottomWeight != null || style.strokeLeftWeight != null;

  if (hasPerSide) {
    var tw = style.strokeTopWeight || 0;
    var rw = style.strokeRightWeight || 0;
    var bw = style.strokeBottomWeight || 0;
    var lw = style.strokeLeftWeight || 0;
    if (tw <= 0 && rw <= 0 && bw <= 0 && lw <= 0) return result;

    var maxW = Math.max(tw, rw, bw, lw);
    result.strokePaints = [paint];
    result.strokeWeight = maxW;
    result.strokeAlign = 'INSIDE';
    result.borderStrokeWeightsIndependent = true;
    result.borderTopWeight = tw;
    result.borderRightWeight = rw;
    result.borderBottomWeight = bw;
    result.borderLeftWeight = lw;
    if (tw <= 0) result.borderTopHidden = true;
    if (rw <= 0) result.borderRightHidden = true;
    if (bw <= 0) result.borderBottomHidden = true;
    if (lw <= 0) result.borderLeftHidden = true;
  } else {
    var weight = style.strokeWeight || 0;
    if (weight <= 0) return result;
    result.strokePaints = [paint];
    result.strokeWeight = weight;
    result.strokeAlign = 'INSIDE';
  }

  // border-style: dashed / dotted → dashPattern
  if (style.borderStyle === 'dashed') {
    var _sw = result.strokeWeight || 1;
    result.dashPattern = [_sw * 3, _sw * 2];
    result.strokeCap = 'NONE';
  } else if (style.borderStyle === 'dotted') {
    var _sw2 = result.strokeWeight || 1;
    result.dashPattern = [0.01, _sw2 * 2];
    result.strokeCap = 'ROUND';
  }

  return result;
}

// ─── Border radius ───

function irBorderRadius(style) {
  var br = style.borderRadius;
  if (br == null) return {};
  if (typeof br === 'number') {
    return br > 0 ? { cornerRadius: br } : {};
  }
  if (Array.isArray(br) && br.length === 4) {
    var tl = br[0] || 0;
    var tr = br[1] || 0;
    var brR = br[2] || 0;
    var bl = br[3] || 0;
    if (tl === tr && tr === brR && brR === bl) {
      return tl > 0 ? { cornerRadius: tl } : {};
    }
    return {
      rectangleCornerRadiiIndependent: true,
      rectangleTopLeftCornerRadius: tl,
      rectangleTopRightCornerRadius: tr,
      rectangleBottomRightCornerRadius: brR,
      rectangleBottomLeftCornerRadius: bl,
    };
  }
  return {};
}

// ─── SVG fallback helpers (clipboard mode) ───

function extractSvgIntrinsicSize(svgContent) {
  if (!svgContent || typeof svgContent !== 'string') return null;
  var widthMatch = svgContent.match(/\bwidth\s*=\s*["']([^"']+)["']/i);
  var heightMatch = svgContent.match(/\bheight\s*=\s*["']([^"']+)["']/i);
  var viewBoxMatch = svgContent.match(/\bviewBox\s*=\s*["']([^"']+)["']/i);

  function parseNum(raw) {
    if (!raw) return null;
    var n = parseFloat(String(raw).replace(/[^\d.\-+eE]/g, ''));
    return isFinite(n) && n > 0 ? n : null;
  }

  var w = parseNum(widthMatch && widthMatch[1]);
  var h = parseNum(heightMatch && heightMatch[1]);
  if (w && h) return { width: w, height: h };

  if (viewBoxMatch && viewBoxMatch[1]) {
    var parts = String(viewBoxMatch[1]).trim().split(/[\s,]+/);
    if (parts.length === 4) {
      var vbW = parseNum(parts[2]);
      var vbH = parseNum(parts[3]);
      if (vbW && vbH) return { width: vbW, height: vbH };
    }
  }
  return null;
}

function extractSvgFallbackPaint(svgContent) {
  if (!svgContent || typeof svgContent !== 'string') return null;

  function toPaint(rawColor) {
    if (!rawColor) return null;
    var c = String(rawColor).trim();
    if (!c || c === 'none' || c === 'currentColor' || /^url\(/i.test(c)) return null;
    var figColor = irColorToFigma(c);
    if (!figColor) return null;
    return {
      type: 'SOLID',
      color: { r: figColor.r, g: figColor.g, b: figColor.b, a: 1 },
      opacity: figColor.a != null ? figColor.a : 1,
      visible: true,
      blendMode: 'NORMAL',
    };
  }

  // 优先拿填充色；没有再尝试描边色，保证 SVG 至少可见。
  var fillMatch = svgContent.match(/\bfill\s*=\s*["']([^"']+)["']/i);
  var fillPaint = toPaint(fillMatch && fillMatch[1]);
  if (fillPaint) return fillPaint;

  var strokeMatch = svgContent.match(/\bstroke\s*=\s*["']([^"']+)["']/i);
  return toPaint(strokeMatch && strokeMatch[1]);
}

// 将 SVG 坐标或百分比归一化到 0–1（用于 radialGradient 的 cx/cy 与 objectBoundingBox）
function _svgCoord01(attr, unitDivisor, defVal) {
  if (attr == null || String(attr).trim() === '') return defVal;
  var s = String(attr).trim();
  if (s.indexOf('%') >= 0) {
    var p = parseFloat(s) / 100;
    return isFinite(p) ? Math.max(0, Math.min(1, p)) : defVal;
  }
  var n = parseFloat(s);
  if (!isFinite(n)) return defVal;
  if (unitDivisor > 0) return Math.max(0, Math.min(1, n / unitDivisor));
  return defVal;
}

// <radialGradient> → IR 的 GRADIENT_RADIAL（与 css-parsers 径向结构一致，供 irFillsToFigmaPaints）
function _parseSvgRadialGradientToIrFill(gradEl, svgEl) {
  if (!gradEl || !svgEl) return null;
  var vbParts = (svgEl.getAttribute('viewBox') || '').trim().split(/[\s,]+/);
  var vbW = vbParts.length >= 4 ? Math.max(1, parseFloat(vbParts[2]) || 1) : 1;
  var vbH = vbParts.length >= 4 ? Math.max(1, parseFloat(vbParts[3]) || 1) : 1;
  var units = String(gradEl.getAttribute('gradientUnits') || '').toLowerCase();
  var cx01 = 0.5;
  var cy01 = 0.5;
  if (units === 'userspaceonuse') {
    cx01 = _svgCoord01(gradEl.getAttribute('cx'), vbW, 0.5);
    cy01 = _svgCoord01(gradEl.getAttribute('cy'), vbH, 0.5);
  } else {
    cx01 = _svgCoord01(gradEl.getAttribute('cx'), 1, 0.5);
    cy01 = _svgCoord01(gradEl.getAttribute('cy'), 1, 0.5);
  }
  var stops = [];
  var stopEls = gradEl.querySelectorAll('stop');
  for (var si = 0; si < stopEls.length; si++) {
    var st = stopEls[si];
    var off = st.getAttribute('offset');
    var pos;
    if (off != null && String(off).trim() !== '') {
      var os = String(off).trim();
      if (os.indexOf('%') >= 0) pos = parseFloat(os) / 100;
      else pos = parseFloat(os);
    } else {
      pos = stopEls.length > 1 ? si / (stopEls.length - 1) : 0;
    }
    if (!isFinite(pos)) pos = si / Math.max(stopEls.length - 1, 1);
    pos = Math.max(0, Math.min(1, pos));
    var sc = st.getAttribute('stop-color');
    if (!sc) {
      var styleStr = st.getAttribute('style') || '';
      var m = styleStr.match(/stop-color\s*:\s*([^;]+)/i);
      if (m) sc = m[1].trim();
    }
    if (!sc) sc = '#000000';
    stops.push({ position: pos, color: String(sc).trim() });
  }
  if (stops.length < 2) {
    if (stops.length === 1) stops.push({ position: 1, color: stops[0].color });
    else return null;
  }
  return { type: 'GRADIENT_RADIAL', gradientStops: stops, centerX: cx01, centerY: cy01, radius: 0.5 };
}

// <linearGradient> → IR 的 GRADIENT_LINEAR（简化：色标 + 由 x1,y1,x2,y2 推导近似角度）
function _parseSvgLinearGradientToIrFill(gradEl) {
  if (!gradEl) return null;
  var stops = [];
  var stopEls = gradEl.querySelectorAll('stop');
  for (var li = 0; li < stopEls.length; li++) {
    var st = stopEls[li];
    var off = st.getAttribute('offset');
    var pos;
    if (off != null && String(off).trim() !== '') {
      var os = String(off).trim();
      if (os.indexOf('%') >= 0) pos = parseFloat(os) / 100;
      else pos = parseFloat(os);
    } else {
      pos = stopEls.length > 1 ? li / (stopEls.length - 1) : 0;
    }
    if (!isFinite(pos)) pos = li / Math.max(stopEls.length - 1, 1);
    pos = Math.max(0, Math.min(1, pos));
    var sc = st.getAttribute('stop-color');
    if (!sc) {
      var styleStr = st.getAttribute('style') || '';
      var m = styleStr.match(/stop-color\s*:\s*([^;]+)/i);
      if (m) sc = m[1].trim();
    }
    if (!sc) sc = '#000000';
    stops.push({ position: pos, color: String(sc).trim() });
  }
  if (stops.length < 2) {
    if (stops.length === 1) stops.push({ position: 1, color: stops[0].color });
    else return null;
  }
  var x1 = parseFloat(gradEl.getAttribute('x1')) || 0;
  var y1 = parseFloat(gradEl.getAttribute('y1')) || 0;
  var x2 = parseFloat(gradEl.getAttribute('x2')) || 1;
  var y2 = parseFloat(gradEl.getAttribute('y2')) || 0;
  var angleDeg = (Math.atan2(y2 - y1, x2 - x1) * 180) / Math.PI + 90;
  if (!isFinite(angleDeg)) angleDeg = 180;
  return { type: 'GRADIENT_LINEAR', gradientStops: stops, angle: angleDeg };
}

/**
 * 解析序列化 SVG 中首个几何图形的 fill="url(#id)"，从 defs 取渐变 → IR fill。
 * 解决 VECTOR 仅用 DOM/svg 首段纯色或灰底、无法还原 <radialGradient> 的问题（如转盘 plateGrad）。
 */
function extractSvgPrimaryPaintAsIrFill(svgContent) {
  if (!svgContent || typeof DOMParser === 'undefined') return null;
  try {
    var doc = new DOMParser().parseFromString(svgContent, 'image/svg+xml');
    if (doc.querySelector('parsererror')) return null;
    var svgEl = doc.querySelector('svg');
    if (!svgEl) return null;
    var shapes = svgEl.querySelectorAll('path, circle, rect, ellipse, polygon, polyline');
    var urlRe = /^url\(#([\w-]+)\)\s*$/i;
    for (var i = 0; i < shapes.length; i++) {
      var sh = shapes[i];
      var fill = sh.getAttribute('fill');
      if (!fill && sh.getAttribute('style')) {
        var sm = String(sh.getAttribute('style')).match(/\bfill\s*:\s*url\(\s*#([\w-]+)\s*\)/i);
        if (sm) fill = 'url(#' + sm[1] + ')';
      }
      if (!fill) continue;
      var um = String(fill).trim().match(urlRe);
      if (!um) continue;
      var gid = um[1];
      var gradEl = doc.getElementById(gid);
      if (!gradEl) continue;
      var gtag = (gradEl.tagName || '').toLowerCase().replace(/^.*:/, '');
      if (gtag === 'radialgradient') return _parseSvgRadialGradientToIrFill(gradEl, svgEl);
      if (gtag === 'lineargradient') return _parseSvgLinearGradientToIrFill(gradEl);
    }
    return null;
  } catch (_e) {
    return null;
  }
}

// Detect stroke-based (线性) SVG icons: root svg has fill="none" and a stroke color.
// Returns { isStrokeBased, strokePaint, strokeWidth } or null.
function detectSvgStrokeMode(svgContent) {
  if (!svgContent || typeof svgContent !== 'string') return null;

  // Check <svg ... fill="none" ...> at root level only (not inside paths)
  var svgTagMatch = svgContent.match(/^<svg\b([^>]*?)>/i);
  if (!svgTagMatch) return null;
  var svgAttrs = svgTagMatch[1];

  var rootFillMatch = svgAttrs.match(/\bfill\s*=\s*["']([^"']+)["']/i);
  if (!rootFillMatch || String(rootFillMatch[1]).trim().toLowerCase() !== 'none') return null;

  // Extract stroke color from root svg attrs or first path
  function toPaint(rawColor) {
    if (!rawColor) return null;
    var c = String(rawColor).trim();
    if (!c || c === 'none' || c === 'currentColor' || /^url\(/i.test(c)) return null;
    var figColor = irColorToFigma(c);
    if (!figColor) return null;
    return {
      type: 'SOLID',
      color: { r: figColor.r, g: figColor.g, b: figColor.b, a: 1 },
      opacity: figColor.a != null ? figColor.a : 1,
      visible: true,
      blendMode: 'NORMAL',
    };
  }

  var strokeColorStr = null;
  var rootStrokeMatch = svgAttrs.match(/\bstroke\s*=\s*["']([^"']+)["']/i);
  if (rootStrokeMatch) {
    strokeColorStr = rootStrokeMatch[1];
  } else {
    // Check first path/circle/etc element for stroke attribute
    var anyElMatch = svgContent.match(/<(?:path|circle|rect|ellipse|polygon|polyline|line)\b[^>]*\bstroke\s*=\s*["']([^"']+)["']/i);
    if (anyElMatch) strokeColorStr = anyElMatch[1];
  }

  var strokePaint = toPaint(strokeColorStr);
  if (!strokePaint) return null;

  // Extract stroke-width; default 1.5 for common line icons
  var swMatch = svgAttrs.match(/\bstroke-width\s*=\s*["']([^"']+)["']/i);
  var strokeWidth = swMatch ? parseFloat(swMatch[1]) : 1.5;
  if (!isFinite(strokeWidth) || strokeWidth <= 0) strokeWidth = 1.5;

  // Extract stroke-linecap and stroke-linejoin from root attrs
  var lcMatch = svgAttrs.match(/\bstroke-linecap\s*=\s*["']([^"']+)["']/i);
  var ljMatch = svgAttrs.match(/\bstroke-linejoin\s*=\s*["']([^"']+)["']/i);
  var linecap = lcMatch ? String(lcMatch[1]).toUpperCase() : 'ROUND';
  var linejoin = ljMatch ? String(ljMatch[1]).toUpperCase() : 'ROUND';
  // Normalize to Figma values
  if (linecap !== 'ROUND' && linecap !== 'SQUARE') linecap = 'ROUND';
  if (linejoin !== 'ROUND' && linejoin !== 'MITER' && linejoin !== 'BEVEL') linejoin = 'ROUND';

  return {
    isStrokeBased: true,
    strokePaint: strokePaint,
    strokeWidth: strokeWidth,
    strokeCap: linecap,
    strokeJoin: linejoin,
  };
}

// ─── SVG → VECTOR path helpers ───

// Extract viewBox intrinsic dimensions (separate from width/height pixel attrs)
function extractSvgViewBox(svgContent) {
  if (!svgContent || typeof svgContent !== 'string') return null;
  var m = svgContent.match(/\bviewBox\s*=\s*["']([^"']+)["']/i);
  if (!m || !m[1]) return null;
  var parts = String(m[1]).trim().split(/[\s,]+/);
  if (parts.length === 4) {
    var minX = parseFloat(parts[0]);
    var minY = parseFloat(parts[1]);
    var w = parseFloat(parts[2]);
    var h = parseFloat(parts[3]);
    if (isFinite(w) && isFinite(h) && w > 0 && h > 0) {
      return {
        width: w,
        height: h,
        minX: isFinite(minX) ? minX : 0,
        minY: isFinite(minY) ? minY : 0,
      };
    }
  }
  return null;
}

// Convert <rect> attributes to SVG path d string
function _svgRectToPathD(x, y, w, h, rx, ry) {
  rx = rx || 0;
  ry = ry || rx;
  if (rx === 0 && ry === 0) {
    return 'M ' + x + ' ' + y + ' L ' + (x + w) + ' ' + y +
      ' L ' + (x + w) + ' ' + (y + h) + ' L ' + x + ' ' + (y + h) + ' Z';
  }
  rx = Math.min(rx, w / 2);
  ry = Math.min(ry, h / 2);
  return (
    'M ' + (x + rx) + ' ' + y +
    ' L ' + (x + w - rx) + ' ' + y +
    ' Q ' + (x + w) + ' ' + y + ' ' + (x + w) + ' ' + (y + ry) +
    ' L ' + (x + w) + ' ' + (y + h - ry) +
    ' Q ' + (x + w) + ' ' + (y + h) + ' ' + (x + w - rx) + ' ' + (y + h) +
    ' L ' + (x + rx) + ' ' + (y + h) +
    ' Q ' + x + ' ' + (y + h) + ' ' + x + ' ' + (y + h - ry) +
    ' L ' + x + ' ' + (y + ry) +
    ' Q ' + x + ' ' + y + ' ' + (x + rx) + ' ' + y +
    ' Z'
  );
}

// Approximate ellipse/circle as 4 cubic bezier curves (kappa = 0.5523)
function _svgEllipseToPathD(cx, cy, rx, ry) {
  var k = 0.5522847498;
  var ox = rx * k;
  var oy = ry * k;
  return (
    'M ' + (cx - rx) + ' ' + cy +
    ' C ' + (cx - rx) + ' ' + (cy - oy) + ' ' + (cx - ox) + ' ' + (cy - ry) + ' ' + cx + ' ' + (cy - ry) +
    ' C ' + (cx + ox) + ' ' + (cy - ry) + ' ' + (cx + rx) + ' ' + (cy - oy) + ' ' + (cx + rx) + ' ' + cy +
    ' C ' + (cx + rx) + ' ' + (cy + oy) + ' ' + (cx + ox) + ' ' + (cy + ry) + ' ' + cx + ' ' + (cy + ry) +
    ' C ' + (cx - ox) + ' ' + (cy + ry) + ' ' + (cx - rx) + ' ' + (cy + oy) + ' ' + (cx - rx) + ' ' + cy +
    ' Z'
  );
}

// Convert polygon/polyline points attribute to path d string
function _svgPolygonToPathD(pointsStr, close) {
  if (!pointsStr) return '';
  var nums = pointsStr.trim().split(/[\s,]+/).map(Number).filter(function (n) { return isFinite(n); });
  if (nums.length < 4) return '';
  var parts = ['M ' + nums[0] + ' ' + nums[1]];
  for (var i = 2; i + 1 < nums.length; i += 2) {
    parts.push('L ' + nums[i] + ' ' + nums[i + 1]);
  }
  if (close) parts.push('Z');
  return parts.join(' ');
}

// Parse SVG transform string → matrix [a,b,c,d,e,f]; returns null for unsupported transforms
function _parseSvgTransform(str) {
  if (!str || str === 'none') return null;
  var t = str.trim();
  var mMatch = t.match(/^matrix\s*\(\s*([\d.\-+eE]+)\s*[\s,]\s*([\d.\-+eE]+)\s*[\s,]\s*([\d.\-+eE]+)\s*[\s,]\s*([\d.\-+eE]+)\s*[\s,]\s*([\d.\-+eE]+)\s*[\s,]\s*([\d.\-+eE]+)\s*\)/);
  if (mMatch) return [mMatch[1], mMatch[2], mMatch[3], mMatch[4], mMatch[5], mMatch[6]].map(parseFloat);
  var trMatch = t.match(/^translate\s*\(\s*([\d.\-+eE]+)\s*(?:[\s,]\s*([\d.\-+eE]+))?\s*\)/);
  if (trMatch) return [1, 0, 0, 1, parseFloat(trMatch[1]), trMatch[2] != null ? parseFloat(trMatch[2]) : 0];
  var scMatch = t.match(/^scale\s*\(\s*([\d.\-+eE]+)\s*(?:[\s,]\s*([\d.\-+eE]+))?\s*\)/);
  if (scMatch) {
    var sx = parseFloat(scMatch[1]);
    return [sx, 0, 0, scMatch[2] != null ? parseFloat(scMatch[2]) : sx, 0, 0];
  }
  return null; // unsupported → caller should skip this path
}

// Compose m1 * m2 (both are [a,b,c,d,e,f] 2D affine matrices)
function _composeSvgMatrix(m1, m2) {
  return [
    m1[0] * m2[0] + m1[2] * m2[1],
    m1[1] * m2[0] + m1[3] * m2[1],
    m1[0] * m2[2] + m1[2] * m2[3],
    m1[1] * m2[2] + m1[3] * m2[3],
    m1[0] * m2[4] + m1[2] * m2[5] + m1[4],
    m1[1] * m2[4] + m1[3] * m2[5] + m1[5],
  ];
}

// Parse SVG content string → array of { d, windingRule, matrix }
// Handles path/rect/circle/ellipse/polygon/polyline/line; null when unavailable
function parseSvgContentToPaths(svgContent) {
  if (!svgContent || typeof DOMParser === 'undefined') return null;
  try {
    var doc = new DOMParser().parseFromString(svgContent, 'image/svg+xml');
    if (doc.querySelector('parsererror')) return null;
    var svgEl = doc.querySelector('svg');
    if (!svgEl) return null;

    var IDENTITY = [1, 0, 0, 1, 0, 0];

    // Accumulate ancestor transform matrices up to (but not including) the <svg> element.
    // Returns null if any ancestor has an unsupported transform.
    function getAncestorMatrix(el) {
      var matrices = [];
      var cur = el.parentElement;
      while (cur && cur !== svgEl) {
        var t = cur.getAttribute ? cur.getAttribute('transform') : null;
        if (t) {
          var m = _parseSvgTransform(t);
          if (m === null) return null; // unsupported → skip whole element
          matrices.unshift(m);
        }
        cur = cur.parentElement;
      }
      if (!matrices.length) return IDENTITY;
      var result = matrices[0];
      for (var i = 1; i < matrices.length; i++) result = _composeSvgMatrix(result, matrices[i]);
      return result;
    }

    function isIdentityMatrix(m) {
      return (
        Math.abs(m[0] - 1) < 1e-5 && Math.abs(m[1]) < 1e-5 &&
        Math.abs(m[2]) < 1e-5 && Math.abs(m[3] - 1) < 1e-5 &&
        Math.abs(m[4]) < 1e-5 && Math.abs(m[5]) < 1e-5
      );
    }

    function pf(v, def) { var n = parseFloat(v || def || '0'); return isFinite(n) ? n : 0; }

    var paths = [];
    var els = svgEl.querySelectorAll('path, circle, rect, ellipse, polygon, polyline, line');
    for (var i = 0; i < els.length; i++) {
      var el = els[i];
      var tag = el.tagName.toLowerCase().replace(/^.*:/, ''); // strip namespace
      var d = null;

      if (tag === 'path') {
        d = el.getAttribute('d');
      } else if (tag === 'rect') {
        var rx0 = pf(el.getAttribute('rx'), '0');
        var ry0 = pf(el.getAttribute('ry'), String(rx0));
        d = _svgRectToPathD(pf(el.getAttribute('x')), pf(el.getAttribute('y')),
          pf(el.getAttribute('width')), pf(el.getAttribute('height')), rx0, ry0);
      } else if (tag === 'circle') {
        var r0 = pf(el.getAttribute('r'));
        d = _svgEllipseToPathD(pf(el.getAttribute('cx')), pf(el.getAttribute('cy')), r0, r0);
      } else if (tag === 'ellipse') {
        d = _svgEllipseToPathD(pf(el.getAttribute('cx')), pf(el.getAttribute('cy')),
          pf(el.getAttribute('rx')), pf(el.getAttribute('ry')));
      } else if (tag === 'polygon') {
        d = _svgPolygonToPathD(el.getAttribute('points') || '', true);
      } else if (tag === 'polyline') {
        d = _svgPolygonToPathD(el.getAttribute('points') || '', false);
      } else if (tag === 'line') {
        d = 'M ' + pf(el.getAttribute('x1')) + ' ' + pf(el.getAttribute('y1')) +
          ' L ' + pf(el.getAttribute('x2')) + ' ' + pf(el.getAttribute('y2'));
      }

      if (!d) continue;

      // fill-rule → windingRule (check element then root svg)
      var fillRule = el.getAttribute('fill-rule') || svgEl.getAttribute('fill-rule') || 'nonzero';
      var windingRule = fillRule.toLowerCase() === 'evenodd' ? 'ODD' : 'NONZERO';

      // Compute final transform matrix: ancestors * own
      var ancestorMatrix = getAncestorMatrix(el);
      if (ancestorMatrix === null) continue; // unsupported ancestor transform → skip
      var ownTransformStr = el.getAttribute('transform');
      var finalMatrix = ancestorMatrix;
      if (ownTransformStr) {
        var ownMatrix = _parseSvgTransform(ownTransformStr);
        if (ownMatrix === null) continue; // unsupported own transform → skip
        finalMatrix = _composeSvgMatrix(ancestorMatrix, ownMatrix);
      }

      paths.push({
        d: d,
        windingRule: windingRule,
        matrix: isIdentityMatrix(finalMatrix) ? null : finalMatrix,
      });
    }

    return paths.length > 0 ? paths : null;
  } catch (e) {
    return null;
  }
}

// 从序列化后的内联 SVG 中解析 <text>，生成与 convertTextNode 兼容的轻量 IR 节点。
// parseSvgContentToPaths 只处理几何图形，不处理文字；剪贴板链路无 createNodeFromSVG，需单独补 TEXT。
function parseSvgContentToTextIrNodes(svgContent, layoutWidth, layoutHeight) {
  if (!svgContent || typeof DOMParser === 'undefined') return null;
  try {
    var doc = new DOMParser().parseFromString(svgContent, 'image/svg+xml');
    if (doc.querySelector('parsererror')) return null;
    var svgEl = doc.querySelector('svg');
    if (!svgEl) return null;
    var textEls = svgEl.querySelectorAll('text');
    if (!textEls || !textEls.length) return null;

    var vb = extractSvgViewBox(svgContent);
    var vbMinX = vb ? vb.minX : 0;
    var vbMinY = vb ? vb.minY : 0;
    var vbW = vb && vb.width > 0 ? vb.width : (layoutWidth > 0 ? layoutWidth : 1);
    var vbH = vb && vb.height > 0 ? vb.height : (layoutHeight > 0 ? layoutHeight : 1);
    var sx = layoutWidth > 0 ? layoutWidth / vbW : 1;
    var sy = layoutHeight > 0 ? layoutHeight / vbH : 1;

    function pf(v, def) {
      var n = parseFloat(v != null ? String(v) : (def != null ? String(def) : '0'));
      return isFinite(n) ? n : 0;
    }

    function stripQuotes(s) {
      if (!s) return '';
      s = String(s).trim();
      if ((s.charAt(0) === '"' && s.charAt(s.length - 1) === '"') ||
          (s.charAt(0) === "'" && s.charAt(s.length - 1) === "'")) {
        s = s.slice(1, -1);
      }
      return s.trim();
    }

    function textContentOneLine(el) {
      var raw = el.textContent || '';
      raw = raw.replace(/\s+/g, ' ').trim();
      return raw;
    }

    function parseFontWeight(attr) {
      if (!attr) return 400;
      var a = String(attr).trim().toLowerCase();
      if (a === 'normal') return 400;
      if (a === 'bold') return 700;
      var n = parseFloat(a);
      return isFinite(n) ? n : 400;
    }

    var out = [];
    for (var i = 0; i < textEls.length; i++) {
      var tel = textEls[i];
      var content = textContentOneLine(tel);
      if (!content) continue;

      var tx = pf(tel.getAttribute('x'), 0);
      var ty = pf(tel.getAttribute('y'), 0);
      var lx = (tx - vbMinX) * sx;
      var ly = (ty - vbMinY) * sy;

      var fsAttr = tel.getAttribute('font-size');
      var fsSvg = fsAttr ? pf(fsAttr, 16) : 16;
      var scaledFs = Math.max(1, fsSvg * sy);

      var anchorRaw = (tel.getAttribute('text-anchor') || 'start').trim().toLowerCase();
      var textAlignHorizontal = 'LEFT';
      if (anchorRaw === 'middle') textAlignHorizontal = 'CENTER';
      else if (anchorRaw === 'end' || anchorRaw === 'right') textAlignHorizontal = 'RIGHT';

      var fill = tel.getAttribute('fill');
      if (!fill || fill === 'none') fill = '#000000';

      var fontFamily = stripQuotes(tel.getAttribute('font-family')) || 'sans-serif';
      var fontWeight = parseFontWeight(tel.getAttribute('font-weight'));
      var fontStyle = (tel.getAttribute('font-style') || '').toLowerCase() === 'italic';

      var lsAttr = tel.getAttribute('letter-spacing');
      // SVG 用户单位下的 letter-spacing 需随水平比例缩放到布局像素（与 font-size 一致用 sy 亦可，横排字距跟 sx）
      var letterSpacing = lsAttr != null && lsAttr !== '' ? pf(lsAttr, 0) * sx : 0;

      var lineHeightPx = scaledFs * 1.15;
      var approxTop = ly - scaledFs * 0.82;

      var style = {
        x: 0,
        y: Math.max(0, approxTop),
        fontSize: scaledFs,
        lineHeight: lineHeightPx,
        fontFamily: fontFamily,
        fontWeight: fontWeight,
        fontStyle: fontStyle ? 'italic' : 'normal',
        color: fill,
        letterSpacing: letterSpacing,
        textAlignHorizontal: textAlignHorizontal,
        textAlignVertical: 'TOP',
        singleLine: true,
        positionType: 'absolute',
      };

      // text-anchor=middle：不要用整幅 SVG 宽度当 style.width，否则 Figma textAutoResize=NONE 会把长文案压扁。
      // 由 convertTextNode 在测宽后按 textAnchorCenterX 设置 transform.x = 锚点x - nodeWidth/2。
      if (textAlignHorizontal === 'CENTER') {
        style.textAnchorCenterX = lx;
        style.textAlignHorizontal = 'LEFT';
      } else if (textAlignHorizontal === 'RIGHT') {
        var estW = Math.max(scaledFs, Math.ceil(content.length * scaledFs * 0.62));
        style.width = estW;
        style.x = lx - estW;
      } else {
        style.x = lx;
      }

      out.push({
        type: 'text',
        name: content.length > 30 ? content.slice(0, 30) + '…' : content,
        content: content,
        style: style,
      });
    }

    return out.length ? out : null;
  } catch (_e) {
    return null;
  }
}

// Normalize SVG path d string → absolute M/L/C/Q/Z command objects using svg-pathdata v6
// Also applies optional affine matrix transform
function _normalizeSvgPathToCommands(d, matrix) {
  if (!_svgPathDataLib || !d) return null;
  try {
    var SVGPathData = _svgPathDataLib.SVGPathData;
    var T = _svgPathDataLib.SVGPathDataTransformer;
    var pd = new SVGPathData(d).toAbs().normalizeHVZ();
    // NORMALIZE_ST: S(smooth cubic)→C, T(smooth quad)→Q
    if (T.NORMALIZE_ST) pd = pd.transform(T.NORMALIZE_ST());
    if (T.A_TO_C) pd = pd.transform(T.A_TO_C());
    if (matrix) pd = pd.transform(T.MATRIX(matrix[0], matrix[1], matrix[2], matrix[3], matrix[4], matrix[5]));
    return pd.commands;
  } catch (e) {
    return null;
  }
}

// Encode normalized svg-pathdata command objects → Figma fillGeometry path blob (Uint8Array)
// Format verified against open-pencil's geometryBlobToPath (reads real Figma .fig files):
//   No header byte. CMD_CLOSE=0, CMD_MOVE_TO=1, CMD_LINE_TO=2, CMD_CUBIC_TO=4.
//   QUAD_TO (cmd=3) is NOT in Figma's format → elevate Q→C inline.
// SVG uses Y-down, Figma fillGeometry also uses Y-down → NO Y negation.
function _encodeSvgCommandsToBlob(commands) {
  if (!_svgPathDataLib || !commands || !commands.length) return null;
  var SvgPathData = _svgPathDataLib.SVGPathData;
  var MT = SvgPathData.MOVE_TO;    // 2
  var LT = SvgPathData.LINE_TO;    // 16
  var CT = SvgPathData.CURVE_TO;   // 32
  var QT = SvgPathData.QUAD_TO;    // 128 – elevated to CT in output
  var ZT = SvgPathData.CLOSE_PATH; // 1

  // Size: no header byte; QT elevated to CT (same 25 bytes as CT)
  var size = 0;
  for (var i = 0; i < commands.length; i++) {
    var c = commands[i];
    if      (c.type === MT) size += 9;  // 1 byte cmd + 2×float32
    else if (c.type === LT) size += 9;
    else if (c.type === QT) size += 25; // elevated to CT: 1 + 6×float32
    else if (c.type === CT) size += 25; // 1 + 6×float32
    else if (c.type === ZT) size += 1;
  }

  var buf = new ArrayBuffer(size);
  var u8 = new Uint8Array(buf);
  var dv = new DataView(buf);
  var pos = 0;
  var curX = 0, curY = 0;

  for (var i = 0; i < commands.length; i++) {
    var c = commands[i];
    if (c.type === MT) {
      u8[pos++] = 0x01;
      dv.setFloat32(pos, c.x, true); pos += 4;
      dv.setFloat32(pos, c.y, true); pos += 4;
      curX = c.x; curY = c.y;
    } else if (c.type === LT) {
      u8[pos++] = 0x02;
      dv.setFloat32(pos, c.x, true); pos += 4;
      dv.setFloat32(pos, c.y, true); pos += 4;
      curX = c.x; curY = c.y;
    } else if (c.type === QT) {
      // Elevate quadratic bezier Q(qx1,qy1,x,y) from (curX,curY) to cubic:
      // C1 = cur + 2/3*(Q_ctrl - cur),  C2 = end + 2/3*(Q_ctrl - end)
      var cx1 = curX + (2 / 3) * (c.x1 - curX);
      var cy1 = curY + (2 / 3) * (c.y1 - curY);
      var cx2 = c.x  + (2 / 3) * (c.x1 - c.x);
      var cy2 = c.y  + (2 / 3) * (c.y1 - c.y);
      u8[pos++] = 0x04;
      dv.setFloat32(pos, cx1,  true); pos += 4;
      dv.setFloat32(pos, cy1,  true); pos += 4;
      dv.setFloat32(pos, cx2,  true); pos += 4;
      dv.setFloat32(pos, cy2,  true); pos += 4;
      dv.setFloat32(pos, c.x,  true); pos += 4;
      dv.setFloat32(pos, c.y,  true); pos += 4;
      curX = c.x; curY = c.y;
    } else if (c.type === CT) {
      u8[pos++] = 0x04;
      dv.setFloat32(pos, c.x1, true); pos += 4;
      dv.setFloat32(pos, c.y1, true); pos += 4;
      dv.setFloat32(pos, c.x2, true); pos += 4;
      dv.setFloat32(pos, c.y2, true); pos += 4;
      dv.setFloat32(pos, c.x,  true); pos += 4;
      dv.setFloat32(pos, c.y,  true); pos += 4;
      curX = c.x; curY = c.y;
    } else if (c.type === ZT) {
      u8[pos++] = 0x00;
      // curX/curY after Z: next M will reset; no need to track subpath start here
    }
  }

  return u8;
}

// Build VectorNetwork topology (vertices / segments / regions) from parsed SVG paths.
// Each SVG <path> element becomes ONE region whose loops array contains one entry per
// closed subpath (M…Z). Multi-subpath paths (e.g. outer circle + inner hole) must stay
// in the SAME region so that Figma applies NONZERO/EVENODD across all loops together,
// producing the correct ring / compound shape (not two separate filled areas).
function _buildVectorNetworkFromPaths(svgPaths) {
  if (!_svgPathDataLib || !svgPaths || !svgPaths.length) return null;
  var SvgPathData = _svgPathDataLib.SVGPathData;
  var MT = SvgPathData.MOVE_TO;
  var LT = SvgPathData.LINE_TO;
  var CT = SvgPathData.CURVE_TO;
  var QT = SvgPathData.QUAD_TO;
  var ZT = SvgPathData.CLOSE_PATH;

  var vertices = [];
  var segments = [];
  var regions  = [];

  for (var pi = 0; pi < svgPaths.length; pi++) {
    var sp = svgPaths[pi];
    var commands = _normalizeSvgPathToCommands(sp.d, sp.matrix);
    if (!commands || !commands.length) continue;

    var windingRule = sp.windingRule || 'NONZERO';
    var subpathStartIdx = -1;
    var curIdx = -1;
    var currentSubpathSegs = []; // segments for the current open subpath
    var pathLoops = [];          // all closed loops collected for this SVG path element
    var prevX = 0, prevY = 0;

    for (var ci = 0; ci < commands.length; ci++) {
      var c = commands[ci];

      if (c.type === MT) {
        // A new M before Z: flush the current open subpath as-is (open loop)
        if (currentSubpathSegs.length > 0) {
          pathLoops.push(currentSubpathSegs);
          currentSubpathSegs = [];
        }
        subpathStartIdx = vertices.length;
        vertices.push({ x: c.x, y: c.y });
        curIdx = subpathStartIdx;
        prevX = c.x; prevY = c.y;

      } else if (c.type === LT) {
        var ni = vertices.length;
        vertices.push({ x: c.x, y: c.y });
        var si = segments.length;
        segments.push({ start: curIdx, end: ni, tangentStart: { x: 0, y: 0 }, tangentEnd: { x: 0, y: 0 } });
        currentSubpathSegs.push(si);
        curIdx = ni; prevX = c.x; prevY = c.y;

      } else if (c.type === CT) {
        var ni = vertices.length;
        vertices.push({ x: c.x, y: c.y });
        var si = segments.length;
        segments.push({
          start: curIdx, end: ni,
          tangentStart: { x: c.x1 - prevX, y: c.y1 - prevY },
          tangentEnd:   { x: c.x2 - c.x,  y: c.y2 - c.y  }
        });
        currentSubpathSegs.push(si);
        curIdx = ni; prevX = c.x; prevY = c.y;

      } else if (c.type === QT) {
        // Elevate Q→C
        var ecx1 = prevX + (2 / 3) * (c.x1 - prevX);
        var ecy1 = prevY + (2 / 3) * (c.y1 - prevY);
        var ecx2 = c.x  + (2 / 3) * (c.x1 - c.x);
        var ecy2 = c.y  + (2 / 3) * (c.y1 - c.y);
        var ni = vertices.length;
        vertices.push({ x: c.x, y: c.y });
        var si = segments.length;
        segments.push({
          start: curIdx, end: ni,
          tangentStart: { x: ecx1 - prevX, y: ecy1 - prevY },
          tangentEnd:   { x: ecx2 - c.x,  y: ecy2 - c.y  }
        });
        currentSubpathSegs.push(si);
        curIdx = ni; prevX = c.x; prevY = c.y;

      } else if (c.type === ZT) {
        // Close subpath: add a straight closing segment back to subpath start
        if (curIdx !== subpathStartIdx && subpathStartIdx >= 0) {
          var si = segments.length;
          segments.push({ start: curIdx, end: subpathStartIdx, tangentStart: { x: 0, y: 0 }, tangentEnd: { x: 0, y: 0 } });
          currentSubpathSegs.push(si);
        }
        // Stash this loop; do NOT create a new Region yet – more subpaths may follow.
        if (currentSubpathSegs.length > 0) {
          pathLoops.push(currentSubpathSegs);
          currentSubpathSegs = [];
        }
        // Reset cursor to subpath start
        curIdx = subpathStartIdx;
        if (subpathStartIdx >= 0) {
          prevX = vertices[subpathStartIdx].x;
          prevY = vertices[subpathStartIdx].y;
        }
      }
    }

    // Flush any trailing open subpath
    if (currentSubpathSegs.length > 0) {
      pathLoops.push(currentSubpathSegs);
    }

    // ONE region per SVG path element, with ALL its loops.
    // This preserves compound-path semantics (e.g. NONZERO ring = outer + inner in one region).
    if (pathLoops.length > 0) {
      regions.push({ windingRule: windingRule, loops: pathLoops });
    }
  }

  if (vertices.length === 0 || segments.length === 0) return null;
  return { vertices: vertices, segments: segments, regions: regions };
}

// Encode VectorNetwork → Figma vectorNetworkBlob (Uint8Array).
// Binary format verified against open-pencil/open-pencil packages/core/src/vector/index.ts:
//   Header:  [numVerts:u32, numSegs:u32, numRegions:u32] = 12 bytes
//   Vertex:  [styleIdx:u32, x:f32, y:f32] = 12 bytes
//   Segment: [styleIdx:u32, start:u32, tsX:f32, tsY:f32, end:u32, teX:f32, teY:f32] = 28 bytes
//   Region:  [windingRule:u32, numLoops:u32, { numSegs:u32, segIdx... }...] variable
function _encodeVectorNetworkBlob(network) {
  var verts = network.vertices;
  var segs  = network.segments;
  var regs  = network.regions;

  var regionBytes = 0;
  for (var r = 0; r < regs.length; r++) {
    regionBytes += 8; // windingRule:u32 + numLoops:u32
    for (var l = 0; l < regs[r].loops.length; l++) {
      regionBytes += 4 + regs[r].loops[l].length * 4; // numSegs:u32 + indices
    }
  }

  var totalBytes = 12 + verts.length * 12 + segs.length * 28 + regionBytes;
  var buf = new ArrayBuffer(totalBytes);
  var dv = new DataView(buf);
  var o = 0;

  dv.setUint32(o, verts.length, true); o += 4;
  dv.setUint32(o, segs.length,  true); o += 4;
  dv.setUint32(o, regs.length,  true); o += 4;

  for (var i = 0; i < verts.length; i++) {
    dv.setUint32(o, 0, true); o += 4; // styleIdx (0 = NONE / no handle mirroring)
    dv.setFloat32(o, verts[i].x, true); o += 4;
    dv.setFloat32(o, verts[i].y, true); o += 4;
  }

  for (var i = 0; i < segs.length; i++) {
    var s = segs[i];
    dv.setUint32(o, 0, true); o += 4; // styleIdx
    dv.setUint32(o, s.start, true); o += 4;
    dv.setFloat32(o, s.tangentStart.x, true); o += 4;
    dv.setFloat32(o, s.tangentStart.y, true); o += 4;
    dv.setUint32(o, s.end, true); o += 4;
    dv.setFloat32(o, s.tangentEnd.x, true); o += 4;
    dv.setFloat32(o, s.tangentEnd.y, true); o += 4;
  }

  for (var i = 0; i < regs.length; i++) {
    var reg = regs[i];
    dv.setUint32(o, reg.windingRule === 'EVENODD' ? 0 : 1, true); o += 4;
    dv.setUint32(o, reg.loops.length, true); o += 4;
    for (var j = 0; j < reg.loops.length; j++) {
      var loop = reg.loops[j];
      dv.setUint32(o, loop.length, true); o += 4;
      for (var k = 0; k < loop.length; k++) {
        dv.setUint32(o, loop[k], true); o += 4;
      }
    }
  }

  return new Uint8Array(buf);
}

// Build complete VECTOR data from SVG content:
//   – fillGeometry blobs (rendering paths, format verified from open-pencil analysis)
//   – vectorNetworkBlob (editable topology)
// Returns { fillGeometry, vectorNetworkBlobIdx } or null on failure.
function buildSvgVectorData(svgContent, blobs) {
  if (!_svgPathDataLib) return null;
  var svgPaths = parseSvgContentToPaths(svgContent);
  if (!svgPaths || !svgPaths.length) return null;

  var fillGeometry = [];
  for (var i = 0; i < svgPaths.length; i++) {
    var sp = svgPaths[i];
    var commands = _normalizeSvgPathToCommands(sp.d, sp.matrix);
    if (!commands || !commands.length) continue;
    var blob = _encodeSvgCommandsToBlob(commands);
    if (!blob) continue;
    var blobIdx = blobs.length;
    blobs.push({ bytes: blob });
    fillGeometry.push({ windingRule: sp.windingRule, commandsBlob: blobIdx });
  }

  if (fillGeometry.length === 0) return null;

  var network = _buildVectorNetworkFromPaths(svgPaths);
  var vectorNetworkBlobIdx = null;
  if (network) {
    var netBlob = _encodeVectorNetworkBlob(network);
    vectorNetworkBlobIdx = blobs.length;
    blobs.push({ bytes: netBlob });
  }

  return { fillGeometry: fillGeometry, vectorNetworkBlobIdx: vectorNetworkBlobIdx };
}

function hasClipPathPolygon(style) {
  return !!(style && Array.isArray(style.clipPathPolygon) && style.clipPathPolygon.length >= 3);
}

function buildClipPathPolygonSvgContent(points, width, height) {
  if (!points || points.length < 3 || !width || !height) return null;
  function _fmt(n) {
    var v = Number(n);
    if (!isFinite(v)) return '0';
    return String(Math.round(v * 1000) / 1000);
  }
  var d = '';
  for (var i = 0; i < points.length; i++) {
    var p = points[i] || {};
    var x = _fmt(p.x);
    var y = _fmt(p.y);
    d += (i === 0 ? 'M ' : ' L ') + x + ' ' + y;
  }
  d += ' Z';
  return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ' + _fmt(width) + ' ' + _fmt(height) + '"><path d="' + d + '"/></svg>';
}

function convertClipPathPolygonBackground(style, guid, parentGuid, siblingIndex, parentLayoutMode, blobs, imageCtxGlobal) {
  if (!hasClipPathPolygon(style)) return null;
  var width = style.width || 0;
  var height = style.height || 0;
  if (!(width > 0 && height > 0)) return null;

  var imageCtx = imageCtxGlobal || { byHash: {} };
  var imageImports = [];
  var imageImportSet = {};
  var paints = irFillsToFigmaPaints(style.fills, blobs, imageCtx, imageImports, imageImportSet);
  if (!paints || !paints.length) return null;

  var svgContent = buildClipPathPolygonSvgContent(style.clipPathPolygon, width, height);
  if (!svgContent) return null;
  var vectorData = buildSvgVectorData(svgContent, blobs);
  if (!vectorData || !vectorData.fillGeometry || !vectorData.fillGeometry.length) return null;

  var nc = {
    guid: guid,
    phase: 'CREATED',
    parentIndex: { guid: parentGuid, position: positionForIndex(siblingIndex) },
    type: 'VECTOR',
    name: 'clip-path-polygon-bg',
    visible: true,
    opacity: 1,
    size: { x: width, y: height },
    transform: makeTransform(0, 0),
    fillPaints: paints,
    fillGeometry: vectorData.fillGeometry,
    vectorData: {
      normalizedSize: { x: width, y: height },
    },
    stackPositioning: 'ABSOLUTE',
  };
  if (vectorData.vectorNetworkBlobIdx != null) {
    nc.vectorData.vectorNetworkBlob = vectorData.vectorNetworkBlobIdx;
  }
  if (imageImports.length) nc.imageImports = { imports: imageImports };

  var stroke = irStrokeToFigma(style);
  var effects = irShadowsToEffects(style.shadows, style.innerShadows);
  var sKeys = Object.keys(stroke);
  for (var i = 0; i < sKeys.length; i++) nc[sKeys[i]] = stroke[sKeys[i]];
  if (effects) nc.effects = effects;
  if (style.alignSelf) nc.stackChildAlignSelf = style.alignSelf;
  if (style.flexGrow >= 1 && parentLayoutMode) nc.stackChildPrimaryGrow = 1;
  return nc;
}

// ─── Auto Layout mapping ───

function irLayoutToFigma(style) {
  if (!style || !style.layoutMode) return {};
  var result = {};
  result.stackMode = style.layoutMode === 'VERTICAL' ? 'VERTICAL' : 'HORIZONTAL';
  if (style.itemSpacing != null) result.stackSpacing = style.itemSpacing;
  if (style.counterAxisSpacing != null) result.stackCounterSpacing = style.counterAxisSpacing;
  if (style.layoutWrap === 'WRAP') result.stackWrap = 'WRAP';

  // stackVerticalPadding = paddingTop, stackHorizontalPadding = paddingLeft
  // stackPaddingRight = paddingRight, stackPaddingBottom = paddingBottom
  if (style.paddingTop != null) result.stackVerticalPadding = style.paddingTop;
  if (style.paddingLeft != null) result.stackHorizontalPadding = style.paddingLeft;
  if (style.paddingRight != null) result.stackPaddingRight = style.paddingRight;
  if (style.paddingBottom != null) result.stackPaddingBottom = style.paddingBottom;

  if (style.primaryAxisAlignItems) result.stackPrimaryAlignItems = style.primaryAxisAlignItems;
  if (style.counterAxisAlignItems) result.stackCounterAlignItems = style.counterAxisAlignItems;

  return result;
}

// ─── Text alignment x-offset helper ───

function computeTextAlignXOffset(textAlignHorizontal, containerWidth, lineWidth) {
  if (textAlignHorizontal === 'CENTER') return Math.max(0, (containerWidth - lineWidth) / 2);
  if (textAlignHorizontal === 'RIGHT') return Math.max(0, containerWidth - lineWidth);
  return 0; // LEFT / JUSTIFIED / default
}

// ─── Glyph blob encoding (Figma binary path format) ───

function encodeGlyphBlob(otGlyph) {
  var pathObj = otGlyph.getPath(0, 0, 1);
  var commands = pathObj.commands;

  var size = 1;
  for (var i = 0; i < commands.length; i++) {
    var c = commands[i];
    switch (c.type) {
      case 'M': size += 1 + 8; break;
      case 'L': size += 1 + 8; break;
      case 'Q': size += 1 + 16; break;
      case 'C': size += 1 + 24; break;
      case 'Z': size += 1; break;
    }
  }

  var buf = new ArrayBuffer(size);
  var u8 = new Uint8Array(buf);
  var dv = new DataView(buf);
  var pos = 0;

  u8[pos++] = 0x00;

  for (var i = 0; i < commands.length; i++) {
    var c = commands[i];
    switch (c.type) {
      case 'M':
        u8[pos++] = 0x01;
        dv.setFloat32(pos, c.x, true); pos += 4;
        dv.setFloat32(pos, -c.y, true); pos += 4;
        break;
      case 'L':
        u8[pos++] = 0x02;
        dv.setFloat32(pos, c.x, true); pos += 4;
        dv.setFloat32(pos, -c.y, true); pos += 4;
        break;
      case 'Q':
        u8[pos++] = 0x03;
        dv.setFloat32(pos, c.x1, true); pos += 4;
        dv.setFloat32(pos, -c.y1, true); pos += 4;
        dv.setFloat32(pos, c.x, true); pos += 4;
        dv.setFloat32(pos, -c.y, true); pos += 4;
        break;
      case 'C':
        u8[pos++] = 0x04;
        dv.setFloat32(pos, c.x1, true); pos += 4;
        dv.setFloat32(pos, -c.y1, true); pos += 4;
        dv.setFloat32(pos, c.x2, true); pos += 4;
        dv.setFloat32(pos, -c.y2, true); pos += 4;
        dv.setFloat32(pos, c.x, true); pos += 4;
        dv.setFloat32(pos, -c.y, true); pos += 4;
        break;
      case 'Z':
        u8[pos++] = 0x00;
        break;
    }
  }

  return u8;
}

// ─── CJK / 全角等：西文字体（Georgia 等）在浏览器里靠 fallback 显示，导出时若仍用该 OpenType 会得到 .notdef，Figma 初渲为方框 ───

function charNeedsCjkFontCoverage(code) {
  return (
    (code >= 0x4e00 && code <= 0x9fff) ||
    (code >= 0x3400 && code <= 0x4dbf) ||
    (code >= 0xf900 && code <= 0xfaff) ||
    (code >= 0xac00 && code <= 0xd7af) ||
    (code >= 0x3000 && code <= 0x303f) ||
    (code >= 0xff00 && code <= 0xffef)
  );
}

function textNeedsCjkFontCoverage(text) {
  if (!text) return false;
  for (var _ti = 0; _ti < text.length; _ti++) {
    if (charNeedsCjkFontCoverage(text.charCodeAt(_ti))) return true;
  }
  return false;
}

/** 对 text 中每个需 CJK 覆盖的码位，用 opentype 单字测量是否得到非 .notdef 字形。 */
function opentypeFontCoversCjkChars(font, text) {
  if (!font || !text) return true;
  for (var _ci = 0; _ci < text.length; _ci++) {
    var _c = text.charCodeAt(_ci);
    if (!charNeedsCjkFontCoverage(_c)) continue;
    var _g;
    try {
      var _arr = font.stringToGlyphs(text.charAt(_ci));
      _g = _arr && _arr[0];
    } catch (_e) {
      return false;
    }
    if (!_g || _g.name === '.notdef') return false;
  }
  return true;
}

function pickFontCtxFromWeightMap(weightMap, clampedWeight) {
  if (!weightMap || typeof weightMap !== 'object') return null;
  var _ctx = weightMap[clampedWeight] || null;
  if (_ctx) return _ctx;
  var _keys = Object.keys(weightMap).map(Number).sort(function(a, b) { return b - a; });
  for (var _ki = 0; _ki < _keys.length; _ki++) {
    if (_keys[_ki] <= clampedWeight) return weightMap[_keys[_ki]];
  }
  return _keys.length ? weightMap[_keys[_keys.length - 1]] : null;
}

// ─── Text measurement with opentype.js ───

// letterSpacing: CSS letter-spacing in pixels (already resolved by style-builder)
// Each glyph x position includes accumulated letter-spacing so blob positions are correct.
function measureTextWithFont(text, fontSize, font, letterSpacing) {
  var ls = typeof letterSpacing === 'number' ? letterSpacing : 0;
  var scale = fontSize / font.unitsPerEm;
  var otGlyphs = font.stringToGlyphs(text);
  var glyphData = [];
  var x = 0;
  var hasVisualBBox = false;
  var visualYMinUnits = Infinity;
  var visualYMaxUnits = -Infinity;

  for (var i = 0; i < otGlyphs.length; i++) {
    var g = otGlyphs[i];
    var advance = (g.advanceWidth || font.unitsPerEm) * scale;
    try {
      // 统计文本字形真实包围盒（字体坐标系，y 轴向上），用于紧行高场景的视觉居中补偿。
      var gb = g && g.getBoundingBox ? g.getBoundingBox() : null;
      if (gb && isFinite(gb.y1) && isFinite(gb.y2) && (gb.y2 > gb.y1)) {
        hasVisualBBox = true;
        if (gb.y1 < visualYMinUnits) visualYMinUnits = gb.y1;
        if (gb.y2 > visualYMaxUnits) visualYMaxUnits = gb.y2;
      }
    } catch (_bboxErr) {}
    glyphData.push({
      otGlyph: g,
      x: x,
      advance: advance + ls,
      advanceNorm: (g.advanceWidth || font.unitsPerEm) / font.unitsPerEm,
    });
    // letter-spacing is added after each glyph (CSS spec: space to the right of each character)
    x += advance + ls;
    if (i < otGlyphs.length - 1) {
      x += font.getKerningValue(otGlyphs[i], otGlyphs[i + 1]) * scale;
    }
  }

  var ascender = font.ascender * scale;
  var descender = Math.abs(font.descender) * scale;
  var visualCenterOffsetFromBaseline = null;
  if (hasVisualBBox) {
    // 将字体坐标系(y向上)换算到 Figma 文本基线坐标：baseline = centerY + offset
    // offset = ((yMax + yMin) / 2) * scale
    visualCenterOffsetFromBaseline = ((visualYMaxUnits + visualYMinUnits) / 2) * scale;
  }

  return {
    totalWidth: x,
    lineHeight: ascender + descender,
    ascender: ascender,
    descender: descender,
    visualCenterOffsetFromBaseline: visualCenterOffsetFromBaseline,
    glyphs: glyphData,
  };
}

// ─── Core: Convert single IR node → Figma NodeChange ───

function convertNode(irNode, parentGuid, siblingIndex, fontCtxMap, blobs, parentLayoutMode, imageCtxGlobal) {
  if (!irNode) return [];

  var type = irNode.type;
  var style = irNode.style || {};
  var guid = nextGuid();
  var changes = [];

  if (type === 'text') {
    changes.push(convertTextNode(irNode, guid, parentGuid, siblingIndex, fontCtxMap, blobs, parentLayoutMode));
  } else if (type === 'svg') {
    var _svgStyle0 = irNode.style || {};
    var _intr0 = extractSvgIntrinsicSize(_svgStyle0.svgContent);
    var _svgW0 = _svgStyle0.width || (_intr0 && _intr0.width) || 24;
    var _svgH0 = _svgStyle0.height || (_intr0 && _intr0.height) || 24;
    var _svgTextIrs = parseSvgContentToTextIrNodes(_svgStyle0.svgContent, _svgW0, _svgH0);
    if (_svgTextIrs && _svgTextIrs.length) {
      var wrapGuid0 = nextGuid();
      var wrapNc0 = {
        guid: wrapGuid0,
        phase: 'CREATED',
        parentIndex: { guid: parentGuid, position: positionForIndex(siblingIndex) },
        type: 'FRAME',
        name: withSyncTag(irNode.name, irNode, 'svg'),
        visible: true,
        opacity: _svgStyle0.opacity != null ? _svgStyle0.opacity : 1,
        size: { x: _svgW0, y: _svgH0 },
        transform: makeTransform(_svgStyle0.x || 0, _svgStyle0.y || 0, _svgStyle0.rotation),
        fillPaints: [],
        frameMaskDisabled: false,
      };
      if (_svgStyle0.positionType === 'absolute') wrapNc0.stackPositioning = 'ABSOLUTE';
      if (_svgStyle0.alignSelf) wrapNc0.stackChildAlignSelf = _svgStyle0.alignSelf;
      if (_svgStyle0.flexGrow >= 1 && parentLayoutMode) wrapNc0.stackChildPrimaryGrow = 1;
      changes.push(wrapNc0);
      var vecGuid0 = nextGuid();
      var irForVec0 = Object.assign({}, irNode, {
        style: Object.assign({}, _svgStyle0, { x: 0, y: 0 }),
      });
      changes.push(convertSvgNode(irForVec0, vecGuid0, wrapGuid0, 0, null, blobs, imageCtxGlobal));
      for (var _sti0 = 0; _sti0 < _svgTextIrs.length; _sti0++) {
        changes.push(convertTextNode(_svgTextIrs[_sti0], nextGuid(), wrapGuid0, 1 + _sti0, fontCtxMap, blobs, null));
      }
    } else {
      changes.push(convertSvgNode(irNode, guid, parentGuid, siblingIndex, parentLayoutMode, blobs, imageCtxGlobal));
    }
  } else if (type === 'image') {
    changes.push(convertImageNode(irNode, guid, parentGuid, siblingIndex, parentLayoutMode, blobs, imageCtxGlobal));
  } else if (type === 'figma-instance') {
    var inst = convertInstanceNode(irNode, guid, parentGuid, siblingIndex);
    if (inst) {
      changes.push(inst);
    } else {
      // 模板中找不到对应 componentKey，降级为普通 frame 绘制
      changes.push(convertFrameNode(irNode, guid, parentGuid, siblingIndex, parentLayoutMode, blobs, imageCtxGlobal));
    }
  } else {
    var frameChange = convertFrameNode(irNode, guid, parentGuid, siblingIndex, parentLayoutMode, blobs, imageCtxGlobal);
    changes.push(frameChange);

    var myLayoutMode = style.layoutMode || null;
    var childIndexOffset = 0;
    if (hasClipPathPolygon(style)) {
      var clipPolygonBg = convertClipPathPolygonBackground(style, nextGuid(), guid, 0, myLayoutMode, blobs, imageCtxGlobal);
      if (clipPolygonBg) {
        changes.push(clipPolygonBg);
        childIndexOffset = 1;
      }
    }
    if (irNode.children && irNode.children.length) {
      var orderedChildren = sortChildrenByZIndex(irNode.children, myLayoutMode);
      for (var i = 0; i < orderedChildren.length; i++) {
        var childChanges = convertNode(orderedChildren[i], guid, i + childIndexOffset, fontCtxMap, blobs, myLayoutMode, imageCtxGlobal);
        for (var j = 0; j < childChanges.length; j++) {
          changes.push(childChanges[j]);
        }
      }
    }
  }

  return changes;
}

// ─── Figma 组件库实例节点转换 ───
// 将 IR 中 type='figma-instance' 的节点转为 Figma INSTANCE NodeChange。
// 依赖 _componentTemplate 的 componentKeyIndex 查 symbolGuid；找不到时返回 null（调用方降级为 frame）。
function convertInstanceNode(irNode, guid, parentGuid, siblingIndex) {
  var ck = irNode.figmaComponentKey;
  var tpl = _componentTemplate;
  var entry = tpl && tpl.componentKeyIndex && tpl.componentKeyIndex[ck];
  if (!entry) return null;

  var symbolGuid = { sessionID: entry.sessionID, localID: entry.localID };
  var style = irNode.style || {};
  var instanceText = irNode.name || 'Instance';
  var instanceNodeName = withSyncTag(instanceText, irNode, 'Instance');

  var symData = { symbolID: symbolGuid, uniformScaleFactor: 1 };

  if (entry.textOverrideKey && instanceText) {
    symData.symbolOverrides = [{
      guidPath: { guids: [entry.textOverrideKey] },
      textData: {
        characters: instanceText,
        lines: [{ lineType: 'PLAIN', styleId: 0, indentationLevel: 0,
                  sourceDirectionality: 'AUTO', listStartOffset: 0, isFirstLineOfList: false }],
      },
      textUserLayoutVersion: 5,
      textExplicitLayoutVersion: 1,
    }];
  }

  return {
    guid: guid,
    phase: 'CREATED',
    type: 'INSTANCE',
    name: instanceNodeName,
    parentIndex: { guid: parentGuid, position: positionForIndex(siblingIndex) },
    transform: makeTransform(style.x || 0, style.y || 0),
    size: { x: style.width ?? 100, y: style.height ?? 32 },
    symbolData: symData,
    visible: true,
    opacity: 1,
    blendMode: 'NORMAL',
    stackPositioning: 'AUTO',
  };
}

function convertSvgNode(irNode, guid, parentGuid, siblingIndex, parentLayoutMode, blobs, imageCtxGlobal) {
  var style = irNode.style || {};
  var svgContent = style.svgContent;
  var intrinsic = extractSvgIntrinsicSize(svgContent);

  var width = style.width || (intrinsic && intrinsic.width) || 24;
  var height = style.height || (intrinsic && intrinsic.height) || 24;

  // Detect stroke-based (线性) SVG: fill="none" at root + stroke color.
  // These icons must use strokePaints (not fillPaints) so open paths render as
  // lines, not auto-closed filled regions.
  var svgStrokeMode = detectSvgStrokeMode(svgContent);

  var fallbackPaint = extractSvgFallbackPaint(svgContent);
  var imageCtx = imageCtxGlobal || { byHash: {} };
  var imageImports = [];
  var imageImportSet = {};
  // Stroke-based icons have no fill; skip irFillsToFigmaPaints so DOM background
  // colors (if any) don't accidentally produce a fill on top of the stroke paths.
  var paints = svgStrokeMode
    ? []
    : irFillsToFigmaPaints(style.fills, blobs, imageCtx, imageImports, imageImportSet);
  // 矢量几何来自 path/circle，但 DOM 上 <svg> 的 fills 常为透明；fill="url(#…)" 须在 defs 里解析渐变。
  if (!svgStrokeMode && svgContent) {
    var _svgDefGradIr = extractSvgPrimaryPaintAsIrFill(svgContent);
    if (_svgDefGradIr) {
      var _svgDefPaints = irFillsToFigmaPaints([_svgDefGradIr], blobs, imageCtx, imageImports, imageImportSet);
      if (_svgDefPaints && _svgDefPaints.length) paints = _svgDefPaints;
    }
  }
  if (!svgStrokeMode && (!paints || !paints.length)) {
    paints = fallbackPaint ? [fallbackPaint] : [{
      type: 'SOLID',
      color: { r: 0.8, g: 0.8, b: 0.8, a: 1 },
      opacity: 1,
      visible: true,
      blendMode: 'NORMAL',
    }];
  }

  // Parse SVG paths into VECTOR node data (fillGeometry + vectorNetworkBlob).
  // Format verified against open-pencil's real Figma .fig decoder.
  var svgVectorData = svgContent ? buildSvgVectorData(svgContent, blobs) : null;
  var isRealVector = !!(svgVectorData && svgVectorData.fillGeometry && svgVectorData.fillGeometry.length);

  var nc = {
    guid: guid,
    phase: 'CREATED',
    parentIndex: { guid: parentGuid, position: positionForIndex(siblingIndex) },
    type: isRealVector ? 'VECTOR' : 'RECTANGLE',
    name: withSyncTag(irNode.name, irNode, 'SVG'),
    visible: true,
    opacity: style.opacity != null ? style.opacity : 1,
    size: { x: width, y: height },
    transform: makeTransform(style.x || 0, style.y || 0, style.rotation),
    fillPaints: paints,
  };

  // For stroke-based SVG icons, wire up strokePaints + strokeWeight so Figma
  // renders open paths as lines rather than filled shapes.
  if (svgStrokeMode && isRealVector) {
    nc.strokePaints = [svgStrokeMode.strokePaint];
    // Scale stroke-width from SVG viewBox space to rendered pixel space,
    // so the visual weight matches the browser rendering.
    var _vb = extractSvgViewBox(svgContent);
    var _vbDim = _vb ? Math.max(_vb.width, _vb.height) : Math.max(width, height);
    var _nodeDim = Math.max(width, height);
    var _scaledSw = (_vbDim > 0 && _nodeDim > 0)
      ? svgStrokeMode.strokeWidth * _nodeDim / _vbDim
      : svgStrokeMode.strokeWidth;
    nc.strokeWeight = Math.max(0.5, _scaledSw);
    nc.strokeCap = svgStrokeMode.strokeCap;
    nc.strokeJoin = svgStrokeMode.strokeJoin;
    nc.strokeAlign = 'CENTER';
  }

  if (isRealVector) {
    nc.fillGeometry = svgVectorData.fillGeometry;
    // normalizedSize = full coordinate space of the SVG viewBox [0 .. minX+width, 0 .. minY+height].
    // Must include minX/minY so paths with an offset origin (e.g. "64 64 896 896") map correctly.
    var vb = extractSvgViewBox(svgContent);
    var normW = vb ? (vb.minX + vb.width) : width;
    var normH = vb ? (vb.minY + vb.height) : height;
    nc.vectorData = { normalizedSize: { x: normW, y: normH } };
    if (svgVectorData.vectorNetworkBlobIdx != null) {
      nc.vectorData.vectorNetworkBlob = svgVectorData.vectorNetworkBlobIdx;
    }
  }

  var stroke = irStrokeToFigma(style);
  var radius = irBorderRadius(style);
  var effects = irShadowsToEffects(style.shadows, style.innerShadows);
  var sKeys = Object.keys(stroke);
  for (var i = 0; i < sKeys.length; i++) nc[sKeys[i]] = stroke[sKeys[i]];
  var rKeys = Object.keys(radius);
  for (var j = 0; j < rKeys.length; j++) nc[rKeys[j]] = radius[rKeys[j]];
  if (effects) nc.effects = effects;
  if (imageImports.length) nc.imageImports = { imports: imageImports };

  if (style.positionType === 'absolute') {
    nc.stackPositioning = 'ABSOLUTE';
  }
  if (style.alignSelf) {
    nc.stackChildAlignSelf = style.alignSelf;
  }
  if (style.flexGrow >= 1 && parentLayoutMode) {
    nc.stackChildPrimaryGrow = 1;
  }

  return nc;
}

function convertFrameNode(irNode, guid, parentGuid, siblingIndex, parentLayoutMode, blobs, imageCtxGlobal) {
  var style = irNode.style || {};
  var hasClipPolygon = hasClipPathPolygon(style);
  var stroke = hasClipPolygon ? {} : irStrokeToFigma(style);
  var radius = hasClipPolygon ? {} : irBorderRadius(style);
  var layout = irLayoutToFigma(style);
  var effects = hasClipPolygon ? null : irShadowsToEffects(style.shadows, style.innerShadows);
  var imageCtx = imageCtxGlobal || { byHash: {} };
  var imageImports = [];
  var imageImportSet = {};

  var nc = {
    guid: guid,
    phase: 'CREATED',
    parentIndex: { guid: parentGuid, position: positionForIndex(siblingIndex) },
    type: 'FRAME',
    name: withSyncTag(irNode.name, irNode, 'Frame'),
    visible: true,
    opacity: style.opacity != null ? style.opacity : 1,
    size: { x: style.width ?? 100, y: style.height ?? 100 },
    transform: makeTransform(style.x || 0, style.y || 0, style.rotation),
    fillPaints: hasClipPolygon ? [] : irFillsToFigmaPaints(style.fills, blobs, imageCtx, imageImports, imageImportSet),
    frameMaskDisabled: style.clipsContent === false,
  };

  var sKeys = Object.keys(stroke);
  for (var i = 0; i < sKeys.length; i++) nc[sKeys[i]] = stroke[sKeys[i]];

  var rKeys = Object.keys(radius);
  for (var i = 0; i < rKeys.length; i++) nc[rKeys[i]] = radius[rKeys[i]];

  var lKeys = Object.keys(layout);
  for (var i = 0; i < lKeys.length; i++) nc[lKeys[i]] = layout[lKeys[i]];

  if (effects) nc.effects = effects;
  if (imageImports.length) nc.imageImports = { imports: imageImports };

  // ─── P0: Layout Sizing — 使用 v3+ 字段 stackPrimarySizing/stackCounterSizing ───
  var hasAutoLayout = !!style.layoutMode;
  if (hasAutoLayout) {
    var isHorizontal = style.layoutMode === 'HORIZONTAL';
    var hSizing = (style.layoutSizingHorizontal === 'HUG') ? 'RESIZE_TO_FIT' : 'FIXED';
    var vSizing = (style.layoutSizingVertical === 'HUG') ? 'RESIZE_TO_FIT' : 'FIXED';
    nc.stackPrimarySizing = isHorizontal ? hSizing : vSizing;
    nc.stackCounterSizing = isHorizontal ? vSizing : hSizing;
  }

  // ─── P3: flex-grow → 主轴 FILL ───
  if (style.flexGrow >= 1 && parentLayoutMode) {
    nc.stackChildPrimaryGrow = 1;
  }

  // ─── P0: Absolute positioning ───
  if (style.positionType === 'absolute') {
    nc.stackPositioning = 'ABSOLUTE';
  }

  // ─── P0: Child alignment (alignSelf / stretch / margin:auto centering) ───
  if (style.alignSelf) {
    nc.stackChildAlignSelf = style.alignSelf;
  } else if (style.alignSelfStretch && parentLayoutMode) {
    nc.stackChildAlignSelf = 'STRETCH';
  } else if (style._marginAutoH) {
    nc.stackChildAlignSelf = 'CENTER';
  }

  // ─── P2: minSize / maxSize constraints ───
  if (style.minWidth != null || style.minHeight != null) {
    nc.minSize = { value: { x: style.minWidth || 0, y: style.minHeight || 0 } };
  }
  if (style.maxWidth != null || style.maxHeight != null) {
    var _mw = (style.maxWidth != null && style.maxWidth > 0) ? style.maxWidth : null;
    var _mh = (style.maxHeight != null && style.maxHeight > 0) ? style.maxHeight : null;
    // CSS max-width:100% 可能被误转为 100px，当 maxSize 远小于实际 size 时丢弃
    if (_mw != null && style.width != null && _mw < style.width * 0.5) _mw = null;
    if (_mh != null && style.height != null && _mh < style.height * 0.5) _mh = null;
    if (_mw != null || _mh != null) {
      // 未约束的维度用极大值而非 0，避免 Figma 将该维度压缩到 0
      nc.maxSize = { value: { x: _mw || 100000, y: _mh || 100000 } };
    }
  }

  return nc;
}

function convertTextNode(irNode, guid, parentGuid, siblingIndex, fontCtxMap, blobs, parentLayoutMode) {
  var style = irNode.style || {};
  var content = irNode.content || '';
  var fontName = resolveFontName(
    style.fontFamily,
    style.fontWeight,
    style.fontStyle === 'italic'
  );

  var textColor = style.color ? irColorToFigma(style.color) : { r: 0, g: 0, b: 0, a: 1 };
  var fillPaints = textColor ? [{
    type: 'SOLID',
    color: { r: textColor.r, g: textColor.g, b: textColor.b, a: 1 },
    opacity: textColor.a,
    visible: true,
    blendMode: 'NORMAL',
  }] : undefined;

  var fontSize = style.fontSize || 14;
  var lineHeightVal = style.lineHeight || (fontSize * 1.4);

  // 从 fontCtxMap 中选出与当前字体族 + 字重最匹配的 FontContext。
  // 格式：{ 'PingFang SC': { 300: ctx, 400: ctx }, 'DingTalk JinBuTi': { 400: ctx } }
  // 注意：font-loader 以 CSS font-family 名（如 "AlibabaPuHuiTi-115-Black"）为 key 存入 map，
  //       但 resolveFontName / resolveKnownFont 已将 fontName.family 转为 Figma 名（"Alibaba PuHuiTi 3.0"）。
  //       两者不同时，需用原始 CSS 名（style.fontFamily）作为备选 key。
  var _clampedWeight = Math.min(style.fontWeight || 400, 900);
  var resolvedFontCtx = null;
  // _fontFellBackToPingFang：目标字体不在 fontCtxMap 中，实际使用了 PingFang SC 兜底。
  // 置 true 时，稍后会将 fontName 同步切换到 PingFang SC，避免 Figma 报 Missing font。
  var _fontFellBackToPingFang = false;
  if (fontCtxMap && typeof fontCtxMap === 'object') {
    var _targetFamily = fontName.family || 'PingFang SC';
    var _familyMap = fontCtxMap[_targetFamily] || null;
    if (!_familyMap && style.fontFamily && style.fontFamily !== _targetFamily) {
      _familyMap = fontCtxMap[style.fontFamily] || null;
    }
    if (!_familyMap) {
      _familyMap = fontCtxMap['PingFang SC'] || fontCtxMap[Object.keys(fontCtxMap)[0]] || null;
      if (_familyMap && _targetFamily !== 'PingFang SC') {
        _fontFellBackToPingFang = true;
      }
    }
    if (_familyMap && typeof _familyMap === 'object') {      resolvedFontCtx = _familyMap[_clampedWeight] || null;
      if (!resolvedFontCtx) {
        // 向下取整找最近可用字重
        var _availableWeights = Object.keys(_familyMap).map(Number).sort(function(a, b) { return b - a; });
        for (var _wi = 0; _wi < _availableWeights.length; _wi++) {
          if (_availableWeights[_wi] <= _clampedWeight) {
            resolvedFontCtx = _familyMap[_availableWeights[_wi]];
            break;
          }
        }
        // 仍未找到则用最小可用字重
        if (!resolvedFontCtx && _availableWeights.length > 0) {
          resolvedFontCtx = _familyMap[_availableWeights[_availableWeights.length - 1]];
        }
      }
    }
  }

  // 目标字体缺失时，统一将 fontName 切换到 PingFang SC，避免 Figma 弹出 "Missing font" 对话框。
  // 两种情况均覆盖：
  //   A) _fontFellBackToPingFang=true：fontCtxMap 有 PingFang SC 但没有目标字体（有字形数据）
  //   B) fontCtxMap 完全没有目标字体（含 map 为空的情况，无字形数据，Figma 用自身渲染引擎）
  //   注意：不依赖 resolvedFontCtx，即使 CDN 加载失败也能保证 fontName 正确
  var _targetNotInMap = fontCtxMap &&
    _targetFamily !== 'PingFang SC' &&
    !fontCtxMap[_targetFamily] &&
    !(style.fontFamily && style.fontFamily !== _targetFamily && fontCtxMap[style.fontFamily]);
  if (_fontFellBackToPingFang || _targetNotInMap) {
    fontName = resolveFontName('PingFang SC', style.fontWeight || 400, style.fontStyle === 'italic');
  }

  // CSS font-family 可能是 PostScript 名（如 "AlibabaPuHuiTi-115-Black"），
  // font-loader 在 PostScript 兜底匹配时会把实际 Figma 字体族/样式存入 figmaFamily/figmaStyle。
  // 有这两个字段时，优先用它们覆盖 resolveFontName 计算出的 fontName，确保 Figma 显示正确字体。
  if (resolvedFontCtx && resolvedFontCtx.figmaFamily) {
    // figmaFamily 来自实际加载的字体，但 ctx.postscript 可能仍是模板默认值（如 Noto + PingFangSC-Regular 混用），
    // 会与节点 fontName 不一致，导致 derivedTextData 首帧与双击编辑后重排漂移。
    var _figFam0 = resolvedFontCtx.figmaFamily;
    var _synFromFigmaFam = resolveFontName(_figFam0, style.fontWeight || 400, style.fontStyle === 'italic');
    fontName = {
      family: _figFam0,
      style: resolvedFontCtx.figmaStyle || resolvedFontCtx.style || _synFromFigmaFam.style,
      postscript: _synFromFigmaFam.postscript || resolvedFontCtx.postscript || fontName.postscript,
    };
  }

  // 内容与 CSS font-family 不一致：浏览器用系统 CJK fallback，OpenType 仍用 Georgia 等会得到 .notdef → Figma 豆腐块。
  if (
    resolvedFontCtx &&
    resolvedFontCtx.font &&
    content &&
    textNeedsCjkFontCoverage(content) &&
    !opentypeFontCoversCjkChars(resolvedFontCtx.font, content) &&
    fontCtxMap &&
    typeof fontCtxMap['PingFang SC'] === 'object'
  ) {
    var _pfCtx = pickFontCtxFromWeightMap(fontCtxMap['PingFang SC'], _clampedWeight);
    if (_pfCtx && _pfCtx.font && _pfCtx.fontDigest && _pfCtx !== resolvedFontCtx) {
      resolvedFontCtx = _pfCtx;
      fontName = resolveFontName('PingFang SC', style.fontWeight || 400, style.fontStyle === 'italic');
    }
  }

  var hasFontCtx = resolvedFontCtx && resolvedFontCtx.font && resolvedFontCtx.fontDigest && blobs && content;
  var measured = null;
  if (hasFontCtx) {
    try {
      measured = measureTextWithFont(content, fontSize, resolvedFontCtx.font, style.letterSpacing || 0);
    } catch (_e) {
      measured = null;
    }
  }

  var hasExplicitWidth = style.width != null && style.width > 0;
  var nodeWidth;
  if (hasExplicitWidth) {
    nodeWidth = style.width;
  } else if (measured) {
    nodeWidth = Math.ceil(measured.totalWidth);
  } else {
    nodeWidth = 100;
  }

  // 多行文本检测（content 含 \n 换行符）
  var _contentLines = content.split('\n');
  var _isMultiLine = _contentLines.length > 1;

  var nodeHeight;
  if (_isMultiLine) {
    // 多行行间距必须使用 CSS line-height（style.lineHeight），不能用 measured.lineHeight。
    // measured.lineHeight = opentype ascender+descender（字体包围盒），对 PingFang SC 等 CJK 字体
    // 远小于 CSS 行高（如 fontSize=14 时约 10px vs CSS 20px），会导致多行字形严重重叠，
    // Figma 初始渲染看不出换行，双击重渲后才正常。
    if (style.lineHeight) lineHeightVal = style.lineHeight;
    // 多行高度 = 行数 × 单行行高
    nodeHeight = _contentLines.length * lineHeightVal;
    // 多行文本需要固定宽度（如 style 无宽度则用兜底值）
    if (!hasExplicitWidth) nodeWidth = style.width ?? 200;
  } else {
    // 单行：不要用 Opentype ascender+descender 覆盖 IR 里的高度/行高，否则 Figma 框普遍比浏览器 getBoundingClientRect 高
    // （如 17px vs 12px）；多行分支已在上方强制用 CSS line-height。
    var _hasCssLh = style.lineHeight != null && style.lineHeight > 0;
    if (style.height != null && style.height > 0) {
      nodeHeight = Math.round(style.height);
    } else if (measured) {
      nodeHeight = Math.ceil(measured.lineHeight);
    } else {
      nodeHeight = 20;
    }
    if (measured && !_hasCssLh) {
      lineHeightVal = Math.ceil(measured.lineHeight);
    }
    if (!_hasCssLh && (style.height != null && style.height > 0)) {
      lineHeightVal = Math.round(style.height);
    }
  }

  var textAutoResize = hasExplicitWidth ? 'NONE' : 'WIDTH_AND_HEIGHT';
  if (_isMultiLine) {
    // 多行：宽度固定，高度随内容自适应
    textAutoResize = 'HEIGHT';
  }

  // ── 富文本颜色范围（来自 inline span 子节点的 colorRuns）──
  // characterStyleIDs: 长度 = content.length，0 = 默认颜色，非零 = styleOverrideTable 条目的 styleID
  // styleOverrideTable: NodeChange 数组，每条有 styleID + fillPaints 覆写颜色
  var _charStyleIDs = null;  // Array<uint>
  var _styleOverrides = null; // Array<{ styleID, fillPaints }>
  if (style.colorRuns && style.colorRuns.length > 0) {
    _charStyleIDs = new Array(content.length).fill(0);
    _styleOverrides = [];
    for (var _cri = 0; _cri < style.colorRuns.length; _cri++) {
      var _cr = style.colorRuns[_cri];
      var _crStyleID = _cri + 1; // 1-indexed，0 保留给默认样式
      for (var _crcIdx = Math.max(0, _cr.start); _crcIdx < _cr.end && _crcIdx < content.length; _crcIdx++) {
        _charStyleIDs[_crcIdx] = _crStyleID;
      }
      var _crPaint = makeSolidPaint(_cr.color);
      _styleOverrides.push({
        styleID: _crStyleID,
        fillPaints: _crPaint ? [_crPaint] : undefined,
      });
    }
  }

  var _textAlignVertical = style.textAlignVertical;
  // 兜底：部分单行标签文本在 DOM 里通过父容器几何形成视觉居中，但未显式打标 textAlignVertical。
  // 旧逻辑用比例阈值（1.12）会漏掉“仅高 1~2px”的常见场景，导致首帧贴顶、双击后回正。
  // 改为像素差阈值：单行文本只要盒高明显大于行高（>0.5px），默认按 CENTER 处理。
  if (!_textAlignVertical && !_isMultiLine && nodeHeight > 0 && lineHeightVal > 0 && (nodeHeight - lineHeightVal) > 0.5) {
    _textAlignVertical = 'CENTER';
  }
  if (!_textAlignVertical) _textAlignVertical = 'TOP';
  // 盒高 < 行高（表头/单元格 textRect 压扁、line-height 仍大）时，IR 常为 TOP，但浏览器单行在该盒内等价于行框垂直居中裁切；
  // 保持 TOP 会导致 derived 顶对齐、字形挤向一侧。升成 CENTER，与下方 (nh-lh)/2 行框偏移一致。
  if (!_isMultiLine && nodeHeight > 0 && lineHeightVal > 0 && nodeHeight < lineHeightVal - 0.25 && _textAlignVertical === 'TOP') {
    _textAlignVertical = 'CENTER';
  }

  // SVG <text text-anchor="middle">：锚点在 lx，盒宽应为测量宽度，transform.x = lx - nodeWidth/2
  var _textTransformX = style.x != null && isFinite(style.x) ? style.x : 0;
  if (style.textAnchorCenterX != null && isFinite(style.textAnchorCenterX)) {
    _textTransformX = style.textAnchorCenterX - nodeWidth / 2;
  }

  var nc = {
    guid: guid,
    phase: 'CREATED',
    parentIndex: { guid: parentGuid, position: positionForIndex(siblingIndex) },
    type: 'TEXT',
    name: withSyncTag(content.slice(0, 30) || 'Text', irNode, 'Text'),
    visible: true,
    opacity: style.opacity != null ? style.opacity : 1,
    size: { x: nodeWidth, y: nodeHeight },
    transform: makeTransform(_textTransformX, style.y || 0, style.rotation),
    strokeWeight: 1,
    strokeAlign: 'OUTSIDE',
    strokeJoin: 'MITER',
    fillPaints: fillPaints,
    textData: (function() {
      var _td = {
        characters: content,
        lines: (function() {
          var _lo = { lineType: 'PLAIN', styleId: 0, indentationLevel: 0, sourceDirectionality: 'AUTO', listStartOffset: 0, isFirstLineOfList: false };
          if (!_isMultiLine) return [_lo];
          return _contentLines.map(function() { return _lo; });
        })(),
      };
      // 富文本：同一 text 节点内不同字符的颜色覆写
      if (_charStyleIDs) _td.characterStyleIDs = _charStyleIDs;
      if (_styleOverrides) _td.styleOverrideTable = _styleOverrides;
      return _td;
    })(),
    fontName: fontName,
    fontSize: fontSize,
    textAlignVertical: _textAlignVertical,
    // 保留 name 里的 [mb:selector] 同步标签，避免 Figma 编辑后自动改名丢标签
    autoRename: false,
    textAutoResize: textAutoResize,
    fontVariantCommonLigatures: true,
    fontVariantContextualLigatures: true,
    letterSpacing: style.letterSpacing ? { value: style.letterSpacing, units: 'PIXELS' } : { value: 0, units: 'PIXELS' },
    lineHeight: { value: lineHeightVal, units: 'PIXELS' },
    textBidiVersion: 1,
  };

  if (style.singleLine) {
    nc.maxLines = 1;
  }
  if (style.textOverflow === 'ellipsis') {
    nc.textTruncation = 'ENDING';
    // Figma truncation requires fixed width — auto-resize WIDTH_AND_HEIGHT
    // would expand to fit all text, never truncating. Force to HEIGHT-only.
    if (nc.textAutoResize === 'WIDTH_AND_HEIGHT') {
      nc.textAutoResize = 'HEIGHT';
    }
  }

  if (measured) {
    nc.textUserLayoutVersion = 4;

    var figmaGlyphs = [];
    var figmaBaselines = [];
    var _truncationStartIdx = -1;
    // 单行：CSS/DOM 行高与 OpenType measured.lineHeight 不一致时，缩放字形 y 与 lineAscent，并使 fontLineHeight 与 lineHeightVal 一致，
    // 否则 derivedTextData 与 nc.lineHeight 矛盾，Figma 初渲需双击才按行高重排。
    var _slAscY = measured.ascender;
    var _slLineAsc = measured.ascender;
    if (!_isMultiLine && lineHeightVal > 0 && measured.lineHeight > 0.001) {
      var __lhRat = lineHeightVal / measured.lineHeight;
      _slAscY = measured.ascender * __lhRat;
      _slLineAsc = _slAscY;
    }
    // 单行 CENTER/BOTTOM：行框在盒内的起点 = (nh-lh)/2 或 nh-lh。须覆盖「盒高 < 行高」（表格压扁单元格 + buildInlineTextStyle 写 textRect.height），
    // 否则旧条件仅 nh > lh+0.25 才偏移，nh<lh 时 _slLineY 恒为 0 → 字形在矮盒内贴底；父级 Auto Layout 仍能把外框居中，框内却偏。
    var _slLineY = 0;
    var _tavSl = _textAlignVertical;
    if (!_isMultiLine && (_tavSl === 'CENTER' || _tavSl === 'BOTTOM')) {
      if (_tavSl === 'CENTER') {
        _slLineY = (nodeHeight - lineHeightVal) / 2;
      } else {
        _slLineY = nodeHeight - lineHeightVal;
      }
    }
    var _slGlyphY = _slLineY + _slAscY;
    // 紧行高 + CENTER 的短文案（如 pill/tag）中，字体 ascender 方案会出现视觉偏上；
    // 改用字形 bbox 视觉中心对齐，贴近 Figma 双击后的重排结果。
    if (!_isMultiLine &&
        _tavSl === 'CENTER' &&
        measured.visualCenterOffsetFromBaseline != null &&
        lineHeightVal > 0 &&
        fontSize > 0 &&
        lineHeightVal <= fontSize * 1.12 &&
        nodeHeight > lineHeightVal + 0.25) {
      var _vcBaseline = (nodeHeight / 2) + measured.visualCenterOffsetFromBaseline;
      var _vcLineY = _vcBaseline - _slLineAsc;
      if (isFinite(_vcLineY)) {
        if (_vcLineY >= 0) {
          _slLineY = _vcLineY;
          _slGlyphY = _slLineY + _slLineAsc;
        } else {
          _slLineY = 0;
          _slGlyphY = _slLineY + _slLineAsc + _vcLineY;
        }
      }
    } else if (!_isMultiLine &&
        _tavSl === 'CENTER' &&
        measured.visualCenterOffsetFromBaseline != null &&
        lineHeightVal > 0 &&
        fontSize > 0 &&
        lineHeightVal > fontSize * 1.12 &&
        ( (nodeHeight >= lineHeightVal - 0.5 && nodeHeight <= lineHeightVal + 1.5) ||
          nodeHeight < lineHeightVal - 0.5 )) {
      // 大行高单行（如 ant-select 占位 line-height≈30、fontSize=14）：盒高≈行高时不会走上面的「(nodeHeight-lineHeight)/2」，
      // 仅用 ascender 缩放会导致 derivedTextData 首帧字形偏下，双击编辑后 Figma 重排才居中。用字形 bbox 视觉中心对齐。
      // 另：盒高 < 行高（如分页 ant-pagination-item > a 内 #text 仅 tight bbox≈16px、CSS line-height=30）时，原先不进本分支，
      // 仅靠 (nh-lh)/2 折入字形仍与 Figma 首帧行框裁切不一致，表现为字形靠下、双击后垂直居中。
      var _vcBaselineTall = (nodeHeight / 2) + measured.visualCenterOffsetFromBaseline;
      var _vcLineYTall = _vcBaselineTall - _slLineAsc;
      if (isFinite(_vcLineYTall)) {
        if (_vcLineYTall >= 0) {
          _slLineY = _vcLineYTall;
          _slGlyphY = _slLineY + _slLineAsc;
        } else {
          _slLineY = 0;
          _slGlyphY = _slLineY + _slLineAsc + _vcLineYTall;
        }
      }
    }

    // 行框起点为负（nh<lh 居中）时，Figma 对 lineY<0 不友好；把偏移并入 glyph y，与紧行高视觉居中负 _vcLineY 处理一致。
    if (!_isMultiLine && _slLineY < 0 && isFinite(_slLineY)) {
      var _negLinePad = _slLineY;
      _slLineY = 0;
      _slGlyphY = _slLineAsc + _negLinePad;
    }

    if (_isMultiLine) {
      // 逐行测量字形，生成多行 baseline
      var _charOffset = 0;
      for (var _li = 0; _li < _contentLines.length; _li++) {
        var _lineText = _contentLines[_li];
        var _lineYBase = _li * lineHeightVal;
        var _lineMeasured = null;
        if (_lineText.length > 0) {
          try { _lineMeasured = measureTextWithFont(_lineText, fontSize, resolvedFontCtx.font, style.letterSpacing || 0); } catch (_e) {}
        }
        var _lineWidth = _lineMeasured ? _lineMeasured.totalWidth : 0;
        var _lineGlyphs = _lineMeasured ? _lineMeasured.glyphs : [];
        var _lineXOffset = computeTextAlignXOffset(style.textAlignHorizontal, nodeWidth, _lineWidth);
        for (var _gi = 0; _gi < _lineGlyphs.length; _gi++) {
          var _gd = _lineGlyphs[_gi];
          var _gblob = encodeGlyphBlob(_gd.otGlyph);
          var _gblobIdx = blobs.length;
          blobs.push({ bytes: _gblob });
          var _glyphObj = {
            commandsBlob: _gblobIdx,
            position: { x: _gd.x + _lineXOffset, y: _lineYBase + measured.ascender },
            fontSize: fontSize,
            firstCharacter: _charOffset + _gi,
            advance: _gd.advanceNorm,
          };
          var _gStyleID = _charStyleIDs ? _charStyleIDs[_charOffset + _gi] : 0;
          if (_gStyleID) _glyphObj.styleID = _gStyleID;
          figmaGlyphs.push(_glyphObj);
        }
        figmaBaselines.push({
          firstCharacter: _charOffset,
          endCharacter: _charOffset + Math.max(_lineText.length - 1, 0),
          position: { x: _lineXOffset, y: _lineYBase + measured.ascender },
          width: _lineWidth,
          lineY: _lineYBase,
          lineHeight: lineHeightVal,
          lineAscent: measured.ascender,
        });
        // +1 跳过 \n 字符（最后一行不加）
        _charOffset += _lineText.length + (_li < _contentLines.length - 1 ? 1 : 0);
      }
    } else {
      // 单行路径：分省略号截断 / 普通两种情况
      var _isEllipsisOverflow = (style.textOverflow === 'ellipsis') && hasExplicitWidth && (measured.totalWidth > nodeWidth);
      if (_isEllipsisOverflow) {
        // ── 省略号截断：计算截断点，生成可见字符字形 + 省略号字形 ──
        var _eFontScale = fontSize / resolvedFontCtx.font.unitsPerEm;
        // 优先使用 Unicode 省略号 '…'；若该字形路径为空（如字体子集不含该字符或为 composite），
        // 降级为 3 个英文句号 '.'，保证初始渲染可见
        var _eRawGlyphs = resolvedFontCtx.font.stringToGlyphs('\u2026');
        var _eHasPath = _eRawGlyphs && _eRawGlyphs.length > 0 &&
          _eRawGlyphs[0].index !== 0 &&
          _eRawGlyphs[0].path && _eRawGlyphs[0].path.commands && _eRawGlyphs[0].path.commands.length > 0;
        var _eOtGlyphs;
        if (_eHasPath) {
          _eOtGlyphs = _eRawGlyphs;
        } else {
          // 降级：用 3 个句号，确保有可见路径
          var _dotG = resolvedFontCtx.font.stringToGlyphs('.')[0];
          _eOtGlyphs = (_dotG && _dotG.index !== 0) ? [_dotG, _dotG, _dotG] : [];
        }
        var _eWidth = 0;
        for (var _emi = 0; _emi < _eOtGlyphs.length; _emi++) {
          _eWidth += (_eOtGlyphs[_emi].advanceWidth || resolvedFontCtx.font.unitsPerEm) * _eFontScale;
        }
        var _availW = Math.max(0, nodeWidth - _eWidth);
        // 若兜底路径也没有（字体极端情况），退出省略号模式走普通单行
        if (_eOtGlyphs.length === 0) {
          var _slXOffset0 = computeTextAlignXOffset(style.textAlignHorizontal, nodeWidth, measured.totalWidth);
          for (var _gi0 = 0; _gi0 < measured.glyphs.length; _gi0++) {
            var _gd0 = measured.glyphs[_gi0];
            var _blob0 = encodeGlyphBlob(_gd0.otGlyph);
            var _blobIdx0 = blobs.length;
            blobs.push({ bytes: _blob0 });
            figmaGlyphs.push({ commandsBlob: _blobIdx0, position: { x: _gd0.x + _slXOffset0, y: _slGlyphY }, fontSize: fontSize, firstCharacter: _gi0, advance: _gd0.advanceNorm });
          }
          figmaBaselines.push({ firstCharacter: 0, endCharacter: Math.max(content.length - 1, 0), position: { x: _slXOffset0, y: _slGlyphY }, width: measured.totalWidth, lineY: _slLineY, lineHeight: lineHeightVal, lineAscent: _slLineAsc });
        } else {
        // 找最后一个右边界不超过 _availW 的字符
        var _truncIdx = 0;
        for (var _tii = 0; _tii < measured.glyphs.length; _tii++) {
          var _tgd = measured.glyphs[_tii];
          if (_tgd.x + _tgd.advance > _availW) break;
          _truncIdx = _tii + 1;
        }
        // 可见部分宽度 + 省略号宽度
        var _visW = (_truncIdx > 0) ? measured.glyphs[_truncIdx - 1].x + measured.glyphs[_truncIdx - 1].advance : 0;
        var _totalTruncW = _visW + _eWidth;
        var _tXOff = computeTextAlignXOffset(style.textAlignHorizontal, nodeWidth, _totalTruncW);
        // 可见字符字形
        for (var _tgi = 0; _tgi < _truncIdx; _tgi++) {
          var _tgd2 = measured.glyphs[_tgi];
          var _tgBlob = encodeGlyphBlob(_tgd2.otGlyph);
          var _tgBlobIdx = blobs.length;
          blobs.push({ bytes: _tgBlob });
          figmaGlyphs.push({
            commandsBlob: _tgBlobIdx,
            position: { x: _tgd2.x + _tXOff, y: _slGlyphY },
            fontSize: fontSize,
            firstCharacter: _tgi,
            advance: _tgd2.advanceNorm,
          });
        }
        // 省略号字形（'…'，firstCharacter 指向截断起始位）
        var _eXStart = _visW + _tXOff;
        for (var _eGi = 0; _eGi < _eOtGlyphs.length; _eGi++) {
          var _eGlyph = _eOtGlyphs[_eGi];
          var _eBlob = encodeGlyphBlob(_eGlyph);
          var _eBlobIdx = blobs.length;
          blobs.push({ bytes: _eBlob });
          var _eAdvNorm = (_eGlyph.advanceWidth || resolvedFontCtx.font.unitsPerEm) / resolvedFontCtx.font.unitsPerEm;
          var _eAdvPx = (_eGlyph.advanceWidth || resolvedFontCtx.font.unitsPerEm) * _eFontScale;
          figmaGlyphs.push({
            commandsBlob: _eBlobIdx,
            position: { x: _eXStart, y: _slGlyphY },
            fontSize: fontSize,
            firstCharacter: _truncIdx,
            advance: _eAdvNorm,
          });
          _eXStart += _eAdvPx;
        }
        figmaBaselines.push({
          firstCharacter: 0,
          endCharacter: Math.max(_truncIdx - 1, 0),
          position: { x: _tXOff, y: _slGlyphY },
          width: _totalTruncW,
          lineY: _slLineY,
          lineHeight: lineHeightVal,
          lineAscent: _slLineAsc,
        });
        _truncationStartIdx = _truncIdx;
        } // end else (_eOtGlyphs.length > 0)
      } else {
        // 普通单行（无截断）
        var _slXOffset = computeTextAlignXOffset(style.textAlignHorizontal, nodeWidth, measured.totalWidth);
        for (var gi = 0; gi < measured.glyphs.length; gi++) {
          var gd = measured.glyphs[gi];
          var blob = encodeGlyphBlob(gd.otGlyph);
          var blobIndex = blobs.length;
          blobs.push({ bytes: blob });
          var _slGlyphObj = {
            commandsBlob: blobIndex,
            position: { x: gd.x + _slXOffset, y: _slGlyphY },
            fontSize: fontSize,
            firstCharacter: gi,
            advance: gd.advanceNorm,
          };
          var _slGStyleID = _charStyleIDs ? _charStyleIDs[gi] : 0;
          if (_slGStyleID) _slGlyphObj.styleID = _slGStyleID;
          figmaGlyphs.push(_slGlyphObj);
        }
        figmaBaselines.push({
          firstCharacter: 0,
          endCharacter: Math.max(content.length - 1, 0),
          position: { x: _slXOffset, y: _slGlyphY },
          width: measured.totalWidth,
          lineY: _slLineY,
          lineHeight: lineHeightVal,
          lineAscent: _slLineAsc,
        });
      }
    }

    nc.derivedTextData = {
      layoutSize: { x: nodeWidth, y: nodeHeight },
      baselines: figmaBaselines,
      glyphs: figmaGlyphs,
      fontMetaData: [{
        // key 须与节点 nc.fontName 及参与 raster 的 fontDigest 一致；优先 fontName（已与 figmaFamily 对齐），
        // 避免 ctx 残留 postscript（如 PingFangSC-Regular）与 Noto Sans 并存导致首帧/编辑态漂移。
        key: {
          family: fontName.family || resolvedFontCtx.figmaFamily || 'PingFang SC',
          style: fontName.style || resolvedFontCtx.figmaStyle || resolvedFontCtx.style || 'Regular',
          postscript: fontName.postscript || resolvedFontCtx.postscript || 'PingFangSC-Regular',
        },
        fontLineHeight: lineHeightVal / fontSize,
        fontDigest: resolvedFontCtx.fontDigest,
        fontStyle: 'NORMAL',
        fontWeight: _clampedWeight,
      }],
      truncationStartIndex: _truncationStartIdx,
      truncatedHeight: -1,
    };
  } else {
    nc.textUserLayoutVersion = 5;
    nc.textExplicitLayoutVersion = 1;
  }

  if (style.textAlignHorizontal) {
    nc.textAlignHorizontal = style.textAlignHorizontal;
  }

  if (style.textDecoration === 'UNDERLINE') {
    nc.textDecoration = 'UNDERLINE';
  } else if (style.textDecoration === 'STRIKETHROUGH') {
    nc.textDecoration = 'STRIKETHROUGH';
  }

  // ─── P0: Text node positioning & alignment ───
  if (style.positionType === 'absolute') {
    nc.stackPositioning = 'ABSOLUTE';
  }
  if (style.alignSelf) {
    nc.stackChildAlignSelf = style.alignSelf;
  } else if (style._marginAutoH) {
    nc.stackChildAlignSelf = 'CENTER';
  }

  // ─── P3: flex-grow → 主轴 FILL ───
  if (style.flexGrow >= 1 && parentLayoutMode) {
    nc.stackChildPrimaryGrow = 1;
  }

  return nc;
}

function convertImageNode(irNode, guid, parentGuid, siblingIndex, parentLayoutMode, blobs, imageCtxGlobal) {
  var style = irNode.style || {};
  var imageCtx = imageCtxGlobal || { byHash: {} };
  var imageImports = [];
  var imageImportSet = {};
  var imgPaint = null;
  if (typeof irNode.content === 'string' && irNode.content.indexOf('data:') === 0) {
    imgPaint = { type: 'IMAGE', content: irNode.content, imageHashHex: irNode.imageHashHex || undefined };
  } else {
    console.warn('[DBG ir-to-figma] convertImageNode: content 不是 data URL，图片将显示为灰色占位', { name: irNode.name, content: irNode.content ? String(irNode.content).slice(0, 80) : 'null' });
  }
  var imagePaints = irFillsToFigmaPaints(
    imgPaint ? [imgPaint] : null,
    blobs,
    imageCtx,
    imageImports,
    imageImportSet
  );

  var nc = {
    guid: guid,
    phase: 'CREATED',
    parentIndex: { guid: parentGuid, position: positionForIndex(siblingIndex) },
    type: 'RECTANGLE',
    name: withSyncTag(irNode.content ? '[IMG] ' + irNode.name : irNode.name, irNode, 'Image'),
    visible: true,
    opacity: style.opacity != null ? style.opacity : 1,
    size: { x: style.width ?? 100, y: style.height ?? 100 },
    transform: makeTransform(style.x || 0, style.y || 0),
    fillPaints: imagePaints || [{
      type: 'SOLID',
      color: { r: 0.85, g: 0.85, b: 0.85, a: 1 },
      opacity: 1,
      visible: true,
      blendMode: 'NORMAL',
    }],
  };

  var imgRadius = irBorderRadius(style);
  var imgRKeys = Object.keys(imgRadius);
  for (var _imgRi = 0; _imgRi < imgRKeys.length; _imgRi++) nc[imgRKeys[_imgRi]] = imgRadius[imgRKeys[_imgRi]];

  // ─── P0: Image node positioning & alignment ───
  if (style.positionType === 'absolute') {
    nc.stackPositioning = 'ABSOLUTE';
  }
  if (style.alignSelf) {
    nc.stackChildAlignSelf = style.alignSelf;
  }

  // ─── P3: flex-grow → 主轴 FILL ───
  if (style.flexGrow >= 1 && parentLayoutMode) {
    nc.stackChildPrimaryGrow = 1;
  }
  if (imageImports.length) nc.imageImports = { imports: imageImports };

  return nc;
}

// ─── Scene message builder ───

function buildSceneMessage(contentNodes, opts, blobs) {
  opts = opts || {};
  var pasteID = opts.pasteID || (Date.now() & 0x7fffffff);
  var fileKey = opts.fileKey || 'test0000test0000test00';
  var topGuid = contentNodes[0] ? contentNodes[0].guid : { sessionID: 1, localID: 2 };

  var msg = {
    type: 'NODE_CHANGES',
    sessionID: 0,
    ackID: 0,
    pasteID: pasteID,
    pasteFileKey: fileKey,
    pasteIsPartiallyOutsideEnclosingFrame: false,
    pastePageId: { sessionID: 0, localID: 1 },
    isCut: false,
    pasteEditorType: 'DESIGN',
    pasteAssetType: 'UNKNOWN',
    clipboardSelectionRegions: [{
      parent: { sessionID: 0, localID: 1 },
      nodes: [topGuid],
      pasteIsPartiallyOutsideEnclosingFrame: false,
      focusType: 'NONE',
    }],
    annotationCategories: [
      { id: { sessionID: 2, localID: 0 }, preset: 'DEVELOPMENT' },
      { id: { sessionID: 2, localID: 1 }, preset: 'INTERACTION' },
      { id: { sessionID: 2, localID: 2 }, preset: 'ACCESSIBILITY' },
      { id: { sessionID: 2, localID: 3 }, preset: 'CONTENT' },
    ],
    nodeChanges: [
      {
        guid: { sessionID: 0, localID: 0 },
        phase: 'CREATED',
        type: 'DOCUMENT',
        name: 'Document',
        visible: true,
        opacity: 1,
        transform: { m00: 1, m01: 0, m02: 0, m10: 0, m11: 1, m12: 0 },
      },
      {
        guid: { sessionID: 0, localID: 1 },
        phase: 'CREATED',
        parentIndex: { guid: { sessionID: 0, localID: 0 }, position: '!' },
        type: 'CANVAS',
        name: 'Page 1',
        visible: true,
        opacity: 1,
        transform: { m00: 1, m01: 0, m02: 0, m10: 0, m11: 1, m12: 0 },
        backgroundOpacity: 1,
        backgroundEnabled: true,
      },
    ].concat(contentNodes).concat(opts.iocNodes || [
      {
        guid: { sessionID: 20000069, localID: 2 },
        phase: 'CREATED',
        parentIndex: { guid: { sessionID: 0, localID: 0 }, position: '"' },
        type: 'CANVAS',
        name: 'Internal Only Canvas',
        visible: false,
        opacity: 1,
        transform: { m00: 1, m01: 0, m02: 0, m10: 0, m11: 1, m12: 0 },
        backgroundOpacity: 1,
        backgroundEnabled: true,
        internalOnly: true,
      },
    ]),
  };

  if (blobs && blobs.length) {
    msg.blobs = blobs;
  }

  return msg;
}

// ─── fig-kiwi archive builder (v15, deflateRaw) ───

function buildArchive(schemaChunk, messageChunk) {
  var PRELUDE = 'fig-kiwi';
  var VERSION = 15;
  var totalSize = PRELUDE.length + 4 + 4 + schemaChunk.length + 4 + messageChunk.length;
  var buf = new Uint8Array(totalSize);
  var view = new DataView(buf.buffer);
  var offset = 0;
  for (var i = 0; i < PRELUDE.length; i++) buf[offset++] = PRELUDE.charCodeAt(i);
  view.setUint32(offset, VERSION, true); offset += 4;
  view.setUint32(offset, schemaChunk.length, true); offset += 4;
  buf.set(schemaChunk, offset); offset += schemaChunk.length;
  view.setUint32(offset, messageChunk.length, true); offset += 4;
  buf.set(messageChunk, offset);
  return buf;
}

function uint8ArrayToBase64(u8) {
  if (typeof Buffer !== 'undefined') {
    return Buffer.from(u8).toString('base64');
  }
  var binary = '';
  for (var i = 0; i < u8.length; i++) binary += String.fromCharCode(u8[i]);
  return btoa(binary);
}

function buildClipboardHtml(metaObj, archiveBuf) {
  var metaB64 = uint8ArrayToBase64(new Uint8Array(
    typeof TextEncoder !== 'undefined'
      ? new TextEncoder().encode(JSON.stringify(metaObj))
      : Buffer.from(JSON.stringify(metaObj))
  ));
  var figmaB64 = uint8ArrayToBase64(archiveBuf);
  return '<meta charset="utf-8" /><meta charset="utf-8" />' +
    '<span data-metadata="<!--(figmeta)' + metaB64 + '(/figmeta)-->"></span>' +
    '<span data-buffer="<!--(figma)' + figmaB64 + '(/figma)-->"></span>' +
    '<span style="white-space: pre-wrap"></span>';
}

// ─── Main API ───

/**
 * 将 IR JSON 转为 Figma 剪切板 HTML
 * @param {object} irPayload - elementToMybricksJsonWithInlineImages 的返回值 { page: { content: [...] } }
 * @param {object} [fontCtxOrMap] - 可选，支持三种格式（均向后兼容）：
 *   - 旧格式 A：{ font, fontDigest }（单字重单字体）
 *   - 旧格式 B：{ 300: ctx, 400: ctx, 500: ctx, 600: ctx }（多字重单字体）
 *   - 新格式：{ 'PingFang SC': { 300: ctx, 400: ctx }, 'DingTalk JinBuTi': { 400: ctx } }（多字体多字重）
 *   提供时文本节点生成 derivedTextData + glyph blob，粘贴后立即渲染（无需双击）。
 * @returns {string} 可直接写入 clipboard 的 HTML
 */
function convertIRToFigmaClipboardHtml(irPayload, fontCtxOrMap) {
  // 统一转换为新格式 { [family]: { [weight]: ctx } }
  var fontCtxMap = null;
  if (fontCtxOrMap) {
    if (fontCtxOrMap.font) {
      // 旧格式 A：单 ctx → { 'PingFang SC': { 400: ctx } }
      fontCtxMap = { 'PingFang SC': { 400: fontCtxOrMap } };
    } else {
      var _firstKey = Object.keys(fontCtxOrMap)[0];
      if (_firstKey && !isNaN(Number(_firstKey))) {
        // 旧格式 B：{ weight: ctx } → { 'PingFang SC': { weight: ctx } }
        fontCtxMap = { 'PingFang SC': fontCtxOrMap };
      } else {
        // 新格式：直接使用
        fontCtxMap = fontCtxOrMap;
      }
    }
  }

  var compiled = _getCompiled();
  var schemaChunk = _getSchemaChunk();
  var pako = _getPako();
  if (!pako) throw new Error('pako not found');

  resetGuidCounter();

  var page = irPayload && irPayload.page;
  if (!page || !page.content || !page.content.length) {
    throw new Error('IR payload has no content');
  }

  var blobs = [];
  var imageCtx = { byHash: {} };
  var rootIR = page.content[0];
  var canvasGuid = { sessionID: 0, localID: 1 };
  var allNodeChanges = convertNode(rootIR, canvasGuid, 0, fontCtxMap, blobs, null, imageCtx);

  // 若模板存在，注入 fileKey + IOC Canvas/SYMBOL 节点，让 Figma 能解析库组件引用
  var _msgOpts = {};
  var tpl = _componentTemplate;
  if (tpl && tpl.iocCanvasNode) {
    _msgOpts.fileKey = tpl.fileKey;
    _msgOpts.iocNodes = [tpl.iocCanvasNode].concat(tpl.componentNodes || []);
  }
  var message = buildSceneMessage(allNodeChanges, _msgOpts, blobs);
  var encoded = compiled.encodeMessage(message);
  var msgChunk = pako.deflateRaw(encoded);
  var archive = buildArchive(schemaChunk, msgChunk);
  var clipHtml = buildClipboardHtml(
    { fileKey: message.pasteFileKey, pasteID: message.pasteID, dataType: 'scene' },
    archive
  );
  return clipHtml;
}

module.exports = {
  convertIRToFigmaClipboardHtml: convertIRToFigmaClipboardHtml,
  convertNode: convertNode,
  buildSceneMessage: buildSceneMessage,
  resetGuidCounter: resetGuidCounter,
  irFillsToFigmaPaints: irFillsToFigmaPaints,
  irShadowsToEffects: irShadowsToEffects,
  irStrokeToFigma: irStrokeToFigma,
  irColorToFigma: irColorToFigma,
  cssAngleToGradientTransform: cssAngleToGradientTransform,
};
