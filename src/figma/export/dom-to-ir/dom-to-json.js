/**
 * ============================================================
 * index.js  —  公共 API 入口层
 * ============================================================
 * 职责：
 *   - 引入所有子模块，将函数注入全局作用域（浏览器注入模式）
 *   - domToMybricksJson：主流程入口，内含 walk 遍历函数
 *   - elementToMybricksJson / comToMybricksJson：薄包装入口
 *   - window.* / module.exports 对外注册
 * 注意：walk 作为 domToMybricksJson 的内部闭包保留，因其依赖外层的
 *   geo / cssRuleMap / globalFont 等变量，提取为独立函数收益有限。
 * ============================================================
 */

/* ── 加载子模块（Node.js / webpack 环境）──────────────────── */
(function () {
  if (typeof module === 'undefined') return; // 浏览器注入时各子模块已内联，无需 require
  var _dh  = require('./dom-helpers');
  var _cp  = require('./css-parsers');
  var _sb  = require('./style-builder');
  var _lu  = require('./layout-utils');
  var _nb  = require('./node-builder');
  var _ii  = require('./image-inline');

  // dom-helpers
  SHADOW_HOST_ID = _dh.SHADOW_HOST_ID;
  GEOVIEW_WRAPPER_ID = _dh.GEOVIEW_WRAPPER_ID;
  getShadowHost = _dh.getShadowHost;
  resolveFrameRoot = _dh.resolveFrameRoot;
  getCssRulesBySelector = _dh.getCssRulesBySelector;
  getMergedCssRulesFromStyleElements = _dh.getMergedCssRulesFromStyleElements;
  getGeoviewScaleAndOrigin = _dh.getGeoviewScaleAndOrigin;
  getDesignRect = _dh.getDesignRect;
  hasClassPrefix = _dh.hasClassPrefix;
  simpleSelectorMatches = _dh.simpleSelectorMatches;
  getMatchedSelectorsForElement = _dh.getMatchedSelectorsForElement;
  getNearestEncodedLessFilePrefixFromAncestors = _dh.getNearestEncodedLessFilePrefixFromAncestors;
  elementHasEncodedLessFileClass = _dh.elementHasEncodedLessFileClass;
  getDeclaredStyleForElement = _dh.getDeclaredStyleForElement;
  getFrameTitleFromElement = _dh.getFrameTitleFromElement;
  findArtboardIdFromElement = _dh.findArtboardIdFromElement;
  emptyRoot = _dh.emptyRoot;
  // css-parsers
  normalizeSvgPathForFigma = _cp.normalizeSvgPathForFigma;
  parseUrlFromBgImage = _cp.parseUrlFromBgImage;
  parseLinearGradientFromBgImage = _cp.parseLinearGradientFromBgImage;
  parseRadialGradientFromBgImage = _cp.parseRadialGradientFromBgImage;
  parseBoxShadow = _cp.parseBoxShadow;
  parseBorderShorthand = _cp.parseBorderShorthand;
  parseGridTemplateColumnsCount = _cp.parseGridTemplateColumnsCount;
  serializeSvgElement = _cp.serializeSvgElement;
  parseTransformRotation = _cp.parseTransformRotation;
  cssColorToHex = _cp.cssColorToHex;
  cssColorToRgba = _cp.cssColorToRgba;
  // style-builder
  parseFontFamilyStack = _sb.parseFontFamilyStack;
  resolveFontFamilyFromStack = _sb.resolveFontFamilyFromStack;
  getGlobalFont = _sb.getGlobalFont;
  buildInlineTextStyle = _sb.buildInlineTextStyle;
  buildStyleJSON = _sb.buildStyleJSON;
  // layout-utils
  getM = _lu.getM;
  pruneChildMarginsAfterGapMerge = _lu.pruneChildMarginsAfterGapMerge;
  anyChildHasMargin = _lu.anyChildHasMargin;
  childrenHaveUniformMargin = _lu.childrenHaveUniformMargin;
  applyUniformMarginAsGap = _lu.applyUniformMarginAsGap;
  ensureItemSpacingFromPositions = _lu.ensureItemSpacingFromPositions;
  wrapHorizontalFlowChildrenVerticalMarginAsPadding = _lu.wrapHorizontalFlowChildrenVerticalMarginAsPadding;
  // node-builder
  shouldSetTextAlignVerticalCenterForAbsoluteTextLeaf = _nb.shouldSetTextAlignVerticalCenterForAbsoluteTextLeaf;
  shouldSetTextAlignVerticalCenterForFlexParentAlignItemsCenter = _nb.shouldSetTextAlignVerticalCenterForFlexParentAlignItemsCenter;
  applyAntSelectSelectionPlaceholderTextAlign = _nb.applyAntSelectSelectionPlaceholderTextAlign;
  inferNodeType = _nb.inferNodeType;
  shouldMergeTextAndBrChildren = _nb.shouldMergeTextAndBrChildren;
  mergeTextAndBrChildNodesContent = _nb.mergeTextAndBrChildNodesContent;
  getElementContentsTextBlockRect = _nb.getElementContentsTextBlockRect;
  getTextNodeRect = _nb.getTextNodeRect;
  shouldMarkWidthConstrainedForEdgeWhitespace = _nb.shouldMarkWidthConstrainedForEdgeWhitespace;
  applyWidthConstrainedForFigmaEdgeWhitespace = _nb.applyWidthConstrainedForFigmaEdgeWhitespace;
  applyTextOverflowEllipsisExport = _nb.applyTextOverflowEllipsisExport;
  normalizeTextExportPreserveTrailing = _nb.normalizeTextExportPreserveTrailing;
  getTextContent = _nb.getTextContent;
  getTextWithActualLineBreaksForElement = _nb.getTextWithActualLineBreaksForElement;
  isShowingPlaceholder = _nb.isShowingPlaceholder;
  getPseudoTextNode = _nb.getPseudoTextNode;
  getPseudoShapeNode = _nb.getPseudoShapeNode;
  getColorRunsFromInlineElement = _nb.getColorRunsFromInlineElement;
  // image-inline
  fetchImageAsBase64DataUrl = _ii.fetchImageAsBase64DataUrl;
  inlineImageFillsInTree = _ii.inlineImageFillsInTree;
})();

/* ── Stub declarations for Node/webpack module resolution */
var SHADOW_HOST_ID, GEOVIEW_WRAPPER_ID, getShadowHost, resolveFrameRoot, getCssRulesBySelector, getMergedCssRulesFromStyleElements, getGeoviewScaleAndOrigin, getDesignRect, hasClassPrefix, simpleSelectorMatches, getMatchedSelectorsForElement, getNearestEncodedLessFilePrefixFromAncestors, elementHasEncodedLessFileClass, getDeclaredStyleForElement, getFrameTitleFromElement, findArtboardIdFromElement, emptyRoot, normalizeSvgPathForFigma, parseUrlFromBgImage, parseLinearGradientFromBgImage, parseRadialGradientFromBgImage, parseBoxShadow, parseBorderShorthand, parseGridTemplateColumnsCount, serializeSvgElement, parseTransformRotation, cssColorToHex, cssColorToRgba, parseFontFamilyStack, resolveFontFamilyFromStack, getGlobalFont, buildInlineTextStyle, buildStyleJSON, getM, pruneChildMarginsAfterGapMerge, anyChildHasMargin, childrenHaveUniformMargin, applyUniformMarginAsGap, ensureItemSpacingFromPositions, wrapHorizontalFlowChildrenVerticalMarginAsPadding, shouldSetTextAlignVerticalCenterForAbsoluteTextLeaf, shouldSetTextAlignVerticalCenterForFlexParentAlignItemsCenter, applyAntSelectSelectionPlaceholderTextAlign, inferNodeType, shouldMergeTextAndBrChildren, mergeTextAndBrChildNodesContent, getElementContentsTextBlockRect, getTextNodeRect, shouldMarkWidthConstrainedForEdgeWhitespace, applyWidthConstrainedForFigmaEdgeWhitespace, applyTextOverflowEllipsisExport, normalizeTextExportPreserveTrailing, getTextContent, getTextWithActualLineBreaksForElement, isShowingPlaceholder, getPseudoTextNode, getPseudoShapeNode, getColorRunsFromInlineElement, fetchImageAsBase64DataUrl, inlineImageFillsInTree;

/**
 * ★ Figma 组件库映射开关
 *
 * 设为 true 时：walk 遇到带 data-library-source 属性的第三方 UI 组件（antd/m-ui 等），
 * 会输出 type:'component-library' + rawClassName，并停止递归子节点，
 * 由 VibeUI 消费侧根据 rawClassName 查映射表替换为 Figma 规范组件实例。
 *
 * 设为 false（默认）时：保持原有行为，照常展开为 Frame/Text 节点树。
 */
var FIGMA_COMPONENT_LIBRARY_ENABLED = false;

/**
 * 从指定 DOM 元素直接导出，不需要通过 comId 查找 Shadow DOM。
 * 样式表通过 styleTagId（组件 ID）在 Shadow DOM 内查找 <style id="styleTagId">。
 * @param {Element} el - 要导出的 DOM 元素（如 focusArea.ele）
 * @param {string} [styleTagId] - 可选，<style> 的 id，用于获取组件样式表（通常为组件 id）
 * @returns {{ page: { name?: string, "component-def"?: any[], content: any[] } }}
 */
function elementToMybricksJson(el, styleTagId, options) {
  if (!el) return emptyRoot();
  return domToMybricksJson(null, styleTagId, el, options);
}

/**
 * 按组件 id 导出：从 #comId 向上找到 class 以 "artboard-" 开头的祖先，取其 id 作为 frameId，再调用 domToMybricksJson。
 * @param {string} comId - 组件根元素 id，同时作为 styleTagId 传入 domToMybricksJson
 * @returns {{ page: { name?: string, "component-def"?: any[], content: any[] } }}
 */
