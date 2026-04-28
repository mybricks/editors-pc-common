/**
 * ============================================================
 * style-builder.js  —  CSS 样式 → Figma JSON 转换层
 * ============================================================
 * 职责：
 *   - 字体推断：parseFontFamilyStack / resolveFontFamilyFromStack / getGlobalFont
 *   - 行内文本样式：buildInlineTextStyle
 *   - 核心样式映射：buildStyleJSON（computed + cssRuleMap + 几何 → Figma style JSON）
 * 规则：依赖 css-parsers 和 dom-helpers，但不直接遍历 DOM 子树，不做节点类型判断。
 * ============================================================
 */
var _dp = (typeof module !== 'undefined') ? require('./css-parsers') : {};
var _dh = (typeof module !== 'undefined') ? require('./dom-helpers') : {};
var parseLinearGradientFromBgImage = _dp.parseLinearGradientFromBgImage || parseLinearGradientFromBgImage;
var parseRadialGradientFromBgImage = _dp.parseRadialGradientFromBgImage || parseRadialGradientFromBgImage;
var parseUrlFromBgImage = _dp.parseUrlFromBgImage || parseUrlFromBgImage;
var parseBoxShadow = _dp.parseBoxShadow || parseBoxShadow;
var parseBorderShorthand = _dp.parseBorderShorthand || parseBorderShorthand;
var parseGridTemplateColumnsCount = _dp.parseGridTemplateColumnsCount || parseGridTemplateColumnsCount;
var parseTransformRotation = _dp.parseTransformRotation || parseTransformRotation;
var cssColorToRgba = _dp.cssColorToRgba || cssColorToRgba;
var cssColorToHex = _dp.cssColorToHex || cssColorToHex;
var getDeclaredStyleForElement = _dh.getDeclaredStyleForElement || getDeclaredStyleForElement;

