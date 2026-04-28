/**
 * ============================================================
 * css-parsers.js  —  CSS 字符串解析层
 * ============================================================
 * 职责：将原始 CSS 属性字符串解析为 Figma 可直接消费的结构化数据。
 *   - 渐变：parseLinearGradientFromBgImage / parseRadialGradientFromBgImage
 *   - 阴影：parseBoxShadow
 *   - 颜色：cssColorToHex / cssColorToRgba
 *   - 其他：parseBorderShorthand / parseGridTemplateColumnsCount / parseTransformRotation
 *   - SVG：normalizeSvgPathForFigma / serializeSvgElement
 * 规则：本层函数只做字符串 → 结构体的纯转换，不读 DOM 样式表，不操作 window（serializeSvgElement 例外，读 computed color）。
 * ============================================================
 */

/**
 * 将 SVG path 的 d 规范为 Figma 要求：命令与数字之间用空格分隔。
 * Figma 报 "Invalid command at M14" 是因为 d 里常有 "M14" 这种无空格写法。
 */
function normalizeSvgPathForFigma(d) {
  if (!d || typeof d !== 'string') return '';
  return d
    .replace(/,/g, ' ')
    // 命令字母（大写和小写）与数字之间加空格
    .replace(/([MmLlCcQqSsAaZzHhVvTt])([-\d.])/g, '$1 $2')
    .replace(/([\d.])([MmLlCcQqSsAaZzHhVvTt])/g, '$1 $2')
    // 数字紧跟负号（如 10-5 → 10 -5）
    .replace(/(\d)(-)/g, '$1 $2')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * 解析 CSS background-image 中的 url(...) → 提取出的 URL 字符串，用于导出为图片 fill。
 */
function parseUrlFromBgImage(bgImage) {
  if (!bgImage || typeof bgImage !== 'string') return null;
  var m = bgImage.trim().match(/url\s*\(\s*['"]?([^'")\s]+)['"]?\s*\)/);
  return m ? m[1].trim() : null;
}

function cssColorToHex(cssColor) {
  if (!cssColor) return null;
  // Already hex
  if (typeof cssColor === 'string' && /^#([0-9A-Fa-f]{3}|[0-9A-Fa-f]{6})$/.test(cssColor)) return cssColor;
  // rgb(r,g,b) or rgba(r,g,b,a)
  const m = String(cssColor).match(/rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/);
  if (m) {
    const r = parseInt(m[1], 10).toString(16).padStart(2, '0');
    const g = parseInt(m[2], 10).toString(16).padStart(2, '0');
    const b = parseInt(m[3], 10).toString(16).padStart(2, '0');
    return '#' + r + g + b;
  }
  return null;
}

/**
 * 统一转换 CSS 颜色为 rgba(r, g, b, a) 格式（Figma 插件用 figma.util.rgba() 解析）。
 * - 任何颜色都转为 rgba(0-255, 0-255, 0-255, 0-1)
 * - 支持：hex、rgb、rgba、transparent、named colors
 */
function cssColorToRgba(cssColor) {
  if (!cssColor) return null;
  var s = String(cssColor).trim();
  if (s === '' || s === 'transparent') return 'rgba(0, 0, 0, 0)';
  
  // 已经是 rgba 格式，直接返回
  var rgbaMatch = s.match(/^rgba\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*,\s*([\d.]+)\s*\)$/);
  if (rgbaMatch) return s;
  
  // rgb(r, g, b) → rgba(r, g, b, 1)
  var rgbMatch = s.match(/^rgb\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*\)$/);
  if (rgbMatch) {
    return 'rgba(' + rgbMatch[1] + ', ' + rgbMatch[2] + ', ' + rgbMatch[3] + ', 1)';
  }
  
  // hex: #RGB 或 #RRGGBB 或 #RRGGBBAA
  var hexMatch = s.match(/^#([0-9A-Fa-f]{3,8})$/);
  if (hexMatch) {
    var hex = hexMatch[1];
    var r, g, b, a = 1;
    
    if (hex.length === 3) {
      // #RGB → #RRGGBB
      r = parseInt(hex[0] + hex[0], 16);
      g = parseInt(hex[1] + hex[1], 16);
      b = parseInt(hex[2] + hex[2], 16);
    } else if (hex.length === 6) {
      // #RRGGBB
      r = parseInt(hex.slice(0, 2), 16);
      g = parseInt(hex.slice(2, 4), 16);
      b = parseInt(hex.slice(4, 6), 16);
    } else if (hex.length === 8) {
      // #RRGGBBAA
      r = parseInt(hex.slice(0, 2), 16);
      g = parseInt(hex.slice(2, 4), 16);
      b = parseInt(hex.slice(4, 6), 16);
      a = parseInt(hex.slice(6, 8), 16) / 255;
    } else {
      return null;
    }
    
    return 'rgba(' + r + ', ' + g + ', ' + b + ', ' + (Math.round(a * 1000) / 1000) + ')';
  }
  
  // 其他格式（named color 等）返回原样，让 Figma 插件侧处理
  return s;
}

/**
 * 解析 CSS background-image 中的 linear-gradient → { type: 'GRADIENT_LINEAR', gradientStops, angle }。
 *
 * 修复 1（正则不够宽松）：原正则 /linear-gradient\s*\(\s*([\d.]+)?deg\s*,\s*(.+)\)/ 只能匹配
 *   Ndeg 形式，无法处理 "to right"/"to bottom right" 等 CSS 方向关键字写法，导致 computed 值里
 *   出现方向关键字时 gradientFill 返回 null，渐变丢失。
 *   修复：改用逐字符括号匹配提取括号内完整内容，再分别处理角度和色标。
 *
 * 修复 2（色标 split 切断 rgba）：原来用 /\s*,\s*(?=#|rgb)/ 分割色标，但 rgba(255,0,0,0.5) 里
 *   的逗号也满足 (?=rgb) 前面是 0 的条件，会把 rgba 切断为碎片，导致 cssColorToRgba 无法解析，
 *   stops < 2，gradientFill 为 null。
 *   修复：改为逐字符扫描，遇到括号内的逗号不拆分，只在括号外的逗号处分割色标。
 */
function parseLinearGradientFromBgImage(bgImage) {
  if (!bgImage || typeof bgImage !== 'string') return null;
  var str = bgImage.trim();
  // 找到 linear-gradient( 的起始位置
  var idx = str.indexOf('linear-gradient');
  if (idx < 0) return null;
  // 逐字符提取括号内全部内容
  var start = str.indexOf('(', idx);
  if (start < 0) return null;
  var depth = 0;
  var end = -1;
  for (var i = start; i < str.length; i++) {
    if (str[i] === '(') depth++;
    else if (str[i] === ')') { depth--; if (depth === 0) { end = i; break; } }
  }
  if (end < 0) return null;
  var inner = str.slice(start + 1, end).trim();

  // 按括号感知的逗号分割，括号内的逗号不分割
  function splitTopLevel(s) {
    var parts = [];
    var cur = '';
    var d = 0;
    for (var j = 0; j < s.length; j++) {
      var ch = s[j];
      if (ch === '(' || ch === '[') { d++; cur += ch; }
      else if (ch === ')' || ch === ']') { d--; cur += ch; }
      else if (ch === ',' && d === 0) { parts.push(cur.trim()); cur = ''; }
      else { cur += ch; }
    }
    if (cur.trim()) parts.push(cur.trim());
    return parts;
  }

  var parts = splitTopLevel(inner);
  if (parts.length < 2) return null;

  // 解析角度：第一段可能是 "135deg"、"to right"、"to bottom right" 等
  // 注意：CSS 未显式给角度时，linear-gradient 的默认方向是 "to bottom"（180deg），不是 0deg。
  // 若这里默认 0deg，会把未写角度的纵向渐变整体反向（top<->bottom 颠倒）。
  var angle = 180;
  var stopsStartIndex = 0;
  var firstPart = parts[0].trim().toLowerCase();
  var degMatch = firstPart.match(/^(-?[\d.]+)deg$/);
  if (degMatch) {
    angle = parseFloat(degMatch[1]);
    stopsStartIndex = 1;
  } else if (firstPart.startsWith('to ')) {
    // 方向关键字 → 转换为角度（CSS 规范：to top=0, to right=90, to bottom=180, to left=270）
    var dirMap = {
      'to top': 0, 'to top right': 45, 'to right top': 45,
      'to right': 90, 'to bottom right': 135, 'to right bottom': 135,
      'to bottom': 180, 'to bottom left': 225, 'to left bottom': 225,
      'to left': 270, 'to top left': 315, 'to left top': 315,
    };
    angle = dirMap[firstPart] != null ? dirMap[firstPart] : 180;
    stopsStartIndex = 1;
  } else {
    // 没有角度/方向，第一段直接是色标
    stopsStartIndex = 0;
  }

  var stops = [];
  for (var k = stopsStartIndex; k < parts.length; k++) {
    var seg = parts[k].trim();
    // 末尾的百分比位置（如 "50%"）
    var pctMatch = seg.match(/\s+([\d.]+)%\s*$/);
    // 末尾的绝对长度位置（如 "0px" "0.5px" "20px"，用于 repeating-gradient）：只 strip，不做归一化
    var lenMatch = !pctMatch && seg.match(/\s+[\d.]+(?:px|em|rem|vw|vh|pt|cm|mm|in)\s*$/i);
    var pos;
    if (pctMatch) {
      pos = parseFloat(pctMatch[1]) / 100;
      seg = seg.slice(0, seg.length - pctMatch[0].length).trim();
    } else if (lenMatch) {
      seg = seg.slice(0, seg.length - lenMatch[0].length).trim();
      var stopIdx = k - stopsStartIndex;
      var total = parts.length - stopsStartIndex - 1;
      pos = total > 0 ? stopIdx / total : 0;
    } else {
      var stopIdx = k - stopsStartIndex;
      var total = parts.length - stopsStartIndex - 1;
      pos = total > 0 ? stopIdx / total : 0;
    }
    var outColor = cssColorToRgba(seg);
    if (outColor) stops.push({ position: pos, color: outColor });
  }

  if (stops.length < 2) return null;
  return { type: 'GRADIENT_LINEAR', gradientStops: stops, angle: angle };
}

/**
 * 解析 CSS background-image 中的 radial-gradient → { type: 'GRADIENT_RADIAL', gradientStops, centerX, centerY, radius }。
 * 支持：
 *   radial-gradient(circle, color1, color2)
 *   radial-gradient(circle at 50% 50%, color1, color2)
 *   radial-gradient(ellipse at 30% 60%, color1, color2)
 */
function parseRadialGradientFromBgImage(bgImage) {
  if (!bgImage || typeof bgImage !== 'string') return null;
  var str = bgImage.trim();
  var idx = str.indexOf('radial-gradient');
  if (idx < 0) return null;
  // 逐字符提取括号内全部内容
  var start = str.indexOf('(', idx);
  if (start < 0) return null;
  var depth = 0;
  var end = -1;
  for (var i = start; i < str.length; i++) {
    if (str[i] === '(') depth++;
    else if (str[i] === ')') { depth--; if (depth === 0) { end = i; break; } }
  }
  if (end < 0) return null;
  var inner = str.slice(start + 1, end).trim();

  // 按括号感知的逗号分割，括号内的逗号不分割
  function splitTopLevelRadial(s) {
    var parts = [];
    var cur = '';
    var d = 0;
    for (var j = 0; j < s.length; j++) {
      var ch = s[j];
      if (ch === '(' || ch === '[') { d++; cur += ch; }
      else if (ch === ')' || ch === ']') { d--; cur += ch; }
      else if (ch === ',' && d === 0) { parts.push(cur.trim()); cur = ''; }
      else { cur += ch; }
    }
    if (cur.trim()) parts.push(cur.trim());
    return parts;
  }

  var parts = splitTopLevelRadial(inner);
  if (parts.length < 2) return null;

  // 解析第一段（形状 + 位置）：circle / ellipse / circle at X Y / ellipse at X Y
  // 识别条件：含 circle/ellipse 关键字，或以 "at " 开头，且不含 rgb/rgba/#（避免误把色标当形状描述）
  var centerX = 0.5;
  var centerY = 0.5;
  var stopsStartIndex = 0;
  var firstPart = parts[0].trim().toLowerCase();
  var looksLikeShapePart = (firstPart.indexOf('circle') >= 0 || firstPart.indexOf('ellipse') >= 0 || firstPart.startsWith('at ')) &&
    firstPart.indexOf('rgb') < 0 && firstPart.indexOf('#') < 0;
  if (looksLikeShapePart) {
    stopsStartIndex = 1;
    // 解析 "at X Y" 位置（百分比或关键字）
    var atIdx = firstPart.indexOf(' at ');
    if (atIdx >= 0) {
      var posPart = firstPart.slice(atIdx + 4).trim();
      var posTokens = posPart.split(/\s+/);
      if (posTokens.length >= 2) {
        var pctX = posTokens[0].replace('%', '');
        var pctY = posTokens[1].replace('%', '');
        var px = parseFloat(pctX);
        var py = parseFloat(pctY);
        if (!isNaN(px)) centerX = px / 100;
        if (!isNaN(py)) centerY = py / 100;
      }
    }
  }

  // 解析色标（与 parseLinearGradientFromBgImage 相同逻辑）
  var stops = [];
  for (var k = stopsStartIndex; k < parts.length; k++) {
    var seg = parts[k].trim();
    var pctMatch = seg.match(/\s+([\d.]+)%\s*$/);
    var lenMatch = !pctMatch && seg.match(/\s+[\d.]+(?:px|em|rem|vw|vh|pt|cm|mm|in)\s*$/i);
    var pos;
    if (pctMatch) {
      pos = parseFloat(pctMatch[1]) / 100;
      seg = seg.slice(0, seg.length - pctMatch[0].length).trim();
    } else if (lenMatch) {
      seg = seg.slice(0, seg.length - lenMatch[0].length).trim();
      var stopIdx = k - stopsStartIndex;
      var total = parts.length - stopsStartIndex - 1;
      pos = total > 0 ? stopIdx / total : 0;
    } else {
      var stopIdx = k - stopsStartIndex;
      var total = parts.length - stopsStartIndex - 1;
      pos = total > 0 ? stopIdx / total : 0;
    }
    var outColor = cssColorToRgba(seg);
    if (outColor) stops.push({ position: pos, color: outColor });
  }

  if (stops.length < 2) return null;
  // radius: 0.5 表示圆形与节点边缘相切（归一化空间），色标百分比控制视觉渐变范围
  var result = { type: 'GRADIENT_RADIAL', gradientStops: stops, centerX: centerX, centerY: centerY, radius: 0.5 };
  return result;
}

/**
 * 解析 CSS box-shadow → [{ offsetX, offsetY, blur, spread?, color }]。
 * 仅解析外阴影（不含 inset），与 Figma DROP_SHADOW 对应。
 * 语法：none | (inset? (color? offset-x offset-y blur-radius spread-radius? | offset-x offset-y blur-radius spread-radius? color?))#
 * 支持 "0 4px 12px rgba(255,77,106,0.2)" 与 "rgba(255,77,106,0.2) 0 4px 12px" 两种顺序。
 */
function parseBoxShadow(boxShadowStr) {
  if (!boxShadowStr || typeof boxShadowStr !== 'string') return [];
  var str = boxShadowStr.trim();
  if (str === '' || str === 'none') return [];
  var result = [];
  var i = 0;
  function skipWs() { while (i < str.length && /\s/.test(str[i])) i++; }
  function parseLength() {
    skipWs();
    if (i >= str.length) return null;
    var start = i;
    if (str[i] === '-') i++;
    while (i < str.length && /[\d.]/.test(str[i])) i++;
    var num = parseFloat(str.slice(start, i));
    if (Number.isNaN(num)) return null;
    skipWs();
    if (str.substr(i, 2) === 'px') i += 2;
    else if (str.substr(i, 2) === 'em') i += 2;
    else if (str.substr(i, 3) === 'rem') i += 3;
    skipWs();
    return num;
  }
  function parseColor() {
    skipWs();
    if (i >= str.length) return null;
    var colorStart = i;
    if (str[i] === '#') {
      i++; while (i < str.length && /[a-fA-F0-9]/.test(str[i])) i++;
      return str.slice(colorStart, i).trim();
    }
    if (str.substr(i, 4).toLowerCase() === 'rgba') {
      i += 4;
      skipWs();
      if (str[i] === '(') { i++; var depth = 1; while (i < str.length && depth > 0) { if (str[i] === '(') depth++; else if (str[i] === ')') { depth--; if (depth === 0) { i++; break; } } i++; } }
      return str.slice(colorStart, i).trim();
    }
    if (str.substr(i, 3).toLowerCase() === 'rgb') {
      i += 3;
      skipWs();
      if (str[i] === '(') { i++; var d = 1; while (i < str.length && d > 0) { if (str[i] === '(') d++; else if (str[i] === ')') { d--; if (d === 0) { i++; break; } } i++; } }
      return str.slice(colorStart, i).trim();
    }
    var word = /^[a-zA-Z][\w-]*/.exec(str.slice(i));
    if (word) { i += word[0].length; return word[0]; }
    return null;
  }
  function looksLikeColor() {
    skipWs();
    if (i >= str.length) return false;
    if (str[i] === '#') return true;
    if (str.substr(i, 4).toLowerCase() === 'rgba') return true;
    if (str.substr(i, 3).toLowerCase() === 'rgb') return true;
    return /^[a-zA-Z]/.test(str[i]);
  }
  while (i < str.length) {
    skipWs();
    if (i >= str.length) break;
    var inset = false;
    if (str.substr(i, 5) === 'inset') { inset = true; i += 5; skipWs(); }
    var colorFirst = looksLikeColor();
    var color = null;
    if (colorFirst) color = parseColor();
    var offsetX = parseLength();
    var offsetY = parseLength();
    if (offsetX == null || offsetY == null) break;
    var blur = parseLength();
    if (blur == null) blur = 0;
    var spread = parseLength();
    if (!colorFirst) {
      skipWs();
      if (i < str.length && str[i] !== ',') color = parseColor();
    }
    {
      var resolvedColor = color ? (cssColorToRgba(String(color).trim()) || 'rgba(0, 0, 0, 1)') : 'rgba(0, 0, 0, 1)';
      var one = {
        offsetX: Math.round(offsetX),
        offsetY: Math.round(offsetY),
        blur: Math.round(blur),
        spread: spread != null ? Math.round(spread) : 0,
        color: resolvedColor
      };
      if (inset) one.inset = true;
      result.push(one);
    }
    skipWs();
    if (str[i] === ',') i++;
  }
  return result;
}

/**
 * 解析 CSS border 简写，如 "1px solid transparent" → { width, style, color }。
 * 用于 style 标签里只写了 border 未写 border-width/color 的情况。
 */
function parseBorderShorthand(borderStr) {
  if (!borderStr || typeof borderStr !== 'string') return null;
  var s = borderStr.trim();
  if (s === '' || s === 'none' || s === '0') return { width: 0, style: 'none', color: 'transparent' };
  var width = 0;
  var style = 'solid';
  var color = 'transparent';
  var rest = s;
  var lenMatch = rest.match(/^(\d+(?:\.\d+)?)\s*(px|em|rem)?\s+/i);
  if (lenMatch) {
    width = parseFloat(lenMatch[1]);
    if (lenMatch[2] && (lenMatch[2].toLowerCase() === 'em' || lenMatch[2].toLowerCase() === 'rem')) width = Math.round(width * 16);
    rest = rest.slice(lenMatch[0].length).trim();
  } else if (/^thin\s+/i.test(rest)) { width = 1; rest = rest.slice(5).trim(); }
  else if (/^medium\s+/i.test(rest)) { width = 3; rest = rest.slice(6).trim(); }
  else if (/^thick\s+/i.test(rest)) { width = 5; rest = rest.slice(5).trim(); }
  var styleMatch = rest.match(/^(none|solid|dashed|dotted|double|groove|ridge|inset|outset)\s+/i);
  if (styleMatch) {
    style = styleMatch[1].toLowerCase();
    rest = rest.slice(styleMatch[0].length).trim();
  }
  if (rest) color = rest;
  return { width: width, style: style, color: color };
}

/**
 * 从 grid-template-columns 解析出列数，用于 Figma 侧按列换行。
 * 支持：repeat(3, 1fr)、repeat(3, minmax(0, 1fr))、1fr 1fr 1fr（computed 多段）等。
 * @param {string} str - 声明或 computed 的 grid-template-columns 值
 * @returns {number|null} 列数，解析失败返回 null
 */
function parseGridTemplateColumnsCount(str) {
  if (!str || typeof str !== 'string') return null;
  var s = str.trim();
  if (!s || s === 'none') return null;
  var repeatMatch = s.match(/repeat\s*\(\s*(\d+)\s*,/);
  if (repeatMatch) return parseInt(repeatMatch[1], 10);
  var autoFillMatch = s.match(/repeat\s*\(\s*auto-fill\s*,/);
  if (autoFillMatch) return null;
  var autoFitMatch = s.match(/repeat\s*\(\s*auto-fit\s*,/);
  if (autoFitMatch) return null;
  var parts = s.split(/\s+/).filter(Boolean);
  if (parts.length >= 1) return parts.length;
  return null;
}

/**
 * 序列化 SVG 元素为字符串，供 Figma createNodeFromSVG() 使用。
 * - 把 currentColor 替换为实际 computed color
 * - 把 width/height 替换为 DOM 实测像素值（避免 1em 等相对单位）
 * @param {SVGElement} svgEl
 * @param {number} domWidth  - DOM 实测宽度（设计稿坐标）
 * @param {number} domHeight - DOM 实测高度（设计稿坐标）
 * @returns {string|null}
 */
function serializeSvgElement(svgEl, domWidth, domHeight) {
  if (!svgEl) return null;
  var html = svgEl.outerHTML;
  if (!html) return null;
  // 取实际渲染颜色，用于替换 currentColor
  var comp = window.getComputedStyle && window.getComputedStyle(svgEl);
  var color = (comp && comp.color) || '#000000';
  // currentColor → 实际颜色
  html = html.replace(/currentColor/gi, color);
  // 替换/补充 width、height 为 DOM 实测像素值
  var w = Math.ceil(domWidth) || 16;
  var h = Math.ceil(domHeight) || 16;
  if (/width="[^"]*"/.test(html)) {
    html = html.replace(/width="[^"]*"/, 'width="' + w + '"');
  } else {
    html = html.replace(/^<svg/, '<svg width="' + w + '"');
  }
  if (/height="[^"]*"/.test(html)) {
    html = html.replace(/height="[^"]*"/, 'height="' + h + '"');
  } else {
    html = html.replace(/^<svg/, '<svg height="' + h + '"');
  }
  return html;
}

function parseTransformRotation(transform) {
  if (!transform || transform === 'none') return undefined;
  const m = transform.match(/matrix\(([^)]+)\)/);
  if (!m) return undefined;
  const parts = m[1].split(',').map((s) => parseFloat(s.trim()));
  if (parts.length >= 6) {
    const a = parts[0];
    const b = parts[1];
    return (Math.atan2(b, a) * 180) / Math.PI;
  }
  return undefined;
}


if (typeof module !== 'undefined') {
  module.exports = {
    normalizeSvgPathForFigma: normalizeSvgPathForFigma,
    parseUrlFromBgImage: parseUrlFromBgImage,
    parseLinearGradientFromBgImage: parseLinearGradientFromBgImage,
    parseRadialGradientFromBgImage: parseRadialGradientFromBgImage,
    parseBoxShadow: parseBoxShadow,
    parseBorderShorthand: parseBorderShorthand,
    parseGridTemplateColumnsCount: parseGridTemplateColumnsCount,
    serializeSvgElement: serializeSvgElement,
    parseTransformRotation: parseTransformRotation,
    cssColorToHex: cssColorToHex,
    cssColorToRgba: cssColorToRgba,
  };
}
