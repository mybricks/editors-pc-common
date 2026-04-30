/**
 * ============================================================
 * node-builder.js  —  节点类型推断 / 文本内容 / 伪元素处理层
 * ============================================================
 * 职责：
 *   - 节点类型：inferNodeType
 *   - 文本内容提取：getTextContent / getTextWithActualLineBreaksForElement /
 *     shouldMergeTextAndBrChildren / mergeTextAndBrChildNodesContent /
 *     normalizeTextExportPreserveTrailing
 *   - 文本布局辅助：getTextNodeRect / getElementContentsTextBlockRect /
 *     shouldMarkWidthConstrainedForEdgeWhitespace / applyWidthConstrainedForFigmaEdgeWhitespace /
 *     applyTextOverflowEllipsisExport / shouldSetTextAlignVerticalCenterForAbsoluteTextLeaf /
 *     shouldSetTextAlignVerticalCenterForFlexParentAlignItemsCenter /
 *     shouldSetTextAlignVerticalCenterForSelectPlaceholder /
 *     applyAntSelectSelectionPlaceholderTextAlign
 *   - 表单辅助：isShowingPlaceholder
 *   - 伪元素：getPseudoTextNode / getPseudoShapeNode
 * 规则：依赖 css-parsers（颜色/阴影）和 style-builder（buildInlineTextStyle）。
 * ============================================================
 */
var _nbcp = (typeof module !== 'undefined') ? require('./css-parsers') : {};
var _nbsb = (typeof module !== 'undefined') ? require('./style-builder') : {};
var _nbdh = (typeof module !== 'undefined') ? require('./dom-helpers') : {};
var cssColorToRgba = _nbcp.cssColorToRgba || cssColorToRgba;
var cssColorToHex = _nbcp.cssColorToHex || cssColorToHex;
var parseBoxShadow = _nbcp.parseBoxShadow || parseBoxShadow;
var parseTransformRotation = _nbcp.parseTransformRotation || parseTransformRotation;
var parseLinearGradientFromBgImage = _nbcp.parseLinearGradientFromBgImage || (typeof parseLinearGradientFromBgImage !== 'undefined' ? parseLinearGradientFromBgImage : null);
var parseRadialGradientFromBgImage = _nbcp.parseRadialGradientFromBgImage || (typeof parseRadialGradientFromBgImage !== 'undefined' ? parseRadialGradientFromBgImage : null);
var parseUrlFromBgImage = _nbcp.parseUrlFromBgImage || (typeof parseUrlFromBgImage !== 'undefined' ? parseUrlFromBgImage : null);
var buildInlineTextStyle = _nbsb.buildInlineTextStyle || buildInlineTextStyle;
var hasClassPrefix = _nbdh.hasClassPrefix || hasClassPrefix;
var getDeclaredStyleForElement = _nbdh.getDeclaredStyleForElement || getDeclaredStyleForElement;