/** 解析 font-family 字符串为有序数组（保留全部名称，供插件与 Figma 可用字体匹配） */
function parseFontFamilyStack(stackStr) {
  if (!stackStr || !String(stackStr).trim()) return [];
  return String(stackStr)
    .split(',')
    .map(function (s) { return s.trim().replace(/^['"]|['"]$/g, ''); })
    .filter(Boolean);
}

/** 从 font-family 栈中解析出 Figma 可用的字体：跳过系统/通用名，取第一个实体字体；若全是系统则默认 PingFang SC（中文） */
function resolveFontFamilyFromStack(stackStr) {
  if (!stackStr || !String(stackStr).trim()) return '';
  var systemKeywords = /^(-apple-system|blinkmacsystemfont|system-ui|arial|helvetica\s*neue|helvetica|sans-serif|serif|monospace)$/i;
  /* Windows/Android 常见系统字体：栈里只有这些时不再输出为「设计字体」，回退到默认 PingFang SC，避免 JSON 里全是 Segoe UI */
  var systemFonts = /^(Segoe\s+UI|Roboto)$/i;
  var list = parseFontFamilyStack(stackStr);
  for (var i = 0; i < list.length; i++) {
    var name = list[i];
    if (!name) continue;
    if (systemKeywords.test(name)) continue;
    if (systemFonts.test(name)) continue;
    if (/^SF\s+UI\s+Text$/i.test(name)) continue;
    return name;
  }
  return 'PingFang SC';
}

/** 从画布根计算全局字体，用于后续仅在与全局不同时输出 font */
function getGlobalFont(rootEl, computed, cssRuleMap) {
  var decl = (cssRuleMap && rootEl && Object.keys(cssRuleMap).length > 0) ? getDeclaredStyleForElement(rootEl, cssRuleMap) : {};
  function d(keys) {
    var k = Array.isArray(keys) ? keys : [keys];
    for (var i = 0; i < k.length; i++) if (decl[k[i]] != null && decl[k[i]] !== '') return decl[k[i]];
    return undefined;
  }
  var num = function (v) { return (v === '' || v == null ? undefined : parseFloat(String(v))); };
  var rawStack = (d(['font-family', 'fontFamily']) || (computed && computed.fontFamily) || '').toString();
  var fontFamily = resolveFontFamilyFromStack(rawStack);
  var fw = d(['font-weight', 'fontWeight']) || (computed && computed.fontWeight);
  var fontWeight = fw === 'bold' ? 700 : (fw === 'normal' ? 400 : num(fw));
  if (fontWeight == null || Number.isNaN(fontWeight)) fontWeight = 400;
  var fs = (d(['font-style', 'fontStyle']) || (computed && computed.fontStyle) || 'normal').toString().toLowerCase();
  var fontStyle = (fs === 'italic' || fs === 'oblique') ? 'italic' : 'normal';
  return { fontFamily: fontFamily || undefined, fontWeight: fontWeight, fontStyle };
}

/**
 * 解析字体大小为 px 数值。
 * 声明层出现相对单位（如 100%、1rem、0.875em）时，不能直接 parseFloat，
 * 否则会把 "100%" 误判成 100px；此时应回退到 computed.fontSize（浏览器已解算为 px）。
 */
function resolveFontSizePxFromDeclAndComputed(declaredVal, computedVal, pxFn) {
  var _decl = declaredVal == null ? '' : String(declaredVal).trim().toLowerCase();
  var _declIsPxLike = /^-?\d*\.?\d+(px)?$/i.test(_decl);
  if (_decl && _declIsPxLike) {
    return pxFn(declaredVal);
  }
  var _computedPx = pxFn(computedVal);
  if (_computedPx != null && !Number.isNaN(_computedPx)) return _computedPx;
  return _decl ? pxFn(declaredVal) : undefined;
}

/** 仅用于 div 内内联文本节点：只含位置 + 文字相关样式，不含 layout/padding */
function buildInlineTextStyle(parentEl, computed, textRect, parentRect, cssRuleMap, globalFont) {
  if (!textRect || !parentRect) return {};
  var style = {};
  style.x = textRect.left - parentRect.left;
  style.y = textRect.top - parentRect.top;
  // 写入文字的实测宽高，使其在 Figma 里精确对齐（尤其是 block button 靠 padding 居中时，y 已经是正确偏移）
  if (textRect.width != null && textRect.width > 0) style.width = textRect.width;
  if (textRect.height != null && textRect.height > 0) style.height = textRect.height;
  var decl = (cssRuleMap && parentEl && Object.keys(cssRuleMap).length > 0) ? getDeclaredStyleForElement(parentEl, cssRuleMap) : {};
  function d(keys) {
    var k = Array.isArray(keys) ? keys : [keys];
    for (var i = 0; i < k.length; i++) if (decl[k[i]] != null && decl[k[i]] !== '') return decl[k[i]];
    return undefined;
  }
  var num = function (v) { return (v === '' || v == null ? undefined : parseFloat(String(v))); };
  var px = function (v) { var n = num(v); return n != null && !Number.isNaN(n) ? Math.round(n) : undefined; };
  var _fontSizeDecl = d(['font-size', 'fontSize']);
  var fontSize = resolveFontSizePxFromDeclAndComputed(
    _fontSizeDecl,
    computed && computed.fontSize,
    px
  );
  if (fontSize != null) {
    if (fontSize < 1) {
      var rawFsVal = _fontSizeDecl || (computed && computed.fontSize);
      console.warn('[fontSize<1] buildStyleJSON', { className: parentEl && parentEl.className, rawValue: rawFsVal, rounded: fontSize, el: parentEl });
    } else {
      style.fontSize = fontSize;
    }
  }
  var color = d(['color']) || (computed && computed.color);
  // 若声明层取到的是 CSS 变量，回退到 computed 实际解析值
  if (color && color.indexOf('var(') >= 0) {
    color = (computed && computed.color) || color;
  }
  if (color) {
    var rgba = cssColorToRgba(color);
    if (rgba) style.color = rgba;
  }
  var fontFamilyRaw = d(['font-family', 'fontFamily']) || (computed && computed.fontFamily);
  var fontFamily = fontFamilyRaw ? resolveFontFamilyFromStack(String(fontFamilyRaw)) : '';
  var fontWeightRaw = d(['font-weight', 'fontWeight']) || (computed && computed.fontWeight);
  var fontWeight = fontWeightRaw === 'bold' ? 700 : (fontWeightRaw === 'normal' ? 400 : num(fontWeightRaw));
  if (fontWeight == null || Number.isNaN(fontWeight)) fontWeight = 400;
  var fontStyleRaw = (d(['font-style', 'fontStyle']) || (computed && computed.fontStyle) || 'normal').toString().toLowerCase();
  var fontStyle = (fontStyleRaw === 'italic' || fontStyleRaw === 'oblique') ? 'italic' : 'normal';
  if (globalFont) {
    if (fontFamily && fontFamily !== globalFont.fontFamily) style.fontFamily = fontFamily;
    if (fontWeight !== globalFont.fontWeight) style.fontWeight = fontWeight;
    if (fontStyle !== globalFont.fontStyle) style.fontStyle = fontStyle;
  } else {
    if (fontFamily) style.fontFamily = fontFamily;
    style.fontWeight = fontWeight;
    if (fontStyle !== 'normal') style.fontStyle = fontStyle;
  }
  var stack = fontFamilyRaw ? parseFontFamilyStack(String(fontFamilyRaw)) : [];
  if (stack.length) style.fontFamilyStack = stack;
  var textAlign = (d(['text-align', 'textAlign']) || (computed && computed.textAlign) || '').toString().toLowerCase();
  if (textAlign) {
    var alignMap = { left: 'LEFT', right: 'RIGHT', center: 'CENTER', justify: 'JUSTIFIED', start: 'LEFT', end: 'RIGHT' };
    var mapped = alignMap[textAlign];
    if (mapped) style.textAlignHorizontal = mapped;
  }
  // 内联文本节点的单行判断：用 lineHeight 判断，fallback 到 height < fontSize * 2
  var _itH = style.height;
  var _itFs = style.fontSize;
  if (_itH != null && _itFs != null && _itFs > 0) {
    var _itLhRaw = computed && computed.lineHeight;
    var _itLh = (_itLhRaw && _itLhRaw !== 'normal') ? parseFloat(_itLhRaw) : null;
    if (_itLh != null && !Number.isNaN(_itLh) && _itLh > 0) {
      style.singleLine = _itH <= _itLh * 1.2;
      style.lineHeight = _itLh;
    } else {
      style.singleLine = _itH < _itFs * 2;
    }
  }
  // 渐变文字（真实 inline 路径）：background-clip:text + 透明文字 → textGradientFill
  // 注意：<h1>Annual<br>Report</h1> 合并后走的是 buildInlineTextStyle，不是 buildStyleJSON。
  var _itBgClip;
  try {
    _itBgClip = computed && computed.getPropertyValue && (computed.getPropertyValue('background-clip') || computed.getPropertyValue('-webkit-background-clip'));
  } catch (_eInlineGt0) {}
  if (!_itBgClip) _itBgClip = d(['background-clip', 'backgroundClip', '-webkit-background-clip']) || (computed && (computed.backgroundClip || computed.webkitBackgroundClip));
  if (_itBgClip && String(_itBgClip).indexOf('text') >= 0) {
    var _itTextFill;
    try { _itTextFill = computed && computed.getPropertyValue && computed.getPropertyValue('-webkit-text-fill-color'); } catch (_eInlineGt1) {}
    if (!_itTextFill) _itTextFill = d(['-webkit-text-fill-color', 'webkitTextFillColor']) || (computed && computed.webkitTextFillColor);
    var _itColorVal = d(['color']) || (computed && computed.color);
    var _itIsTransparent = function (c) {
      if (!c) return true;
      var s = String(c).trim();
      if (s === 'transparent') return true;
      var m = s.match(/^rgba?\(\s*\d+\s*,\s*\d+\s*,\s*\d+\s*,\s*([\d.]+)\s*\)$/);
      return !!(m && parseFloat(m[1]) === 0);
    };
    if (_itIsTransparent(_itColorVal) || _itIsTransparent(_itTextFill)) {
      var _itBgImg = (computed && computed.backgroundImage) || '';
      if (!_itBgImg || _itBgImg === 'none') _itBgImg = d(['background']) || '';
      if (_itBgImg && _itBgImg !== 'none') {
        var _itGradFill = parseLinearGradientFromBgImage(_itBgImg) || parseRadialGradientFromBgImage(_itBgImg);
        if (_itGradFill) {
          style.textGradientFill = _itGradFill;
          style.color = undefined;
        }
      }
    }
  }
  return style;
}

function _splitByCommaOutsideParens(str) {
  var out = [];
  var cur = '';
  var depth = 0;
  for (var i = 0; i < str.length; i++) {
    var ch = str[i];
    if (ch === '(') depth++;
    if (ch === ')' && depth > 0) depth--;
    if (ch === ',' && depth === 0) {
      out.push(cur);
      cur = '';
      continue;
    }
    cur += ch;
  }
  if (cur) out.push(cur);
  return out;
}

function _splitBySpaceOutsideParens(str) {
  var out = [];
  var cur = '';
  var depth = 0;
  for (var i = 0; i < str.length; i++) {
    var ch = str[i];
    if (ch === '(') depth++;
    if (ch === ')' && depth > 0) depth--;
    if (/\s/.test(ch) && depth === 0) {
      if (cur) out.push(cur);
      cur = '';
      continue;
    }
    cur += ch;
  }
  if (cur) out.push(cur);
  return out;
}

/**
 * 将 border-radius 简写拆成 [tl, tr, br, bl]（px 整数）；忽略椭圆语法中 `/` 之后的第二组半径。
 * 仅作声明层兜底：每角不应把整段简写交给 parseFloat，否则会只读到第一个数。
 */
function expandBorderRadiusShorthandToPxFour(raw, pxFn) {
  if (raw == null) return null;
  var s = String(raw).trim();
  if (!s || s === 'none') return null;
  var slash = s.indexOf('/');
  if (slash >= 0) s = s.slice(0, slash).trim();
  var parts = _splitBySpaceOutsideParens(s).map(function (p) { return String(p || '').trim(); }).filter(Boolean);
  if (!parts.length) return null;
  var nums = [];
  for (var i = 0; i < parts.length; i++) {
    var n = pxFn(parts[i]);
    nums.push(n != null && !Number.isNaN(n) ? n : 0);
  }
  var a;
  var b;
  var c;
  var d;
  if (nums.length === 1) {
    a = b = c = d = nums[0];
  } else if (nums.length === 2) {
    a = nums[0];
    b = nums[1];
    c = nums[0];
    d = nums[1];
  } else if (nums.length === 3) {
    a = nums[0];
    b = nums[1];
    c = nums[2];
    d = nums[1];
  } else {
    a = nums[0];
    b = nums[1];
    c = nums[2];
    d = nums[3];
  }
  return [a, b, c, d];
}

/**
 * 在 cssRuleMap 中查找与 el 匹配且值含 inset 的 box-shadow 声明。
 * 用于 getComputedStyle 省略 inset、或合并声明时 inset 被覆盖的兜底；取最后一个匹配值。
 */
function findInsetBoxShadowFromCssRuleMap(el, cssRuleMap) {
  if (!cssRuleMap || !el || typeof el.matches !== 'function') return null;
  var best = null;
  for (var sel in cssRuleMap) {
    var matched = false;
    try {
      matched = el.matches(sel);
    } catch (_) {
      matched = false;
    }
    if (!matched) continue;
    var text = cssRuleMap[sel] || '';
    var parts = text.split(';');
    for (var pi = 0; pi < parts.length; pi++) {
      var part = String(parts[pi] || '').trim();
      if (!part) continue;
      var colon = part.indexOf(':');
      if (colon <= 0) continue;
      var key = part.slice(0, colon).trim().toLowerCase();
      if (key !== 'box-shadow' && key !== '-webkit-box-shadow' && key !== '-moz-box-shadow') continue;
      var val = part.slice(colon + 1).trim().replace(/\s*!important\s*$/i, '');
      if (val && val !== 'none' && val.indexOf('inset') >= 0) best = val;
    }
  }
  return best;
}

function _parseCalcCoord(expr, axisSize) {
  var s = String(expr || '').trim();
  var m = s.match(/^calc\((.*)\)$/i);
  if (!m) return null;
  var body = m[1];
  var re = /([+-]?)\s*([0-9]*\.?[0-9]+)\s*(%|px)/g;
  var sum = 0;
  var matched = false;
  var item;
  while ((item = re.exec(body)) !== null) {
    matched = true;
    var sign = item[1] === '-' ? -1 : 1;
    var num = parseFloat(item[2]);
    var unit = item[3];
    if (!isFinite(num)) continue;
    if (unit === '%') sum += sign * axisSize * num / 100;
    else if (unit === 'px') sum += sign * num;
  }
  return matched ? sum : null;
}

function _parseClipPathCoord(token, axisSize) {
  var t = String(token || '').trim().toLowerCase();
  if (!t) return null;
  if (t.endsWith('%')) {
    var nPct = parseFloat(t);
    return isFinite(nPct) ? axisSize * nPct / 100 : null;
  }
  if (t.endsWith('px')) {
    var nPx = parseFloat(t);
    return isFinite(nPx) ? nPx : null;
  }
  if (t.indexOf('calc(') === 0) {
    return _parseCalcCoord(t, axisSize);
  }
  var n = parseFloat(t);
  return isFinite(n) ? n : null;
}

function parseClipPathPolygon(rawClipPath, width, height) {
  if (!rawClipPath || width == null || height == null || width <= 0 || height <= 0) return null;
  var raw = String(rawClipPath).trim();
  var m = raw.match(/^polygon\s*\(([\s\S]*)\)$/i);
  if (!m) return null;
  var body = String(m[1] || '').trim();
  if (!body) return null;
  var parts = _splitByCommaOutsideParens(body).map(function (p) { return String(p || '').trim(); }).filter(Boolean);
  if (!parts.length) return null;
  if (/^(evenodd|nonzero)$/i.test(parts[0])) {
    parts = parts.slice(1);
  }
  var points = [];
  for (var i = 0; i < parts.length; i++) {
    var seg = parts[i];
    var coords = _splitBySpaceOutsideParens(seg).filter(Boolean);
    if (coords.length < 2) continue;
    var x = _parseClipPathCoord(coords[0], width);
    var y = _parseClipPathCoord(coords[1], height);
    if (!isFinite(x) || !isFinite(y)) continue;
    points.push({ x: x, y: y });
  }
  return points.length >= 3 ? points : null;
}

/** 2×2 子矩阵是否近似正交旋转（允许轻微数值误差） */
function _isApproxPureRotation2D(a, b, c, d) {
  var n = a * a + b * b;
  if (Math.abs(n - 1) > 0.08) return false;
  if (Math.abs(c * c + d * d - 1) > 0.08) return false;
  if (Math.abs(a * c + b * d) > 0.02) return false;
  return true;
}

/**
 * 将 transform-origin 解析为相对 border-box 左上角的 px 偏移（用于与 matrix(a,b,c,d) 组合）。
 * 优先匹配浏览器已算好的「Npx Mpx」；否则按关键字 / % / length 解析。
 */
function parseTransformOriginOffsetsPx(originRaw, bw, bh) {
  var raw = String(originRaw || '').trim();
  if (!raw) return { ox: bw * 0.5, oy: bh * 0.5 };
  var mpx = raw.match(/^(-?[\d.]+)px\s+(-?[\d.]+)px$/i);
  if (mpx) {
    var ox0 = parseFloat(mpx[1]);
    var oy0 = parseFloat(mpx[2]);
    if (isFinite(ox0) && isFinite(oy0)) return { ox: ox0, oy: oy0 };
  }
  var parts = _splitBySpaceOutsideParens(raw);
  if (parts.length >= 3 && /^-?[\d.]+px$/i.test(String(parts[2] || '').trim())) {
    parts = parts.slice(0, 2);
  }
  function lenOrPctToken(tok, dim) {
    if (tok == null || tok === '') return null;
    var t = String(tok).trim();
    var tl = t.toLowerCase();
    if (tl === 'left' || tl === 'top') return 0;
    if (tl === 'center') return dim * 0.5;
    if (tl === 'right' || tl === 'bottom') return dim;
    if (t.indexOf('%') >= 0) {
      var pct = parseFloat(t);
      return isFinite(pct) && isFinite(dim) ? (pct * dim) / 100 : null;
    }
    var n = parseFloat(t.replace(/px$/i, ''));
    return isFinite(n) ? n : null;
  }
  var ox;
  var oy;
  if (!parts.length) return { ox: bw * 0.5, oy: bh * 0.5 };
  if (parts.length === 1) {
    var p0 = parts[0].trim();
    var p0l = p0.toLowerCase();
    if (p0l === 'top' || p0l === 'bottom') {
      ox = bw * 0.5;
      oy = lenOrPctToken(p0, bh);
    } else if (p0l === 'left' || p0l === 'right' || p0l === 'center') {
      ox = lenOrPctToken(p0, bw);
      oy = bh * 0.5;
    } else {
      ox = lenOrPctToken(p0, bw);
      oy = bh * 0.5;
    }
  } else {
    var t0 = parts[0].trim();
    var t1 = parts[1].trim();
    var t0l = t0.toLowerCase();
    var t1l = t1.toLowerCase();
    if (t0l === 'top' || t0l === 'bottom') {
      oy = lenOrPctToken(t0, bh);
      ox = lenOrPctToken(t1, bw);
      if (ox == null) ox = bw * 0.5;
    } else if (t0l === 'left' || t0l === 'right' || t0l === 'center') {
      ox = lenOrPctToken(t0, bw);
      oy = lenOrPctToken(t1, bh);
      if (oy == null) oy = bh * 0.5;
    } else if (t1l === 'top' || t1l === 'bottom') {
      ox = lenOrPctToken(t0, bw);
      oy = lenOrPctToken(t1, bh);
    } else if (t1l === 'left' || t1l === 'right' || t1l === 'center') {
      ox = lenOrPctToken(t1, bw);
      oy = lenOrPctToken(t0, bh);
    } else {
      ox = lenOrPctToken(t0, bw);
      oy = lenOrPctToken(t1, bh);
    }
  }
  if (ox == null || !isFinite(ox)) ox = bw * 0.5;
  if (oy == null || !isFinite(oy)) oy = bh * 0.5;
  return { ox: ox, oy: oy };
}

/**
 * 已知旋转后 AABB（相对父）、CSS matrix 的 2×2 部分、border 尺寸与 transform-origin，
 * 反推未旋转 border-box 左上角 (sx,sy)。与「绕 AABB 中心 = 旋转中心」等价于 origin 为 50% 50%。
 */
function _layoutUnrotatedFromRotatedAabb(ax, ay, aw, ah, a, b, c, d, bw, bh, ox, oy) {
  var corners = [[0, 0], [bw, 0], [bw, bh], [0, bh]];
  var minVx = Infinity;
  var maxVx = -Infinity;
  var minVy = Infinity;
  var maxVy = -Infinity;
  for (var i = 0; i < corners.length; i++) {
    var lx = corners[i][0];
    var ly = corners[i][1];
    var vx = lx - ox;
    var vy = ly - oy;
    var rx = a * vx + c * vy;
    var ry = b * vx + d * vy;
    var ViX = ox + rx;
    var ViY = oy + ry;
    if (ViX < minVx) minVx = ViX;
    if (ViX > maxVx) maxVx = ViX;
    if (ViY < minVy) minVy = ViY;
    if (ViY > maxVy) maxVy = ViY;
  }
  var sx = ax - minVx;
  var sy = ay - minVy;
  var errX = Math.abs(ax + aw - (sx + maxVx));
  var errY = Math.abs(ay + ah - (sy + maxVy));
  return { sx: sx, sy: sy, ok: errX < 1.5 && errY < 1.5 };
}

function buildStyleJSON(el, computed, rect, parentRect, cssRuleMap, globalFont) {
  const style = {};
  const num = (v) => (v === '' || v == null ? undefined : parseFloat(String(v)));
  const px = (v) => {
    const n = num(v);
    return n != null && !Number.isNaN(n) ? Math.round(n) : undefined;
  };

  // 优先从 style 标签匹配到的规则取声明，没有再用 computed
  var decl = (cssRuleMap && Object.keys(cssRuleMap).length > 0) ? getDeclaredStyleForElement(el, cssRuleMap) : {};
  function d(keys) {
    var k = Array.isArray(keys) ? keys : [keys];
    for (var i = 0; i < k.length; i++) if (decl[k[i]] != null && decl[k[i]] !== '') return decl[k[i]];
    return undefined;
  }

  // 位置与宽高一律用 API 实测值（rect 来自 getDesignRect），避免 CSS 规则里 100% 等被误解析成 100
  const x = parentRect ? rect.left - parentRect.left : rect.left;
  const y = parentRect ? rect.top - parentRect.top : rect.top;
  style.x = x;
  style.y = y;
  // 相对父节点的亚像素偏移（旋转 AABB 反推未旋转位置时用）
  var xRelSub = x;
  var yRelSub = y;
  // 实测宽高（亚像素）：原样透传，保留浮点精度
  const wSub = rect.width != null && rect.width >= 0 ? rect.width : undefined;
  const hSub = rect.height != null && rect.height >= 0 ? rect.height : undefined;
  const w = wSub;
  const h = hSub;
  if (w != null) style.width = w;
  if (h != null) style.height = h;

  // border-radius 含 % 时不能用 parseFloat：'50%' → 50 会被误当成 50px（圆盘等场景应为 min(w,h) 的一半）。
  // CSS 椭圆角水平半径相对 width、垂直相对 height；导出为 Figma 单标量 cornerRadius 时取 min 近似内接圆角。
  const pxLenRadius = (v) => {
    if (v == null || v === '') return undefined;
    var str = String(v).trim();
    if (!str || str === 'none') return undefined;
    if (str.indexOf('%') >= 0) {
      var pct = parseFloat(str);
      if (!isFinite(pct) || w == null || h == null || !(w > 0) || !(h > 0)) return undefined;
      var rx = (w * pct) / 100;
      var ry = (h * pct) / 100;
      return Math.round(Math.min(rx, ry));
    }
    var n = parseFloat(str);
    return isFinite(n) && !Number.isNaN(n) ? Math.round(n) : undefined;
  };

  const rotation = num(computed.transform);
  if (computed.transform && computed.transform !== 'none') {
    const angle = parseTransformRotation(computed.transform);
    if (angle != null) {
      style.rotation = -angle; // CSS 顺时针为正，Figma 逆时针为正，需取反
      // getBoundingClientRect 为旋转后 AABB；按 matrix 2×2 + transform-origin 反推未旋转 x/y/w/h。
      // 旧逻辑假定旋转中心 = AABB 中心（等价于 origin 50% 50%），绕非中心点旋转（如圆盘绕大圆心）会错位。
      if (angle !== 0 && rect.width != null && rect.height != null) {
        var _appliedOrigin = false;
        var _matM = computed.transform.match(/matrix\(([^)]+)\)/);
        if (_matM && el) {
          var _mp = _matM[1].split(',').map(function (s) { return parseFloat(String(s).trim()); });
          if (_mp.length >= 6 && _mp.every(function (n) { return isFinite(n); })) {
            var _e = _mp[4];
            var _f = _mp[5];
            if (_isApproxPureRotation2D(_mp[0], _mp[1], _mp[2], _mp[3]) && Math.hypot(_e, _f) <= 1) {
              var _oStr = d(['transform-origin', 'transformOrigin']) || (computed.transformOrigin || '');
              var _bw = el.offsetWidth;
              var _bh = el.offsetHeight;
              if (_bw > 0 && _bh > 0) {
                var _po = parseTransformOriginOffsetsPx(_oStr, _bw, _bh);
                var _lay = _layoutUnrotatedFromRotatedAabb(
                  xRelSub,
                  yRelSub,
                  rect.width,
                  rect.height,
                  _mp[0],
                  _mp[1],
                  _mp[2],
                  _mp[3],
                  _bw,
                  _bh,
                  _po.ox,
                  _po.oy
                );
                if (_lay.ok) {
                  // ir-to-figma 当前使用的是“绕局部原点(0,0)旋转”的矩阵编码；
                  // CSS transform 是“绕 transform-origin 旋转”。
                  // 需把平移项从 sx/sy（未旋转左上角）补偿为等价的原点旋转平移：
                  // t' = s + O - R*O（O=transform-origin）
                  var _txComp = _lay.sx + _po.ox - (_mp[0] * _po.ox + _mp[2] * _po.oy);
                  var _tyComp = _lay.sy + _po.oy - (_mp[1] * _po.ox + _mp[3] * _po.oy);
                  style.x = Math.round(_txComp);
                  style.y = Math.round(_tyComp);
                  style.width = Math.round(_bw);
                  style.height = Math.round(_bh);
                  _appliedOrigin = true;
                }
              }
            }
          }
        }
        if (!_appliedOrigin) {
          const angleRad = (angle * Math.PI) / 180;
          const cosA = Math.abs(Math.cos(angleRad));
          const sinA = Math.abs(Math.sin(angleRad));
          // det = cos²θ - sin²θ = cos(2θ)，趋近 0（θ≈45°）时无法区分 W/H，跳过修正
          const det = cosA * cosA - sinA * sinA;
          if (Math.abs(det) > 0.01) {
            const aabbW = rect.width;
            const aabbH = rect.height;
            const origW = (aabbW * cosA - aabbH * sinA) / det;
            const origH = (aabbH * cosA - aabbW * sinA) / det;
            if (origW > 0 && origH > 0) {
              const cx = style.x + aabbW / 2;
              const cy = style.y + aabbH / 2;
              style.x = Math.round(cx - origW / 2);
              style.y = Math.round(cy - origH / 2);
              style.width = Math.round(origW);
              style.height = Math.round(origH);
            }
          }
        }
      }
    }
  } else {
    // CSS Transforms Level 2 独立属性：rotate / scale / translate。
    // 部分浏览器中 getComputedStyle(el).transform 对这类属性返回 'none'，
    // 需要单独读取 computed.rotate 作为兜底。
    // rotate 属性格式：'-90deg' | '0.5turn' | '1rad' 等
    var _rotateRaw = (computed && computed.rotate) || '';
    if (_rotateRaw && _rotateRaw !== 'none') {
      var _rotateAngle = null;
      if (_rotateRaw.endsWith('deg')) {
        _rotateAngle = parseFloat(_rotateRaw);
      } else if (_rotateRaw.endsWith('rad')) {
        _rotateAngle = parseFloat(_rotateRaw) * 180 / Math.PI;
      } else if (_rotateRaw.endsWith('turn')) {
        _rotateAngle = parseFloat(_rotateRaw) * 360;
      }
      if (_rotateAngle != null && !isNaN(_rotateAngle) && _rotateAngle !== 0) {
        style.rotation = -_rotateAngle; // CSS 顺时针为正，Figma 逆时针为正
        if (rect.width != null && rect.height != null) {
          var _rAppliedOrigin = false;
          var _rRad = (_rotateAngle * Math.PI) / 180;
          var _ra = Math.cos(_rRad);
          var _rb = Math.sin(_rRad);
          var _rc = -Math.sin(_rRad);
          var _rd = Math.cos(_rRad);
          if (el && _isApproxPureRotation2D(_ra, _rb, _rc, _rd)) {
            var _rOstr = d(['transform-origin', 'transformOrigin']) || (computed.transformOrigin || '');
            var _rBw = el.offsetWidth;
            var _rBh = el.offsetHeight;
            if (_rBw > 0 && _rBh > 0) {
              var _rPo = parseTransformOriginOffsetsPx(_rOstr, _rBw, _rBh);
              var _rLay = _layoutUnrotatedFromRotatedAabb(
                xRelSub,
                yRelSub,
                rect.width,
                rect.height,
                _ra,
                _rb,
                _rc,
                _rd,
                _rBw,
                _rBh,
                _rPo.ox,
                _rPo.oy
              );
              if (_rLay.ok) {
                // 与 matrix(...) 分支一致：把“绕 origin 旋转”的平移补偿进 x/y。
                var _rTxComp = _rLay.sx + _rPo.ox - (_ra * _rPo.ox + _rc * _rPo.oy);
                var _rTyComp = _rLay.sy + _rPo.oy - (_rb * _rPo.ox + _rd * _rPo.oy);
                style.x = Math.round(_rTxComp);
                style.y = Math.round(_rTyComp);
                style.width = Math.round(_rBw);
                style.height = Math.round(_rBh);
                _rAppliedOrigin = true;
              }
            }
          }
          if (!_rAppliedOrigin) {
            const _rCosA = Math.abs(Math.cos(_rRad));
            const _rSinA = Math.abs(Math.sin(_rRad));
            const _rDet = _rCosA * _rCosA - _rSinA * _rSinA;
            if (Math.abs(_rDet) > 0.01) {
              const _rAabbW = rect.width;
              const _rAabbH = rect.height;
              const _rOrigW = (_rAabbW * _rCosA - _rAabbH * _rSinA) / _rDet;
              const _rOrigH = (_rAabbH * _rCosA - _rAabbW * _rSinA) / _rDet;
              if (_rOrigW > 0 && _rOrigH > 0) {
                const _rCx = style.x + _rAabbW / 2;
                const _rCy = style.y + _rAabbH / 2;
                style.x = Math.round(_rCx - _rOrigW / 2);
                style.y = Math.round(_rCy - _rOrigH / 2);
                style.width = Math.round(_rOrigW);
                style.height = Math.round(_rOrigH);
              }
            }
          }
        }
      }
    }
  }

  var opacityVal = d(['opacity']) || computed.opacity;
  if (opacityVal != null) {
    var o = parseFloat(opacityVal);
    if (!Number.isNaN(o) && o < 1) style.opacity = o;
  }

  // clip-path: polygon(...)：记录为点集，供 IR→Figma 阶段生成 VECTOR 背景还原异形容器。
  var _clipPathRaw = d(['clip-path', 'clipPath']) || (computed && (computed.clipPath || computed.webkitClipPath));
  if (_clipPathRaw && _clipPathRaw !== 'none') {
    var _polygonPoints = parseClipPathPolygon(_clipPathRaw, wSub, hSub);
    if (_polygonPoints && _polygonPoints.length >= 3) {
      style.clipPathPolygon = _polygonPoints;
    }
  }

  // min-width / min-height / max-width / max-height → Figma minSize / maxSize
  var _minW = px(computed.minWidth);
  var _minH = px(computed.minHeight);
  // 百分比值（如 max-width: 100%）会被 parseFloat 误解析成 100px，需跳过
  var _isMaxWPct = (function () {
    var raw = d(['max-width', 'maxWidth']) || (computed && computed.maxWidth);
    if (raw && String(raw).indexOf('%') >= 0) return true;
    // 兜底：声明和 computed 都没有 %，但 el.style 中有百分比
    var inl = el && el.style && el.style.maxWidth;
    if (inl && String(inl).indexOf('%') >= 0) return true;
    return false;
  })();
  var _isMaxHPct = (function () {
    var raw = d(['max-height', 'maxHeight']) || (computed && computed.maxHeight);
    if (raw && String(raw).indexOf('%') >= 0) return true;
    var inl = el && el.style && el.style.maxHeight;
    if (inl && String(inl).indexOf('%') >= 0) return true;
    return false;
  })();
  var _maxW = _isMaxWPct ? undefined : px(computed.maxWidth);
  var _maxH = _isMaxHPct ? undefined : px(computed.maxHeight);
  // 二次兜底：maxWidth 远小于实际宽度时可能是百分比误转（如 100% → 100px）
  if (_maxW != null && w != null && _maxW < w * 0.5) _maxW = undefined;
  if (_maxH != null && h != null && _maxH < h * 0.5) _maxH = undefined;
  if ((_minW != null && _minW > 0) || (_minH != null && _minH > 0)) {
    style.minWidth = _minW || undefined;
    style.minHeight = _minH || undefined;
  }
  if ((_maxW != null && _maxW > 0) || (_maxH != null && _maxH > 0)) {
    style.maxWidth = _maxW || undefined;
    style.maxHeight = _maxH || undefined;
  }

  // overflow: visible → Figma clipsContent = false（默认 true 会裁切溢出内容）
  var overflowVal = d(['overflow']) || computed.overflow;
  if (overflowVal && overflowVal.trim() === 'visible') {
    style.clipsContent = false;
  }

  // Background -> fills（优先 style 标签里的 background-image/background，再 computed）
  // 修复：bgImageDecl 存在但不含渐变时（如纯色 background 简写），不应屏蔽 computed.backgroundImage 里的渐变。
  // 正确策略：先用 declared background-image，没有则用 computed.backgroundImage，两者都没有再试 declared background 简写。
  var bgImageDecl = d(['background-image', 'backgroundImage']);
  var bgImageComputed = computed.backgroundImage || '';
  var bgImageFromBackground = d(['background']);
  var bgBackgroundRaw = d(['background']) || (computed && computed.background) || '';
  var bgImage = '';
  if (bgImageDecl && bgImageDecl !== 'none') {
    bgImage = bgImageDecl;
  } else if (bgImageComputed && bgImageComputed !== 'none') {
    bgImage = bgImageComputed;
  } else if (bgImageFromBackground && (bgImageFromBackground.indexOf('linear-gradient') >= 0 || bgImageFromBackground.indexOf('radial-gradient') >= 0)) {
    bgImage = bgImageFromBackground;
  }
  // 检测 background-size 是否为具体像素值（如 "200px 200px"），若是则该渐变为平铺图案。
  // Figma 的 GRADIENT_LINEAR 不支持平铺，需在内联阶段用 Canvas 绘制成位图，以 IMAGE TILE 写入。
  var _bgSizeRaw = d(['background-size', 'backgroundSize']) || computed.backgroundSize || '';
  var _bgTileW = 0, _bgTileH = 0;
  (function () {
    if (!_bgSizeRaw) return;
    var _parts = _bgSizeRaw.trim().split(/\s+/);
    var _kw = /^(auto|cover|contain)$/i;
    if (_parts[0] && !_kw.test(_parts[0])) {
      var _w = parseFloat(_parts[0]);
      var _h = _parts.length >= 2 && !_kw.test(_parts[1]) ? parseFloat(_parts[1]) : _w;
      if (!isNaN(_w) && _w > 0 && !isNaN(_h) && _h > 0) {
        _bgTileW = _w;
        _bgTileH = _h;
      }
    }
  })();
  // 斜条纹等「渐变 + 固定平铺单元」常把尺寸写在 background 简写里（如 linear-gradient(...) / 200px 200px），
  // 单独读 background-size 可能为空，导致 _bgTileW=0、退化为整幅 GRADIENT_LINEAR（无细密条纹）。
  if ((!_bgTileW || !_bgTileH) && bgImage && bgImage.indexOf('linear-gradient') >= 0) {
    var _bgShForTile = d(['background']) || '';
    try {
      if (!_bgShForTile && computed && computed.background) _bgShForTile = computed.background;
    } catch (_eBgTile) {}
    if (_bgShForTile && typeof _bgShForTile === 'string') {
      var _slashPair = _bgShForTile.match(/\/\s*([\d.]+)px\s+([\d.]+)px/i);
      if (_slashPair) {
        var _twS = parseFloat(_slashPair[1]);
        var _thS = parseFloat(_slashPair[2]);
        if (!isNaN(_twS) && _twS > 0 && !isNaN(_thS) && _thS > 0) {
          _bgTileW = _twS;
          _bgTileH = _thS;
        }
      } else {
        var _slashOne = _bgShForTile.match(/\/\s*([\d.]+)px(?:\s*[,;]|$)/i);
        if (_slashOne) {
          var _oneS = parseFloat(_slashOne[1]);
          if (!isNaN(_oneS) && _oneS > 0) {
            _bgTileW = _oneS;
            _bgTileH = _oneS;
          }
        }
      }
    }
  }
  var _bgColorDecl = d(['background-color', 'backgroundColor']) || computed.backgroundColor;
  // 若声明层取到的是 CSS 变量，回退到 computed 实际解析值
  if (_bgColorDecl && _bgColorDecl.indexOf('var(') >= 0) {
    _bgColorDecl = computed.backgroundColor || _bgColorDecl;
  }
  var _bgColorRgba = _bgColorDecl ? cssColorToRgba(_bgColorDecl) : null;
  var _gradientFnMatches = bgImage ? bgImage.match(/(?:linear|radial)-gradient\s*\(/gi) : null;
  var _isMultiGradient = !!(_gradientFnMatches && _gradientFnMatches.length > 1);
  var gradientFill = bgImage ? (parseLinearGradientFromBgImage(bgImage) || parseRadialGradientFromBgImage(bgImage)) : null;
  var imageUrl = bgImage ? parseUrlFromBgImage(bgImage) : null;
  if (_isMultiGradient && wSub > 0 && hSub > 0) {
    // 多重渐变（常见于多层 radial 叠加）在 Figma 原生渐变里很难等价表达，降级为位图导出。
    // 这里写入 IMAGE 占位，由 image-inline.js 异步栅格化为 data URL（scaleMode=FILL）。
    var _gradientAsImage = { type: 'IMAGE', cssGradient: bgImage, scaleMode: 'FILL' };
    if (bgBackgroundRaw && String(bgBackgroundRaw).indexOf('gradient') >= 0) {
      _gradientAsImage.cssBackground = bgBackgroundRaw;
    }
    if (_bgColorRgba && _bgColorRgba !== 'rgba(0, 0, 0, 0)') {
      _gradientAsImage.cssBackgroundColor = _bgColorRgba;
      style.fills = [_bgColorRgba, _gradientAsImage];
    } else {
      style.fills = [_gradientAsImage];
    }
  } else if (gradientFill && _bgTileW > 0 && _bgTileH > 0) {
    // 平铺渐变：标记为 TILED_GRADIENT，由 image-inline.js 在异步阶段用 Canvas 渲染成位图后以 IMAGE TILE 写入
    style.fills = [{ type: 'TILED_GRADIENT', bgImage: bgImage, bgSizeW: _bgTileW, bgSizeH: _bgTileH }];
  } else if (gradientFill) {
    // 同时保留背景色作为底层 fill，避免渐变透明区域在 Figma 中透出阴影导致整体变深
    style.fills = _bgColorRgba ? [_bgColorRgba, gradientFill] : [gradientFill];
  } else if (imageUrl) {
    style.fills = [{ type: 'IMAGE', url: imageUrl }];
  } else {
    var bg = d(['background-color', 'backgroundColor', 'background']) || computed.backgroundColor;
    // 若声明层取到的是 CSS 变量，回退到 computed 实际解析值
    if (bg && bg.indexOf('var(') >= 0) {
      bg = computed.backgroundColor || bg;
    }
    if (bg) {
      var rgba = cssColorToRgba(bg);
      if (rgba && rgba !== 'rgba(0, 0, 0, 0)') {
        style.fills = [rgba];
      }
    }
  }

  // 渐变文字：background-clip:text + color/webkit-text-fill-color 为 transparent
  // CSS 用 background 渐变裁剪到文字轮廓，Figma text 节点的 fillPaints 原生支持渐变，在此转换。
  var _gtBgClip2;
  try { _gtBgClip2 = computed && computed.getPropertyValue && (computed.getPropertyValue('background-clip') || computed.getPropertyValue('-webkit-background-clip')); } catch (_e3) {}
  if (!_gtBgClip2) _gtBgClip2 = d(['background-clip', 'backgroundClip', '-webkit-background-clip']) || (computed && (computed.backgroundClip || computed.webkitBackgroundClip));
  if (_gtBgClip2 && String(_gtBgClip2).indexOf('text') >= 0) {
    var _gtTextFill2;
    try { _gtTextFill2 = computed && computed.getPropertyValue && computed.getPropertyValue('-webkit-text-fill-color'); } catch (_e4) {}
    if (!_gtTextFill2) _gtTextFill2 = d(['-webkit-text-fill-color', 'webkitTextFillColor']) || (computed && computed.webkitTextFillColor);
    var _gtColorVal2 = d(['color']) || (computed && computed.color);
    var _gtIsTransp2 = function (c) {
      if (!c) return true;
      var cs = String(c).trim();
      if (cs === 'transparent') return true;
      var m = cs.match(/^rgba?\(\s*\d+\s*,\s*\d+\s*,\s*\d+\s*,\s*([\d.]+)\s*\)$/);
      return !!(m && parseFloat(m[1]) === 0);
    };
    if (_gtIsTransp2(_gtColorVal2) || _gtIsTransp2(_gtTextFill2)) {
      var _gtGradFill2 = null;
      if (style.fills && style.fills.length) {
        for (var _gtFi = 0; _gtFi < style.fills.length; _gtFi++) {
          var _gtF = style.fills[_gtFi];
          if (_gtF && typeof _gtF === 'object' && (_gtF.type === 'GRADIENT_LINEAR' || _gtF.type === 'GRADIENT_RADIAL')) {
            _gtGradFill2 = _gtF;
            break;
          }
        }
      }
      if (!_gtGradFill2) {
        var _gtBgImgFallback = (computed && computed.backgroundImage) || '';
        if (_gtBgImgFallback && _gtBgImgFallback !== 'none') {
          _gtGradFill2 = parseLinearGradientFromBgImage(_gtBgImgFallback) || parseRadialGradientFromBgImage(_gtBgImgFallback);
        }
      }
      if (_gtGradFill2) {
        style.textGradientFill = _gtGradFill2;
        style.fills = undefined;
        style.color = undefined;
      }
    }
  }

  // Border：先尝试四边独立检测（border-top/right/bottom/left），不一致时输出各自的 strokeXxxWeight；
  // 四边完全相同时退化为统一的 strokeWeight，以保持对旧版消费端的兼容。
  var _btW = px(d(['border-top-width']) || computed.borderTopWidth) || 0;
  var _brW = px(d(['border-right-width']) || computed.borderRightWidth) || 0;
  var _bbW = px(d(['border-bottom-width']) || computed.borderBottomWidth) || 0;
  var _blW = px(d(['border-left-width']) || computed.borderLeftWidth) || 0;
  var _btStyle = (d(['border-top-style']) || computed.borderTopStyle || 'none').toString().toLowerCase();
  var _brStyle = (d(['border-right-style']) || computed.borderRightStyle || 'none').toString().toLowerCase();
  var _bbStyle = (d(['border-bottom-style']) || computed.borderBottomStyle || 'none').toString().toLowerCase();
  var _blStyle = (d(['border-left-style']) || computed.borderLeftStyle || 'none').toString().toLowerCase();
  var _btColor = d(['border-top-color']) || computed.borderTopColor;
  var _brColor = d(['border-right-color']) || computed.borderRightColor;
  var _bbColor = d(['border-bottom-color']) || computed.borderBottomColor;
  var _blColor = d(['border-left-color']) || computed.borderLeftColor;
  // 若声明层取到的是 CSS 变量，回退到 computed 实际解析值
  if (_btColor && _btColor.indexOf('var(') >= 0) _btColor = computed.borderTopColor || _btColor;
  if (_brColor && _brColor.indexOf('var(') >= 0) _brColor = computed.borderRightColor || _brColor;
  if (_bbColor && _bbColor.indexOf('var(') >= 0) _bbColor = computed.borderBottomColor || _bbColor;
  if (_blColor && _blColor.indexOf('var(') >= 0) _blColor = computed.borderLeftColor || _blColor;
  // border 简写兜底：若四边均未读到有效值，尝试 border 简写
  var _borderShorthand = d(['border']);
  if (_borderShorthand && (_btW === 0 && _brW === 0 && _bbW === 0 && _blW === 0)) {
    var _parsedB = parseBorderShorthand(_borderShorthand);
    if (_parsedB && _parsedB.width > 0) {
      _btW = _brW = _bbW = _blW = _parsedB.width;
      _btStyle = _brStyle = _bbStyle = _blStyle = _parsedB.style || 'solid';
      _btColor = _brColor = _bbColor = _blColor = _parsedB.color;
    }
  }
  // 过滤掉 style=none 的边（视为无边框）
  if (_btStyle === 'none') _btW = 0;
  if (_brStyle === 'none') _brW = 0;
  if (_bbStyle === 'none') _bbW = 0;
  if (_blStyle === 'none') _blW = 0;
  var _hasBorder = _btW > 0 || _brW > 0 || _bbW > 0 || _blW > 0;
  if (_hasBorder) {
    var _allSameW = (_btW === _brW && _brW === _bbW && _bbW === _blW);
    var _btColorN = cssColorToRgba(_btColor) || _btColor || 'rgba(0, 0, 0, 0)';
    var _brColorN = cssColorToRgba(_brColor) || _brColor || 'rgba(0, 0, 0, 0)';
    var _bbColorN = cssColorToRgba(_bbColor) || _bbColor || 'rgba(0, 0, 0, 0)';
    var _blColorN = cssColorToRgba(_blColor) || _blColor || 'rgba(0, 0, 0, 0)';
    var _allSameColor = (_btColorN === _brColorN && _brColorN === _bbColorN && _bbColorN === _blColorN);
    if (_allSameW && _allSameColor) {
      // 四边统一，用简单的 strokeWeight（兼容旧格式）
      style.strokeWeight = _btW;
      style.strokeColor = _btColorN;
    } else {
      // 四边不同，分别输出各自宽度和颜色
      // strokeColor/strokeWeight 用有效边中第一个的颜色（Figma strokes 颜色统一），宽度用 individualStrokeWeights
      var _firstColor = _btW > 0 ? _btColorN : (_brW > 0 ? _brColorN : (_bbW > 0 ? _bbColorN : _blColorN));
      style.strokeColor = _firstColor;
      style.strokeTopWeight = _btW;
      style.strokeRightWeight = _brW;
      style.strokeBottomWeight = _bbW;
      style.strokeLeftWeight = _blW;
    }
    // border-style → dashPattern: pick first non-none, non-solid style
    var _bStyles = [_btStyle, _brStyle, _bbStyle, _blStyle];
    for (var _si = 0; _si < _bStyles.length; _si++) {
      if (_bStyles[_si] === 'dashed' || _bStyles[_si] === 'dotted') {
        style.borderStyle = _bStyles[_si];
        break;
      }
    }
  }

  // Border radius：每角不要回退到整段 border-radius（parseFloat 只吃到第一个数）
  var tl = pxLenRadius(d(['border-top-left-radius', 'borderTopLeftRadius']));
  if (tl == null) tl = pxLenRadius(computed.borderTopLeftRadius);
  var tr = pxLenRadius(d(['border-top-right-radius', 'borderTopRightRadius']));
  if (tr == null) tr = pxLenRadius(computed.borderTopRightRadius);
  var brRad = pxLenRadius(d(['border-bottom-right-radius', 'borderBottomRightRadius']));
  if (brRad == null) brRad = pxLenRadius(computed.borderBottomRightRadius);
  var bl = pxLenRadius(d(['border-bottom-left-radius', 'borderBottomLeftRadius']));
  if (bl == null) bl = pxLenRadius(computed.borderBottomLeftRadius);
  if (tl == null && tr == null && brRad == null && bl == null) {
    var _brShr = d(['border-radius', 'borderRadius']) || computed.borderRadius;
    var _expBr = expandBorderRadiusShorthandToPxFour(_brShr, pxLenRadius);
    if (_expBr) {
      tl = _expBr[0];
      tr = _expBr[1];
      brRad = _expBr[2];
      bl = _expBr[3];
    }
  }
  if (tl != null || tr != null || brRad != null || bl != null) {
    var _tlN = tl ?? 0;
    var _trN = tr ?? 0;
    var _brN = brRad ?? 0;
    var _blN = bl ?? 0;
    if (_tlN === _trN && _trN === _brN && _brN === _blN) style.borderRadius = _tlN;
    else style.borderRadius = [_tlN, _trN, _brN, _blN];
  }

  // box-shadow -> shadows (DROP_SHADOW) + innerShadows (INNER_SHADOW)
  // 顺序：内联 style → cssRuleMap 声明 → computed；避免 WebKit 等省略 inset 导致内阴影误判为 DROP_SHADOW。
  var boxComputed = (computed && (computed.boxShadow || computed['box-shadow'])) || '';
  var boxInline = '';
  if (el && el.style) {
    try {
      var _bxIn = (el.style.boxShadow && String(el.style.boxShadow).trim()) || '';
      if (!_bxIn && typeof el.style.getPropertyValue === 'function') {
        _bxIn = String(el.style.getPropertyValue('box-shadow') || el.style.getPropertyValue('-webkit-box-shadow') || '').trim();
      }
      if (_bxIn && _bxIn !== 'none') boxInline = _bxIn;
    } catch (_) {}
  }
  var boxDeclRaw = d(['box-shadow', 'boxShadow']);
  var boxShadowStr = '';
  if (boxInline) {
    var _bsInl = String(boxInline).trim();
    if (_bsInl.indexOf('var(') >= 0 || _bsInl.toLowerCase().indexOf('calc(') >= 0) {
      boxShadowStr = boxComputed;
    } else {
      boxShadowStr = _bsInl;
    }
  } else if (boxDeclRaw != null && String(boxDeclRaw).trim() !== '' && String(boxDeclRaw).trim() !== 'none') {
    var _bsDecl = String(boxDeclRaw).trim();
    if (_bsDecl.indexOf('var(') >= 0 || _bsDecl.toLowerCase().indexOf('calc(') >= 0) {
      boxShadowStr = boxComputed;
    } else {
      boxShadowStr = _bsDecl;
    }
  }
  if (!boxShadowStr || String(boxShadowStr).trim() === '' || String(boxShadowStr).trim() === 'none') {
    boxShadowStr = boxComputed;
  }
  if (boxShadowStr && String(boxShadowStr).trim() !== '' && String(boxShadowStr).trim() !== 'none' && String(boxShadowStr).indexOf('inset') < 0 && cssRuleMap) {
    var _insetBsFallback = findInsetBoxShadowFromCssRuleMap(el, cssRuleMap);
    if (_insetBsFallback) boxShadowStr = _insetBsFallback;
  }
  if (boxShadowStr && String(boxShadowStr).trim() !== '' && String(boxShadowStr).trim() !== 'none') {
    var _allShadows = parseBoxShadow(String(boxShadowStr));
    _allShadows = _allShadows.filter(function (s) {
      return s.blur > 0 || s.offsetX !== 0 || s.offsetY !== 0 || (s.spread && s.spread !== 0);
    });
    var _outerShadows = _allShadows.filter(function (s) { return !s.inset; });
    var _innerShadows = _allShadows.filter(function (s) { return s.inset; });
    if (_outerShadows.length > 0) style.shadows = _outerShadows;
    if (_innerShadows.length > 0) style.innerShadows = _innerShadows;
  }

  // filter: blur(Xpx) → layerBlur（Figma LAYER_BLUR effect）
  var _filterVal = d(['filter']) || (computed && (computed.filter || computed['filter'])) || '';
  if (_filterVal && typeof _filterVal === 'string' && _filterVal !== 'none') {
    var _blurMatch = _filterVal.match(/\bblur\s*\(\s*([\d.]+)\s*px\s*\)/i);
    if (_blurMatch) {
      var _blurRadius = parseFloat(_blurMatch[1]);
      if (_blurRadius > 0) style.layerBlur = _blurRadius;
    }
  }

  // Flex / Grid -> Auto layout（gap 等同 itemSpacing）；padding 仅来自声明或 computed，不再与 margin 混合
  var display = d(['display']) || computed.display;
  // [debug:layout] 追踪 radio-button-wrapper / label 的 display 和布局判断
  var _isRadioWrapper = (el.className && typeof el.className === 'string' && el.className.indexOf('radio-button-wrapper') !== -1);
  if (_isRadioWrapper) {
  }
  if (display === 'flex' || display === 'inline-flex') {
    var dir = d(['flex-direction', 'flexDirection']) || computed.flexDirection;
    style.layoutMode = dir === 'column' || dir === 'column-reverse' ? 'VERTICAL' : 'HORIZONTAL';
    var gap = px(d(['gap']) || computed.gap);
    if (gap != null && gap > 0) style.itemSpacing = gap;
    // flex-wrap: wrap → Figma layoutWrap=WRAP；同时读 row-gap 作为换行后的行间距(counterAxisSpacing)
    var flexWrapVal = (d(['flex-wrap', 'flexWrap']) || computed.flexWrap || '').toString().toLowerCase();
    if (flexWrapVal === 'wrap' || flexWrapVal === 'wrap-reverse') {
      if (style.layoutMode === 'HORIZONTAL') {
        style.layoutWrap = 'WRAP';
        var rowGap = px(d(['row-gap', 'rowGap']) || computed.rowGap);
        if (rowGap != null && rowGap > 0) style.counterAxisSpacing = rowGap;
      }
    }
    style.paddingTop = px(d(['padding-top', 'paddingTop']) || computed.paddingTop);
    style.paddingRight = px(d(['padding-right', 'paddingRight']) || computed.paddingRight);
    style.paddingBottom = px(d(['padding-bottom', 'paddingBottom']) || computed.paddingBottom);
    style.paddingLeft = px(d(['padding-left', 'paddingLeft']) || computed.paddingLeft);
    var justifyContent = d(['justify-content', 'justifyContent']) || computed.justifyContent;
    var alignItems = d(['align-items', 'alignItems']) || computed.alignItems;
    // 当 computed 返回浏览器默认值 "normal" 时，主动扫描 cssRuleMap 用 el.matches() 寻找声明值
    // 场景：Shadow DOM 内 getComputedStyle 未能拿到 antd CSS cascade 的值，但 style 标签里有规则
    if ((!alignItems || alignItems === 'normal') && cssRuleMap && typeof el.matches === 'function') {
      for (var _sel in cssRuleMap) {
        var _cssText = cssRuleMap[_sel] || '';
        if (_cssText.indexOf('align-items') === -1) continue;
        var _matched = false;
        try { _matched = el.matches(_sel); } catch (_e) {}
        if (!_matched) continue;
        var _parts = _cssText.split(';');
        for (var _pi = 0; _pi < _parts.length; _pi++) {
          var _part = _parts[_pi].trim();
          var _col = _part.indexOf(':');
          if (_col <= 0) continue;
          var _key = _part.slice(0, _col).trim();
          var _val = _part.slice(_col + 1).trim();
          if (_key === 'align-items' && _val) { alignItems = _val; break; }
        }
        if (alignItems && alignItems !== 'normal') break;
      }
    }
    // Flex：align-items 初始值为 stretch。getComputedStyle 常返回关键字 normal（与 CSS 初始一致），
    // 若仍按「未知」走下方几何反推，在表格等高行 + 矮文本场景下易把交叉轴误判为 center。
    // 在几何反推之前将 normal/空 视为 stretch，与浏览器 flex 盒模型一致。
    var _alignItemsRaw = alignItems == null ? '' : String(alignItems).trim().toLowerCase();
    if (!_alignItemsRaw || _alignItemsRaw === 'normal') {
      alignItems = 'stretch';
    }
    // 终极 fallback：cssRuleMap 里没有规则（如 antd 全局 CSS 不在 style 标签内），
    // 且 computed 也是 "normal"（Shadow DOM cascade 丢失），改用子元素实际位置反推。
    // HORIZONTAL flex 时：
    //   1. 优先找「高度明显小于行高（< containerH * 0.95）」的流内子项，用它的中心偏移判断 center / flex-start；
    //   2. 若流内子项全都≈满行高，说明是 align-items: stretch（默认拉满），直接视为 stretch（→ MIN），
    //      避免把「stretch 下盒子中心恰在行中」误判成 center；
    //   3. 若只有 height=0 的子项（SVG），用偏移法兜底。
    var _elClassForDebug = (el.className && typeof el.className === 'string') ? el.className : '';
    if ((!alignItems || alignItems === 'normal') && style.layoutMode === 'HORIZONTAL' && el.children && el.children.length > 0) {
      var _containerRect = el.getBoundingClientRect();
      var _containerH = _containerRect.height;
      var _containerTop = _containerRect.top;
      var _sampleChild = null;      // 找到的「矮」子项（未撑满行高），用于中心法
      var _fullHeightChild = null;  // 流内满高子项备用
      var _svgFallback = null;      // height=0 子项（SVG 等）备用
      for (var _ci = 0; _ci < el.children.length; _ci++) {
        var _ch = el.children[_ci];
        // 跳过脱离 flex 流的绝对定位子节点（其高度与行高无关）
        try {
          var _chPos = (window.getComputedStyle(_ch).position || '').toLowerCase();
          if (_chPos === 'absolute' || _chPos === 'fixed') continue;
        } catch (_ce) {}
        var _chH = _ch.getBoundingClientRect().height;
        if (_chH > 0 && _containerH > 0 && _chH < _containerH * 0.95) {
          _sampleChild = _ch; // 矮子项优先，找到即停
          break;
        }
        if (!_fullHeightChild && _chH > 0) _fullHeightChild = _ch;
        if (!_svgFallback && _chH === 0) _svgFallback = _ch;
      }
      if (_sampleChild && _containerH > 0) {
        // 用矮子项的位置判断 center / flex-start
        var _childRect = _sampleChild.getBoundingClientRect();
        if (_childRect.height > 0) {
          var _childCenterY = _childRect.top - _containerTop + _childRect.height / 2;
          var _containerCenterY = _containerH / 2;
          if (Math.abs(_childCenterY - _containerCenterY) < 3) {
            alignItems = 'center';
          } else if (_childCenterY > _containerCenterY) {
            alignItems = 'flex-end';
          } else {
            alignItems = 'flex-start';
          }
        } else {
          var _childOffsetY = _childRect.top - _containerTop;
          if (_childOffsetY > _containerH * 0.2 && _childOffsetY < _containerH * 0.8) {
            alignItems = 'center';
          } else if (_childOffsetY >= _containerH * 0.8) {
            alignItems = 'flex-end';
          } else {
            alignItems = 'flex-start';
          }
        }
      } else if (_fullHeightChild) {
        // 流内子项都≈满高 → align-items: stretch（默认值），stretch 映射为 MIN（交叉轴顶对齐）
        alignItems = 'stretch';
      } else if (_svgFallback && _containerH > 0) {
        // 只有 height=0 的 SVG 子项，用偏移法兜底
        var _childOffsetY = _svgFallback.getBoundingClientRect().top - _containerTop;
        if (_childOffsetY > _containerH * 0.2 && _childOffsetY < _containerH * 0.8) {
          alignItems = 'center';
        } else if (_childOffsetY >= _containerH * 0.8) {
          alignItems = 'flex-end';
        } else {
          alignItems = 'flex-start';
        }
      }
    }
    if ((!justifyContent || justifyContent === 'normal') && cssRuleMap && typeof el.matches === 'function') {
      for (var _selJ in cssRuleMap) {
        var _cssTextJ = cssRuleMap[_selJ] || '';
        if (_cssTextJ.indexOf('justify-content') === -1) continue;
        var _matchedJ = false;
        try { _matchedJ = el.matches(_selJ); } catch (_eJ) {}
        if (!_matchedJ) continue;
        var _partsJ = _cssTextJ.split(';');
        for (var _pj = 0; _pj < _partsJ.length; _pj++) {
          var _partJ = _partsJ[_pj].trim();
          var _colJ = _partJ.indexOf(':');
          if (_colJ <= 0) continue;
          var _keyJ = _partJ.slice(0, _colJ).trim();
          var _valJ = _partJ.slice(_colJ + 1).trim();
          if (_keyJ === 'justify-content' && _valJ) { justifyContent = _valJ; break; }
        }
        if (justifyContent && justifyContent !== 'normal') break;
      }
    }
    // 统一转 lowercase 再查表，避免大写/空格导致 map miss（如 "Center"、" center"）
    var alignItemsNorm = alignItems ? String(alignItems).trim().toLowerCase() : undefined;
    var justifyContentNorm = justifyContent ? String(justifyContent).trim().toLowerCase() : undefined;
    var alignMap = { 'flex-start': 'MIN', 'flex-end': 'MAX', center: 'CENTER', 'space-between': 'SPACE_BETWEEN', 'space-around': 'CENTER', 'space-evenly': 'CENTER', normal: 'MIN', stretch: 'MIN', baseline: 'BASELINE', start: 'MIN', end: 'MAX' };
    style.primaryAxisAlignItems = alignMap[justifyContentNorm] || 'MIN';
    // CSS：space-between 在仅 1 个参与排布的 flex 子项时贴在主轴起点；Figma SPACE_BETWEEN+单子项会居中，降级为 MIN/MAX
    if (justifyContentNorm === 'space-between' && style.primaryAxisAlignItems === 'SPACE_BETWEEN' && el.children) {
      var _inFlowFlexChildren = 0;
      var _inFlowHasFlexGrow = false;
      for (var _fi = 0; _fi < el.children.length; _fi++) {
        try {
          var _fpos = (window.getComputedStyle(el.children[_fi]).position || '').toLowerCase();
          if (_fpos === 'absolute' || _fpos === 'fixed') continue;
          _inFlowFlexChildren++;
          var _fgSb = parseFloat(window.getComputedStyle(el.children[_fi]).flexGrow || '0');
          if (!isNaN(_fgSb) && _fgSb >= 1) _inFlowHasFlexGrow = true;
        } catch (_fe) {}
      }
      if (_inFlowFlexChildren <= 1) {
        var _dirStr = (dir && String(dir).trim().toLowerCase()) || 'row';
        var _rowRev = _dirStr === 'row-reverse';
        var _colRev = _dirStr === 'column-reverse';
        var _rtl = computed && String(computed.direction || 'ltr').toLowerCase() === 'rtl';
        if (style.layoutMode === 'VERTICAL') {
          style.primaryAxisAlignItems = _colRev ? 'MAX' : 'MIN';
        } else {
          if (_rowRev) {
            style.primaryAxisAlignItems = _rtl ? 'MIN' : 'MAX';
          } else {
            style.primaryAxisAlignItems = _rtl ? 'MAX' : 'MIN';
          }
        }
      } else if (style.layoutMode === 'HORIZONTAL' && _inFlowFlexChildren >= 2 && _inFlowHasFlexGrow) {
        // 浏览器里 space-between 的「主轴留白」常被 flex-grow≥1 的子项吃掉；Figma 下 SPACE_BETWEEN 与 itemSpacing 易冲突。
        // 改 MIN + 可伸展子项 FILL，与常见「左/上贴齐 + 伸展项占满 + 固定宽尾项」一致。
        style.primaryAxisAlignItems = 'MIN';
      }
    }
    style.counterAxisAlignItems = alignMap[alignItemsNorm] || 'MIN';
    // 几何兜底：部分业务容器会通过 margin/局部偏移让视觉对齐与 CSS align-items 声明不一致。
    // 直接信声明值会把“实际贴顶”的节点误导成 MAX（贴底）。改为用子节点几何关系二次校准。
    if (style.layoutMode === 'HORIZONTAL' && el.children && el.children.length > 1) {
      var _hostRect = el.getBoundingClientRect();
      var _h = _hostRect.height || 0;
      if (_h > 0) {
        var _flowMetrics = [];
        for (var _gi = 0; _gi < el.children.length; _gi++) {
          var _gc = el.children[_gi];
          try {
            var _gp = (window.getComputedStyle(_gc).position || '').toLowerCase();
            if (_gp === 'absolute' || _gp === 'fixed') continue;
          } catch (_gpe) {}
          var _gr = _gc.getBoundingClientRect();
          if (!_gr || _gr.height <= 0) continue;
          var _top = _gr.top - _hostRect.top;
          var _bottom = _hostRect.bottom - _gr.bottom;
          var _center = _top + _gr.height / 2;
          _flowMetrics.push({ top: _top, bottom: _bottom, center: _center, h: _gr.height });
        }
        if (_flowMetrics.length >= 2) {
          var _minTop = Infinity, _maxTop = -Infinity;
          var _minBottom = Infinity, _maxBottom = -Infinity;
          var _minCenter = Infinity, _maxCenter = -Infinity;
          for (var _mi = 0; _mi < _flowMetrics.length; _mi++) {
            var _m = _flowMetrics[_mi];
            if (_m.top < _minTop) _minTop = _m.top;
            if (_m.top > _maxTop) _maxTop = _m.top;
            if (_m.bottom < _minBottom) _minBottom = _m.bottom;
            if (_m.bottom > _maxBottom) _maxBottom = _m.bottom;
            if (_m.center < _minCenter) _minCenter = _m.center;
            if (_m.center > _maxCenter) _maxCenter = _m.center;
          }
          var _topSpan = _maxTop - _minTop;
          var _bottomSpan = _maxBottom - _minBottom;
          var _centerSpan = _maxCenter - _minCenter;
          var _tol = 3;
          var _inferredCrossAlign = null;
          // 仅在「各流内子项交叉轴高度都接近容器」时，才把「top/bottom 差很小」判成表格式 stretch → MIN。
          // 否则常见 align-items:center 下「满高块 + 较矮图标」top 差仅 1～2px，会误判成等高行而贴顶。
          var _allCrossNearlyFull = true;
          for (var _ac = 0; _ac < _flowMetrics.length; _ac++) {
            if (_flowMetrics[_ac].h < _h * 0.97 - 0.5) { _allCrossNearlyFull = false; break; }
          }
          // 表格行 / 多列等高 flex：各子项 top、bottom 几乎相同 → _centerSpan 也为 0，
          // 若走「centerSpan≤tol → CENTER」会误把整行交叉轴标成居中，左侧短文案在 Figma 里垂直居中。
          // 等高带应对齐 stretch 语义 → 交叉轴用 MIN（顶对齐），不要推断 CENTER。
          if (_topSpan <= _tol && _bottomSpan <= _tol && _allCrossNearlyFull) {
            _inferredCrossAlign = 'MIN';
          } else if (_topSpan <= _tol && _bottomSpan > _tol) _inferredCrossAlign = 'MIN';
          else if (_bottomSpan <= _tol && _topSpan > _tol) _inferredCrossAlign = 'MAX';
          else if (_centerSpan <= _tol) _inferredCrossAlign = 'CENTER';
          else if (_topSpan <= _tol) _inferredCrossAlign = 'MIN';
          else if (_bottomSpan <= _tol) _inferredCrossAlign = 'MAX';
          if (_inferredCrossAlign) {
            style.counterAxisAlignItems = _inferredCrossAlign;
          }
        }
      }
    }
    // align-items: baseline + 横向 flex + 仅一个流内子项：Figma 与浏览器对「单行仅一方参与基线」的交叉轴常不一致（表头只渲控件等）。
    // 用布局语义修正为 CENTER，避免依赖 ant-* 等易变的 className。
    if (style.layoutMode === 'HORIZONTAL' && alignItemsNorm === 'baseline' && el.children && el.children.length > 0) {
      var _baselineFlowCount = 0;
      for (var _bfc = 0; _bfc < el.children.length; _bfc++) {
        try {
          var _bfPos = (window.getComputedStyle(el.children[_bfc]).position || '').toLowerCase();
          if (_bfPos === 'absolute' || _bfPos === 'fixed') continue;
        } catch (_bfe) {}
        _baselineFlowCount++;
      }
      if (_baselineFlowCount <= 1) {
        style.counterAxisAlignItems = 'CENTER';
      }
    }
    // ant-radio-wrapper：CSS align-items 可能因自定义主题（如 verticalRadio 竖排变体）被覆盖为 flex-start，
    // 导致 radio 圆圈贴顶。改用几何法：取最矮的流内子项（即 radio 圆圈），
    // 若其中心与容器中心对齐（误差 < 5px），则强制 CENTER，不依赖 CSS 声明值。
    var _isAntRadioWrapper = (el.className && typeof el.className === 'string' && el.className.indexOf('ant-radio-wrapper') !== -1);
    if (_isAntRadioWrapper) {
      var _rawWRect = el.getBoundingClientRect();
      var _rawWH = _rawWRect.height;
      var _rawShortCh = null;
      for (var _rwci = 0; _rwci < el.children.length; _rwci++) {
        try { if ((window.getComputedStyle(el.children[_rwci]).position || '').toLowerCase() === 'absolute') continue; } catch (_rwe) {}
        var _rwcH = el.children[_rwci].getBoundingClientRect().height;
        if (_rwcH > 0 && _rawWH > 0 && _rwcH < _rawWH * 0.95) { _rawShortCh = el.children[_rwci]; break; }
      }
      if (_rawShortCh && _rawWH > 0) {
        var _rawCR = _rawShortCh.getBoundingClientRect();
        var _rawCCY = _rawCR.top - _rawWRect.top + _rawCR.height / 2;
        if (Math.abs(_rawCCY - _rawWH / 2) < 5) style.counterAxisAlignItems = 'CENTER';
      } else if (alignItemsNorm === 'baseline' || alignItemsNorm === 'center') {
        style.counterAxisAlignItems = 'CENTER';
      }
    }
    // ant-select：selection-wrap 内为「绝对定位 search + 占位/选中项」，交叉轴应对齐居中，避免占位文案在 32px 框内贴顶/贴底。
    if (el.className && typeof el.className === 'string' && el.className.indexOf('ant-select-selection-wrap') !== -1 &&
        style.layoutMode === 'HORIZONTAL') {
      style.counterAxisAlignItems = 'CENTER';
    }
    if (_isRadioWrapper) {
    }
    // 无元素子节点、仅文本的 flex/inline-flex（如 tag）：align-items 默认 stretch → MIN，
    // 匿名 flex 行框在浏览器里常视觉垂直居中，用语义几何校准交叉轴。
    if (style.layoutMode === 'HORIZONTAL' && (!el.children || el.children.length === 0) && /\S/.test(el.textContent || '')) {
      try {
        var _anonFlexRect = el.getBoundingClientRect();
        var _anonFlexH = _anonFlexRect.height || 0;
        if (_anonFlexH > 0) {
          var _anonDoc = el.ownerDocument;
          for (var _afi = 0; _afi < el.childNodes.length; _afi++) {
            var _afn = el.childNodes[_afi];
            if (_afn.nodeType !== 3 || !/\S/.test(_afn.textContent || '')) continue;
            if (_anonDoc && _anonDoc.createRange) {
              var _afr = _anonDoc.createRange();
              _afr.selectNodeContents(_afn);
              var _aftr = _afr.getBoundingClientRect();
              if (_aftr && _aftr.height > 0) {
                var _afcy = _aftr.top - _anonFlexRect.top + _aftr.height / 2;
                if (Math.abs(_afcy - _anonFlexH / 2) < 5) style.counterAxisAlignItems = 'CENTER';
              }
            }
            break;
          }
        }
      } catch (_eAnonFlex) {}
    }
  } else if (display === 'block' || display === 'inline-block' || display === 'inline') {
    // 架构级修复：不再依赖 blockTextTags 白名单。
    // 如果一个 block/inline 元素没有子元素（只有文本），但因为有背景/padding被升级为 frame，
    // 我们为其开启 HORIZONTAL 自动布局，以完美模拟 CSS 的 padding 包裹效果。
    // 同理，若唯一子元素是内联文字标签（label/span/b/em 等），语义上等同于纯文本容器，也开启 Auto Layout 以支持垂直居中。
    const hasElementChildren = el.children && el.children.length > 0;
    var INLINE_TEXT_TAGS = ['label', 'span', 'b', 'em', 'strong', 'i', 'a', 'small', 'mark'];
    var hasSingleInlineTextChild = el.children &&
      el.children.length === 1 &&
      INLINE_TEXT_TAGS.indexOf((el.children[0].tagName || '').toLowerCase()) !== -1;
    if (!hasElementChildren || hasSingleInlineTextChild) {
      // 混合内容检测：block 容器同时有非空文本节点 + 单个 inline 子元素时，
      // 需用子元素的几何位置判断是否实为纵向排列（文本在上、span 在下）。
      // 例：<div>突破<span>100万元</span></div> — span 实际在第二行，应为 VERTICAL。
      if (hasSingleInlineTextChild) {
        var _hasMixedTextNode = false;
        for (var _mtnI = 0; _mtnI < el.childNodes.length; _mtnI++) {
          var _mtn = el.childNodes[_mtnI];
          if (_mtn.nodeType === 3 && (_mtn.textContent || '').trim()) {
            _hasMixedTextNode = true;
            break;
          }
        }
        if (_hasMixedTextNode) {
          try {
            var _mixSpanRect = el.children[0].getBoundingClientRect();
            var _mixParentRect = el.getBoundingClientRect();
            var _mixSpanOffsetTop = _mixSpanRect.top - _mixParentRect.top;
            // span 的顶部超过容器高度 30% → 说明上方有文本内容，纵向排列
            if (_mixParentRect.height > 0 && _mixSpanOffsetTop > _mixParentRect.height * 0.3) {
              style.layoutMode = 'VERTICAL';
              style.counterAxisAlignItems = 'MIN';
              style.primaryAxisAlignItems = 'MIN';
              style.paddingTop = px(d(['padding-top', 'paddingTop']) || computed.paddingTop);
              style.paddingRight = px(d(['padding-right', 'paddingRight']) || computed.paddingRight);
              style.paddingBottom = px(d(['padding-bottom', 'paddingBottom']) || computed.paddingBottom);
              style.paddingLeft = px(d(['padding-left', 'paddingLeft']) || computed.paddingLeft);
            }
          } catch (_eMix) {}
        }
      }
      if (!style.layoutMode) {
      style.layoutMode = 'HORIZONTAL';
      // 若单行 inline 子元素在浏览器中实际跨越多个行（getClientRects().length > 1），
      // 说明 block 内含文本 + inline 子元素的内容因容器宽度不足而换行。
      // 此时加上 layoutWrap='WRAP'，让 Figma Auto Layout 也能按宽度自动换行，
      // 避免两段文本在 Figma 中横排在同一行。
      if (hasSingleInlineTextChild) {
        try {
          var _inlineChild = el.children[0];
          var _inlineCrs = _inlineChild.getClientRects();
          if (_inlineCrs && _inlineCrs.length > 1) {
            style.layoutWrap = 'WRAP';
          }
        } catch (_eWrap) {}
      }
      // 动态读取 text-align，而不是无脑居中，兼容 div 的左对齐和 button 的居中
      var textAlign = (d(['text-align', 'textAlign']) || computed.textAlign || '').toString().toLowerCase();
      var alignMap = { left: 'MIN', right: 'MAX', center: 'CENTER', justify: 'MIN', start: 'MIN', end: 'MAX' };
      style.primaryAxisAlignItems = alignMap[textAlign] || 'MIN';
      // 垂直对齐：优先用几何位置反推（子元素中心 vs 容器中心，误差 <3px → CENTER）。
      // 原先用"容器高 > 子高 * 1.5"判断的方案会把图标按钮（容器22px/图标8px）误判为顶对齐。
      style.paddingTop = px(d(['padding-top', 'paddingTop']) || computed.paddingTop);
      style.paddingRight = px(d(['padding-right', 'paddingRight']) || computed.paddingRight);
      style.paddingBottom = px(d(['padding-bottom', 'paddingBottom']) || computed.paddingBottom);
      style.paddingLeft = px(d(['padding-left', 'paddingLeft']) || computed.paddingLeft);
      // 垂直对齐：优先用几何位置反推（子元素中心 vs 容器中心，误差 <3px → CENTER）。
      // 原先用"容器高 > 子高 * 1.5"判断的方案会把图标按钮（容器22px/图标8px）误判为顶对齐。
      var _blockChildEl = hasSingleInlineTextChild ? el.children[0] : null;
      var _blockContainerRect = el.getBoundingClientRect();
      var _blockContainerH = _blockContainerRect.height;
      if (_blockChildEl && _blockContainerH > 0) {
        var _blockChildRect = _blockChildEl.getBoundingClientRect();
        var _blockChildH = _blockChildRect.height;
        if (_blockChildH > 0) {
          var _blockChildCenterY = _blockChildRect.top - _blockContainerRect.top + _blockChildH / 2;
          style.counterAxisAlignItems = Math.abs(_blockChildCenterY - _blockContainerH / 2) < 3 ? 'CENTER' : 'MIN';
        } else {
          // 子元素高度为 0（SVG 等）：看 top 偏移是否在容器中间区域
          var _blockChildOffsetY = _blockChildRect.top - _blockContainerRect.top;
          style.counterAxisAlignItems = (_blockChildOffsetY > _blockContainerH * 0.2 && _blockChildOffsetY < _blockContainerH * 0.8) ? 'CENTER' : 'MIN';
        }
      } else {
        // 纯文本节点、无元素子节点：默认顶对齐，避免表格等高行里单行文案被误判为垂直居中。
        // 但若首段文本行框的垂直中心与容器中心接近（如 tag/badge 仅靠 line-height + padding 居中），
        // 则输出 CENTER，与浏览器视觉一致（否则 Figma Auto Layout 贴顶）。
        style.counterAxisAlignItems = 'MIN';
        if (el && el.childNodes && _blockContainerH > 0) {
          try {
            var _docCross = el.ownerDocument;
            var _txtRectCross = null;
            for (var _tnCrossI = 0; _tnCrossI < el.childNodes.length; _tnCrossI++) {
              var _tnCross = el.childNodes[_tnCrossI];
              if (_tnCross.nodeType !== 3 || !/\S/.test(_tnCross.textContent || '')) continue;
              if (_docCross && _docCross.createRange) {
                var _rngCross = _docCross.createRange();
                _rngCross.selectNodeContents(_tnCross);
                _txtRectCross = _rngCross.getBoundingClientRect();
              }
              break;
            }
            if (_txtRectCross && _txtRectCross.height > 0) {
              var _txtCenterY = _txtRectCross.top - _blockContainerRect.top + _txtRectCross.height / 2;
              if (Math.abs(_txtCenterY - _blockContainerH / 2) < 5) {
                style.counterAxisAlignItems = 'CENTER';
              }
            }
          } catch (_eTxtCross) {}
        }
      }
      } // end if (!style.layoutMode)
    } else {
      // 有多个子元素（如 ant-radio-button-wrapper）：computed display 在 Shadow DOM 中可能降级为 block/inline-block，
      // 但实际上是 flex 容器（antd 外部 CSS 未 cascade 进 Shadow DOM）。
      // 用几何反推：遍历子元素，取有实际高度的一个，判断其中心是否与容器中心对齐，以此推断是否垂直居中。
      var _multiContainerRect = el.getBoundingClientRect();
      var _multiContainerH = _multiContainerRect.height;
      if (_multiContainerH > 0) {
        var _multiSampleChild = null;
        for (var _mci = 0; _mci < el.children.length; _mci++) {
          var _mch = el.children[_mci];
          var _mchH = _mch.getBoundingClientRect().height;
          // 跳过高度等于容器高度的子元素（如 position:absolute 撑满容器的），优先取比容器矮的
          if (_mchH > 0 && _mchH < _multiContainerH * 0.95) { _multiSampleChild = _mch; break; }
        }
        if (!_multiSampleChild) {
          // 降级：取任意有高度的子元素
          for (var _mci2 = 0; _mci2 < el.children.length; _mci2++) {
            if (el.children[_mci2].getBoundingClientRect().height > 0) { _multiSampleChild = el.children[_mci2]; break; }
          }
        }
        if (_multiSampleChild) {
          var _multiChildRect2 = _multiSampleChild.getBoundingClientRect();
          // 子项被父级撑满高度时，几何中心必然接近容器中心，不能据此推断「垂直居中」。
          var _multiChildH2 = _multiChildRect2.height;
          if (_multiChildH2 > 0 && _multiChildH2 < _multiContainerH * 0.95) {
            var _multiChildCenterY = _multiChildRect2.top - _multiContainerRect.top + _multiChildRect2.height / 2;
            var _isCentered = Math.abs(_multiChildCenterY - _multiContainerH / 2) < 3;
            if (_isRadioWrapper) {
            }
            if (_isCentered) {
              style.layoutMode = 'HORIZONTAL';
              style.counterAxisAlignItems = 'CENTER';
              var _textAlignMulti = (d(['text-align', 'textAlign']) || computed.textAlign || '').toString().toLowerCase();
              var _alignMapMulti = { left: 'MIN', right: 'MAX', center: 'CENTER', justify: 'MIN', start: 'MIN', end: 'MAX' };
              style.primaryAxisAlignItems = _alignMapMulti[_textAlignMulti] || 'MIN';
              style.paddingTop = px(d(['padding-top', 'paddingTop']) || computed.paddingTop);
              style.paddingRight = px(d(['padding-right', 'paddingRight']) || computed.paddingRight);
              style.paddingBottom = px(d(['padding-bottom', 'paddingBottom']) || computed.paddingBottom);
              style.paddingLeft = px(d(['padding-left', 'paddingLeft']) || computed.paddingLeft);
            }
          }
        }
      }
    }
  } else if (display === 'grid' || display === 'inline-grid') {
    // grid-auto-flow: row = 按行排（横向多列）→ HORIZONTAL；column = 按列排（纵向多行）→ VERTICAL
    style.layoutMode = (d(['grid-auto-flow']) || computed.gridAutoFlow || 'row') === 'column' ? 'VERTICAL' : 'HORIZONTAL';
    // 分别读取 column-gap 和 row-gap，避免把 row-gap 误用为列间距（HORIZONTAL WRAP 的 itemSpacing 是列间距）。
    // gap 简写格式 "row-gap column-gap"（如 "40px 32px"），parseFloat 只取第一个值 = row-gap，
    // 若直接用 gap 值做 itemSpacing 会错误地用 row-gap 代替 column-gap，导致 Figma 中行内溢出换行。
    var _gridColGap = px(d(['column-gap', 'columnGap']) || computed.columnGap);
    var _gridRowGap = px(d(['row-gap', 'rowGap']) || computed.rowGap);
    // gap 简写兜底：当 column-gap / row-gap 均未单独声明时，解析 gap 两段式或单值
    if (_gridColGap == null || _gridRowGap == null) {
      var _gapDecl = d(['gap']) || computed.gap;
      if (_gapDecl) {
        var _gapStr = String(_gapDecl).trim();
        var _gapParts = _gapStr.split(/\s+/);
        if (_gridRowGap == null) _gridRowGap = px(_gapParts[0]);
        if (_gridColGap == null) _gridColGap = px(_gapParts.length > 1 ? _gapParts[1] : _gapParts[0]);
      }
    }
    // HORIZONTAL grid: itemSpacing = 列间距(column-gap)；VERTICAL grid: itemSpacing = 行间距(row-gap)
    var _gridPrimaryGap = style.layoutMode === 'HORIZONTAL' ? _gridColGap : _gridRowGap;
    if (_gridPrimaryGap != null && _gridPrimaryGap > 0) style.itemSpacing = _gridPrimaryGap;
    var gridTemplateCols = d(['grid-template-columns', 'gridTemplateColumns']) || (computed && computed.gridTemplateColumns);
    var colCount = parseGridTemplateColumnsCount(gridTemplateCols);
    if (colCount != null && colCount > 0) {
      style.layoutGridColumns = colCount;
    }
    // CSS grid 横向布局：无论固定列数还是 auto-fill/auto-fit，均设为换行
    // （auto-fill/auto-fit 时 colCount 为 null，但 grid 本身就是换行的）
    if (style.layoutMode === 'HORIZONTAL' && gridTemplateCols && String(gridTemplateCols).trim() !== 'none') {
      style.layoutWrap = 'WRAP';
    }
    // counterAxisSpacing: HORIZONTAL grid = row-gap；VERTICAL grid = column-gap
    var _gridCounterGap = style.layoutMode === 'HORIZONTAL' ? _gridRowGap : _gridColGap;
    if (_gridCounterGap != null && _gridCounterGap > 0) style.counterAxisSpacing = _gridCounterGap;
    style.paddingTop = px(d(['padding-top', 'paddingTop']) || computed.paddingTop);
    style.paddingRight = px(d(['padding-right', 'paddingRight']) || computed.paddingRight);
    style.paddingBottom = px(d(['padding-bottom', 'paddingBottom']) || computed.paddingBottom);
    style.paddingLeft = px(d(['padding-left', 'paddingLeft']) || computed.paddingLeft);
    style.primaryAxisAlignItems = 'MIN';
    style.counterAxisAlignItems = 'MIN';
  } else if (display === 'table' || display === 'inline-table' ||
             display === 'table-header-group' || display === 'table-row-group' ||
             display === 'table-footer-group') {
    // table / thead / tbody / tfoot → 行纵向排列
    style.layoutMode = 'VERTICAL';
    style.paddingTop = px(d(['padding-top', 'paddingTop']) || computed.paddingTop);
    style.paddingRight = px(d(['padding-right', 'paddingRight']) || computed.paddingRight);
    style.paddingBottom = px(d(['padding-bottom', 'paddingBottom']) || computed.paddingBottom);
    style.paddingLeft = px(d(['padding-left', 'paddingLeft']) || computed.paddingLeft);
    style.primaryAxisAlignItems = 'MIN';
    style.counterAxisAlignItems = 'MIN';
  } else if (display === 'table-row') {
    // tr → 单元格横向排列
    style.layoutMode = 'HORIZONTAL';
    style.paddingTop = px(d(['padding-top', 'paddingTop']) || computed.paddingTop);
    style.paddingRight = px(d(['padding-right', 'paddingRight']) || computed.paddingRight);
    style.paddingBottom = px(d(['padding-bottom', 'paddingBottom']) || computed.paddingBottom);
    style.paddingLeft = px(d(['padding-left', 'paddingLeft']) || computed.paddingLeft);
    style.primaryAxisAlignItems = 'MIN';
    style.counterAxisAlignItems = 'MIN';
  } else if (display === 'table-cell') {
    // td / th → 内容横向排列，支持 vertical-align 映射
    style.layoutMode = 'HORIZONTAL';
    style.paddingTop = px(d(['padding-top', 'paddingTop']) || computed.paddingTop);
    style.paddingRight = px(d(['padding-right', 'paddingRight']) || computed.paddingRight);
    style.paddingBottom = px(d(['padding-bottom', 'paddingBottom']) || computed.paddingBottom);
    style.paddingLeft = px(d(['padding-left', 'paddingLeft']) || computed.paddingLeft);
    // 与 block 容器一致：text-align 决定主轴上单子项/内容块位置（右对齐单元格需 MAX，否则 Hug 宽文本框贴左）
    var textAlignTc = (d(['text-align', 'textAlign']) || computed.textAlign || '').toString().toLowerCase();
    var alignMapTc = { left: 'MIN', right: 'MAX', center: 'CENTER', justify: 'MIN', start: 'MIN', end: 'MAX' };
    style.primaryAxisAlignItems = alignMapTc[textAlignTc] || 'MIN';
    var vAlign = (d(['vertical-align', 'verticalAlign']) || computed.verticalAlign || '').toString().toLowerCase();
    style.counterAxisAlignItems = vAlign === 'middle' ? 'CENTER' : vAlign === 'bottom' ? 'MAX' : 'MIN';
  }

  // Text styles（优先 style 标签，再 computed）；字体仅在与全局不同时输出
  var _fontSizeDecl = d(['font-size', 'fontSize']);
  var fontSize = resolveFontSizePxFromDeclAndComputed(
    _fontSizeDecl,
    computed.fontSize,
    px
  );
  if (fontSize != null) {
    if (fontSize < 1) {
      var rawFsVal = _fontSizeDecl || computed.fontSize;
      console.warn('[fontSize<1] buildInlineTextStyle', { className: el.className, rawValue: rawFsVal, rounded: fontSize, el: el });
    } else {
      style.fontSize = fontSize;
    }
  }
  var color = d(['color']) || computed.color;
  // 若声明层取到的是 CSS 变量，回退到 computed 实际解析值
  if (color && color.indexOf('var(') >= 0) {
    color = computed.color || color;
  }
  if (color) {
    var rgba = cssColorToRgba(color);
    if (rgba) style.color = rgba;
  }
  var fontFamilyRaw = d(['font-family', 'fontFamily']) || computed.fontFamily;
  var fontFamily = fontFamilyRaw ? resolveFontFamilyFromStack(String(fontFamilyRaw)) : '';
  var fontWeightRaw = d(['font-weight', 'fontWeight']) || computed.fontWeight;
  var fontWeight = fontWeightRaw === 'bold' ? 700 : (fontWeightRaw === 'normal' ? 400 : num(fontWeightRaw));
  if (fontWeight == null || Number.isNaN(fontWeight)) fontWeight = 400;
  var fontStyleRaw = (d(['font-style', 'fontStyle']) || computed.fontStyle || 'normal').toString().toLowerCase();
  var fontStyle = (fontStyleRaw === 'italic' || fontStyleRaw === 'oblique') ? 'italic' : 'normal';
  if (globalFont) {
    if (fontFamily && fontFamily !== globalFont.fontFamily) style.fontFamily = fontFamily;
    if (fontWeight !== globalFont.fontWeight) style.fontWeight = fontWeight;
    if (fontStyle !== globalFont.fontStyle) style.fontStyle = fontStyle;
  } else {
    if (fontFamily) style.fontFamily = fontFamily;
    style.fontWeight = fontWeight;
    if (fontStyle !== 'normal') style.fontStyle = fontStyle;
  }
  var stack = fontFamilyRaw ? parseFontFamilyStack(String(fontFamilyRaw)) : [];
  if (stack.length) style.fontFamilyStack = stack;
  var textAlign = d(['text-align', 'textAlign']) || computed.textAlign;
  if (textAlign) {
    var alignMap = { left: 'LEFT', right: 'RIGHT', center: 'CENTER', justify: 'JUSTIFIED', start: 'LEFT', end: 'RIGHT' };
    var mapped = alignMap[String(textAlign).toLowerCase()];
    if (mapped) style.textAlignHorizontal = mapped;
  }
  var textDecoration = d(['text-decoration', 'textDecoration', 'text-decoration-line']) || computed.textDecorationLine;
  if (textDecoration && textDecoration !== 'none') {
    if (String(textDecoration).indexOf('underline') >= 0) style.textDecoration = 'UNDERLINE';
    else if (String(textDecoration).indexOf('line-through') >= 0) style.textDecoration = 'STRIKETHROUGH';
  }

  var _lsRaw = d(['letter-spacing', 'letterSpacing']) || computed.letterSpacing;
  var _ls = px(_lsRaw);
  if (_ls != null && _ls !== 0) style.letterSpacing = _ls;

  // margin：用于后续在自动布局下转成 spacer 节点，不参与 padding/背景
  var _mTRaw = d(['margin-top', 'marginTop']);
  var _mRRaw = d(['margin-right', 'marginRight']);
  var _mBRaw = d(['margin-bottom', 'marginBottom']);
  var _mLRaw = d(['margin-left', 'marginLeft']);
  // 若声明层取到 CSS 变量或 calc，降级到 computed
  var mT = px((_mTRaw && String(_mTRaw).indexOf('var(') < 0 && String(_mTRaw).indexOf('calc(') < 0 ? _mTRaw : null) || computed.marginTop);
  var mR = px((_mRRaw && String(_mRRaw).indexOf('var(') < 0 && String(_mRRaw).indexOf('calc(') < 0 ? _mRRaw : null) || computed.marginRight);
  var mB = px((_mBRaw && String(_mBRaw).indexOf('var(') < 0 && String(_mBRaw).indexOf('calc(') < 0 ? _mBRaw : null) || computed.marginBottom);
  var mL = px((_mLRaw && String(_mLRaw).indexOf('var(') < 0 && String(_mLRaw).indexOf('calc(') < 0 ? _mLRaw : null) || computed.marginLeft);
  if (mT != null) style.marginTop = mT;
  if (mR != null) style.marginRight = mR;
  if (mB != null) style.marginBottom = mB;
  if (mL != null) style.marginLeft = mL;
  // 检测 margin:auto 水平居中（声明值均为 'auto'），供父容器处理时转换为 alignSelf:'CENTER'
  if (typeof _mLRaw === 'string' && _mLRaw.trim() === 'auto' &&
      typeof _mRRaw === 'string' && _mRRaw.trim() === 'auto') {
    style._marginAutoH = true;
  }

  // position: absolute/fixed → 消费端需让该节点脱离 Auto Layout 流式排布，统一标记为 'absolute'
  // 用 getPropertyValue 而非 .position 直接访问，Shadow DOM 环境下后者可能返回空字符串
  var positionDeclared = d(['position']);
  var positionComputed = computed.getPropertyValue ? computed.getPropertyValue('position') : computed.position;
  var positionVal = (positionDeclared || positionComputed || '').toString().toLowerCase();
  if (positionVal === 'absolute' || positionVal === 'fixed') {
    style.positionType = 'absolute';
  }
  // z-index：用于导出时恢复层级顺序（尤其是 absolute/fixed 节点）
  var zIndexVal = d(['z-index', 'zIndex']) || computed.zIndex;
  if (zIndexVal != null) {
    var z = parseInt(String(zIndexVal), 10);
    if (!Number.isNaN(z)) {
      style.zIndex = z;
    }
  }

  // flex-grow → Figma FILL（填充剩余空间）
  // 用 computed 优先：声明层聚合未处理 CSS specificity，像 :last-child/更高优先级覆盖时，
  // decl 可能仍是旧值，导致误把固定列导出为 FILL（stackChildPrimaryGrow=1）。
  var _fgComputed = parseFloat(computed.flexGrow || '');
  var _fgDecl = parseFloat(d(['flex-grow', 'flexGrow']) || '');
  var _fg = !Number.isNaN(_fgComputed) ? _fgComputed : (!Number.isNaN(_fgDecl) ? _fgDecl : 0);
  if (_fg >= 1) style.flexGrow = _fg;

  // align-self → 子节点自身的交叉轴对齐
  var _as = (d(['align-self', 'alignSelf']) || computed.alignSelf || '').toString().toLowerCase();
  if (_as === 'stretch') style.alignSelfStretch = true;

  return style;
}


if (typeof module !== 'undefined') {
  module.exports = {
    parseFontFamilyStack: parseFontFamilyStack,
    resolveFontFamilyFromStack: resolveFontFamilyFromStack,
    getGlobalFont: getGlobalFont,
    buildInlineTextStyle: buildInlineTextStyle,
    buildStyleJSON: buildStyleJSON,
  };
}
