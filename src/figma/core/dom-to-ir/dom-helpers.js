/**
 * ============================================================
 * dom-helpers.js  —  DOM / Shadow DOM 底层工具层
 * ============================================================
 * 职责：
 *   - 画布坐标系：getGeoviewScaleAndOrigin / getDesignRect
 *   - DOM 辅助：hasClassPrefix / simpleSelectorMatches / getMatchedSelectorsForElement / getDeclaredStyleForElement
 *   - Shadow DOM 解析：getShadowHost / resolveFrameRoot / getCssRulesBySelector
 *   - 画布语义：getFrameTitleFromElement / findArtboardIdFromElement / emptyRoot
 * 规则：本层不依赖任何其他自定义模块，不做 CSS 解析，不构建 JSON 节点。
 * ============================================================
 */

var SHADOW_HOST_ID = '_mybricks-geo-webview_';
var GEOVIEW_WRAPPER_ID = '_geoview-wrapper_';

/**
 * 从 id=_geoview-wrapper_ 的节点上读取 transform: scale(n)，并返回设计稿坐标系参数。
 * 该节点通常包在画布外层，getBoundingClientRect() 得到的是缩放后的视口坐标，需换算成设计稿坐标。
 * @param {Document|ShadowRoot} [searchRoot] - 可选，先在此内查 #_geoview-wrapper_，没有再在 document 查
 * @returns {{ scale: number, originLeft: number, originTop: number }}
 */
function getGeoviewScaleAndOrigin(searchRoot) {
  var wrapper = null;
  if (searchRoot && searchRoot.querySelector) {
    try {
      wrapper = searchRoot.querySelector('#' + CSS.escape(GEOVIEW_WRAPPER_ID));
    } catch (_) {}
  }
  if (!wrapper && typeof document !== 'undefined') {
    try {
      wrapper = document.getElementById(GEOVIEW_WRAPPER_ID);
    } catch (_) {}
  }
  if (!wrapper) return { scale: 1, originLeft: 0, originTop: 0 };
  var computed = window.getComputedStyle(wrapper);
  var transform = computed && computed.transform ? computed.transform : '';
  var scale = 1;
  if (transform && transform !== 'none') {
    var m = transform.match(/matrix\(([^)]+)\)/);
    if (m) {
      var parts = m[1].split(',').map(function (s) { return parseFloat(s.trim()); });
      if (parts.length >= 4) scale = parts[0];
      if (scale <= 0 || !Number.isFinite(scale)) scale = 1;
    }
  }
  var r = wrapper.getBoundingClientRect();
  return { scale: scale, originLeft: r.left, originTop: r.top };
}

/**
 * 封装 getBoundingClientRect：返回「设计稿坐标」下的 rect（受 _geoview-wrapper_ 的 scale 影响时自动除以 scale）。
 * @param {Element|DOMRect|{ left: number, top: number, right?: number, bottom?: number, width?: number, height?: number }} elOrRect - 元素或视口 rect 对象
 * @param {{ scale: number, originLeft: number, originTop: number }} geo - 来自 getGeoviewScaleAndOrigin()
 * @returns {{ left: number, top: number, right: number, bottom: number, width: number, height: number }}
 */
function getDesignRect(elOrRect, geo) {
  var r;
  if (elOrRect && typeof elOrRect.getBoundingClientRect === 'function') {
    r = elOrRect.getBoundingClientRect();
  } else if (elOrRect && typeof elOrRect.left === 'number' && typeof elOrRect.top === 'number') {
    r = elOrRect;
  } else {
    return { left: 0, top: 0, right: 0, bottom: 0, width: 0, height: 0 };
  }
  var s = geo.scale || 1;
  var oL = geo.originLeft || 0;
  var oT = geo.originTop || 0;
  return {
    left: (r.left - oL) / s,
    top: (r.top - oT) / s,
    right: (r.right - oL) / s,
    bottom: (r.bottom - oT) / s,
    width: (r.width || r.right - r.left) / s,
    height: (r.height || r.bottom - r.top) / s
  };
}