// 内联字体栈解析函数：style-builder.js 里有同名定义，但打包后 node-builder 作用域内不一定可见。
// 用局部变量形式引用，优先用外部已有的定义，否则 fallback 到内联实现，避免 ReferenceError。
var _parseFontFamilyStack = (typeof parseFontFamilyStack === 'function') ? parseFontFamilyStack : function(stackStr) {
  if (!stackStr || !String(stackStr).trim()) return [];
  return String(stackStr).split(',').map(function(s){ return s.trim().replace(/^['"]|['"]$/g, ''); }).filter(Boolean);
};
var _resolveFontFamilyFromStack = (typeof resolveFontFamilyFromStack === 'function') ? resolveFontFamilyFromStack : function(stackStr) {
  var _syskw = /^(-apple-system|blinkmacsystemfont|system-ui|arial|helvetica\s*neue|helvetica|sans-serif|serif|monospace|Segoe\s+UI|Roboto|SF\s+UI\s+Text)$/i;
  var list = _parseFontFamilyStack(stackStr);
  for (var _i = 0; _i < list.length; _i++) {
    if (list[_i] && !_syskw.test(list[_i])) return list[_i];
  }
  return 'PingFang SC';
};

/**
 * 绝对/固定定位的叶子 text：导出宽高常为整盒，浏览器用 flex 将一行字居中，Figma 需 textAlignVertical。
 * 如 ant Pagination 的 .ant-pagination-item-ellipsis（•••）。
 */
function shouldSetTextAlignVerticalCenterForAbsoluteTextLeaf(textStyle, computed) {
  if (!textStyle || !computed) return false;
  var pt = textStyle.positionType;
  if (pt !== 'absolute' && pt !== 'fixed') return false;
  var gv = computed.getPropertyValue
    ? function (k) { return (computed.getPropertyValue(k) || '').trim().toLowerCase(); }
    : function (k) { return String(computed[k] || '').trim().toLowerCase(); };
  var disp = gv('display');
  var ai = gv('align-items');
  if ((disp === 'flex' || disp === 'inline-flex') && ai === 'center') return true;
  if (textStyle.singleLine !== true) return false;
  var h = textStyle.height;
  var fs = textStyle.fontSize;
  if (h != null && fs != null && fs > 0 && h >= fs * 1.75) return true;
  var lhRaw = computed.lineHeight;
  var lh = (lhRaw && lhRaw !== 'normal') ? parseFloat(lhRaw) : null;
  if (h != null && lh != null && !Number.isNaN(lh) && lh > 0 && h > lh * 1.25) return true;
  return false;
}

/**
 * 横向 flex 父级 align-items:center 时，子文本行框在父交叉轴内垂直居中；IR 上 height 常为整行高、lineHeight 为 CSS 行高。
 * 若不标 textAlignVertical，Figma textUserLayoutVersion=4 的 derivedTextData 会把行框顶在 0，与浏览器不一致。
 */
function shouldSetTextAlignVerticalCenterForFlexParentAlignItemsCenter(el, textStyle) {
  if (!el || !textStyle) return false;
  var p = el.parentElement;
  if (!p) return false;
  var pcs;
  try { pcs = window.getComputedStyle(p); } catch (e) { return false; }
  var disp = String(pcs.display || '').toLowerCase();
  if (disp !== 'flex' && disp !== 'inline-flex') return false;
  var flexDir = String(pcs.flexDirection || 'row').toLowerCase();
  if (flexDir !== 'row' && flexDir !== 'row-reverse') return false;
  var ai = String(pcs.alignItems || 'stretch').trim().toLowerCase();
  if (ai === 'normal') ai = 'stretch';
  if (ai !== 'center') return false;
  var h = textStyle.height;
  var lh = textStyle.lineHeight;
  if (h == null || lh == null || !(h > 0) || !(lh > 0)) return false;
  return h > lh * 1.02;
}

/**
 * ant-select .ant-select-selection-placeholder：浏览器里占位符在行框内垂直居中；
 * IR 上可能 height 远小于 lineHeight（字形盒），也可能 height≈格高与 lineHeight 同量级，
 * 原先用「h < lh*0.92」会漏掉后者。lineHeight 若未写入 style，用 computed 兜底。
 */
function shouldSetTextAlignVerticalCenterForSelectPlaceholder(el, textStyle, computed) {
  if (!el || !textStyle) return false;
  try {
    if (typeof el.closest !== 'function') return false;
    if (!el.closest('.ant-select-selection-placeholder')) return false;
  } catch (e) {
    return false;
  }
  if (textStyle.singleLine === false) return false;
  var lh = textStyle.lineHeight;
  if (lh == null || !(lh > 0)) {
    if (!computed) return false;
    var _lhRaw = computed.lineHeight;
    lh = (_lhRaw && String(_lhRaw) !== 'normal') ? parseFloat(_lhRaw) : NaN;
    if (!(lh > 0) || Number.isNaN(lh)) return false;
  }
  var h = textStyle.height;
  if (h == null || !(h > 0)) return true;
  if (h < lh * 0.92) return true;
  // 测量高度与行高同量级（含略大于行高的整格），仍为单行占位，需 CENTER
  if (h >= lh * 0.85 && h <= lh * 1.35) return true;
  return false;
}

/**
 * 对 IR 文本节点应用 ant-select 占位符垂直居中（含 line-height / height 与浏览器行框对齐）。
 * @returns {boolean} 是否已写入 CENTER
 */
function applyAntSelectSelectionPlaceholderTextAlign(textNode, el, computed) {
  if (!textNode || !textNode.style || !el || !computed) return false;
  if (!shouldSetTextAlignVerticalCenterForSelectPlaceholder(el, textNode.style, computed)) return false;
  var s = textNode.style;
  s.textAlignVertical = 'CENTER';
  if (s.lineHeight == null || !(s.lineHeight > 0)) {
    var _raw = computed.lineHeight;
    var _lh = (_raw && String(_raw) !== 'normal') ? parseFloat(_raw) : null;
    if (_lh != null && !Number.isNaN(_lh) && _lh > 0) s.lineHeight = _lh;
  }
  var _lhNow = s.lineHeight;
  if (_lhNow != null && _lhNow > 0 && s.height != null && s.height > 0 && s.height < _lhNow * 0.92) {
    s.height = Math.round(_lhNow);
  }
  return true;
}

/** 计算样式中 background-image 是否有效（渐变/url 等）。纯渐变时 background-color 常为透明，不能单靠底色判断容器。 */
function computedHasNonNoneBackgroundImage(comp) {
  if (!comp) return false;
  var raw = comp.backgroundImage;
  if ((raw == null || raw === '') && comp.getPropertyValue) {
    try { raw = comp.getPropertyValue('background-image'); } catch (e) { raw = ''; }
  }
  var s = String(raw || '').trim().toLowerCase();
  return s.length > 0 && s !== 'none';
}

function inferNodeType(el, computed, tag) {
  if (tag === 'img') return 'image';
  // canvas 导出为静态图片：读取当前像素快照写入 image 节点
  if (tag === 'canvas') return 'image';
  if (tag === 'svg') return 'component';
  // input/textarea 识别为 frame：在 Figma 中用带边框+圆角+背景的 Frame 还原输入框外观
  // （TextNode 不支持 strokes/borderRadius，若判为 text 会导致边框和圆角丢失）
  if (tag === 'input' && (el.type === 'text' || el.type === 'number' || el.type === 'password' || el.type === 'search' || el.type === 'email' || el.type === 'tel' || el.type === 'url' || !el.type || el.type === '')) {
    return 'frame';
  }
  if (tag === 'textarea') return 'frame';
  if (tag === 'picture' || (el.querySelector && el.querySelector('img'))) return 'frame'; // wrap or container
  const display = computed.display;
  const isFlex = display === 'flex' || display === 'inline-flex';
  const isBlock = display === 'block' || display === 'flex' || display === 'grid' || display === 'inline-block' || display === 'table-cell' || display === 'table-row' || display === 'table-header-group' || display === 'table-row-group';
  const hasElementChildren = el.children && el.children.length > 0;
  const hasOnlyText = !hasElementChildren; // 无子元素
  if (hasOnlyText) {
    // 架构级修复：不再依赖 textTags 白名单。
    // 任何无子元素的叶子节点，只要带有非透明背景色、非 none 的 background-image（渐变/url）、
    // padding 或 border-radius，在视觉上就是一个容器（如 badge、tag、button 或带样式的 div），
    // 必须识别为 frame 以保留背景与圆角、内边距等样式。
    var elBg = computed.backgroundColor || '';
    var elRadius = computed.borderRadius || computed.borderTopLeftRadius || '';
    var elPaddingTop = computed.paddingTop || '';
    var elPaddingRight = computed.paddingRight || '';
    var elPaddingBottom = computed.paddingBottom || '';
    var elPaddingLeft = computed.paddingLeft || '';
    var hasVisualBg = elBg && elBg !== 'rgba(0, 0, 0, 0)' && elBg !== 'transparent';
    var hasBgImage = computedHasNonNoneBackgroundImage(computed);
    var hasRadius = elRadius && elRadius !== '0px' && elRadius !== '0';
    var hasPadding = (elPaddingTop && elPaddingTop !== '0px') ||
                    (elPaddingRight && elPaddingRight !== '0px') ||
                    (elPaddingBottom && elPaddingBottom !== '0px') ||
                    (elPaddingLeft && elPaddingLeft !== '0px');
    if (hasVisualBg || hasBgImage || hasRadius || hasPadding) {
      var tc = (el.textContent || '').trim().slice(0, 30);
      return 'frame';
    }
    if (/\S/.test(el.textContent || '')) {
      return 'text';
    }
  }
  // "纯内联子节点文本段落"检测：
  // 若父元素为非 flex/grid 的块级元素，且所有子元素均为 inline/inline-block/inline-flex
  // （如 <span>/<a>/<em> 等），则整体当 text 节点处理。
  // 原因：inline 子节点处于文本流中，各片段无法用绝对定位在 Figma 中精确还原，
  // 合并为单个 text 节点后再用 Range 检测视觉断行，位置和换行均正确。
  // 例外：若任一子元素有背景色（如 badge/tag）则跳过合并，保持 frame 处理。
  if (hasElementChildren && !isFlex && computed.display !== 'grid') {
    var _allChildInline = true;
    var _anyChildHasBg = false;
    for (var _ici = 0; _ici < el.children.length; _ici++) {
      var _childEl = el.children[_ici];
      var _childTagLower = (_childEl.tagName || '').toLowerCase();
      // <svg> 在 HTML 中常为 display:inline，但绝不能走「合并为 text」：textContent 会串起所有 <text>，
      // 且丢失 circle/渐变/textPath（如 plateImg 仅包 plateSvg 时被误判成一段「炭CHARCOALBBQ」）。
      if (_childTagLower === 'svg' || _childTagLower === 'math' || _childTagLower === 'canvas' ||
          _childTagLower === 'video' || _childTagLower === 'iframe' || _childTagLower === 'object') {
        _allChildInline = false;
        break;
      }
      var _childComp = window.getComputedStyle(_childEl);
      var _childDisp = _childComp.display;
      if (_childDisp !== 'inline' && _childDisp !== 'inline-block' && _childDisp !== 'inline-flex') {
        _allChildInline = false;
        break;
      }
      // inline-flex 子节点含有元素子节点（如圆点+标签的状态组件）：视为含视觉背景，阻止父节点合并为文本
      if ((_childDisp === 'inline-flex' || _childDisp === 'flex') && _childEl.children && _childEl.children.length > 0) {
        _anyChildHasBg = true;
      }
      var _childBg = _childComp.backgroundColor || '';
      if (_childBg && _childBg !== 'rgba(0, 0, 0, 0)' && _childBg !== 'transparent') {
        _anyChildHasBg = true;
      }
      if (!_anyChildHasBg && computedHasNonNoneBackgroundImage(_childComp)) {
        _anyChildHasBg = true;
      }
    }
    // 多个操作入口 / 表单块：① 直接子级为 a/button/input/select/textarea 或子级内包一层；② 子树 ≥2 个 a/button/input…；
    // ③ 多子级且含表单控件（如 ant-pagination-options：条/页 + 前往页）。任一则不能整段判成 text。
    if (_allChildInline && el.children.length >= 2) {
      var _interactiveSlots = 0;
      for (var _pii = 0; _pii < el.children.length; _pii++) {
        var _slotEl = el.children[_pii];
        var _slotTag = (_slotEl.tagName || '').toLowerCase();
        if (_slotTag === 'a' || _slotTag === 'button' || _slotTag === 'input' || _slotTag === 'select' || _slotTag === 'textarea') {
          _interactiveSlots++;
        } else if (_slotEl.querySelector && (_slotEl.querySelector('a') || _slotEl.querySelector('button') ||
            _slotEl.querySelector('input') || _slotEl.querySelector('select') || _slotEl.querySelector('textarea'))) {
          _interactiveSlots++;
        }
      }
      if (_interactiveSlots >= 2) _allChildInline = false;
    }
    if (_allChildInline && el.children.length >= 2 && el.querySelector) {
      try {
        if (el.querySelector('input, select, textarea')) _allChildInline = false;
      } catch (_eFormMix) {}
    }
    if (_allChildInline && el.querySelectorAll) {
      try {
        var _subCtrls = el.querySelectorAll('a, button, input, select, textarea');
        if (_subCtrls.length >= 2) _allChildInline = false;
      } catch (_eSubL) {}
    }
    if (_allChildInline && !_anyChildHasBg && /\S/.test(el.textContent || '')) {
      // 父元素本身无视觉容器背景/圆角/内边距，整体当 text 处理
      var _pBg = computed.backgroundColor || '';
      var _pHasBg = _pBg && _pBg !== 'rgba(0, 0, 0, 0)' && _pBg !== 'transparent';
      var _pHasBgImage = computedHasNonNoneBackgroundImage(computed);
      var _pRadius = computed.borderRadius || computed.borderTopLeftRadius || '';
      var _pHasRadius = _pRadius && _pRadius !== '0px' && _pRadius !== '0';
      // 有 padding 时不合并为 text：padding 代表可视内边距，需保留为 frame 的 AutoLayout 内边距，
      // 否则导出后文本直接贴边，padding 丢失（如 tableCellDesc 有 padding 的表格单元格）。
      var _pPt = computed.paddingTop || ''; var _pPr = computed.paddingRight || '';
      var _pPb = computed.paddingBottom || ''; var _pPl = computed.paddingLeft || '';
      var _pHasPadding = (_pPt && _pPt !== '0px') || (_pPr && _pPr !== '0px') ||
                         (_pPb && _pPb !== '0px') || (_pPl && _pPl !== '0px');
      if (!_pHasBg && !_pHasBgImage && !_pHasRadius && !_pHasPadding) {
        return 'text';
      }
    }
  }
  // 既有子元素又有文本时当作容器，子列表里会包含文本节点
  if (isFlex || isBlock) return 'frame';
  return 'group';
}

/** childNodes 在「导出语义」上是否仅由文本节点与 br 组成（无 span 等），用于与 br 合并为单段带 \\n 的 text */
function shouldMergeTextAndBrChildren(parentEl) {
  if (!parentEl || !parentEl.childNodes || parentEl.childNodes.length === 0) return false;
  var hasBr = false;
  var hasNonEmptyText = false;
  for (var i = 0; i < parentEl.childNodes.length; i++) {
    var n = parentEl.childNodes[i];
    if (n.nodeType === 3) {
      if ((n.textContent || '').replace(/[^\S\n]+/g, '').length > 0) hasNonEmptyText = true;
      continue;
    }
    if (n.nodeType === 1) {
      var tn = (n.tagName || '').toLowerCase();
      if (tn === 'script' || tn === 'style' || tn === 'link') continue;
      if (hasClassPrefix(n, 'selection-') || hasClassPrefix(n, 'append-') || hasClassPrefix(n, 'boardTitle-')) continue;
      if (tn === 'br') {
        hasBr = true;
        continue;
      }
      return false;
    }
    if (n.nodeType === 8) continue;
    return false;
  }
  return hasBr && hasNonEmptyText;
}

/** 按文档顺序拼接文本，br → \\n；空白与 getTextContent 一致（保留换行，折叠空格，保留行尾空白） */
function mergeTextAndBrChildNodesContent(parentEl) {
  var parts = [];
  for (var i = 0; i < parentEl.childNodes.length; i++) {
    var n = parentEl.childNodes[i];
    if (n.nodeType === 3) {
      parts.push(n.textContent || '');
      continue;
    }
    if (n.nodeType === 1) {
      var tn = (n.tagName || '').toLowerCase();
      if (tn === 'script' || tn === 'style' || tn === 'link') continue;
      if (hasClassPrefix(n, 'selection-') || hasClassPrefix(n, 'append-') || hasClassPrefix(n, 'boardTitle-')) continue;
      if (tn === 'br') {
        parts.push('\n');
        continue;
      }
    }
    if (n.nodeType === 8) continue;
  }
  var raw = parts.join('');
  return normalizeTextExportPreserveTrailing(raw, false);
}

/** 取元素全部子内容（含 br）的整体文本块包围盒，用于合并后的单个 text 节点 */
function getElementContentsTextBlockRect(el) {
  if (!el || !el.ownerDocument || !el.ownerDocument.createRange) return null;
  try {
    var range = el.ownerDocument.createRange();
    range.selectNodeContents(el);
    var r = range.getBoundingClientRect();
    if (!r || (r.width <= 0 && r.height <= 0)) return null;
    return r;
  } catch (_) {
    return null;
  }
}

/** 用 Range 取文本节点的包围框（相对于视口） */
function getTextNodeRect(textNode) {
  if (!textNode || textNode.nodeType !== 3) return null;
  var doc = textNode.ownerDocument;
  if (!doc || !doc.createRange) return null;
  try {
    var range = doc.createRange();
    range.selectNodeContents(textNode);
    return range.getBoundingClientRect();
  } catch (_) {
    return null;
  }
}

/**
 * Figma 在 textAutoResize=WIDTH_AND_HEIGHT 时，行首/行尾空白不参与撑宽，文本框会比浏览器实测窄。
 * 有此类空白且已有实测 width 时标记 widthConstrained，消费侧固定宽度以保留空白占位。
 */
function shouldMarkWidthConstrainedForEdgeWhitespace(content) {
  if (content == null || typeof content !== 'string') return false;
  return /^\s/.test(content) || /\s$/.test(content);
}

/** @param {{ style?: object, content?: string }} json */
function applyWidthConstrainedForFigmaEdgeWhitespace(json) {
  if (!json || !json.style) return;
  if (json.style.singleLine !== true || json.style.width == null) return;
  if (!shouldMarkWidthConstrainedForEdgeWhitespace(json.content)) return;
  json.style.widthConstrained = true;
}

/**
 * 父元素有 text-overflow:ellipsis 时，将子文本 width 收窄到父容器可用宽度，
 * 并标记 widthConstrained/textOverflow，由 Figma 插件的 textTruncation='ENDING' 自动渲染省略号。
 * @param {object} json type:text 节点（会改写 style.width 等，不改 content）
 * @param {Element} parentEl 包裹该文本的 DOM 元素
 * @param {CSSStyleDeclaration} computed parentEl 的计算样式
 * @param {object} geo scale 等
 * @param {Text|null} textNode 原始 #text 节点（暂未使用，保留供将来扩展）
 * @param {object|null} parentDesignRect 父元素的 design rect（含 width，已除以 geo.scale）
 */
function applyTextOverflowEllipsisExport(json, parentEl, computed, geo, textNode, parentDesignRect) {
  if (!json || !json.style || !parentEl || !computed) return;
  if ((computed.textOverflow || '') !== 'ellipsis') return;
  if ((computed.overflowX || computed.overflow || '') === 'visible') return;
  var full = json.content;
  if (full == null || typeof full !== 'string' || full.indexOf('\n') >= 0) return;

  // 父容器可用宽度 = 父设计宽度 - text.x（已含 paddingLeft 偏移）- paddingRight
  var parentW = parentDesignRect ? parentDesignRect.width
    : (parentEl.getBoundingClientRect().width / ((geo && geo.scale) || 1));
  var paddingRight = parseFloat(computed.paddingRight || '0');
  var availW = parentW - (json.style.x || 0) - paddingRight;
  if (!(availW > 0)) return;
  if (json.style.width != null && json.style.width <= availW) return;

  json.style.width = availW;
  json.style.widthConstrained = true;
  json.style.textOverflow = 'ellipsis';
  json.style.singleLine = true;
}

/**
 * 导出用文本规范化：折叠空白（可选是否把换行也压成空格），去掉行首空白，保留行尾空白；无非空白字符则返回 ''。
 * @param {string} raw
 * @param {boolean} collapseNewlinesToSpace - true 时等同原 element walk 的 /\\s+/g
 */
function normalizeTextExportPreserveTrailing(raw, collapseNewlinesToSpace) {
  if (raw == null || raw === '') return '';
  var pat = collapseNewlinesToSpace ? /\s+/g : /[^\S\n]+/g;
  var s = String(raw).replace(pat, ' ');
  s = s.replace(/^[\s\uFEFF\xA0]+/, '');
  if (!/\S/.test(s)) return '';
  return s;
}

function getTextContent(el) {
  const tag = (el.tagName || '').toLowerCase();
  if (tag === 'input' || tag === 'textarea') return el.value || el.placeholder || '';
  // 保留换行符，只折叠同行内的多余空白；保留行尾空白（与 String#trim 不同）
  return normalizeTextExportPreserveTrailing(el.textContent || '', false);
}

/**
 * 对多行文本元素（singleLine:false，含 CJK+数字），递归遍历所有子节点（包括嵌套 span 等），
 * 用 Range.getClientRects() 逐字符检测 DOM 实际断行位置，在换行处插入 '\n'。
 * 仅当结果中确实存在 '\n' 时返回新字符串，否则返回 null（不改原 content）。
 * @param {Element} el 文本元素（type:'text' 对应的 DOM 节点）
 * @returns {string|null}
 */
function getTextWithActualLineBreaksForElement(el) {
  var pieces = [];
  function collectPieces(node) {
    if (node.nodeType === 3) {
      var t = node.textContent || '';
      if (!t) return;
      try {
        var range = document.createRange();
        for (var i = 0; i < t.length; i++) {
          range.setStart(node, i);
          range.setEnd(node, i + 1);
          var rects = range.getClientRects();
          pieces.push({ ch: t[i], top: (rects && rects.length) ? Math.round(rects[0].top) : null });
        }
      } catch (e) {
        for (var j = 0; j < t.length; j++) pieces.push({ ch: t[j], top: null });
      }
    } else if (node.nodeType === 1) {
      for (var k = 0; k < node.childNodes.length; k++) collectPieces(node.childNodes[k]);
    }
  }
  for (var m = 0; m < el.childNodes.length; m++) collectPieces(el.childNodes[m]);
  if (!pieces.length) return null;
  var result = '';
  var prevTop = null;
  for (var p = 0; p < pieces.length; p++) {
    var piece = pieces[p];
    // Skip original '\n' chars from the HTML source: in white-space:normal they're rendered as
    // spaces by the browser, not actual line breaks. We insert our own '\n' from visual detection
    // below. Keeping them would cause a double '\n' (source char + detected visual break).
    if (piece.ch === '\n') continue;
    if (piece.top !== null && prevTop !== null && piece.top > prevTop + 2) result += '\n';
    result += piece.ch;
    if (piece.top !== null) prevTop = piece.top;
  }
  return result.indexOf('\n') !== -1 ? result : null;
}

function isShowingPlaceholder(el) {
  const tag = (el.tagName || '').toLowerCase();
  if (tag !== 'input' && tag !== 'textarea') return false;
  return !el.value && !!el.placeholder;
}

/**
 * 获取元素的 ::before 或 ::after 伪元素文本节点 JSON。
 * 伪元素不是真实 DOM，无法用 getBoundingClientRect 精确定位，
 * 位置基于父元素矩形 + margin 偏移估算。
 * @param {Element} el 宿主元素
 * @param {string} pseudo '::before' 或 '::after'
 * @param {object} geo getGeoviewScaleAndOrigin 返回值
 * @param {object} parentRect 父节点设计稿矩形 {x,y,width,height}
 * @param {object} elRect 宿主元素设计稿矩形 {x,y,width,height}
 * @param {object|null} cssRuleMap
 * @param {object|null} globalFont
 * @returns {object|null}
 */

/**
 * 扫描页面所有可访问样式表（document.styleSheets + shadowRoot.styleSheets），
 * 提取与 el 匹配的伪元素 CSS 属性对象。
 * 作用：Shadow DOM 下 getComputedStyle(el, pseudo) 可能因外部样式表不在 shadow 作用域
 * 而返回 content:'none'，此函数作为兜底从原始样式规则里读取真实值。
 * @param {Element} el
 * @param {string} pseudo  '::before' 或 '::after'
 * @returns {Object|null}  如 { content: '"*"', color: '#ff4d4f', 'font-size': '14px' }
 */
function _collectPseudoPropsFromRuleList(ruleList, el, pseudoDbl, pseudoSgl, result) {
  if (!ruleList || !el || typeof el.matches !== 'function') return;
  for (var _ri = 0; _ri < ruleList.length; _ri++) {
    var _rule = ruleList[_ri];
    if (!_rule) continue;
    var _selText = _rule.selectorText;
    if (_selText && (_selText.indexOf(pseudoDbl) !== -1 || _selText.indexOf(pseudoSgl) !== -1)) {
      // 支持 "a::before, b::before" 多选择器规则
      var _selParts = _selText.split(',');
      var _matched = false;
      for (var _pi = 0; _pi < _selParts.length; _pi++) {
        var _part = _selParts[_pi].trim();
        if (_part.indexOf(pseudoDbl) === -1 && _part.indexOf(pseudoSgl) === -1) continue;
        var _base = _part.replace(pseudoDbl, '').replace(pseudoSgl, '').trim();
        if (!_base) continue;
        try { if (el.matches(_base)) { _matched = true; break; } } catch (_) {}
      }
      if (_matched) {
        var _st = _rule.style;
        if (_st) {
          for (var _li = 0; _li < _st.length; _li++) {
            var _prop = _st[_li];
            result[_prop] = _st.getPropertyValue(_prop);
          }
        }
      }
    }
    // 递归进入 @media / @supports / @layer 等分组规则，避免遗漏嵌套伪元素规则
    if (_rule.cssRules && _rule.cssRules.length) {
      _collectPseudoPropsFromRuleList(_rule.cssRules, el, pseudoDbl, pseudoSgl, result);
    }
  }
}

function _getPseudoPropsFromSheets(el, pseudo) {
  if (!el || typeof el.matches !== 'function') return null;
  var result = {};
  try {
    var _pseudoName = (String(pseudo || '').indexOf('before') !== -1) ? 'before' : 'after';
    var _pseudoDbl = '::' + _pseudoName;
    var _pseudoSgl = ':' + _pseudoName;
    var sheets = [];
    if (typeof document !== 'undefined' && document.styleSheets) {
      for (var _i = 0; _i < document.styleSheets.length; _i++) sheets.push(document.styleSheets[_i]);
    }
    // shadow root 的样式表（如果 el 在 shadow DOM 内）
    try {
      var _rn = el.getRootNode && el.getRootNode();
      if (_rn && _rn !== document && _rn.styleSheets) {
        for (var _j = 0; _j < _rn.styleSheets.length; _j++) sheets.push(_rn.styleSheets[_j]);
      }
    } catch (_) {}
    for (var _si = 0; _si < sheets.length; _si++) {
      var _rules;
      try { _rules = sheets[_si].cssRules; } catch (_) { continue; } // CORS 跨域样式表跳过
      if (!_rules) continue;
      _collectPseudoPropsFromRuleList(_rules, el, _pseudoDbl, _pseudoSgl, result);
    }
  } catch (_) {}
  return Object.keys(result).length > 0 ? result : null;
}

function getPseudoTextNode(el, pseudo, geo, parentRect, elRect, cssRuleMap, globalFont) {
  try {
    // MyBricks 标注标记（[data-zone-docs-events]:before）是编辑器专用黄色圆点，不应导出到 Figma
    if (el && el.hasAttribute && el.hasAttribute('data-zone-docs-events')) return null;
    // elRect 无效时无法估算位置，直接跳过（getDesignRect 返回的是 left/top/width/height，不是 x/y）
    if (!elRect || typeof elRect.left !== 'number' || typeof elRect.top !== 'number' ||
        isNaN(elRect.left) || isNaN(elRect.top) || isNaN(elRect.width) || isNaN(elRect.height)) {
      return null;
    }

    var ps = window.getComputedStyle(el, pseudo);
    var content = ps.content;
    // content 为 none / normal 时：getComputedStyle 在 Shadow DOM 下可能读不到外部样式表的伪元素规则，
    // 用 _getPseudoPropsFromSheets 扫描所有可访问样式表作为兜底；若仍无内容则跳过。

    if (!content || content === 'none' || content === 'normal') {
      var _fallbackProps = _getPseudoPropsFromSheets(el, pseudo);
      if (!_fallbackProps) {
        // content 读不到时，尝试按图形伪元素导出
        var _shapeFallback = getPseudoShapeNode(el, pseudo, ps, geo, parentRect, elRect);
        if (_shapeFallback) return _shapeFallback;
        return null;
      }
      var _fc = _fallbackProps['content'];
      var _fbBorderW = 0;
      if (_fallbackProps['border']) {
        var _bwMatch = String(_fallbackProps['border']).match(/([0-9.]+)px/);
        _fbBorderW = _bwMatch ? (parseFloat(_bwMatch[1]) || 0) : 0;
      }
      ps = Object.assign(
        { display: 'inline', visibility: 'visible', opacity: '1', 'font-size': '14px' },
        _fallbackProps,
        // 同时提供 camelCase 别名，供 ps.fontSize / ps.color 等后续读取
        {
          fontSize: _fallbackProps['font-size'] || '14px',
          color: _fallbackProps['color'] || '',
          fontWeight: _fallbackProps['font-weight'] || '400',
          fontFamily: _fallbackProps['font-family'] || '',
          top: _fallbackProps['top'],
          right: _fallbackProps['right'],
          bottom: _fallbackProps['bottom'],
          left: _fallbackProps['left'],
          width: _fallbackProps['width'],
          height: _fallbackProps['height'],
          transform: _fallbackProps['transform'],
          transformOrigin: _fallbackProps['transform-origin'],
          backgroundColor: _fallbackProps['background-color'],
          backgroundImage: _fallbackProps['background-image'],
          boxSizing: _fallbackProps['box-sizing'],
          paddingTop: _fallbackProps['padding-top'] || '0',
          paddingRight: _fallbackProps['padding-right'] || '0',
          paddingBottom: _fallbackProps['padding-bottom'] || '0',
          paddingLeft: _fallbackProps['padding-left'] || '0',
          borderStyle: _fallbackProps['border-style'] || _fallbackProps['border'] || '',
          borderTopWidth: _fallbackProps['border-top-width'] || (_fbBorderW > 0 ? (_fbBorderW + 'px') : '0'),
          borderRightWidth: _fallbackProps['border-right-width'] || (_fbBorderW > 0 ? (_fbBorderW + 'px') : '0'),
          borderBottomWidth: _fallbackProps['border-bottom-width'] || (_fbBorderW > 0 ? (_fbBorderW + 'px') : '0'),
          borderLeftWidth: _fallbackProps['border-left-width'] || (_fbBorderW > 0 ? (_fbBorderW + 'px') : '0'),
          marginLeft: _fallbackProps['margin-left'] || '0',
          marginRight: _fallbackProps['margin-right'] || '0',
          marginInlineStart: _fallbackProps['margin-inline-start'] || _fallbackProps['margin-left'] || '0',
          marginInlineEnd: _fallbackProps['margin-inline-end'] || _fallbackProps['margin-right'] || '0',
        }
      );
      // content 可能为空字符串（纯图形伪元素），此时走图形分支而不是直接丢弃
      if (!_fc || _fc === 'none' || _fc === 'normal') {
        var _shapeFallback2 = getPseudoShapeNode(el, pseudo, ps, geo, parentRect, elRect);
        if (_shapeFallback2) return _shapeFallback2;
        return null;
      }
      content = _fc;
    }
    // 过滤 display:none 或 visibility:hidden 或 opacity:0 的伪元素（如 Ant Design 动画层）
    if (ps.display === 'none' || ps.visibility === 'hidden') {
      return null;
    }
    if (parseFloat(ps.opacity) === 0) {
      return null;
    }
    // content: '""' 或去引号 trim 后为空 / 无可见字符 → 尝试图形型伪元素（border/background 分割线等）
    if (content === '""') return getPseudoShapeNode(el, pseudo, ps, geo, parentRect, elRect);
    // 去掉首尾引号，如 "\":\"" → ":"。不做 trim，保留空格内容。
    // 注意：Shadow DOM 下 getComputedStyle 有时返回不带引号的原始值（如 '*' 而非 '"*"'），
    // replace 在无引号时不做任何改变，text 仍能得到正确内容，不需要特殊处理。
    var text = content.replace(/^["']|["']$/g, '');
    if (!text) return getPseudoShapeNode(el, pseudo, ps, geo, parentRect, elRect);
    // 纯空白内容（如 content: " "）：有背景色或可见边框说明是图形占位符（如 radio 圆点），走图形分支；
    // 有 margin 说明是 margin 载体（如 ant-form-item-label::after margin-right:8px 用于撑开与右侧输入框的间距），保留；
    // 三者均无则真正无意义，直接跳过。
    if (!/\S/.test(text)) {
      var _bg = ps.backgroundColor || '';
      var _hasBg = _bg && _bg !== 'transparent' && _bg !== 'rgba(0, 0, 0, 0)';
      var _hasBorder = ps.borderStyle && ps.borderStyle !== 'none' && parseFloat(ps.borderWidth || 0) > 0;
      if (_hasBg || _hasBorder) return getPseudoShapeNode(el, pseudo, ps, geo, parentRect, elRect);
      var _mEnd   = parseFloat(ps.marginInlineEnd   || ps.marginRight) || 0;
      var _mStart = parseFloat(ps.marginInlineStart || ps.marginLeft)  || 0;
      if (_mEnd <= 0 && _mStart <= 0) {
        var _shapeFallback3 = getPseudoShapeNode(el, pseudo, ps, geo, parentRect, elRect);
        if (_shapeFallback3) return _shapeFallback3;
        return null;
      }
      // 有有效 margin，fall-through 到后续文本节点生成逻辑，保留间距载体
    }

    var fontSize = parseFloat(ps.fontSize) || 14;
    var color = ps.color;
    var marginLeft = parseFloat(ps.marginInlineStart || ps.marginLeft) || 0;
    var marginRight = parseFloat(ps.marginInlineEnd || ps.marginRight) || 0;

    var estWidth = Math.ceil(fontSize * text.length * 0.65);
    var estHeight = Math.ceil(fontSize * 1.4);

    var pxOff = parentRect && typeof parentRect.left === 'number' && !isNaN(parentRect.left) ? parentRect.left : 0;
    var pyOff = parentRect && typeof parentRect.top === 'number' && !isNaN(parentRect.top) ? parentRect.top : 0;

    var relX, relY;
    if (pseudo === '::before') {
      relX = (elRect.left - pxOff) - estWidth - marginRight + marginLeft;
    } else {
      relX = (elRect.left - pxOff) + elRect.width + marginLeft;
    }
    relY = elRect.top - pyOff;

    // 最终保护：确保 x/y/width/height 均为有限数值
    var safeX = isFinite(relX) ? Math.round(relX) : 0;
    var safeY = isFinite(relY) ? Math.round(relY) : 0;
    var safeW = isFinite(estWidth) && estWidth > 0 ? estWidth : 10;
    var safeH = isFinite(estHeight) && estHeight > 0 ? estHeight : 20;

    var pseudoStyle = {
      x: safeX,
      y: safeY,
      width: safeW,
      height: safeH,
      fontSize: Math.round(fontSize),
      singleLine: true,
    };
    // 还原 margin-inline-start/end，用于 Auto Layout 子节点间距
    if (marginLeft > 0) pseudoStyle.marginLeft = Math.round(marginLeft);
    if (marginRight > 0) pseudoStyle.marginRight = Math.round(marginRight);

    if (color) {
      var rgba = cssColorToRgba(color);
      if (rgba) pseudoStyle.color = rgba;
    }

    if (globalFont) {
      var fw = parseFloat(ps.fontWeight) || 400;
      var ff = ps.fontFamily ? _resolveFontFamilyFromStack(ps.fontFamily) : '';
      if (ff && ff !== globalFont.fontFamily) pseudoStyle.fontFamily = ff;
      if (fw !== globalFont.fontWeight) pseudoStyle.fontWeight = fw;
    }

    var _pseudoReturnNode = {
      type: 'text',
      name: pseudo === '::before' ? 'pseudo-before' : 'pseudo-after',
      content: text,
      style: pseudoStyle,
    };
    return _pseudoReturnNode;
  } catch (e) {
    console.warn('[pseudo] catch error', { pseudo, tag: el && el.tagName, error: String(e), stack: e && e.stack });
    return null;
  }
}

/**
 * 处理"图形型"伪元素（content 为空但有 border/background 可见样式，如 Tabs 分割线）。
 * 伪元素通常是 position:absolute，位置基于宿主元素矩形 + top/right/bottom/left 偏移估算。
 * @param {Element} el 宿主元素
 * @param {string} pseudo '::before' 或 '::after'
 * @param {CSSStyleDeclaration} ps getComputedStyle(el, pseudo) 的结果（已由调用方计算好）
 * @param {object} geo getGeoviewScaleAndOrigin 返回值
 * @param {object} parentRect 父节点设计稿矩形 {left,top,width,height}
 * @param {object} elRect 宿主元素设计稿矩形 {left,top,width,height}
 * @returns {object|null}
 */
function getPseudoShapeNode(el, pseudo, ps, geo, parentRect, elRect) {
  try {
    // display:none 或 visibility:hidden 或 opacity:0 → 不可见，跳过（如 checkbox 勾选动画层）
    if (ps.display === 'none' || ps.visibility === 'hidden') return null;
    if (parseFloat(ps.opacity) === 0) return null;
    // transform: scale(0) → 视觉上缩成不可见，跳过
    // 典型场景：weui-switch:checked::before 在选中态通过 scale(0) 隐藏白色内层
    if (ps.transform && ps.transform !== 'none') {
      var _scaleZeroMatch = ps.transform.match(/matrix\(([^)]+)\)/);
      if (_scaleZeroMatch) {
        var _szParts = _scaleZeroMatch[1].split(',').map(function(s) { return parseFloat(s.trim()); });
        if (_szParts.length >= 4 && Math.abs(_szParts[0]) < 0.01 && Math.abs(_szParts[3]) < 0.01) {
          return null;
        }
      }
    }

    var bBottom = parseFloat(ps.borderBottomWidth) || 0;
    var bTop    = parseFloat(ps.borderTopWidth)    || 0;
    var bLeft   = parseFloat(ps.borderLeftWidth)   || 0;
    var bRight  = parseFloat(ps.borderRightWidth)  || 0;
    var hasBorder = bBottom > 0 || bTop > 0 || bLeft > 0 || bRight > 0;

    // 读取 background-color（getComputedStyle 已解析 CSS 变量为真实 RGB 值）
    var bgColor = ps.backgroundColor;
    var bgNotEmpty = bgColor && bgColor !== 'transparent' && bgColor !== 'rgba(0, 0, 0, 0)';

    // 读取 background-image（URL 或渐变，如 ant-steps 连接线用 url() 绘制）
    var bgImage = ps.backgroundImage;
    var hasBgImage = bgImage && bgImage !== 'none' && bgImage !== '';

    // 既无 border 也无背景色也无背景图 → 不可见，跳过
    if (!hasBorder && !bgNotEmpty && !hasBgImage) return null;

    // --- 坐标估算 ---
    // 伪元素是 position:absolute，解析 top/right/bottom/left 值（px 值才可用，auto 则忽略）
    var psTop    = ps.top    !== 'auto' ? parseFloat(ps.top)    : null;
    var psBottom = ps.bottom !== 'auto' ? parseFloat(ps.bottom) : null;
    var psLeft   = ps.left   !== 'auto' ? parseFloat(ps.left)   : null;
    var psRight  = ps.right  !== 'auto' ? parseFloat(ps.right)  : null;

    // 直接读取 getComputedStyle 计算后的 width/height（已将 100%/auto 转为实际像素值）
    var psWidth  = parseFloat(ps.width);
    var psHeight = parseFloat(ps.height);
    var hasPsWidth  = psWidth  > 0 && isFinite(psWidth);
    var hasPsHeight = psHeight > 0 && isFinite(psHeight);

    // 伪元素的 padding（content-box 下 getComputedStyle.height/width 只含内容，需补上 padding）
    var psPaddingTop    = parseFloat(ps.paddingTop)    || 0;
    var psPaddingBottom = parseFloat(ps.paddingBottom) || 0;
    var psPaddingLeft   = parseFloat(ps.paddingLeft)   || 0;
    var psPaddingRight  = parseFloat(ps.paddingRight)  || 0;

    // 宿主元素的 border（CSS absolute 的 top/left 是相对宿主的 padding-edge，
    // Figma 子节点 y/x 是相对宿主 frame 的外边缘，两者差 borderTopWidth / borderLeftWidth）
    var _hostCs = window.getComputedStyle(el);
    var hostBorderTop    = parseFloat(_hostCs.borderTopWidth)    || 0;
    var hostBorderBottom = parseFloat(_hostCs.borderBottomWidth) || 0;
    var hostBorderLeft   = parseFloat(_hostCs.borderLeftWidth)   || 0;
    var hostBorderRight  = parseFloat(_hostCs.borderRightWidth)  || 0;

    // 伪元素坐标是 position:absolute 相对宿主元素（el）的，直接使用 psLeft/psTop，不需要父容器偏移
    // （elRelX/elRelY 仅作调试备用，勿在坐标计算中使用）
    var elRelX = elRect.left - (parentRect && typeof parentRect.left === 'number' && !isNaN(parentRect.left) ? parentRect.left : 0);
    var elRelY = elRect.top  - (parentRect && typeof parentRect.top  === 'number' && !isNaN(parentRect.top)  ? parentRect.top  : 0);
    void elRelX; void elRelY;

    // 宽度：优先直接读取计算宽度（如 width:1px / width:100%），left/right 反推降级为 fallback
    // content-box 下 width 不含 padding，需加上左右 padding
    var w;
    if (hasPsWidth) {
      w = psWidth + (ps.boxSizing !== 'border-box' ? psPaddingLeft + psPaddingRight : 0);
    } else if (psLeft !== null && psRight !== null) {
      w = elRect.width - hostBorderLeft - hostBorderRight - psLeft - psRight;
    } else if (psLeft !== null) {
      w = elRect.width - hostBorderLeft - psLeft;
    } else if (psRight !== null) {
      w = elRect.width - hostBorderRight - psRight;
    } else {
      w = elRect.width;
    }
    // 高度：优先直接读取计算高度（如 height:100%），top/bottom 反推和 border/bg 推算降级为 fallback
    // content-box 下 height 不含 padding，需加上上下 padding
    var h;
    if (hasPsHeight) {
      h = psHeight + (ps.boxSizing !== 'border-box' ? psPaddingTop + psPaddingBottom : 0);
    } else if (psTop !== null && psBottom !== null) {
      h = elRect.height - hostBorderTop - hostBorderBottom - psTop - psBottom;
    } else if (hasBorder) {
      h = Math.max(bTop, bBottom, bLeft, bRight);
      if (h < 1) h = 1;
    } else {
      // 纯背景色伪元素：无法反推高度，兜底为 2px
      h = 2;
    }

    // x 坐标：CSS absolute 的 left 是相对宿主 padding-edge，Figma 坐标相对宿主 border 外边缘
    // 需加上 hostBorderLeft 来对齐
    var x;
    if (psLeft !== null) {
      x = psLeft + hostBorderLeft;
    } else if (psRight !== null) {
      x = elRect.width - hostBorderRight - psRight - w;
    } else {
      x = 0;
    }

    // y 坐标：同理，加上 hostBorderTop
    var y;
    if (psTop !== null) {
      y = psTop + hostBorderTop;
    } else if (psBottom !== null) {
      y = elRect.height - hostBorderBottom - psBottom - h;
    } else {
      y = 0;
    }

    // 确保数值有效
    var safeX = isFinite(x) ? Math.round(x) : 0;
    var safeY = isFinite(y) ? Math.round(y) : 0;
    var safeW = isFinite(w) && w > 0 ? Math.round(w) : 1;
    var safeH = isFinite(h) && h > 0 ? Math.round(h) : 1;

    var shapeStyle = {
      x: safeX,
      y: safeY,
      width: safeW,
      height: safeH,
      positionType: 'absolute',
    };

    // transform: rotate() / translateX() / translateY() → rotation + 位置修正
    // CSS transform 矩阵 matrix(a,b,c,d,tx,ty) 综合了 transform-origin 平移、rotate 及 translate
    // 直接用矩阵将「元素中心」变换到视觉中心，反推 Figma 的 x/y，使 Figma 按中心旋转时与 CSS 匹配
    if (ps.transform && ps.transform !== 'none') {
      var psRotation = parseTransformRotation(ps.transform);
      var _matMatch = ps.transform.match(/matrix\(([^)]+)\)/);
      // 纯平移（如 left:50%; transform:translateX(-50%) 水平居中）同样需要修正坐标，
      // 不能只判断 rotation !== 0，还需检测矩阵中 tx/ty 是否非零
      var _hasMeaningfulTranslate = false;
      if (_matMatch) {
        var _txCheckParts = _matMatch[1].split(',').map(function(s) { return parseFloat(s.trim()); });
        if (_txCheckParts.length >= 6) {
          _hasMeaningfulTranslate = Math.abs(_txCheckParts[4]) > 0.5 || Math.abs(_txCheckParts[5]) > 0.5;
        }
      }
      if ((psRotation != null && psRotation !== 0) || _hasMeaningfulTranslate) {
        // CSS rotation 顺时针为正，Figma rotation 逆时针为正，需取反
        if (psRotation != null && psRotation !== 0) shapeStyle.rotation = -psRotation;

        // checkbox-inner / radio-inner 的选中标记（::after）：
        // CSS 通过 top:50%; left:~22%; transform:rotate(45deg) translate(-50%,-50%) 实现视觉居中。
        // 直接用父容器尺寸居中，比反推矩阵更简洁准确。
        var _elClassForCenter = String((el && el.className) || '');
        if (/checkbox-inner|radio-inner/i.test(_elClassForCenter)) {
          // 由父容器 walk 层用 Auto Layout 居中，不在这里设绝对定位坐标
          delete shapeStyle.x;
          delete shapeStyle.y;
          delete shapeStyle.positionType;
        } else if (_matMatch) {
          var _mParts = _matMatch[1].split(',').map(function(s) { return parseFloat(s.trim()); });
          if (_mParts.length >= 6) {
            var _ma = _mParts[0], _mb = _mParts[1], _mc = _mParts[2], _md = _mParts[3];
            var _mtx = _mParts[4], _mty = _mParts[5];

            // Chrome getComputedStyle 返回的是不含 transform-origin 的纯变换矩阵。
            // 需手动将 transform-origin (ox, oy) 折叠进矩阵：
            //   tx_full = tx + ox*(1-a) - c*oy
            //   ty_full = ty + oy*(1-d) - b*ox
            var _toStr = (ps.transformOrigin || '').trim();
            var _toParts = _toStr.split(/\s+/);
            var _ox = parseFloat(_toParts[0]) || 0;
            var _oy = parseFloat(_toParts[1]) || 0;
            if (_ox !== 0 || _oy !== 0) {
              _mtx = _mtx + _ox * (1 - _ma) - _mc * _oy;
              _mty = _mty + _oy * (1 - _md) - _mb * _ox;
            }

            // M_full（含 origin 修正）将元素局部坐标（相对自身 border-box 左上角）映射为位移量。
            // 视觉中心 = 元素 Figma 位置(safeX, safeY) + M_full × 局部中心(w/2, h/2)
            // 注意：不能将父坐标系的中心传入矩阵，CSS transform 只作用于局部坐标。
            var _localCx = w / 2;
            var _localCy = h / 2;
            var _visualCx = safeX + (_ma * _localCx + _mc * _localCy + _mtx);
            var _visualCy = safeY + (_mb * _localCx + _md * _localCy + _mty);
            // 令 Figma 矩形中心 = CSS 视觉中心，推算 x/y（Figma rotation 绕矩形中心旋转）
            // 必须用 shapeStyle.width/height（即 Figma 实际尺寸，已 Math.round）做中心计算，
            // 否则 h=1.5 → safeH=2 导致 Figma 中心比预期偏 0.25px
            shapeStyle.x = _visualCx - shapeStyle.width / 2;
            shapeStyle.y = _visualCy - shapeStyle.height / 2;
          }
        }
      }
    }

    // radio-inner / checkbox-inner::after：不论 transform 类型（scale / rotate / none），
    // 均由 index.js walk 层设置的 Auto Layout（primaryAxisAlignItems/counterAxisAlignItems: CENTER）居中。
    // 此处无条件删除绝对定位坐标，并将纯 scale 变换应用到尺寸（如 scale(0.375) 使 16px → 6px 小圆点）。
    var _elClsAutoCenter = String((el && el.className) || '');
    if (/checkbox-inner|radio-inner/i.test(_elClsAutoCenter) && pseudo === '::after') {
      delete shapeStyle.x;
      delete shapeStyle.y;
      delete shapeStyle.positionType;
      if (ps.transform && ps.transform !== 'none') {
        var _acMatM = ps.transform.match(/matrix\(([^)]+)\)/);
        if (_acMatM) {
          var _acParts = _acMatM[1].split(',').map(function(s) { return parseFloat(s.trim()); });
          // 均匀纯 scale：b≈0, c≈0, a≈d, 0 < a < 0.99
          if (_acParts.length >= 4 &&
              Math.abs(_acParts[1]) < 0.01 && Math.abs(_acParts[2]) < 0.01 &&
              Math.abs(_acParts[0] - _acParts[3]) < 0.01 &&
              _acParts[0] > 0 && _acParts[0] < 0.99) {
            var _scaleFactor = _acParts[0];
            shapeStyle.width = Math.max(1, Math.round(safeW * _scaleFactor));
            shapeStyle.height = Math.max(1, Math.round(safeH * _scaleFactor));
          }
        }
      }
    }

    // background-color / background-image → fills
    if (bgNotEmpty) {
      var bgRgba = cssColorToRgba(bgColor);
      if (bgRgba) shapeStyle.fills = [bgRgba];
      else shapeStyle.fills = [];
    } else if (hasBgImage) {
      // background-image（URL 或渐变）：渐变走解析路径；URL 走 IMAGE fill，与普通元素一致，
      // 供 inlineImageFillsInTree 自动 fetch 并转为 base64。
      var _parsedGrad = null;
      try {
        if (bgImage.indexOf('linear-gradient') !== -1) {
          _parsedGrad = parseLinearGradientFromBgImage && parseLinearGradientFromBgImage(bgImage, shapeStyle.width, shapeStyle.height);
        } else if (bgImage.indexOf('radial-gradient') !== -1) {
          _parsedGrad = parseRadialGradientFromBgImage && parseRadialGradientFromBgImage(bgImage);
        }
      } catch (_ge) {}
      if (_parsedGrad) {
        shapeStyle.fills = [_parsedGrad];
      } else {
        var _bgUrl = parseUrlFromBgImage ? parseUrlFromBgImage(bgImage) : null;
        if (_bgUrl) {
          var _bgRepeat = (ps.backgroundRepeat || '').toLowerCase();
          var _isTile = _bgRepeat && _bgRepeat !== 'no-repeat';
          var _imgFill = { type: 'IMAGE', url: _bgUrl };
          if (_isTile) _imgFill.scaleMode = 'TILE';
          shapeStyle.fills = [_imgFill];
        } else {
          shapeStyle.fills = [];
        }
      }
    } else {
      shapeStyle.fills = [];
    }

    // border-radius（getComputedStyle 已解析 var() 为 px 值）
    var brtl = parseFloat(ps.borderTopLeftRadius) || 0;
    var brtr = parseFloat(ps.borderTopRightRadius) || 0;
    var brbr = parseFloat(ps.borderBottomRightRadius) || 0;
    var brbl = parseFloat(ps.borderBottomLeftRadius) || 0;
    if (brtl > 0 || brtr > 0 || brbr > 0 || brbl > 0) {
      if (brtl === brtr && brtr === brbr && brbr === brbl) {
        shapeStyle.borderRadius = Math.round(brtl);
      } else {
        shapeStyle.borderRadius = [Math.round(brtl), Math.round(brtr), Math.round(brbr), Math.round(brbl)];
      }
    }

    // border → strokeColor + 四边独立描边
    if (hasBorder) {
      // 取各边颜色（通常相同，取第一个非透明边的颜色）
      var borderColor = ps.borderBottomColor || ps.borderTopColor || ps.borderLeftColor || ps.borderRightColor;
      if (!borderColor || borderColor === 'transparent' || borderColor === 'rgba(0, 0, 0, 0)') {
        // 尝试 border shorthand
        var borderShort = ps.border || ps.borderBottom || ps.borderTop;
        var parsed = parseBorderShorthand(borderShort);
        if (parsed) borderColor = parsed.color;
      }
      var borderRgba = borderColor ? cssColorToRgba(borderColor) : null;
      if (borderRgba && borderRgba !== 'rgba(0, 0, 0, 0)') {
        shapeStyle.strokeColor = borderRgba;
        shapeStyle.strokeAlign = 'INSIDE';
        if (bTop    > 0) shapeStyle.strokeTopWeight    = bTop;
        if (bRight  > 0) shapeStyle.strokeRightWeight  = bRight;
        if (bBottom > 0) shapeStyle.strokeBottomWeight = bBottom;
        if (bLeft   > 0) shapeStyle.strokeLeftWeight   = bLeft;
      }
    }

    return {
      type: 'rectangle',
      name: pseudo === '::before' ? 'pseudo-before' : 'pseudo-after',
      style: shapeStyle,
    };
  } catch (e) {
    console.warn('[pseudo-shape] catch error', { pseudo, tag: el && el.tagName, error: String(e) });
    return null;
  }
}

/** 分页等 UI 省略占位：•（U+2022）、·（U+00B7）、. … …（U+2026）、⋯（U+22EF） */
function _isLikelyEllipsisGlyphText(s) {
  if (!s || typeof s !== 'string') return false;
  var n = s.length;
  if (n < 1 || n > 8) return false;
  for (var i = 0; i < n; i++) {
    var c = s.charCodeAt(i);
    if (c !== 0x2022 && c !== 0xb7 && c !== 0x2e && c !== 0x2026 && c !== 0x22ef) return false;
  }
  return true;
}

/**
 * 「图标 + 省略占位」结构：元素被合并为单 text 时，省略 span 的 computed color
 * 往往源自同容器内 SVG 图标的 currentColor 上下文，而非设计意图。
 *
 * 判定条件（全部满足才丢弃）：
 *   1. 唯一 colorRun 覆盖全文
 *   2. 全文仅由省略号类字符（•··...）组成
 *   3. 当前元素（或其任意后代）含有 SVG（即 icon 与省略号同根）
 *
 * 不做颜色字符串比较，避免 "rgb()" vs "rgba()" 格式不一致导致的漏判。
 * 不限制层级深度，覆盖 anticon → container → link 等各层作为 el 的情形。
 */
function _shouldDropSvgSiblingBleedColorRun(container, parentColorStr, finalContent, run) {
  if (!container || !run || !finalContent) return false;
  if (run.start !== 0 || run.end !== finalContent.length) return false;
  if (!run.color || run.color === 'rgba(0, 0, 0, 0)') return false;
  if (parentColorStr && run.color === parentColorStr) return false;
  var _fcFlat = finalContent.replace(/\n/g, '');
  if (!_isLikelyEllipsisGlyphText(_fcFlat)) return false;
  try {
    if (container.querySelector && container.querySelector('svg')) return true;
  } catch (e) {}
  return false;
}

/**
 * 对含 inline span 子节点的文本元素，提取各 span 的样式范围，用于 Figma 富文本 characterStyleIDs。
 * 返回颜色或渐变与父元素不同的 span 对应的范围，格式为：
 * [{ start, end, color? , gradientFill? }]（索引基于 finalContent）。
 *
 * 原理：
 *   1. 遍历 el.childNodes，对文本节点按顺序推进搜索位置；对 span 元素在 finalContent（含视觉 \n）
 *      中搜索其文本，记录 [start, end) 索引与颜色。
 *   2. 用 mapRawIdx() 将「忽略 \n 的裸字符索引」转换为 finalContent 的实际字符索引。
 *   3. 若声明层/样式表不可用，对「仅省略号类字符 + 与无文本 SVG 兄弟同色」的唯一全长 run 做兜底剔除（见 _shouldDropSvgSiblingBleedColorRun）。
 *
 * @param {Element} el - 父文本元素（inferNodeType 返回 'text' 且有 children 时使用）
 * @param {string}  finalContent - 已处理的最终文本（含视觉 \n，由 getTextContent/getTextWithActualLineBreaks 产出）
 * @param {string|null} parentColorStr - 父元素计算颜色字符串，用于过滤相同颜色的 span（不需要记录）
 * @param {Record<string,string>|null} [cssRuleMap] - 与 buildInlineTextStyle 一致：优先用声明层 color，避免仅 computed 误判（如分页省略号与主色图标同容器）
 * @returns {Array<{start:number, end:number, color?:string, gradientFill?:object}>|null}
 */
function getColorRunsFromInlineElement(el, finalContent, parentColorStr, cssRuleMap) {
  if (!el || !finalContent || !el.children || el.children.length === 0) return null;

  // 将「裸字符索引（忽略 \n）」映射到 finalContent 中的实际字符索引
  function mapRawIdx(rawIdx) {
    var count = 0;
    for (var ci = 0; ci < finalContent.length; ci++) {
      if (count === rawIdx) return ci;
      if (finalContent[ci] !== '\n') count++;
    }
    return finalContent.length;
  }

  var contentNoNl = finalContent.replace(/\n/g, '');
  var searchFrom = 0; // 在 contentNoNl 中从此位置开始搜索，保持与 DOM 顺序一致
  var runs = [];

  // 父元素的 textDecorationLine，用于判断子 span 是否有独立的装饰线覆写
  var _parentTdl = '';
  try { _parentTdl = (window.getComputedStyle(el).textDecorationLine || '').toLowerCase().trim(); } catch (_eTdl) {}

  // 父元素的 letter-spacing（px），用于判断子 span 是否覆写了字间距
  var _parentLsPx = 0;
  try {
    var _parentLsRaw = window.getComputedStyle(el).letterSpacing;
    if (_parentLsRaw && _parentLsRaw !== 'normal') _parentLsPx = parseFloat(_parentLsRaw) || 0;
  } catch (_eLsP) {}

  for (var i = 0; i < el.childNodes.length; i++) {
    var child = el.childNodes[i];
    if (child.nodeType === 3) {
      // 文本节点：在 contentNoNl 中找到对应位置后推进 searchFrom
      var tRaw = (child.textContent || '').replace(/\n/g, '');
      if (!tRaw) continue;
      var tIdx = contentNoNl.indexOf(tRaw, searchFrom);
      if (tIdx !== -1) searchFrom = tIdx + tRaw.length;
      else searchFrom = Math.min(searchFrom + tRaw.length, contentNoNl.length);
    } else if (child.nodeType === 1) {
      var spanComp = window.getComputedStyle(child);

      // 读取 span 的 textDecorationLine，与父元素对比，判断是否有装饰线覆写
      var _spanTdlRaw = '';
      try { _spanTdlRaw = (spanComp.textDecorationLine || spanComp.getPropertyValue('text-decoration-line') || '').toLowerCase().trim(); } catch (_eStdl) {}
      var _spanTextDecoration = null;
      if (_spanTdlRaw && _spanTdlRaw !== 'none' && _spanTdlRaw !== _parentTdl) {
        if (_spanTdlRaw.indexOf('line-through') >= 0) _spanTextDecoration = 'STRIKETHROUGH';
        else if (_spanTdlRaw.indexOf('underline') >= 0) _spanTextDecoration = 'UNDERLINE';
      }
      var declMap = (cssRuleMap && Object.keys(cssRuleMap).length > 0) ? getDeclaredStyleForElement(child, cssRuleMap) : {};
      var dColor = declMap.color || declMap['color'];
      var spanColor = dColor;
      if (spanColor && String(spanColor).indexOf('var(') >= 0) {
        spanColor = spanComp.color;
      }
      if (!spanColor) spanColor = spanComp.color;
      var spanRaw = (child.textContent || '').replace(/\n/g, '');
      if (!spanRaw) continue;

      var spanIdx = contentNoNl.indexOf(spanRaw, searchFrom);
      if (spanIdx === -1) {
        searchFrom = Math.min(searchFrom + spanRaw.length, contentNoNl.length);
        continue;
      }
      var spanRawStart = spanIdx;
      var spanRawEnd = spanIdx + spanRaw.length;
      searchFrom = spanRawEnd;

      // span 局部渐变文字：background-clip:text + 透明文字
      var spanBgClip = '';
      try {
        spanBgClip = (spanComp.getPropertyValue && (spanComp.getPropertyValue('background-clip') || spanComp.getPropertyValue('-webkit-background-clip'))) || '';
      } catch (_eBgClip) {}
      if (!spanBgClip) spanBgClip = String((spanComp.backgroundClip || spanComp.webkitBackgroundClip || '')).trim();
      var spanTextFill = '';
      try {
        spanTextFill = (spanComp.getPropertyValue && spanComp.getPropertyValue('-webkit-text-fill-color')) || '';
      } catch (_eTextFill) {}
      if (!spanTextFill) spanTextFill = String(spanComp.webkitTextFillColor || '');
      var spanBgImg = String(spanComp.backgroundImage || '');
      var spanGradientFill = null;
      var _isTransparentLike = function (v) {
        if (!v) return true;
        var s = String(v).trim();
        if (s === 'transparent') return true;
        var m = s.match(/^rgba?\(\s*\d+\s*,\s*\d+\s*,\s*\d+\s*,\s*([\d.]+)\s*\)$/);
        return !!(m && parseFloat(m[1]) === 0);
      };
      if (spanBgClip && spanBgClip.indexOf('text') >= 0 && (_isTransparentLike(spanColor) || _isTransparentLike(spanTextFill))) {
        spanGradientFill = parseLinearGradientFromBgImage(spanBgImg) || parseRadialGradientFromBgImage(spanBgImg);
      }

      // 读取 span 的 letter-spacing（px），与父元素对比，判断是否有字间距覆写
      var _spanLsPx = _parentLsPx;
      try {
        var _spanLsRaw = spanComp.letterSpacing;
        if (_spanLsRaw && _spanLsRaw !== 'normal') _spanLsPx = parseFloat(_spanLsRaw) || _parentLsPx;
      } catch (_eSpanLs) {}
      var _hasLsOverride = Math.abs(_spanLsPx - _parentLsPx) > 0.1;

      // 记录与父元素不同的样式 run：优先渐变，其次纯色，最后仅装饰线/字间距
      if (spanGradientFill) {
        var _gRun = { start: mapRawIdx(spanRawStart), end: mapRawIdx(spanRawEnd), gradientFill: spanGradientFill };
        if (_spanTextDecoration) _gRun.textDecoration = _spanTextDecoration;
        if (_hasLsOverride) _gRun.letterSpacing = _spanLsPx;
        runs.push(_gRun);
      } else if (spanColor && spanColor !== parentColorStr && spanColor !== 'rgba(0, 0, 0, 0)') {
        var _cRun = { start: mapRawIdx(spanRawStart), end: mapRawIdx(spanRawEnd), color: spanColor };
        if (_spanTextDecoration) _cRun.textDecoration = _spanTextDecoration;
        if (_hasLsOverride) _cRun.letterSpacing = _spanLsPx;
        runs.push(_cRun);
      } else if (_spanTextDecoration || _hasLsOverride) {
        // 颜色与父相同，但有装饰线或字间距覆写
        var _dtRun = { start: mapRawIdx(spanRawStart), end: mapRawIdx(spanRawEnd) };
        if (_spanTextDecoration) _dtRun.textDecoration = _spanTextDecoration;
        if (_hasLsOverride) _dtRun.letterSpacing = _spanLsPx;
        runs.push(_dtRun);
      }
    }
  }

  if (runs.length === 1 && _shouldDropSvgSiblingBleedColorRun(el, parentColorStr, finalContent, runs[0])) {
    return null;
  }

  return runs.length > 0 ? runs : null;
}

if (typeof module !== 'undefined') {
  module.exports = {
    shouldSetTextAlignVerticalCenterForAbsoluteTextLeaf: shouldSetTextAlignVerticalCenterForAbsoluteTextLeaf,
    shouldSetTextAlignVerticalCenterForFlexParentAlignItemsCenter: shouldSetTextAlignVerticalCenterForFlexParentAlignItemsCenter,
    shouldSetTextAlignVerticalCenterForSelectPlaceholder: shouldSetTextAlignVerticalCenterForSelectPlaceholder,
    applyAntSelectSelectionPlaceholderTextAlign: applyAntSelectSelectionPlaceholderTextAlign,
    inferNodeType: inferNodeType,
    shouldMergeTextAndBrChildren: shouldMergeTextAndBrChildren,
    mergeTextAndBrChildNodesContent: mergeTextAndBrChildNodesContent,
    getElementContentsTextBlockRect: getElementContentsTextBlockRect,
    getTextNodeRect: getTextNodeRect,
    shouldMarkWidthConstrainedForEdgeWhitespace: shouldMarkWidthConstrainedForEdgeWhitespace,
    applyWidthConstrainedForFigmaEdgeWhitespace: applyWidthConstrainedForFigmaEdgeWhitespace,
    applyTextOverflowEllipsisExport: applyTextOverflowEllipsisExport,
    normalizeTextExportPreserveTrailing: normalizeTextExportPreserveTrailing,
    getTextContent: getTextContent,
    getTextWithActualLineBreaksForElement: getTextWithActualLineBreaksForElement,
    isShowingPlaceholder: isShowingPlaceholder,
    getPseudoTextNode: getPseudoTextNode,
    getPseudoShapeNode: getPseudoShapeNode,
    getColorRunsFromInlineElement: getColorRunsFromInlineElement,
  };
}
