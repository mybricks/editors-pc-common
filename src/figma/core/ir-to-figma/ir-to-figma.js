/**
 * ir-to-figma-clipboard.js
 *
 * 将 dom-to-figma 产出的 IR JSON 直接转为 Figma 剪切板 HTML（fig-kiwi binary），
 * 粘贴到 Figma 后无需插件即可生成设计稿。
 *
 * 依赖：pako（deflateRaw）、kiwi-schema（compileSchema）
 * 数据：figma-schema-data.js（预生成的 schema 常量）
 */

var _pako = require('./vendors/pako');
var _kiwiSchema = require('./vendors/kiwi-schema');
var _schemaData = require('./schema-data');
var _svgPathDataLib = require('./vendors/svg-pathdata');

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

function resolveFontName(family, weight, italic) {
  var w = weight || 400;
  if (w > 600) w = 600;
  var styleName = PINGFANG_WEIGHT_MAP[w] || 'Regular';
  // PingFang SC 无 Italic 变体，忽略 italic 参数，对应 Figma "Missing font" 替换规则
  var postscript = 'PingFangSC-' + styleName.replace(/\s+/g, '');
  return { family: 'PingFang SC', style: styleName, postscript: postscript };
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

// ─── IR fills → Figma fillPaints ───

function normalizeImageScaleMode(mode) {
  var m = (mode || '').toString().toUpperCase();
  if (m === 'FIT' || m === 'FILL' || m === 'TILE' || m === 'STRETCH') return m;
  return 'FILL';
}

function base64ToUint8Array(base64) {
  if (!base64) return null;
  try {
    if (typeof Buffer !== 'undefined') return new Uint8Array(Buffer.from(base64, 'base64'));
    if (typeof atob === 'function') {
      var bin = atob(base64);
      var out = new Uint8Array(bin.length);
      for (var i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
      return out;
    }
  } catch (_e) {}
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

function registerImageFromDataUrl(dataUrl, blobs, imageCtx) {
  var parsed = parseDataUrlToBytes(dataUrl);
  if (!parsed || !parsed.bytes || !parsed.bytes.length) return null;
  var hashHex = computeImageHashHex(parsed.bytes);
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
  if (typeof console !== 'undefined' && console.log) {
    console.log('[figma image] 注册图片资源', {
      hash: hashHex,
      dataBlob: dataBlobIndex,
      bytes: parsed.bytes.length,
      name: entry.name,
    });
  }
  return entry;
}

// ─── Gradient transform helpers ───

function cssAngleToGradientTransform(angleDeg) {
  var rad = ((angleDeg || 0) % 360) * Math.PI / 180;
  var s = Math.sin(rad);
  var c = Math.cos(rad);
  return {
    m00: s, m01: c, m02: 0.5 * (1 - s - c),
    m10: -c, m11: s, m12: 0.5 * (1 + c - s),
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
      var imageEntry = (imageData && blobs && imageCtx) ? registerImageFromDataUrl(imageData, blobs, imageCtx) : null;
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
    return {
      rectangleTopLeftCornerRadius: br[0] || 0,
      rectangleTopRightCornerRadius: br[1] || 0,
      rectangleBottomRightCornerRadius: br[2] || 0,
      rectangleBottomLeftCornerRadius: br[3] || 0,
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

// ─── Text measurement with opentype.js ───

function measureTextWithFont(text, fontSize, font) {
  var scale = fontSize / font.unitsPerEm;
  var otGlyphs = font.stringToGlyphs(text);
  var glyphData = [];
  var x = 0;

  for (var i = 0; i < otGlyphs.length; i++) {
    var g = otGlyphs[i];
    var advance = (g.advanceWidth || font.unitsPerEm) * scale;
    glyphData.push({
      otGlyph: g,
      x: x,
      advance: advance,
      advanceNorm: (g.advanceWidth || font.unitsPerEm) / font.unitsPerEm,
    });
    x += advance;
    if (i < otGlyphs.length - 1) {
      x += font.getKerningValue(otGlyphs[i], otGlyphs[i + 1]) * scale;
    }
  }

  var ascender = font.ascender * scale;
  var descender = Math.abs(font.descender) * scale;

  return {
    totalWidth: x,
    lineHeight: ascender + descender,
    ascender: ascender,
    descender: descender,
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
    changes.push(convertSvgNode(irNode, guid, parentGuid, siblingIndex, parentLayoutMode, blobs, imageCtxGlobal));
  } else if (type === 'image') {
    changes.push(convertImageNode(irNode, guid, parentGuid, siblingIndex, parentLayoutMode, blobs, imageCtxGlobal));
  } else {
    var frameChange = convertFrameNode(irNode, guid, parentGuid, siblingIndex, parentLayoutMode, blobs, imageCtxGlobal);
    changes.push(frameChange);

    var myLayoutMode = style.layoutMode || null;
    if (irNode.children && irNode.children.length) {
      var orderedChildren = sortChildrenByZIndex(irNode.children, myLayoutMode);
      for (var i = 0; i < orderedChildren.length; i++) {
        var childChanges = convertNode(orderedChildren[i], guid, i, fontCtxMap, blobs, myLayoutMode, imageCtxGlobal);
        for (var j = 0; j < childChanges.length; j++) {
          changes.push(childChanges[j]);
        }
      }
    }
  }

  return changes;
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
    name: irNode.name || 'SVG',
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
  var stroke = irStrokeToFigma(style);
  var radius = irBorderRadius(style);
  var layout = irLayoutToFigma(style);
  var effects = irShadowsToEffects(style.shadows, style.innerShadows);
  var imageCtx = imageCtxGlobal || { byHash: {} };
  var imageImports = [];
  var imageImportSet = {};

  var nc = {
    guid: guid,
    phase: 'CREATED',
    parentIndex: { guid: parentGuid, position: positionForIndex(siblingIndex) },
    type: 'FRAME',
    name: irNode.name || 'Frame',
    visible: true,
    opacity: style.opacity != null ? style.opacity : 1,
    size: { x: style.width || 100, y: style.height || 100 },
    transform: makeTransform(style.x || 0, style.y || 0, style.rotation),
    fillPaints: irFillsToFigmaPaints(style.fills, blobs, imageCtx, imageImports, imageImportSet),
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

  // 从 fontCtxMap 中选出与当前字重最匹配的 FontContext。
  // fontCtxMap 格式：{ 300: ctx, 400: ctx, 500: ctx, 600: ctx }
  // 向下取整找最近字重，找不到则退而使用 400（Regular）。
  var _clampedWeight = Math.min(style.fontWeight || 400, 600);
  var resolvedFontCtx = null;
  if (fontCtxMap && typeof fontCtxMap === 'object') {
    resolvedFontCtx = fontCtxMap[_clampedWeight] || null;
    if (!resolvedFontCtx) {
      // 向下取整找最近可用字重
      var _availableWeights = Object.keys(fontCtxMap).map(Number).sort(function(a, b) { return b - a; });
      for (var _wi = 0; _wi < _availableWeights.length; _wi++) {
        if (_availableWeights[_wi] <= _clampedWeight) {
          resolvedFontCtx = fontCtxMap[_availableWeights[_wi]];
          break;
        }
      }
      // 仍未找到则用最小可用字重
      if (!resolvedFontCtx && _availableWeights.length > 0) {
        resolvedFontCtx = fontCtxMap[_availableWeights[_availableWeights.length - 1]];
      }
    }
  }

  var hasFontCtx = resolvedFontCtx && resolvedFontCtx.font && resolvedFontCtx.fontDigest && blobs && content;
  var measured = null;
  if (hasFontCtx) {
    try {
      measured = measureTextWithFont(content, fontSize, resolvedFontCtx.font);
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
  var nodeHeight = measured ? Math.ceil(measured.lineHeight) : (style.height || 20);
  if (measured) {
    lineHeightVal = Math.ceil(measured.lineHeight);
  }

  // 多行文本检测（content 含 \n 换行符）
  var _contentLines = content.split('\n');
  var _isMultiLine = _contentLines.length > 1;
  if (_isMultiLine) {
    // 多行高度 = 行数 × 单行行高
    nodeHeight = _contentLines.length * lineHeightVal;
    // 多行文本需要固定宽度（如 style 无宽度则用兜底值）
    if (!hasExplicitWidth) nodeWidth = style.width || 200;
  }

  var textAutoResize = hasExplicitWidth ? 'NONE' : 'WIDTH_AND_HEIGHT';
  if (_isMultiLine) {
    // 多行：宽度固定，高度随内容自适应
    textAutoResize = 'HEIGHT';
  }

  var nc = {
    guid: guid,
    phase: 'CREATED',
    parentIndex: { guid: parentGuid, position: positionForIndex(siblingIndex) },
    type: 'TEXT',
    name: content.slice(0, 30) || 'Text',
    visible: true,
    opacity: style.opacity != null ? style.opacity : 1,
    size: { x: nodeWidth, y: nodeHeight },
    transform: makeTransform(style.x || 0, style.y || 0, style.rotation),
    strokeWeight: 1,
    strokeAlign: 'OUTSIDE',
    strokeJoin: 'MITER',
    fillPaints: fillPaints,
    textData: {
      characters: content,
      lines: (function() {
        var _lo = { lineType: 'PLAIN', styleId: 0, indentationLevel: 0, sourceDirectionality: 'AUTO', listStartOffset: 0, isFirstLineOfList: false };
        if (!_isMultiLine) return [_lo];
        return _contentLines.map(function() { return _lo; });
      })(),
    },
    fontName: fontName,
    fontSize: fontSize,
    textAlignVertical: style.textAlignVertical || 'TOP',
    autoRename: true,
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

    if (_isMultiLine) {
      // 逐行测量字形，生成多行 baseline
      var _charOffset = 0;
      for (var _li = 0; _li < _contentLines.length; _li++) {
        var _lineText = _contentLines[_li];
        var _lineYBase = _li * lineHeightVal;
        var _lineMeasured = null;
        if (_lineText.length > 0) {
          try { _lineMeasured = measureTextWithFont(_lineText, fontSize, resolvedFontCtx.font); } catch (_e) {}
        }
        var _lineWidth = _lineMeasured ? _lineMeasured.totalWidth : 0;
        var _lineGlyphs = _lineMeasured ? _lineMeasured.glyphs : [];
        var _lineXOffset = computeTextAlignXOffset(style.textAlignHorizontal, nodeWidth, _lineWidth);
        for (var _gi = 0; _gi < _lineGlyphs.length; _gi++) {
          var _gd = _lineGlyphs[_gi];
          var _gblob = encodeGlyphBlob(_gd.otGlyph);
          var _gblobIdx = blobs.length;
          blobs.push({ bytes: _gblob });
          figmaGlyphs.push({
            commandsBlob: _gblobIdx,
            position: { x: _gd.x + _lineXOffset, y: _lineYBase + measured.ascender },
            fontSize: fontSize,
            firstCharacter: _charOffset + _gi,
            advance: _gd.advanceNorm,
          });
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
            figmaGlyphs.push({ commandsBlob: _blobIdx0, position: { x: _gd0.x + _slXOffset0, y: measured.ascender }, fontSize: fontSize, firstCharacter: _gi0, advance: _gd0.advanceNorm });
          }
          figmaBaselines.push({ firstCharacter: 0, endCharacter: Math.max(content.length - 1, 0), position: { x: _slXOffset0, y: measured.ascender }, width: measured.totalWidth, lineY: 0, lineHeight: lineHeightVal, lineAscent: measured.ascender });
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
            position: { x: _tgd2.x + _tXOff, y: measured.ascender },
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
            position: { x: _eXStart, y: measured.ascender },
            fontSize: fontSize,
            firstCharacter: _truncIdx,
            advance: _eAdvNorm,
          });
          _eXStart += _eAdvPx;
        }
        figmaBaselines.push({
          firstCharacter: 0,
          endCharacter: Math.max(_truncIdx - 1, 0),
          position: { x: _tXOff, y: measured.ascender },
          width: _totalTruncW,
          lineY: 0,
          lineHeight: lineHeightVal,
          lineAscent: measured.ascender,
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
          figmaGlyphs.push({
            commandsBlob: blobIndex,
            position: { x: gd.x + _slXOffset, y: measured.ascender },
            fontSize: fontSize,
            firstCharacter: gi,
            advance: gd.advanceNorm,
          });
        }
        figmaBaselines.push({
          firstCharacter: 0,
          endCharacter: Math.max(content.length - 1, 0),
          position: { x: _slXOffset, y: measured.ascender },
          width: measured.totalWidth,
          lineY: 0,
          lineHeight: lineHeightVal,
          lineAscent: measured.ascender,
        });
      }
    }

    nc.derivedTextData = {
      layoutSize: { x: nodeWidth, y: nodeHeight },
      baselines: figmaBaselines,
      glyphs: figmaGlyphs,
      fontMetaData: [{
        // key 必须与 fontDigest 对应：我们始终用 PingFangSC-Regular 做字形测量，
        // key/digest/fontWeight 与实际加载的字体文件一一对应，
        // 保证 Figma 能通过 digest 验证字形数据合法，从而立即渲染。
        key: {
          family: 'PingFang SC',
          style: resolvedFontCtx.style || 'Regular',
          postscript: resolvedFontCtx.postscript || 'PingFangSC-Regular',
        },
        fontLineHeight: measured.lineHeight / fontSize,
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
    imgPaint = { type: 'IMAGE', content: irNode.content };
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
    name: irNode.content ? '[IMG] ' + irNode.name : irNode.name || 'Image',
    visible: true,
    opacity: style.opacity != null ? style.opacity : 1,
    size: { x: style.width || 100, y: style.height || 100 },
    transform: makeTransform(style.x || 0, style.y || 0),
    fillPaints: imagePaints || [{
      type: 'SOLID',
      color: { r: 0.85, g: 0.85, b: 0.85, a: 1 },
      opacity: 1,
      visible: true,
      blendMode: 'NORMAL',
    }],
    cornerRadius: style.borderRadius && typeof style.borderRadius === 'number' ? style.borderRadius : undefined,
  };

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
    ].concat(contentNodes).concat([
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
 * @param {object} [fontCtxOrMap] - 可选，支持两种格式：
 *   - 旧格式：{ font, fontDigest }（单字重，向后兼容）
 *   - 新格式：{ 300: ctx, 400: ctx, 500: ctx, 600: ctx }（多字重，推荐）
 *   提供时文本节点生成 derivedTextData + glyph blob，粘贴后立即渲染（无需双击）。
 * @returns {string} 可直接写入 clipboard 的 HTML
 */
function convertIRToFigmaClipboardHtml(irPayload, fontCtxOrMap) {
  // 兼容旧的单 ctx 格式：{ font, fontDigest } → 包装为 weight=400 的 map
  var fontCtxMap = null;
  if (fontCtxOrMap) {
    if (fontCtxOrMap.font) {
      fontCtxMap = { 400: fontCtxOrMap };
    } else {
      fontCtxMap = fontCtxOrMap;
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
  if (typeof console !== 'undefined' && console.log) {
    var _imageCount = Object.keys(imageCtx.byHash || {}).length;
    console.log('[figma image] 剪贴板打包完成', { imageCount: _imageCount, blobCount: blobs.length });
  }

  var message = buildSceneMessage(allNodeChanges, {}, blobs);
  var encoded = compiled.encodeMessage(message);
  var msgChunk = pako.deflateRaw(encoded);
  var archive = buildArchive(schemaChunk, msgChunk);

  return buildClipboardHtml(
    { fileKey: message.pasteFileKey, pasteID: message.pasteID, dataType: 'scene' },
    archive
  );
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