function comToMybricksJson(comId, options) {
  var host = getShadowHost();
  if (!host || !host.shadowRoot) {
    return emptyRoot();
  }
  var shadowRoot = host.shadowRoot;
  var comEl = shadowRoot.querySelector('#' + CSS.escape(comId));
  if (!comEl) {
    return emptyRoot();
  }
  var frameId = findArtboardIdFromElement(comEl);
  if (!frameId) {
    return emptyRoot();
  }

  return domToMybricksJson(frameId, comId, null, options);
}

/** 同上，但会请求 background-image url() 并内联为 base64，供导出到 Figma 时带背景图。返回 Promise。 */
function comToMybricksJsonWithInlineImages(comId, options) {
  var host = getShadowHost();
  if (!host || !host.shadowRoot) return Promise.resolve(emptyRoot());
  var shadowRoot = host.shadowRoot;
  var comEl = shadowRoot.querySelector('#' + CSS.escape(comId));
  if (!comEl) return Promise.resolve(emptyRoot());
  var frameId = findArtboardIdFromElement(comEl);
  if (!frameId) return Promise.resolve(emptyRoot());
  return domToMybricksJsonWithInlineImages(frameId, comId, options);
}

function domToMybricksJson(frameId, styleTagId, _rootElOverride, options) {
  const host = getShadowHost();
  const shadowRoot = host && host.shadowRoot ? host.shadowRoot : null;
  // 没有 shadowRoot 时：有 _rootElOverride 才能继续（elementToMybricksJson 场景），否则返回空
  if (!shadowRoot && !_rootElOverride) {
    return emptyRoot();
  }

  const root = _rootElOverride || resolveFrameRoot(frameId);
  if (!root) {
    return emptyRoot();
  }

  // 声明层样式：Antd 等常在 Shadow 内注入多段 <style>，仅 style#id 会漏规则，colorRuns / flex 读 decl 会偏。
  var _styleCollectRoot = shadowRoot;
  if (!_styleCollectRoot && _rootElOverride && _rootElOverride.getRootNode) {
    try {
      var _rnStyle = _rootElOverride.getRootNode();
      if (_rnStyle && _rnStyle.querySelectorAll) _styleCollectRoot = _rnStyle;
    } catch (_eRn) {}
  }
  if (!_styleCollectRoot && typeof document !== 'undefined') _styleCollectRoot = document;
  var cssRuleMap = _styleCollectRoot ? getMergedCssRulesFromStyleElements(_styleCollectRoot) : null;
  if (styleTagId) {
    var _cssFromId = getCssRulesBySelector(styleTagId, shadowRoot || document);
    if (_cssFromId && Object.keys(_cssFromId).length) {
      cssRuleMap = Object.assign({}, cssRuleMap || {}, _cssFromId);
    }
  }
  const dom = root;
  const COMPONENT_LIBRARY_ENABLED =
    options && typeof options.componentLibraryEnabled === 'boolean'
      ? options.componentLibraryEnabled
      : FIGMA_COMPONENT_LIBRARY_ENABLED;

  var geo = getGeoviewScaleAndOrigin(shadowRoot || document);

  // 全局字体：从画布根取，仅当节点与全局不同时才在 style 里输出 fontFamily/fontWeight/fontStyle
  var rootComputed = window.getComputedStyle(root);
  var globalFont = getGlobalFont(root, rootComputed, cssRuleMap);

  function walk(el, parentRect, _inProForm, _inTabs, _inQuickSort) {
    var rect = getDesignRect(el, geo);
    const computed = window.getComputedStyle(el);
    const tag = (el.tagName || '').toLowerCase();

    // inline 元素（如 span）在 flex-wrap 或行内布局中可能跨越多个浏览器行，
    // getBoundingClientRect() 返回联合包围盒，导致 y 位置错误（偏到第一行顶部）。
    // 改用 getClientRects() 中面积最大的单行矩形，取其准确的行内位置和尺寸。
    // _isMultiLineInline：记录 inline 元素跨行事实，用于后续强制 singleLine=false 并触发换行检测。
    var _elDisplayForMultiline = computed.display;
    var _isMultiLineInline = false;
    if (_elDisplayForMultiline === 'inline' || _elDisplayForMultiline === 'inline-block' || _elDisplayForMultiline === 'inline-flex') {
      try {
        var _crs = el.getClientRects();
        if (_crs && _crs.length > 1) {
          _isMultiLineInline = true;
          var _maxArea = 0;
          var _primaryVR = null;
          for (var _ri = 0; _ri < _crs.length; _ri++) {
            var _vr = _crs[_ri];
            var _vArea = (_vr.width || 0) * (_vr.height || 0);
            if (_vArea > _maxArea) { _maxArea = _vArea; _primaryVR = _vr; }
          }
          if (_primaryVR) rect = getDesignRect(_primaryVR, geo);
        }
      } catch (_eInline) {}
    }

    // position: sticky 处理：分两种情况。
    // ① 容器未溢出（表格宽度 ≤ 容器宽度）：sticky 等同于 relative，getBoundingClientRect 就是自然位置，无需修正。
    // ② 容器溢出（表格宽于容器，sticky 列处于吸附状态）：
    //    - 不修正 rect：getBoundingClientRect 对 sticky:right 吸附列返回的是「贴在容器右边缘」的视口坐标，
    //      转换为设计坐标后相对父节点（tr）的 x = 容器可见宽度 - right偏移 - 列宽，这正好是我们想要的浮动位置。
    //    - 设 _stickyNeedsAbsolute = true：后续为该节点注入 positionType:'absolute'，
    //      让它在 Auto Layout 父行（tr）中浮动到正确位置而非被排入流中塞到行末（行末超出可见区域）。
    var _stickyNeedsAbsolute = false;
    var _stickyShadow = null;
    var _stickySiblingBg = null;
    try {
      var _posForStickyCheck = computed.getPropertyValue ? computed.getPropertyValue('position') : computed.position;
      if (_posForStickyCheck === 'sticky' || _posForStickyCheck === '-webkit-sticky') {
        var _stickyScrollX = 0, _stickyScrollY = 0;
        var _stickyContainerOverflows = false;
        var _stickyAncestor = el.parentElement;
        while (_stickyAncestor && _stickyAncestor !== document.body && _stickyAncestor !== document.documentElement) {
          var _saCs = window.getComputedStyle(_stickyAncestor);
          var _saOvx = _saCs.overflowX; var _saOvy = _saCs.overflowY;
          if (_saOvx === 'auto' || _saOvx === 'scroll' || _saOvy === 'auto' || _saOvy === 'scroll' ||
              _saOvx === 'overlay' || _saOvy === 'overlay') {
            _stickyScrollX = _stickyAncestor.scrollLeft || 0;
            _stickyScrollY = _stickyAncestor.scrollTop  || 0;
            _stickyContainerOverflows = (_stickyAncestor.scrollWidth > _stickyAncestor.clientWidth + 1);
            break;
          }
          _stickyAncestor = _stickyAncestor.parentElement;
        }
        if (_stickyContainerOverflows) {
          // 溢出容器中的 sticky 吸附列：rect 保持 getBoundingClientRect 的吸附坐标（已是正确的浮动 x），
          // 仅需后续设为 absolute 让 ir-to-figma 生成 stackPositioning:ABSOLUTE
          _stickyNeedsAbsolute = true;
          // 读取 ::after 上的 box-shadow（如 Ant Design 固定列分隔阴影）。
          // ::after 是位于 th 左侧的透明遮罩（right:100%; width:30px），其 inset box-shadow 产生左侧分隔线效果。
          // 将其转为 th 本身的外阴影（去掉 inset）直接注入 node.style.shadows，在 Figma 中等价还原该视觉。
          try {
            var _stickyAfterCs = window.getComputedStyle(el, '::after');
            var _stickyAfterBs = _stickyAfterCs && _stickyAfterCs.boxShadow;
            if (_stickyAfterBs && _stickyAfterBs !== 'none' && typeof parseBoxShadow === 'function') {
              var _parsedStickyBs = parseBoxShadow(String(_stickyAfterBs));
              if (_parsedStickyBs && _parsedStickyBs.length) {
                var _candidateShadows = _parsedStickyBs.map(function(s) {
                  return { offsetX: s.offsetX, offsetY: s.offsetY, blur: s.blur, spread: s.spread, color: s.color, inset: false };
                }).filter(function(s) {
                  return s.blur > 0 || s.offsetX !== 0 || s.offsetY !== 0 || (s.spread && s.spread !== 0);
                });
                if (_candidateShadows.length) _stickyShadow = _candidateShadows;
              }
            }
          } catch (_eStickyBs) {}
        } else if (_stickyScrollX !== 0 || _stickyScrollY !== 0) {
          // 容器未溢出但存在滚动偏移（极少见）：还原自然流坐标
          rect = { left: rect.left + _stickyScrollX, top: rect.top + _stickyScrollY, width: rect.width, height: rect.height };
        }
        // 修正表头背景色：对所有 sticky th 生效（无论容器是否溢出）。
        // getDeclaredStyleForElement 按 last-wins 取 CSS 声明（不考虑 CSS 优先级），
        // 会错误地把 .ant-table-cell-fix-right{background:#fff} 当作背景。
        // getComputedStyle 浏览器正确计算了优先级，其 backgroundColor 才是真实值。
        // 修正：sticky th 直接用 computed.backgroundColor 覆盖 fills，跳过有问题的 declared 逻辑。
        if (tag === 'th') {
          try {
            var _stickyComputedBg = computed.backgroundColor || '';
            if (_stickyComputedBg && _stickyComputedBg !== 'rgba(0, 0, 0, 0)' && _stickyComputedBg !== 'transparent') {
              _stickySiblingBg = _stickyComputedBg;
            }
          } catch (_eStickyBg) {}
        }
      }
    } catch (_eStickyAdj) {}

    // [debug] input 节点全流程追踪（最早入口）
    if (tag === 'input') {
    }

    var _tc = (el.textContent || '').trim();

    // Skip invisible or zero-size
    // display:contents 元素自身无盒模型（width/height 均为 0），但其子节点参与布局，需透传遍历
    const isDisplayContents = computed.display === 'contents';
    if (!isDisplayContents && rect.width <= 0 && rect.height <= 0 && tag !== 'svg') return null;
    if (computed.display === 'none' || computed.visibility === 'hidden') return null;

    // body 下方 class 以 selection- 开头的节点不参与输出
    // append- 是 MyBricks 画布的组件追加区域包裹层，boardTitle- 是画布标题区，均属画布内部骨架节点，不应导出为设计稿内容
    if (hasClassPrefix(el, 'selection-')) return null;
    if (hasClassPrefix(el, 'append-')) return null;
    if (hasClassPrefix(el, 'boardTitle-')) return null;

    // ant-checkbox-inner 是 checkbox 的纯视觉方框，当启用组件库映射时由 Figma 变体组件负责渲染，跳过
    if (COMPONENT_LIBRARY_ENABLED && el.classList && el.classList.contains('ant-checkbox-inner')) return null;

    // ── Figma 组件库实例映射：<button> → 按钮变体 ──
    // ant-btn-primary → 一级按钮，其他 → 二级按钮
    if (COMPONENT_LIBRARY_ENABLED && tag === 'button') {
      var _btnCls = (typeof el.className === 'string') ? el.className : '';
      var _isPrimary = _btnCls.indexOf('btnSearch') !== -1;
      return {
        type: 'figma-instance',
        figmaComponentKey: _isPrimary
          ? '25b631121259ef348009e6cdc75fe2db40fcf38e'
          : '0d72cf9591f663c61227e0086043266b9a523fcc',
        name: (el.textContent || '').replace(/\s+/g, ' ').trim() || 'Button',
        style: { x: rect.x, y: rect.y, width: rect.width, height: rect.height },
      };
    }

    // display:contents 节点自身不作为独立 frame，直接将其子节点合并到父级
    if (isDisplayContents) {
      const childNodes = [];
      for (let i = 0; i < el.childNodes.length; i++) {
        const child = el.childNodes[i];
        if (child.nodeType === 1) {
          const elChild = child;
          const skipTag = (elChild.tagName || '').toLowerCase();
          if (skipTag === 'script' || skipTag === 'style' || skipTag === 'link' || skipTag === 'colgroup' || skipTag === 'col') continue;
          if (hasClassPrefix(elChild, 'selection-')) continue;
          if (hasClassPrefix(elChild, 'append-')) continue;
          if (hasClassPrefix(elChild, 'boardTitle-')) continue;
          const childNode = walk(elChild, parentRect, _inProForm, _inTabs, _inQuickSort);
          if (childNode) childNodes.push(childNode);
        }
      }
      if (childNodes.length === 0) return null;
      if (childNodes.length === 1) return childNodes[0];
      // 多个子节点时包成一个 group 透传
      return { type: 'group', name: 'contents-wrapper', style: undefined, children: childNodes };
    }

    const nodeType = inferNodeType(el, computed, tag);
    const style = buildStyleJSON(el, computed, rect, parentRect, cssRuleMap, globalFont);

    const node = {
      type: nodeType,
      name: el.getAttribute('aria-label') || (el.className && typeof el.className === 'string' ? el.className.trim().split(/\s+/)[0] : null) || tag,
      className: el.className && typeof el.className === 'string' ? el.className.trim().split(/\s+/)[0] || undefined : undefined,
      style: style && Object.keys(style).length ? style : undefined,
      content: undefined,
      children: undefined,
    };
    // inferNodeType 只读 computed.display，但 buildStyleJSON 优先读 decl（cssRuleMap 声明）。
    // 当 decl.display 为 flex 时 style 会有 layoutMode，但 computed.display 可能仍为 inline，
    // 导致 type='group' + layoutMode 同时出现。Figma Group 不支持 Auto Layout，需升级为 frame。
    if (node.type === 'group' && node.style && node.style.layoutMode) {
      node.type = 'frame';
    }
    // 标记 radio-button-wrapper-checked（className 字段只存第一个 class，需从 DOM 全类名单独判断）
    if (el.className && typeof el.className === 'string' && el.className.indexOf('ant-radio-button-wrapper-checked') !== -1) {
      node._checkedWrapper = true;
    }
    // sticky 溢出列（如表格右侧固定列）：注入 positionType:'absolute'
    // 让 ir-to-figma 生成 stackPositioning:ABSOLUTE，使该节点在 Auto Layout 父行中浮动到
    // getBoundingClientRect 捕获的吸附位置（即容器可见宽度右边缘），而非被 Auto Layout 排到行末超出可见区域
    if (_stickyNeedsAbsolute) {
      var _stickyStylePatch = { positionType: 'absolute' };
      // 将 ::after 上读到的固定列分隔阴影作为 th 本身的外阴影（shadows）一并写入，
      // 使 Figma 能渲染出左侧分隔线效果（对应浏览器中 ::after inset box-shadow 产生的视觉）
      if (_stickyShadow && _stickyShadow.length) {
        _stickyStylePatch.shadows = _stickyShadow;
      }
      // 修正 sticky 表头被 Ant Design 白色滚动遮罩覆盖的背景色
      if (_stickySiblingBg) {
        _stickyStylePatch.fills = [_stickySiblingBg];
      }
      node.style = Object.assign({}, node.style || {}, _stickyStylePatch);
    } else if (_stickySiblingBg) {
      // 非溢出容器的 sticky th（容器宽度足够，列不需要 absolute）：
      // 同样需要修正 getDeclaredStyleForElement last-wins 导致的错误白色背景
      node.style = Object.assign({}, node.style || {}, { fills: [_stickySiblingBg] });
    }

    var matchedSelectors = cssRuleMap ? getMatchedSelectorsForElement(el, cssRuleMap) : [];
    if (matchedSelectors.length) node.selectors = matchedSelectors;

    // Figma 反向同步：antd 等子节点仅有 .ant-* 时，把「最近祖先的 less 文件编码」拼进 [mb:]，便于写回对应 less 的 :global(...)
    try {
      var _ancEnc = getNearestEncodedLessFilePrefixFromAncestors(el);
      if (_ancEnc && !elementHasEncodedLessFileClass(el) && el.className && typeof el.className === 'string') {
        var _partsAnt = el.className.trim().split(/\s+/);
        var _bestAntToken = null;
        for (var _ai = 0; _ai < _partsAnt.length; _ai++) {
          var _tok = _partsAnt[_ai];
          if (_tok.indexOf('ant-') === 0) {
            _bestAntToken = _tok;
            break;
          }
        }
        if (_bestAntToken) {
          node.figmaSyncSelector = '.' + _ancEnc + '-' + _bestAntToken;
        }
      }
    } catch (_eFigSync) {}

    if (nodeType === 'text') {
      node.content = getTextContent(el);
      if (node.content === '' && !el.querySelector('img, svg')) return null;
      // input/textarea 正在显示 placeholder 时，用 ::placeholder 伪类的颜色替换文字颜色
      if (isShowingPlaceholder(el) && node.style) {
        try {
          var placeholderColor = window.getComputedStyle(el, '::placeholder').color;
          if (placeholderColor && placeholderColor !== 'rgba(0, 0, 0, 0)') {
            node.style.color = placeholderColor;
          }
        } catch (e) {}
      }
      // 文本节点不需要 frame 专属的布局属性，清除避免消费端误处理
      if (node.style) {
        delete node.style.layoutMode;
        delete node.style.layoutWrap;
        delete node.style.itemSpacing;
        delete node.style.counterAxisSpacing;
        // input/textarea：paddingLeft/Right 影响文字可见区域，转成 x 偏移和宽度收窄，而非直接删除
        var _itagPre = (el.tagName || '').toLowerCase();
        if (_itagPre === 'input' || _itagPre === 'textarea') {
          var _pl2 = node.style.paddingLeft || 0;
          var _pr2 = node.style.paddingRight || 0;
          if (node.style.x != null) node.style.x = node.style.x + _pl2;
          if (node.style.width != null) node.style.width = Math.max(1, node.style.width - _pl2 - _pr2);
        }
        delete node.style.paddingTop;
        delete node.style.paddingRight;
        delete node.style.paddingBottom;
        delete node.style.paddingLeft;
        delete node.style.primaryAxisAlignItems;
        delete node.style.counterAxisAlignItems;
        delete node.style.layoutSizingHorizontal;
        delete node.style.layoutSizingVertical;
        delete node.style.layoutGridColumns;
        // 判断 DOM 里是否单行：用 lineHeight 判断（单行高度约等于一个 lineHeight），fallback 到 height < fontSize * 2
        var _h = node.style.height;
        var _fs = node.style.fontSize;

        if (_h != null && _fs != null && _fs > 0) {
          var _lhRaw = computed && computed.lineHeight;
          var _lh = (_lhRaw && _lhRaw !== 'normal') ? parseFloat(_lhRaw) : null;
          if (_lh != null && !Number.isNaN(_lh) && _lh > 0) {
            node.style.singleLine = _h <= _lh * 1.2;
          } else {
            node.style.singleLine = _h < _fs * 2;
          }
          // inline 元素跨越多个浏览器行时，rect 被修正为主行单行高度，导致上面误判为 singleLine:true。
          // 此处强制覆盖，确保后续调用 getTextWithActualLineBreaksForElement 检测真实断行。
          if (_isMultiLineInline) node.style.singleLine = false;
          // 将 lineHeight 写入 JSON，让 Figma 使用与 DOM 一致的行高，
          // 避免 Figma 按自身字体度量重新计算（如 fontSize=48 的 -apple-system 默认行高≈67px）
          if (_lh != null && !Number.isNaN(_lh) && _lh > 0) {
            node.style.lineHeight = _lh;
          } else if (node.style.singleLine) {
            // line-height: normal 的单行文本：DOM 元素高度 = 有效行高（减去 padding）
            var _ptop2 = parseFloat(computed && computed.paddingTop) || 0;
            var _pbot2 = parseFloat(computed && computed.paddingBottom) || 0;
            var _effLh2 = _h - _ptop2 - _pbot2;
            if (_effLh2 > 0) {
              node.style.lineHeight = _effLh2;
            }
          }
        }
        // 判断是否容器约束宽度：用 Range 测量文字内容的自然渲染宽度，若内容宽度 < 元素宽度 × 0.9
        // 则说明容器 CSS 约束了宽度（文字未撑满），固定宽度不会导致 Figma 换行
        // 也检测 text-overflow: ellipsis，文字超出被截断同样需要固定容器宽度
        if (node.style.singleLine && node.style.width != null) {
          var _textOverflowVal = (computed && computed.textOverflow) || '';
          var _overflowXVal = (computed && (computed.overflowX || computed.overflow)) || '';
          if (_textOverflowVal === 'ellipsis' && _overflowXVal !== 'visible') {
            node.style.widthConstrained = true;
            node.style.textOverflow = 'ellipsis';
          } else {
            var _contentW = 0;
            var _geoScale = geo.scale || 1;
            for (var _ci = 0; _ci < el.childNodes.length; _ci++) {
              var _cn = el.childNodes[_ci];
              if (_cn.nodeType === 3 && /\S/.test(_cn.textContent || '')) {
                var _tr = getTextNodeRect(_cn);
                if (_tr && _tr.width > 0) _contentW += _tr.width / _geoScale;
              }
            }
            if (_contentW > 0 && _contentW < node.style.width * 0.9) {
              node.style.widthConstrained = true;
            }
          }
        }
        applyWidthConstrainedForFigmaEdgeWhitespace(node);
      }
      // 多行文本：递归遍历所有子节点检测 DOM 实际断行位置，插入 \n，
      // 使 Figma 导入后立即按正确行数显示（无需双击）。
      // 原仅对 CJK+数字混合触发；现扩展到所有 singleLine:false 节点，
      // 包括纯中文、纯英文、中英混合、以及普通 CSS 宽度换行文本。
      if (nodeType === 'text' && node.style && !node.style.singleLine) {
        var _cwb = getTextWithActualLineBreaksForElement(el);
        if (_cwb) node.content = _cwb;
      }
      // 含 inline span 子节点时提取颜色范围（colorRuns），传递到 Figma 的 characterStyleIDs 机制，
      // 实现同一文本节点内不同字符分别着色（如段落内高亮关键词）。
      if (nodeType === 'text' && node.style && el.children && el.children.length > 0) {
        var _parentColorStr = computed ? computed.color : null;
        var _colorRuns = getColorRunsFromInlineElement(el, node.content, _parentColorStr, cssRuleMap);
        if (_colorRuns && _colorRuns.length > 0) {
          node.style.colorRuns = _colorRuns;
        }
      }
      // input/textarea 浏览器默认垂直居中，Figma text 节点需要显式设置
      var _itag = (el.tagName || '').toLowerCase();
      if (_itag === 'input' || _itag === 'textarea') {
        if (node.style) {
          node.style.textAlignVertical = 'CENTER';
          if (!node.style.textAlignHorizontal) {
            var _taRaw = computed && computed.textAlign;
            var _taMap = { left: 'LEFT', right: 'RIGHT', center: 'CENTER', justify: 'JUSTIFIED', start: 'LEFT', end: 'RIGHT' };
            node.style.textAlignHorizontal = _taMap[String(_taRaw || 'left').toLowerCase()] || 'LEFT';
          }
        } else {
          console.warn('[walk:input:align] node.style is undefined! content:', node.content, '| placeholder:', el.placeholder);
        }
      } else if (node.style && shouldSetTextAlignVerticalCenterForFlexParentAlignItemsCenter(el, node.style)) {
        node.style.textAlignVertical = 'CENTER';
      } else if (applyAntSelectSelectionPlaceholderTextAlign(node, el, computed)) {
      } else if (node.style && shouldSetTextAlignVerticalCenterForAbsoluteTextLeaf(node.style, computed)) {
        node.style.textAlignVertical = 'CENTER';
      }
      // 对 text 节点检测伪元素：若 ::before/::after 有内容，升级为 frame，原文本 + 伪元素作为子节点
      var _pseudoBefore = getPseudoTextNode(el, '::before', geo, parentRect, rect, cssRuleMap, globalFont);
      var _pseudoAfter = getPseudoTextNode(el, '::after', geo, parentRect, rect, cssRuleMap, globalFont);
      var _upgradeCls2 = (el.className && typeof el.className === 'string') ? el.className.split(' ').slice(0,3).join(' ') : '';
      if (_pseudoBefore || _pseudoAfter) {
        // 浅拷贝 style，避免直接修改原始对象（可能被冻结导致 object is not extensible）
        var _textStyle = node.style ? Object.assign({}, node.style) : {};
        delete _textStyle.x; delete _textStyle.y;
        delete _textStyle.width; delete _textStyle.height;
        var _textChild = { type: 'text', name: node.name, content: node.content, style: _textStyle, className: node.className };
        if (_pseudoBefore) _pseudoBefore = { type: _pseudoBefore.type, name: _pseudoBefore.name, content: _pseudoBefore.content, style: Object.assign({}, _pseudoBefore.style, { x: undefined, y: undefined }) };
        if (_pseudoAfter) _pseudoAfter = { type: _pseudoAfter.type, name: _pseudoAfter.name, content: _pseudoAfter.content, style: Object.assign({}, _pseudoAfter.style, { x: undefined, y: undefined }) };
        var _pseudoChildren = [];
        if (_pseudoBefore) _pseudoChildren.push(_pseudoBefore);
        _pseudoChildren.push(_textChild);
        if (_pseudoAfter) _pseudoChildren.push(_pseudoAfter);
        node.type = 'frame';
        node.content = undefined;
        node.children = _pseudoChildren;
        // 保留原始 DOM height：对于有明确 CSS height 的元素（如 ant-form-item-label > label { height: 32px }），
        // DOM 高度是设计值而非 flex-stretch 副产品，应用 FIXED 保证导入 Figma 后尺寸正确。
        var _origFrameHeight = node.style && node.style.height;
        node.style = { x: node.style && node.style.x, y: node.style && node.style.y, width: node.style && node.style.width, height: (_origFrameHeight != null) ? _origFrameHeight : undefined, layoutMode: 'HORIZONTAL', itemSpacing: 0, counterAxisAlignItems: 'CENTER', layoutSizingHorizontal: 'HUG', layoutSizingVertical: (_origFrameHeight != null) ? 'FIXED' : 'HUG' };
        var _dbgUpgradeCls = (el.className && typeof el.className === 'string') ? el.className.split(' ').slice(0,3).join(' ') : '';
      }
    }

    if (nodeType === 'image') {
      const src = (el.tagName || '').toLowerCase() === 'img' ? (el.currentSrc || el.src || el.getAttribute('src')) : null;
      if (!src) return null;
      node.content = src;
    }

    var childNodes = [];
    var isLibrarySource = !!(el.getAttribute && el.getAttribute('data-library-source') != null);

    // ★ Figma 组件库映射：开关开启时，凡带 data-library-source 的节点直接打标并停止递归，
    //   由消费侧根据 librarySource + zoneTitle + rawClassName 查规则表映射到 Figma 变体。
    //   没有 data-library-source 的节点一律走原有绘制逻辑（frame / text 等）。
    var _libCls = (el.className && typeof el.className === 'string') ? el.className : '';
    if (COMPONENT_LIBRARY_ENABLED && isLibrarySource && nodeType !== 'text' && nodeType !== 'image' && tag !== 'svg') {
      // 检查子树中是否还有嵌套的 data-library-source 节点（如 ProForm 内嵌 ProFormText）。
      // 有则说明当前节点是容器，不能在此停止，需继续递归让子节点各自打标。
      var _hasNestedLibSource = !!(el.querySelector && el.querySelector('[data-library-source]'));
      // data-zone-title=".tabs" 是 tabs 容器，子节点 ant-tabs-tab 需要各自打标，不能在此截停
      var _isTabsContainer = (el.getAttribute('data-zone-title') || '') === '.tabs';
      // data-zone-title 含 "quickSort" 的容器，或 className 含精确 class "ant-pro-checkableTags"（有s）的容器：
      // 子节点 ant-pro-checkableTag（无s）需要各自打标为单个二三级tab，不能在此截停
      var _isQuickSortContainer =
        (el.getAttribute('data-zone-title') || '').indexOf('quickSort') !== -1 ||
        (' ' + _libCls + ' ').indexOf(' ant-pro-checkableTags ') !== -1;
      // Ant Design Space：根节点带 data-library-source，子项（链接/按钮）通常无该属性，
      // 若在此截停为 component-library，innerText 会把「查看/编辑/删除」拼成一段并丢失各链颜色与间距。
      var _ztRaw = (el.getAttribute('data-zone-title') || '').trim();
      var _isSpaceContainer = _ztRaw.toLowerCase() === 'space';
      // 子树内 ≥2 个可交互控件（链/按钮/表单）：多入口或分页 options 等，不能整段 component-library
      var _libMultiInteractive = false;
      if (el.querySelectorAll) {
        try {
          var _libCtrls = el.querySelectorAll('a, button, input, select, textarea');
          if (_libCtrls.length >= 2) _libMultiInteractive = true;
        } catch (_eLibL) {}
      }
      if (!_libMultiInteractive && el.children && el.children.length >= 2 && el.querySelector) {
        try {
          if (el.querySelector('input, select, textarea')) _libMultiInteractive = true;
        } catch (_eLibF) {}
      }
      // ProTable 根节点需要整体映射为「表格」变体，允许在此强制截停（即使子树里有其他 data-library-source）
      var _zoneTitle = el.getAttribute('data-zone-title') || '';
      var _isProTableRoot = _zoneTitle === 'ProTable';
      if ((_isProTableRoot) || (!_hasNestedLibSource && !_isTabsContainer && !_isQuickSortContainer && !_isSpaceContainer && !_libMultiInteractive)) {
        node.type = 'component-library';
        node.rawClassName = _libCls.trim();
        var _libSrc = el.getAttribute('data-library-source') || '';
        if (_libSrc) node.librarySource = _libSrc;
        var _zoneTitleRaw = _zoneTitle;
        if (_zoneTitleRaw) node.zoneTitle = _zoneTitleRaw;
        // 优先从表单标签元素提取标题（避免把 placeholder 文本也混入 label）
        var _labelDomEl = el.querySelector && (
          el.querySelector('.ant-form-item-label label') ||
          el.querySelector('label.ant-form-item-no-colon') ||
          el.querySelector('label')
        );
        var _libLabel = _labelDomEl
          ? (_labelDomEl.getAttribute('title') || _labelDomEl.textContent || '').trim()
          : (el.innerText || el.textContent || '').replace(/\s+/g, ' ').trim();
        if (_libLabel) node.label = _libLabel;
        // 提取 placeholder：
        //   1. input / textarea[placeholder] —— ProFormText 等输入框
        //   2. .ant-select-selection-placeholder —— ProFormSelect 等下拉框（placeholder 是 span 文本）
        var _inputDomEl = el.querySelector && el.querySelector('input[placeholder]:not([style*="opacity: 0"]):not([style*="opacity:0"]), textarea[placeholder]');
        var _selectPhEl = el.querySelector && el.querySelector('.ant-select-selection-placeholder');
        var _phVal = (_inputDomEl && _inputDomEl.getAttribute('placeholder'))
          || (_selectPhEl && (_selectPhEl.textContent || '').trim())
          || '';
        if (_phVal) node.placeholder = _phVal;
        return node;
      }
      // 有嵌套 library-source，fall through → 继续普通 frame 递归逻辑
    }
    // ProForm 内置按钮（无 data-library-source 但在 ProForm 子树内）：
    // ProForm 的提交/重置按钮由框架自动渲染，不会携带 data-library-source，
    // 但因已明确处于 ProForm 内部，可补上 librarySource 让消费侧映射到变体组件库。
    // 只对带 ant-btn 的元素截停；其他中间容器（ant-row / ant-col / ant-pro-form-group 等）
    // 不截停，继续递归让按钮在更深层被识别。
    var _isProFormBtn = _libCls.indexOf('ant-btn') !== -1 || tag === 'button';
    if (COMPONENT_LIBRARY_ENABLED && _inProForm && !isLibrarySource && _isProFormBtn) {
      node.type = 'component-library';
      node.rawClassName = _libCls.trim();
      node.librarySource = '@es/pro-components';
      var _pfBtnLabel = (el.innerText || el.textContent || '').replace(/\s+/g, ' ').trim();
      if (_pfBtnLabel) node.label = _pfBtnLabel;
      return node;
    }
    // tabs 容器内的 ant-tabs-tab 子节点（无 data-library-source，由父容器 _inTabs 标记识别）：
    // 每个 tab 项映射为独立的 component-library 节点，label 取 tab 文案，librarySource 补充为父容器来源。
    if (COMPONENT_LIBRARY_ENABLED && _inTabs && !isLibrarySource
        && _libCls.indexOf('ant-tabs-tab') !== -1) {
      node.type = 'component-library';
      node.rawClassName = _libCls.trim();
      node.librarySource = '@m-ui/react';
      var _tabLabel = (el.innerText || el.textContent || '').replace(/\s+/g, ' ').trim();
      if (_tabLabel) node.label = _tabLabel;
      return node;
    }
    // quickSort 容器内的 ant-pro-checkableTag 子节点（无 data-library-source，由父容器 _inQuickSort 标记识别）：
    // 每个快捷筛选项映射为独立的 component-library 节点。
    // label 取纯文本（排除徽标数字 span），若存在纯数字 span 则以 placeholder 字段存储数字
    // 并在 rawClassName 追加 __has-badge-number，供消费侧判断「是否带数字」变体。
    // 注意：用精确 class 匹配（加空格包围）区分 ant-pro-checkableTag（无s）与 ant-pro-checkableTags（有s容器）。
    if (COMPONENT_LIBRARY_ENABLED && _inQuickSort && !isLibrarySource
        && (' ' + _libCls + ' ').indexOf(' ant-pro-checkableTag ') !== -1) {
      node.type = 'component-library';
      node.rawClassName = _libCls.trim();
      node.librarySource = '@es/pro-components';
      var _qsText = '', _qsBadge = '';
      for (var _qsi = 0; _qsi < el.childNodes.length; _qsi++) {
        var _qsChild = el.childNodes[_qsi];
        if (_qsChild.nodeType === 3) {
          var _qst = (_qsChild.textContent || '').trim();
          if (_qst) _qsText += _qst;
        } else if (_qsChild.nodeType === 1 && (_qsChild.tagName || '').toLowerCase() === 'span') {
          var _qsSpanText = (_qsChild.textContent || '').trim();
          if (/^\d+$/.test(_qsSpanText)) _qsBadge = _qsSpanText;
        }
      }
      if (!_qsText) _qsText = (el.innerText || el.textContent || '').replace(/\s+/g, ' ').trim();
      if (_qsText) node.label = _qsText.trim();
      if (_qsBadge) {
        node.placeholder = _qsBadge;
        node.rawClassName += ' __has-badge-number';
      }
      return node;
    }

    if (nodeType !== 'text' && nodeType !== 'image' && !(tag === 'svg')) {
      // 支持 div 内同时有文本和 DOM：按 childNodes 顺序，元素走 walk，文本节点单独成 text 节点；SVG 用占位组件不遍历子节点
      var _mergedTextBr = '';
      var _didMergeTextBr = false;
      var _didMergeInlineChildrenText = false;
      if (shouldMergeTextAndBrChildren(el)) {
        _mergedTextBr = mergeTextAndBrChildNodesContent(el);
        if (_mergedTextBr) {
          var _mergeRectVp = getElementContentsTextBlockRect(el);
          var _mergeRect = _mergeRectVp ? getDesignRect(_mergeRectVp, geo) : null;
          var _mergeInline = buildInlineTextStyle(el, window.getComputedStyle(el), _mergeRect, rect, cssRuleMap, globalFont);
          var _mergeTextJson = {
            type: 'text',
            name: 'Text',
            content: _mergedTextBr,
            style: _mergeInline && Object.keys(_mergeInline).length ? _mergeInline : undefined,
          };
          if (node.selectors && node.selectors.length) _mergeTextJson.selectors = node.selectors.slice();
          if (node.className) _mergeTextJson.className = node.className;
          if (node.figmaSyncSelector) _mergeTextJson.figmaSyncSelector = node.figmaSyncSelector;
          applyTextOverflowEllipsisExport(_mergeTextJson, el, window.getComputedStyle(el), geo, null, rect);
          applyWidthConstrainedForFigmaEdgeWhitespace(_mergeTextJson);
          childNodes.push(_mergeTextJson);
          _didMergeTextBr = true;
        }
      }
      // 容器（尤其带 padding 的 tableCell）内若是“文本 + inline span 高亮”混排，
      // 不能拆成多个绝对定位子节点，否则 Figma 中易出现 span 数字错位。
      // 这里保留父 frame（不丢 padding），但把 inline 子内容合并为一个 text 子节点。
      if (!_didMergeTextBr) {
        var _canMergeInlineChildren = false;
        if (el && el.children && el.children.length > 0 && /\S/.test(el.textContent || '')) {
          var _isInlineMergeParent = computed.display !== 'flex' && computed.display !== 'inline-flex' && computed.display !== 'grid';
          if (_isInlineMergeParent) {
            _canMergeInlineChildren = true;
            for (var _imi = 0; _imi < el.children.length; _imi++) {
              var _imChild = el.children[_imi];
              var _imTagLower = (_imChild.tagName || '').toLowerCase();
              // 与 inferNodeType 一致：<svg> 常为 inline，但绝不能走 getTextContent 合并（会吃掉整棵 SVG）。
              if (_imTagLower === 'svg' || _imTagLower === 'math' || _imTagLower === 'canvas' ||
                  _imTagLower === 'video' || _imTagLower === 'iframe' || _imTagLower === 'object') {
                _canMergeInlineChildren = false;
                break;
              }
              var _imComp = window.getComputedStyle(_imChild);
              var _imDisp = _imComp.display;
              if (_imDisp !== 'inline' && _imDisp !== 'inline-block' && _imDisp !== 'inline-flex') {
                _canMergeInlineChildren = false;
                break;
              }
              // inline-flex 子节点若还有元素子节点（如 claimStatusWrapper 包裹圆点+标签），
              // 说明是结构容器而非单纯文本包裹，不能合并为单段文本（会丢失圆点和标签视觉）
              if ((_imDisp === 'inline-flex' || _imDisp === 'flex') && _imChild.children && _imChild.children.length > 0) {
                _canMergeInlineChildren = false;
                break;
              }
              var _imBg = _imComp.backgroundColor || '';
              var _imHasBg = _imBg && _imBg !== 'rgba(0, 0, 0, 0)' && _imBg !== 'transparent';
              var _imHasBorder = (_imComp.borderStyle && _imComp.borderStyle !== 'none' && parseFloat(_imComp.borderWidth || 0) > 0);
              var _imHasPadding = (parseFloat(_imComp.paddingTop || 0) > 0) ||
                                  (parseFloat(_imComp.paddingRight || 0) > 0) ||
                                  (parseFloat(_imComp.paddingBottom || 0) > 0) ||
                                  (parseFloat(_imComp.paddingLeft || 0) > 0);
              if (_imHasBg || _imHasBorder || _imHasPadding) {
                _canMergeInlineChildren = false;
                break;
              }
            }
            // 多链/多表单块：合并为单 text 会丢间距、输入框与文案（如 ant-pagination-options）
            if (_canMergeInlineChildren && el.children.length >= 2) {
              var _mergeSlots = 0;
              for (var _mpi = 0; _mpi < el.children.length; _mpi++) {
                var _mch = el.children[_mpi];
                var _mtn = (_mch.tagName || '').toLowerCase();
                if (_mtn === 'a' || _mtn === 'button' || _mtn === 'input' || _mtn === 'select' || _mtn === 'textarea') {
                  _mergeSlots++;
                } else if (_mch.querySelector && (_mch.querySelector('a') || _mch.querySelector('button') ||
                    _mch.querySelector('input') || _mch.querySelector('select') || _mch.querySelector('textarea'))) {
                  _mergeSlots++;
                }
              }
              if (_mergeSlots >= 2) _canMergeInlineChildren = false;
            }
            if (_canMergeInlineChildren && el.children.length >= 2 && el.querySelector) {
              try {
                if (el.querySelector('input, select, textarea')) _canMergeInlineChildren = false;
              } catch (_eFormMix2) {}
            }
            if (_canMergeInlineChildren && el.querySelectorAll) {
              try {
                var _mergeSubCtrls = el.querySelectorAll('a, button, input, select, textarea');
                if (_mergeSubCtrls.length >= 2) _canMergeInlineChildren = false;
              } catch (_eMs) {}
            }
          }
        }

        if (_canMergeInlineChildren) {
          var _inlineMergedText = getTextContent(el);
          if (_inlineMergedText) {
            var _inlineRectVp = getElementContentsTextBlockRect(el);
            var _inlineRect = _inlineRectVp ? getDesignRect(_inlineRectVp, geo) : null;
            var _inlineStyle = buildInlineTextStyle(el, window.getComputedStyle(el), _inlineRect, rect, cssRuleMap, globalFont);
            var _inlineTextJson = {
              type: 'text',
              name: 'Text',
              content: _inlineMergedText,
              style: _inlineStyle && Object.keys(_inlineStyle).length ? _inlineStyle : undefined,
            };
            if (node.selectors && node.selectors.length) _inlineTextJson.selectors = node.selectors.slice();
            if (node.className) _inlineTextJson.className = node.className;
            if (node.figmaSyncSelector) _inlineTextJson.figmaSyncSelector = node.figmaSyncSelector;
            if (_inlineTextJson.style && _inlineTextJson.style.singleLine === false) {
              var _inlineCwb = getTextWithActualLineBreaksForElement(el);
              if (_inlineCwb) _inlineTextJson.content = _inlineCwb;
            }
            if (_inlineTextJson.style) {
              var _inlineParentColor = computed ? computed.color : null;
              var _inlineColorRuns = getColorRunsFromInlineElement(el, _inlineTextJson.content, _inlineParentColor, cssRuleMap);
              if (_inlineColorRuns && _inlineColorRuns.length > 0) {
                _inlineTextJson.style.colorRuns = _inlineColorRuns;
              }
            }
            applyTextOverflowEllipsisExport(_inlineTextJson, el, window.getComputedStyle(el), geo, null, rect);
            applyWidthConstrainedForFigmaEdgeWhitespace(_inlineTextJson);
            childNodes.push(_inlineTextJson);
            _didMergeInlineChildrenText = true;
          }
        }
      }
      if (!_didMergeTextBr && !_didMergeInlineChildrenText) {
      // ProForm 容器检测：当前节点是 @es/pro-components 的 ProForm 时，
      // 向所有子节点传递 _inProForm=true，让内部无标记按钮得以被识别。
      // 已有 _inProForm 的保持不变（嵌套 ProForm 兜底）。
      var _nextInProForm = _inProForm;
      if (COMPONENT_LIBRARY_ENABLED && !_nextInProForm && isLibrarySource) {
        var _pfLibSrc = el.getAttribute('data-library-source') || '';
        var _pfZone = el.getAttribute('data-zone-title') || '';
        if (_pfLibSrc === '@es/pro-components' && _pfZone === 'ProForm') {
          _nextInProForm = true;
        }
      }
      // tabs 容器：向子节点传递 _inTabs=true，让 ant-tabs-tab 子项得以被识别并打标
      var _nextInTabs = _inTabs;
      if (COMPONENT_LIBRARY_ENABLED && !_nextInTabs && isLibrarySource) {
        if ((el.getAttribute('data-zone-title') || '') === '.tabs') {
          _nextInTabs = true;
        }
      }
      // quickSort 容器：向子节点传递 _inQuickSort=true，让 ant-pro-checkableTag 子项得以被识别并打标
      var _nextInQuickSort = _inQuickSort;
      if (COMPONENT_LIBRARY_ENABLED && !_nextInQuickSort && isLibrarySource) {
        if ((el.getAttribute('data-zone-title') || '').indexOf('quickSort') !== -1 ||
            (' ' + _libCls + ' ').indexOf(' ant-pro-checkableTags ') !== -1) {
          _nextInQuickSort = true;
        }
      }
      for (let i = 0; i < el.childNodes.length; i++) {
        const child = el.childNodes[i];
        if (child.nodeType === 1) {
          const elChild = child;
          var _childTag = (elChild.tagName || '').toLowerCase();
          var skip = _childTag === 'script' || _childTag === 'style' || _childTag === 'link' ||
            _childTag === 'colgroup' || _childTag === 'col';
          if (skip) continue;
          if (hasClassPrefix(elChild, 'selection-')) continue;
          if (hasClassPrefix(elChild, 'append-')) continue;
          if (hasClassPrefix(elChild, 'boardTitle-')) continue;
          const childNode = walk(elChild, rect, _nextInProForm, _nextInTabs, _nextInQuickSort);
          if (childNode) childNodes.push(childNode);
        } else if (child.nodeType === 3) {
          var textContent = normalizeTextExportPreserveTrailing(child.textContent || '', false);
          if (textContent) {
            var textRectViewport = getTextNodeRect(child);
            var textRect = textRectViewport ? getDesignRect(textRectViewport, geo) : null;
            var _frameTextHostComp = window.getComputedStyle(el);
            var inlineStyle = buildInlineTextStyle(el, _frameTextHostComp, textRect, rect, cssRuleMap, globalFont);
            var textNodeJson = {
              type: 'text',
              name: 'Text',
              content: textContent,
              style: inlineStyle && Object.keys(inlineStyle).length ? inlineStyle : undefined,
            };
            if (node.selectors && node.selectors.length) textNodeJson.selectors = node.selectors.slice();
            if (node.className) textNodeJson.className = node.className;
            if (node.figmaSyncSelector) textNodeJson.figmaSyncSelector = node.figmaSyncSelector;
            // frame 内换行文本子节点：buildInlineTextStyle 若判为 singleLine:false（多行），
            // 用 Range 逐字符检测视觉断行点并写入 \n，使 ir-to-figma 按多行生成正确字形，
            // 避免 Figma 初始渲染为单行、需双击才换行的问题。
            if (textNodeJson.style && textNodeJson.style.singleLine === false) {
              try {
                var _cwr = ''; var _cwrPrevTop = null;
                var _cwrRng = document.createRange();
                var _cwrT = child.textContent || '';
                for (var _cwrI = 0; _cwrI < _cwrT.length; _cwrI++) {
                  // Skip raw '\n' from HTML source: in white-space:normal they render as spaces,
                  // not actual line breaks. Visual line breaks are detected below via top comparison.
                  // Keeping them would cause double '\n' (source char + detected visual break).
                  if (_cwrT[_cwrI] === '\n') continue;
                  _cwrRng.setStart(child, _cwrI);
                  _cwrRng.setEnd(child, _cwrI + 1);
                  var _cwrRects = _cwrRng.getClientRects();
                  var _cwrTop = (_cwrRects && _cwrRects.length) ? Math.round(_cwrRects[0].top) : null;
                  if (_cwrTop !== null && _cwrPrevTop !== null && _cwrTop > _cwrPrevTop + 2) _cwr += '\n';
                  _cwr += _cwrT[_cwrI];
                  if (_cwrTop !== null) _cwrPrevTop = _cwrTop;
                }
                if (_cwr.indexOf('\n') !== -1) textNodeJson.content = _cwr;
              } catch (_eCwr) {}
            }
            applyTextOverflowEllipsisExport(textNodeJson, el, _frameTextHostComp, geo, child, rect);
            applyWidthConstrainedForFigmaEdgeWhitespace(textNodeJson);
            applyAntSelectSelectionPlaceholderTextAlign(textNodeJson, el, _frameTextHostComp);
            childNodes.push(textNodeJson);
          }
        }
      }
      }
      // 伪元素处理：::before 插到最前，::after 追加到最后
      var pseudoBefore = getPseudoTextNode(el, '::before', geo, parentRect, rect, cssRuleMap, globalFont);
      if (pseudoBefore) childNodes.unshift(pseudoBefore);
      var pseudoAfter = getPseudoTextNode(el, '::after', geo, parentRect, rect, cssRuleMap, globalFont);
      if (pseudoAfter) childNodes.push(pseudoAfter);
      // ant-checkbox-inner / ant-radio-inner：使用 Auto Layout 双轴居中显示选中标记（pseudo-after）。
      // pseudo-after 不带绝对定位，让 Auto Layout 自动居中；其余 input 等子节点已是绝对定位，不受影响。
      if (pseudoAfter && el.className && typeof el.className === 'string' && /ant-checkbox-inner|ant-radio-inner/.test(el.className)) {
        if (node.style) {
          node.style.layoutMode = node.style.layoutMode || 'HORIZONTAL';
          node.style.primaryAxisAlignItems = 'CENTER';
          node.style.counterAxisAlignItems = 'CENTER';
          node.style.itemSpacing = 0;
          node.style.layoutSizingHorizontal = 'FIXED';
          node.style.layoutSizingVertical = 'FIXED';
          // 勾形（rotation 非零）视觉重心偏上，加 2px 底部 padding 补偿
          var _isCheckmark = pseudoAfter.style && pseudoAfter.style.rotation != null && pseudoAfter.style.rotation !== 0;
          if (_isCheckmark) {
            node.style.paddingBottom = 2;
          }
        }
      }
      if (childNodes.length) {
        var layoutMode = node.style && (node.style.layoutMode === 'VERTICAL' || node.style.layoutMode === 'HORIZONTAL') ? node.style.layoutMode : null;
        if (layoutMode) {
          // VERTICAL 父容器：若子节点水平居中（x ≈ (parentWidth-childWidth)/2），设 alignSelf:'CENTER'
          if (layoutMode === 'VERTICAL') {
            var _pW2 = node.style && node.style.width;
            for (var _maci2 = 0; _maci2 < childNodes.length; _maci2++) {
              var _mcs2 = childNodes[_maci2];
              if (!_mcs2 || !_mcs2.style) continue;
              if (_mcs2.style.positionType === 'absolute') continue;
              var _cW2 = _mcs2.style.width;
              var _cX2 = _mcs2.style.x;
              if (_pW2 != null && _cW2 != null && _cX2 != null && _pW2 > _cW2 + 4) {
                var _expectedCX2 = (_pW2 - _cW2) / 2;
                if (Math.abs(_cX2 - _expectedCX2) < 2) {
                  _mcs2.style.alignSelf = 'CENTER';
                  // Figma layoutAlign='CENTER' 在 FIXED sizing 下静默失效；
                  // 改为将父容器设为 counterAxisAlignItems='CENTER'。
                  // 安全检查：只有所有其他非绝对定位兄弟节点都是全宽（容差10px）时才设置，
                  // 避免非全宽兄弟节点被错误居中。
                  var _allSibsFullWidth2 = true;
                  for (var _si2 = 0; _si2 < childNodes.length; _si2++) {
                    if (_si2 === _maci2) continue;
                    var _sib2 = childNodes[_si2];
                    if (!_sib2 || !_sib2.style || _sib2.style.positionType === 'absolute') continue;
                    var _sibW2 = _sib2.style.width;
                    if (_sibW2 != null && _pW2 - _sibW2 > 10) {
                      _allSibsFullWidth2 = false;
                      break;
                    }
                  }
                  if (_allSibsFullWidth2) {
                    node.style.counterAxisAlignItems = 'CENTER';
                  }
                }
              }
            }
          }
          // 任意子节点有负值 margin 说明间距不均匀，无法用 Auto Layout 还原，直接降级为绝对定位
          if (anyChildHasMargin(childNodes)) {
            delete node.style.layoutMode;
            delete node.style.itemSpacing;
            for (var i = 0; i < childNodes.length; i++) {
              var s = childNodes[i].style || {};
              if (s.marginTop != null) delete s.marginTop;
              if (s.marginRight != null) delete s.marginRight;
              if (s.marginBottom != null) delete s.marginBottom;
              if (s.marginLeft != null) delete s.marginLeft;
            }
          } else {
            // 横向 Auto Layout：子项正 marginTop/marginBottom 在 prune 中会被删；外包纵向 HUG frame，用 padding 与 wrapper 上的左右 margin 还原（如列表圆点）
            if (layoutMode === 'HORIZONTAL') {
              wrapHorizontalFlowChildrenVerticalMarginAsPadding(childNodes);
            }
            // WRAP 容器：在所有 margin 清理操作之前，先提取子节点 marginBottom 作为行间距
            if (node.style && node.style.layoutWrap === 'WRAP' && !node.style.counterAxisSpacing) {
              for (var _wEarly2 = 0; _wEarly2 < childNodes.length; _wEarly2++) {
                var _wEarlyC2 = childNodes[_wEarly2];
                if (_wEarlyC2 && _wEarlyC2.style && _wEarlyC2.style.marginBottom > 0) {
                  node.style.counterAxisSpacing = _wEarlyC2.style.marginBottom;
                  break;
                }
              }
            }
            if (childrenHaveUniformMargin(childNodes, layoutMode)) {
              applyUniformMarginAsGap(node, childNodes, layoutMode);
            }
            ensureItemSpacingFromPositions(node, childNodes, layoutMode);
            var finalSpacing = (node.style && node.style.itemSpacing != null) ? node.style.itemSpacing : null;
            var _isRadioWrapperNode2 = node.className && node.className.indexOf('radio-button-wrapper') !== -1;
            var _isMenuNode2 = node.className && node.className.indexOf('ant-menu') !== -1;
            if (_isRadioWrapperNode2) {
            }
            if (finalSpacing == null || finalSpacing < 0) {
              // 架构级修复：不再依赖标签名白名单。
              // 只要节点配置了对齐方式（非默认的 MIN）或存在内边距，说明它在视觉上依赖 AutoLayout 
              // 来维持内部排版（如居中、Padding包裹）。此时即使算不出间距（如单节点），也不能删除 layoutMode。
              var s = node.style || {};
              var hasAlignment = (s.primaryAxisAlignItems && s.primaryAxisAlignItems !== 'MIN') ||
                                 (s.counterAxisAlignItems && s.counterAxisAlignItems !== 'MIN');
              var hasPadding = s.paddingTop || s.paddingRight || s.paddingBottom || s.paddingLeft;
              // 若子节点中有绝对定位节点，其 x/y 不参与流式排布，不应影响间距计算结论，保留 layoutMode
              var hasAbsoluteChild = childNodes.some(function(c) { return c.style && c.style.positionType === 'absolute'; });
              // 多个流中子节点（>1）且算不出均匀间距 → 说明子节点间距本就不均匀，
              // 不能用 Auto Layout，即使有对齐/内边距也要降级为绝对定位，保留真实坐标
              var multiFlowChildren = childNodes.filter(function(c) { return !(c.style && c.style.positionType === 'absolute'); }).length > 1;
              if (_isMenuNode2) {
              }
              if (_isRadioWrapperNode2) {
              }
              if ((hasAlignment || hasPadding || hasAbsoluteChild) && !multiFlowChildren) {
                node.style.itemSpacing = 0;
              } else {
                delete node.style.layoutMode;
                delete node.style.itemSpacing;
              }
            } else {
              // itemSpacing 已从子节点 margin 中推断出来，清理子节点 margin
              // 但若父容器是 WRAP，marginBottom 是行间距来源，先提取再删
              var _isWrapContainer2 = node.style && node.style.layoutWrap === 'WRAP';
              if (_isWrapContainer2 && !node.style.counterAxisSpacing) {
                for (var _wPre2 = 0; _wPre2 < childNodes.length; _wPre2++) {
                  var _wPreC2 = childNodes[_wPre2];
                  if (_wPreC2 && _wPreC2.style && _wPreC2.style.marginBottom > 0) {
                    node.style.counterAxisSpacing = _wPreC2.style.marginBottom;
                    break;
                  }
                }
              }
              for (var i = 0; i < childNodes.length; i++) {
                pruneChildMarginsAfterGapMerge(
                  node.style,
                  childNodes[i].style,
                  layoutMode,
                  (node.name || '') + '/' + (node.className || ''),
                  (childNodes[i].name || '') + '/' + (childNodes[i].className || '')
                );
              }
            }
          }
        }
        // CSS Grid 显式放置降级：有 layoutGridColumns 的容器说明是 display:grid 且有 grid-template-columns。
        // 此类容器的子节点通过 grid-area 显式定位（可能跨列/跨行），Auto Layout WRAP 会忽略子节点的
        // x/y 坐标，导致单元格错位。子节点的 getBoundingClientRect() 已包含正确的绝对坐标，
        // 直接使用绝对定位可还原真实布局，无需 Auto Layout。
        if (node.style && node.style.layoutGridColumns != null) {
          delete node.style.layoutMode;
          delete node.style.itemSpacing;
          delete node.style.layoutWrap;
          delete node.style.counterAxisSpacing;
          delete node.style.layoutGridColumns;
        }
        // 保持 DOM 原始子节点顺序，避免将所有 absolute 节点统一抬到最上层。
        // 对于“背景图 + 文本”场景，背景图通常在 DOM 更靠前，需保持在文字下方。
        // ant-radio-group：过滤掉各 wrapper 内的 pseudo-before 竖线（Figma 里不需要，边框各自渲染）
        // 注意：选中态 wrapper（ant-radio-button-wrapper-checked）的 ::before 是左侧高亮边，不能过滤
        if (node.className && node.className.indexOf('ant-radio-group') !== -1) {
          for (var _rgi2 = 0; _rgi2 < childNodes.length; _rgi2++) {
            var _rgChild2 = childNodes[_rgi2];
            if (_rgChild2 && _rgChild2.children) {
              var _isChecked2 = _rgChild2._checkedWrapper === true;
              if (!_isChecked2) {
                _rgChild2.children = _rgChild2.children.filter(function(c) { return c.name !== 'pseudo-before'; });
              }
            }
          }
        }
        // 父节点启用 Auto Layout 时，流式子节点不应再携带绝对 x/y。
        // 否则导出到 Figma 后会把 x/y 当成附加偏移，导致纵向间距异常变大。
        if (node.style && node.style.layoutMode) {
          for (var _ali = 0; _ali < childNodes.length; _ali++) {
            var _alChild = childNodes[_ali];
            if (!_alChild || !_alChild.style) continue;
            if (_alChild.style.positionType === 'absolute') continue;
            delete _alChild.style.x;
            delete _alChild.style.y;
          }
        }
        node.children = childNodes;
        // flex-wrap 容器：若 counterAxisSpacing 未设置（无 row-gap），从子节点 marginBottom 推断行间距
        if (node.style && node.style.layoutWrap === 'WRAP' && !node.style.counterAxisSpacing) {
          var _wrapSpacing2 = 0;
          for (var _wsi2 = 0; _wsi2 < childNodes.length; _wsi2++) {
            var _wsc2 = childNodes[_wsi2];
            if (_wsc2 && _wsc2.style && _wsc2.style.marginBottom > 0) {
              _wrapSpacing2 = _wsc2.style.marginBottom;
              break;
            }
          }
          if (_wrapSpacing2 > 0) node.style.counterAxisSpacing = _wrapSpacing2;
        }
       
      }
      // 表格行（display: table-row / <tr>）的 border-bottom 需下移到子单元格
      // 因为 Figma 中子 frame 背景会遮盖父 frame 的底部边框，浏览器表格模型不存在这个问题
      if (node.children && node.children.length > 0 && node.style && node.style.strokeBottomWeight > 0) {
        var _elDisplay2 = computed.display || '';
        if (_elDisplay2 === 'table-row' || (el.tagName || '').toLowerCase() === 'tr') {
          var _trStrokeColor2 = node.style.strokeColor;
          var _trStrokeBottomW2 = node.style.strokeBottomWeight;
          for (var _tdi2 = 0; _tdi2 < node.children.length; _tdi2++) {
            var _tdNode2 = node.children[_tdi2];
            if (!_tdNode2 || !_tdNode2.style) continue;
            if (!_tdNode2.style.strokeColor) _tdNode2.style.strokeColor = _trStrokeColor2;
            var _tdBotW2 = _tdNode2.style.strokeBottomWeight || 0;
            if (_trStrokeBottomW2 > _tdBotW2) _tdNode2.style.strokeBottomWeight = _trStrokeBottomW2;
          }
          node.style.strokeBottomWeight = 0;
        }
      }
    }

    // frame 标题：从 class boardTitle- 下的 class tt- 元素取文本作为该 frame 的 name
    if (nodeType === 'frame') {
      var frameTitle = getFrameTitleFromElement(el);
      if (frameTitle) node.name = frameTitle;
      // input/textarea 改为 frame 后需补入 placeholder 文字子节点
      if (tag === 'input' || tag === 'textarea') {
        var _inputPlaceholder2 = el.placeholder || '';
        var _inputValue2 = (el.value || '').trim();
        var _inputText2 = _inputValue2 || _inputPlaceholder2;
        if (_inputText2) {
          try {
            var _inputPl2 = node.style ? (node.style.paddingLeft || 0) : 0;
            var _inputPr2 = node.style ? (node.style.paddingRight || 0) : 0;
            var _inputPt2 = node.style ? (node.style.paddingTop || 0) : 0;
            var _inputPb2 = node.style ? (node.style.paddingBottom || 0) : 0;
            var _inputW2 = node.style && node.style.width != null ? Math.max(1, node.style.width - _inputPl2 - _inputPr2) : undefined;
            var _inputH2 = node.style && node.style.height != null ? Math.max(1, node.style.height - _inputPt2 - _inputPb2) : undefined;
            var _inputFontSize2 = node.style ? (node.style.fontSize || 14) : 14;
            var _inputColor2 = node.style ? node.style.color : undefined;
            if (!_inputValue2 && _inputPlaceholder2) {
              try {
                var _phColor2 = window.getComputedStyle(el, '::placeholder').color;
                if (_phColor2 && _phColor2 !== 'rgba(0, 0, 0, 0)') _inputColor2 = _phColor2;
              } catch (e) {}
            }
            var _isTextarea2 = tag === 'textarea';
            var _inputChildStyle2 = {
              positionType: _isTextarea2 ? 'absolute' : undefined,
              x: _inputPl2,
              y: _isTextarea2 ? _inputPt2 : undefined,
              width: _inputW2,
              height: _isTextarea2 ? _inputH2 : undefined,
              fontSize: _inputFontSize2,
              singleLine: !_isTextarea2,
              textAlignVertical: _isTextarea2 ? 'TOP' : 'CENTER',
              textAlignHorizontal: node.style ? (node.style.textAlignHorizontal || 'LEFT') : 'LEFT',
            };
            if (_inputColor2) _inputChildStyle2.color = cssColorToRgba(_inputColor2) || _inputColor2;
            if (node.style && node.style.fontFamily) _inputChildStyle2.fontFamily = node.style.fontFamily;
            if (node.style && node.style.fontFamilyStack) _inputChildStyle2.fontFamilyStack = node.style.fontFamilyStack;
            if (node.style && node.style.fontWeight) _inputChildStyle2.fontWeight = node.style.fontWeight;
            // textarea 自身 frame 对齐改为 flex-start，防止被父容器 counterAxisAlignItems:CENTER 影响
            if (_isTextarea2 && node.style) {
              node.style.alignSelf = 'MIN';
            }
            node.children = [{ type: 'text', name: 'placeholder', content: _inputText2, style: _inputChildStyle2 }];
            if (node.style) {
              delete node.style.color;
              delete node.style.fontSize;
              delete node.style.fontFamily;
              delete node.style.fontFamilyStack;
              delete node.style.fontWeight;
              delete node.style.textAlignHorizontal;
              // 单行 input：子文本行高常小于框高，Figma 横向 Auto Layout 默认 counterAxis=MIN 会贴顶；
              // 浏览器里 line-height + 盒高是垂直居中的，父级交叉轴需 CENTER。
              if (!_isTextarea2 && node.style.layoutMode === 'HORIZONTAL') {
                node.style.counterAxisAlignItems = 'CENTER';
              }
            }
          } catch (e) {}
        }
      }
    }

    // SVG：序列化为字符串，消费端用 figma.createNodeFromSVG 直接创建，保留所有 fill/stroke
    if (nodeType === 'component' && tag === 'svg') {
      var svgContent = serializeSvgElement(el, rect.width, rect.height);
      if (svgContent) {
        node.type = 'svg';
        node.ref = undefined;
        node.children = undefined;
        if (!node.style) node.style = {};
        node.style.svgContent = svgContent;
      } else {
        node.ref = 'svg-placeholder';
        node.children = undefined;
      }
    }
    var _dbgReturnCls = (el.className && typeof el.className === 'string') ? el.className.split(' ').slice(0,3).join(' ') : '';

    return node;
  }
  var rootDesignRect = getDesignRect(dom, geo);
  const contentChildren = [];
  for (let i = 0; i < dom.children.length; i++) {
    const child = dom.children[i];
    if (hasClassPrefix(child, 'selection-')) continue;
    if (hasClassPrefix(child, 'append-')) continue;
    if (hasClassPrefix(child, 'boardTitle-')) continue;
    const tag = (child.tagName || '').toLowerCase();
    if (tag === 'script' || tag === 'style' || tag === 'link') continue;
    const childNode = walk(child, rootDesignRect);
    if (childNode) contentChildren.push(childNode);
  }

  const rootStyle = buildStyleJSON(dom, rootComputed, rootDesignRect, null, cssRuleMap, globalFont);
  const pageName = (dom.getAttribute && dom.getAttribute('data-zone-title')) || dom.id || (typeof dom.className === 'string' && dom.className.trim() && dom.className.trim().split(/\s+/).find(function (c) { return c.startsWith('body-'); }) || dom.className.trim().split(/\s+/)[0]) || undefined;
  var rootSelectors = cssRuleMap ? getMatchedSelectorsForElement(dom, cssRuleMap) : [];
  const content = [
    {
      type: 'frame',
      name: pageName || 'Frame',
      className: (typeof dom.className === 'string' && dom.className.trim()) ? dom.className.trim().split(/\s+/).find(function (c) { return c.startsWith('body-'); }) || dom.className.trim().split(/\s+/)[0] : undefined,
      style: rootStyle && Object.keys(rootStyle).length ? rootStyle : undefined,
      children: contentChildren.length ? contentChildren : undefined,
    },
  ];
  if (rootSelectors.length) content[0].selectors = rootSelectors;

  var componentDef = [];
  componentDef.push({
    type: 'svg-placeholder',
    name: 'SVG Placeholder',
    style: { fills: ['#e5e5e5'] },
    children: []
  });
  componentDef.push({
    type: 'library-source-placeholder',
    name: 'Library Source Placeholder',
    style: { fills: ['#e5e5e5'] },
    children: []
  });
  var pagePayload = { name: pageName, 'component-def': componentDef, content };
  if (globalFont && globalFont.fontFamily) {
    var defaultStack = (rootComputed && rootComputed.fontFamily) ? parseFontFamilyStack(String(rootComputed.fontFamily)) : [];
    pagePayload.defaultFont = {
      fontFamily: globalFont.fontFamily,
      fontWeight: globalFont.fontWeight,
      fontStyle: globalFont.fontStyle,
      fontFamilyStack: defaultStack.length ? defaultStack : undefined
    };
  }
  return { page: pagePayload };
}