/** 元素是否有任意 class 以 prefix 开头 */
function hasClassPrefix(el, prefix) {
  if (!el.className || typeof el.className !== 'string') return false;
  return el.className.trim().split(/\s+/).some(function (c) { return c.indexOf(prefix) === 0; });
}

/** 判断元素是否匹配单个选择器（支持 .class、#id、tag、.a.b、div.foo 等，不含组合符） */
function simpleSelectorMatches(el, sel) {
  var s = sel.trim();
  if (!s) return false;
  if (s.indexOf(',') >= 0) {
    var parts = s.split(',');
    for (var i = 0; i < parts.length; i++) if (simpleSelectorMatches(el, parts[i].trim())) return true;
    return false;
  }
  var tagPart = s.match(/^([a-zA-Z][\w-]*)/);
  if (tagPart && (el.tagName || '').toLowerCase() !== tagPart[1].toLowerCase()) return false;
  var idM = s.match(/#([\w-]+)/);
  if (idM && el.id !== idM[1]) return false;
  var classParts = s.match(/\.[\w-]+/g);
  if (classParts) {
    for (var j = 0; j < classParts.length; j++) {
      if (!el.classList || !el.classList.contains(classParts[j].slice(1))) return false;
    }
  }
  return true;
}

/** 从 style 标签里收集匹配当前元素的所有 selector 字符串（用于挂到节点额外信息） */
function getMatchedSelectorsForElement(el, cssRuleMap) {
  if (!el || !cssRuleMap || typeof el.matches !== 'function') return [];
  var out = [];
  for (var selector in cssRuleMap) {
    try {
      if (el.matches(selector)) out.push(selector);
    } catch (_) {}
  }
  return out;
}

/** 从 style 标签规则里收集匹配当前元素的所有声明（后匹配的覆盖前面的）
 *
 * 修复：优先用 el.matches(selector)（支持后代/多类等所有 CSS 选择器）；
 * 仅在 el.matches 不可用时降级到 simpleSelectorMatches。
 * 原先只用 simpleSelectorMatches 无法处理 .a.b、.parent .child 等复合选择器，
 * 导致 ant-pagination 等多类节点的 align-items: center 读不到。
 */
function getDeclaredStyleForElement(el, cssRuleMap) {
  var declared = {};
  var canUseMatches = el && typeof el.matches === 'function';
  for (var selector in cssRuleMap) {
    var matched = false;
    if (canUseMatches) {
      try { matched = el.matches(selector); } catch (_) { matched = simpleSelectorMatches(el, selector); }
    } else {
      matched = simpleSelectorMatches(el, selector);
    }
    if (!matched) continue;
    var cssText = cssRuleMap[selector];
    if (!cssText) continue;
    var parts = cssText.split(';');
    for (var i = 0; i < parts.length; i++) {
      var part = parts[i].trim();
      var colon = part.indexOf(':');
      if (colon <= 0) continue;
      var key = part.slice(0, colon).trim();
      var val = part.slice(colon + 1).trim().replace(/\s*!important\s*$/i, '');
      if (key) declared[key] = val;
    }
  }
  return declared;
}

/** 从 frame 的 DOM 中取标题：子元素 class 以 boardTitle- 开头，其下 class 以 tt- 开头的元素文本 */
function getFrameTitleFromElement(el) {
  if (!el || !el.children) return '';
  for (var i = 0; i < el.children.length; i++) {
    var child = el.children[i];
    if (!hasClassPrefix(child, 'boardTitle-')) continue;
    var tt = child.querySelector('[class^="tt-"], [class*=" tt-"]');
    if (tt) return (tt.textContent || '').trim();
  }
  return '';
}

/**
 * DOM to MyBricks-Figma JSON (browser script)
 *
 * 画布一定在固定 id 的 Shadow DOM 下，从其中取画布根:
 *   const json = domToMybricksJson('u_NuKJ9');
 *   const json = domToMybricksJson('u_NuKJ9', 'app-styles');
 *
 * @param {string} frameId - 画布容器 div 的 id（在 shadowRoot 内）。其下 class 以 "body-" 开头的节点为画布根（背景、宽高）。
 * @param {string} [styleTagId] - 可选，<style> 的 id，在 shadowRoot 内查找。
 * @returns {{ page: { name?: string, "component-def"?: any[], content: any[] } }}
 */
/** 始终返回插件可接受的根结构，保证 parser 不会报 "missing page object"。 */
function emptyRoot() {
  return { page: { name: undefined, 'component-def': [], content: [] } };
}

/** 从元素 el 向上查找，返回第一个 class 以 "artboard-" 开头的祖先元素的 id；找不到返回 null。 */
function findArtboardIdFromElement(el) {
  var node = el && el.parentElement;
  while (node) {
    if (hasClassPrefix(node, 'artboard-')) {
      return node.id || null;
    }
    node = node.parentElement;
  }
  return null;
}

/**
 * 获取固定 id 的 Shadow DOM 宿主（画布和 style 都在其 shadowRoot 下）。
 *
 * @returns {Element | null}
 */
function getShadowHost() {
  return document.getElementById(SHADOW_HOST_ID) || null;
}

/**
 * 从 Shadow DOM 解析画布根：div#frameId 下第一个 class 以 "body-" 开头的节点。
 *
 * @param {string} frameId - 画布容器 div 的 id
 * @returns {Element | null}
 */
function resolveFrameRoot(frameId) {
  const host = getShadowHost();
  if (!host || !host.shadowRoot) return null;
  const root = host.shadowRoot;
  const frameContainer = root.querySelector('#' + CSS.escape(frameId));
  if (!frameContainer) return null;
  const frameRoot = frameContainer.querySelector('[class^="body-"], [class*=" body-"]');
  return frameRoot || null;
}

/**
 * Build a map of selector -> declaration string from a <style id="..."> tag.
 * 用 style#id 查，避免与画布上同 id 的 div 等元素冲突；找不到时再在 document 内用 style#id 查。
 *
 * @param {string} styleTagId - ID of the <style> element
 * @param {Document|ShadowRoot} [root] - Document or shadowRoot to query in first; then document.
 * @returns {Record<string, string> | null} selector -> cssText or null if not found
 */
function getCssRulesBySelector(styleTagId, root) {
  var styleSelector = 'style#' + CSS.escape(styleTagId);
  var styleEl = null;
  if (root && root.querySelector) {
    try {
      styleEl = root.querySelector(styleSelector);
    } catch (_) {}
  }
  if (!styleEl && typeof document !== 'undefined' && document.querySelector) {
    try {
      styleEl = document.querySelector(styleSelector);
    } catch (_) {}
  }
  if (!styleEl || (styleEl.tagName || '').toLowerCase() !== 'style') return null;
  var sheet = styleEl.sheet;
  if (!sheet || !sheet.cssRules) return null;
  var map = {};
  for (var i = 0; i < sheet.cssRules.length; i++) {
    var rule = sheet.cssRules[i];
    if (rule.selectorText) map[rule.selectorText.trim()] = rule.style.cssText;
  }
  return map;
}


if (typeof module !== 'undefined') {
  module.exports = {
    SHADOW_HOST_ID: SHADOW_HOST_ID,
    GEOVIEW_WRAPPER_ID: GEOVIEW_WRAPPER_ID,
    getShadowHost: getShadowHost,
    resolveFrameRoot: resolveFrameRoot,
    getCssRulesBySelector: getCssRulesBySelector,
    getGeoviewScaleAndOrigin: getGeoviewScaleAndOrigin,
    getDesignRect: getDesignRect,
    hasClassPrefix: hasClassPrefix,
    simpleSelectorMatches: simpleSelectorMatches,
    getMatchedSelectorsForElement: getMatchedSelectorsForElement,
    getDeclaredStyleForElement: getDeclaredStyleForElement,
    getFrameTitleFromElement: getFrameTitleFromElement,
    findArtboardIdFromElement: findArtboardIdFromElement,
    emptyRoot: emptyRoot,
  };
}