function domToMybricksJsonAsync(frameId, styleTagId, options) {
  var syncPayload = domToMybricksJson(frameId, styleTagId, null, options);
  var content = syncPayload.page && syncPayload.page.content;
  if (!content || !content.length) return Promise.resolve(syncPayload);
  var _inlineOpts = Object.assign({}, options);
  if (typeof parseLinearGradientFromBgImage === 'function') {
    _inlineOpts.parseLinearGradientFromBgImage = parseLinearGradientFromBgImage;
  }
  return inlineImageFillsInTree(content[0], _inlineOpts).then(function () { return syncPayload; });
}

function domToMybricksJsonWithInlineImages(frameId, styleTagId, options) {
  return domToMybricksJsonAsync(frameId, styleTagId, options);
}

function elementToMybricksJsonWithInlineImages(el, styleTagId, options) {
  var syncPayload = elementToMybricksJson(el, styleTagId, options);
  var content = syncPayload.page && syncPayload.page.content;
  if (!content || !content.length) return Promise.resolve(syncPayload);
  var _inlineOpts2 = Object.assign({}, options);
  if (typeof parseLinearGradientFromBgImage === 'function') {
    _inlineOpts2.parseLinearGradientFromBgImage = parseLinearGradientFromBgImage;
  }
  return inlineImageFillsInTree(content[0], _inlineOpts2).then(function () { return syncPayload; });
}


// Export for browser (attach to window so you can run in console)
if (typeof window !== 'undefined') {
  window.SHADOW_HOST_ID = SHADOW_HOST_ID;
  window.domToMybricksJson = domToMybricksJson;
  window.domToMybricksJsonWithInlineImages = domToMybricksJsonWithInlineImages;
  window.comToMybricksJsonWithInlineImages = comToMybricksJsonWithInlineImages;
  window.comToMybricksJson = comToMybricksJson;
  window.elementToMybricksJson = elementToMybricksJson;
  window.elementToMybricksJsonWithInlineImages = elementToMybricksJsonWithInlineImages;
  window.getCssRulesBySelector = getCssRulesBySelector;
  window.getMergedCssRulesFromStyleElements = getMergedCssRulesFromStyleElements;
  window.getShadowHost = getShadowHost;
  window.resolveFrameRoot = resolveFrameRoot;
}

// ES module export if supported
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { SHADOW_HOST_ID, domToMybricksJson, comToMybricksJson, elementToMybricksJson, elementToMybricksJsonWithInlineImages, domToMybricksJsonWithInlineImages, comToMybricksJsonWithInlineImages, getCssRulesBySelector, getMergedCssRulesFromStyleElements, getShadowHost, resolveFrameRoot };
}
