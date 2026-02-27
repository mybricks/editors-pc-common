const COSNT = {
  /** 当前页面的文档节点，用于获取样式表 */
  get DOCUMENT_ELEMENT() {
    return (document.getElementById('_mybricks-geo-webview_')?.shadowRoot || document) as Document;
  },
  /** 当前页面的根节点 */
  get ROOT_ELEMENT() {
    const shaodwnRoot = document.getElementById('_mybricks-geo-webview_')?.shadowRoot;
    return (shaodwnRoot?.querySelector('#_geoview-wrapper_') || shaodwnRoot || document.body) as HTMLElement;
  }
}

/**
 * @description 根据Dom元素，获取哪些样式可以配置，可用于Style编辑器
 * @param selectDom 
 * @returns 
 */
export function getSuggestOptionsByElement(selectDom: HTMLElement): { type: string, config?: any }[] | void {
  if (!selectDom || !selectDom.getBoundingClientRect) {
    console.warn(`getSuggestOptions failed，because selectDom is not valid`, selectDom)
    return
  }

  try {
    // const startTime = new Date().getTime();

    const { getMatchedCssRules, cleanCache } = createGetMatchedCssRulesWithCache()

    // 处理字体相关
    let fontOption: any = {
      type: 'font',
      config: {}
    }
    /** 深层遍历，当前Dom下方所有的带直接文本节点的元素 */
    const textElemnts = findElementsWithDirectTextChildren(selectDom);
    if (Array.isArray(textElemnts) && textElemnts.length) { // 有多个文本元素
      // 有文本子元素，判断这些元素中，是否存在所有含文本元素及其父元素都没配置的属性，这些是可以配置的
      const isMoreThanOne = textElemnts.length > 1;
      // 下面默认设置true的为特殊规则
      // 1.text-align在多个子元素中，有特殊性（计算是否足够textAlign的宽度 + 继承规则过于复杂），直接不允许配置
      // 2.fontFamily 和 letterSpacing 虽然可以继承，但是，同时配置多个子元素的情况太少了，直接不允许配置
      // 3. whiteSpace 和 lineHeight 继承规则比较复杂，在多个子元素时同时配置的情况也很少，直接不允许配置
      fontOption.config = {
        disableFontFamily: isMoreThanOne ? true : shouldHeritPropertyDisabled(selectDom, 'fontFamily', { getMatchedCssRules, textElemnts }),
        disableColor: shouldHeritPropertyDisabled(selectDom, 'color', { getMatchedCssRules, textElemnts }),
        disableFontSize: shouldHeritPropertyDisabled(selectDom, 'fontSize', { getMatchedCssRules, textElemnts }),
        disableFontWeight: shouldHeritPropertyDisabled(selectDom, 'fontWeight', { getMatchedCssRules, textElemnts }),
        disableLetterSpacing: isMoreThanOne ? true : shouldHeritPropertyDisabled(selectDom, 'letterSpaceing', { getMatchedCssRules, textElemnts }),
        disableLineHeight: isMoreThanOne ? true : shouldHeritPropertyDisabled(selectDom, 'lineHeight', { getMatchedCssRules, textElemnts }),
        disableWhiteSpace: isMoreThanOne ? true : shouldHeritPropertyDisabled(selectDom, 'whiteSpace', { getMatchedCssRules, textElemnts }),
        disableTextAlign: isMoreThanOne ? true : shouldTextAlignDisabled(selectDom),
      }
    } else if (Array.isArray(textElemnts) && textElemnts.length === 0) { // 未找到文本元素，隐藏字体配置
      fontOption = void 0;
    } else { // 本身就是含文本的元素，开启字体配置，除了textAlign需要测量距离
      fontOption.config = {
        disableFontFamily: false,
        disableColor: false,
        disableFontSize: false,
        disableFontWeight: false,
        disableLetterSpacing: false,
        disableLineHeight: false,
        disableWhiteSpace: false,
        disableTextAlign: shouldTextAlignDisabled(selectDom),
      }
    }
    // 全部都disabled的话，直接隐藏
    if (fontOption?.config && Object.keys(fontOption.config).every(c => !!fontOption.config[c])) {
      fontOption = void 0;
    }

    // 处理size
    const sizeDisabled = shouldSizeDisabled(selectDom);

    const isAllSizeDisabled = [sizeDisabled.disableWidth, sizeDisabled.disableHeight].every(t => !!t);
    const sizeOption = isAllSizeDisabled ? void 0 : {
      type: 'size',
      config: sizeDisabled,
    }

    // 处理boxShadow
    const boxShadowOption = shouldBoxshadowDisabled(selectDom) ? void 0 : {
      type: 'boxShadow',
    }

    // 处理margin
    const marginDisabled = shouldMarginDisabled(selectDom);
    const isAllMarginDisabled = [marginDisabled.disableMarginTop, marginDisabled.disableMarginRight, marginDisabled.disableMarginBottom, marginDisabled.disableMarginLeft].every(t => !!t);
    const marginOption = isAllMarginDisabled ? void 0 : {
      type: 'margin',
      config: marginDisabled
    }

    // 处理paddding
    const paddingOption = shouldPaddingDisabled(selectDom) ? void 0 : {
      type: 'padding',
    }

    // 处理border
    const borderOption = shouldBorderDisabled(selectDom) ? void 0 : {
      type: 'border',
      config: {
        disableBorderRadius: shouldBorderRadiusDisabled(selectDom)
      }
    }

    const overflowOption = shouldOverflowDisabled(selectDom) ? void 0 : {
      type: 'overflow',
    }

    const suggestion = [
      {
        type: 'layout'
      },
      fontOption,
      marginOption,
      paddingOption,
      boxShadowOption,
      {
        type: 'background'
      },
      borderOption,
      {
        type: 'cursor'
      },
      overflowOption,
      {
        type: 'opacity'
      },
      sizeOption
    ].filter(t => !!t)

    // 清理缓存
    cleanCache();

    // console.log('result', ...suggestion, new Date().getTime() - startTime)

    return suggestion
  } catch (error) {
    console.error(`getSuggestOptions error`, error)
  }
}


type SuggestProperties = Array<'width' | 'height' | 'marginLeft' | 'marginRight' | 'marginBottom' | 'marginTop'>;

/**
 * @description 获取当前Dom可被修改的 尺寸 和 margin 属性，可被修改则会被返回
 * @param selectDom
 * @returns 
 */
export function getEditableCssPropertiesByElement(selectDom: HTMLElement): SuggestProperties {
  if (!selectDom || !selectDom.getBoundingClientRect) {
    console.warn(`getEditableCssPropertiesByElement failed，because selectDom is not valid`, selectDom)
    return []
  }

  const marginDisabled = shouldMarginDisabled(selectDom);
  const sizeDisabled = shouldSizeDisabled(selectDom);

  const result: SuggestProperties = []

  if (!sizeDisabled.disableWidth) {
    result.push('width')
  }
  if (!sizeDisabled.disableHeight) {
    result.push('height')
  }
  if (!marginDisabled.disableMarginTop) {
    result.push('marginTop')
  }
  if (!marginDisabled.disableMarginBottom) {
    result.push('marginBottom')
  }
  if (!marginDisabled.disableMarginLeft) {
    result.push('marginLeft')
  }
  if (!marginDisabled.disableMarginRight) {
    result.push('marginRight')
  }

  return result
}


type GetMatchedCssRulesFunctionType = (dom: HTMLElement | Element) => CSSStyleRule[]

function shouldHeritPropertyDisabled(selectDom: HTMLElement, property: string, { textElemnts, getMatchedCssRules }: {
  getMatchedCssRules: GetMatchedCssRulesFunctionType,
  textElemnts: Element[]
}) {
  let hasSetting = false;
  textElemnts.forEach(element => {
    const doms = getChildDomPath(selectDom, element);

    // TODO，如果出现元素被隐藏的话，认为不可编辑
    if (doms.some(dom => {
      const domStyle = window.getComputedStyle(dom)
      return domStyle.visibility === 'hidden' && domStyle.pointerEvents === 'none'
    })) {
      return hasSetting = true
    }

    return doms.some(dom => {
      const cssRules = getMatchedCssRules(dom)
      hasSetting = hasSetting || cssRules.some(cssRule => {
        if (dom.matches(cssRule.selectorText)) {
          /** 当前Dom是否被配置了样式 */
          let isConfig = false
          switch (true) {
            default: {
              isConfig = !!cssRule.style[property]
              break
            }
          }
          // 文本子元素被配置 同时 selectDom 中也不命中这个规则（selectDom命中的话，说明是*或者其他的通用匹配，匹配到了selectDom和下方所有子元素，这种就应该可以覆盖）
          return !!isConfig && !selectDom.matches(cssRule.selectorText)
        }
        return false
      })

      return hasSetting
    })
  })
  return hasSetting
}


function shouldTextAlignDisabled(selectDom: HTMLElement) {
  let totalChildrenWidth = 0;

  const selectDomStyle = window.getComputedStyle(selectDom);

  if (selectDomStyle.display === 'flex' || selectDomStyle.display === 'grid') {
    return true
  }

  const isAllInline = Array.from(selectDom.childNodes).reduce((acc, child) => {
    if (child.nodeType === Node.TEXT_NODE) {
      totalChildrenWidth += calculateTextNodeWidth(child)
      return acc && true
    } else if (child.nodeType === Node.ELEMENT_NODE) {
      const childStyle = window.getComputedStyle(child as HTMLElement);

      // TODO，这好像是设计器加的Dom，审查不到
      if (childStyle.position === 'absolute' || childStyle.position === 'fixed') {
        return true
      }

      totalChildrenWidth += (child as HTMLElement).offsetWidth;
      return childStyle.display === 'inline' || childStyle.display === 'inline-block' || childStyle.display === 'inline-flex' || childStyle.display === 'inline-grid' || childStyle.display === 'inline-table'
    } else {
      return true
    }
  }, true)

  if (!isAllInline) {
    return true
  }

  return calculateDomInnerWidth(selectDom) - totalChildrenWidth <= 4
}

function shouldBorderDisabled(selectDom: HTMLElement) {
  return false
}

function shouldBorderRadiusDisabled(selectDom: HTMLElement) {
  // 先放开吧，感觉overflow的case没那么多
  return false

  const selectDomStyle = window.getComputedStyle(selectDom);

  const noOverflow = selectDomStyle.overflowX !== 'hidden' && selectDomStyle.overflowY !== 'hidden'

  const computedStyle = window.getComputedStyle(selectDom);

  // 获取border宽度
  const borderTopLeftRadius = parseInt(computedStyle.borderTopLeftRadius);
  const borderTopRightRadius = parseInt(computedStyle.borderTopRightRadius);
  const borderBottomLeftRadius = parseInt(computedStyle.borderBottomLeftRadius);
  const borderBottomRightRadius = parseInt(computedStyle.borderBottomRightRadius);

  // [TODO] 粗暴一点，如果没有border 且不是 overflow:hidden 就禁用，否则性能太差了
  return noOverflow && borderTopLeftRadius === 0 && borderTopRightRadius === 0 && borderBottomLeftRadius === 0 && borderBottomRightRadius === 0
}

function shouldBoxshadowDisabled(selectDom: HTMLElement) {
  let hasEnoughSpace = true;
  const selectDomRect = selectDom.getBoundingClientRect();
  traverseDomFromChildToCurrent(COSNT.ROOT_ELEMENT, selectDom, (current) => {
    if (current === selectDom) {
      return false
    }

    const isOverflow = window.getComputedStyle(current).overflow === 'hidden';
    if (isOverflow) {
      const currentRect = current.getBoundingClientRect();
      if (currentRect.top - selectDomRect.top >= 0 && currentRect.bottom - selectDomRect.bottom <= 0 && currentRect.left - selectDomRect.left >= 0 && currentRect.right - selectDomRect.right <= 0) {
        hasEnoughSpace = false
      }
    }
    // 如果当前元素没有足够的空间，则中止遍历
    return !hasEnoughSpace
  })

  return !hasEnoughSpace
}

function shouldMarginDisabled(selectDom: HTMLElement) {
  const selectDomStyle = window.getComputedStyle(selectDom);

  if (selectDomStyle.display === 'table-header-group' || selectDomStyle.display === 'table-row' || selectDomStyle.display === 'table-cell' || selectDomStyle.position === 'absolute' || selectDomStyle.position === 'fixed' || selectDomStyle.position === 'sticky') {
    return {
      disableMarginLeft: true,
      disableMarginRight: true,
      disableMarginTop: true,
      disableMarginBottom: true
    }
  }

  if (selectDomStyle.display === 'inline') {
    return {
      disableMarginLeft: false,
      disableMarginRight: false,
      disableMarginTop: true,
      disableMarginBottom: true
    }
  }

  return {
    disableMarginLeft: false,
    disableMarginRight: false,
    disableMarginTop: false,
    disableMarginBottom: false
  }
}

function shouldPaddingDisabled(selectDom: HTMLElement) {
  let cannotSetPadding = false

  const selectDomStyle = window.getComputedStyle(selectDom);
  function isFixedSize(value: string) {
    // 1. 具体的数值单位（px, em, rem, vh, vw等）
    if (/^[0-9]+(\.[0-9]+)?(px|em|rem|vh|vw|pt|pc|cm|mm|in)$/.test(value)) {
      return true;
    }
    // 2. 百分比值
    if (/^[0-9]+(\.[0-9]+)?%$/.test(value)) {
      return true;
    }
    // 3. 特定的关键字
    const nonAutoValues = [
      'max-content',
    ];
    return nonAutoValues.includes(value);
  }

  // 检查是否有非空的文本节点
  function hasNonEmptyTextNode(element: Element) {
    // 获取元素的直接子节点
    const childNodes = Array.from(element.childNodes);
    return childNodes.some(node => {
      // 检查是否是文本节点且内容不为空
      return node.nodeType === Node.TEXT_NODE && node.textContent?.trim() !== '';
    });
  }

  // 检查是否有可见的伪元素
  function hasVisiblePseudoElement(element: Element) {
    const before = window.getComputedStyle(element, ':before');
    const after = window.getComputedStyle(element, ':after');
    
    return (
      before.content !== 'none' && before.content !== '""' ||
      after.content !== 'none' && after.content !== '""'
    );
  }

  if (isFixedSize(selectDomStyle.width + '') && isFixedSize(selectDomStyle.height + '')) {

    // 检查是否有非空文本内容
    const hasText = hasNonEmptyTextNode(selectDom);
    
    // 检查是否有可见的伪元素
    const hasPseudo = hasVisiblePseudoElement(selectDom);

    // 如果没有文本内容和，则检查子元素
    if (!hasText && !hasPseudo) {
      const childrenDoms = Array.from(selectDom.children)
  
      const allChildrenAbsolute = childrenDoms.length > 0 && childrenDoms.every(child => {
        const childStyle = window.getComputedStyle(child);
        return childStyle.position === 'absolute' || childStyle.position === 'fixed';
      });
  
      if (allChildrenAbsolute) {
        cannotSetPadding = true
      }
    }
  }

  return cannotSetPadding
}

function shouldSizeDisabled(selectDom: HTMLElement) {
  const selectDomStyle = window.getComputedStyle(selectDom);

  if (selectDomStyle.display === 'inline') {
    return {
      disableWidth: true,
      disableHeight: true
    }
  }

  const parentDom = selectDom.parentElement as HTMLElement;
  if (parentDom) {
    const parentDomStyle = window.getComputedStyle(parentDom);

    if (parentDomStyle.display === 'flex' && (
      (!isNaN(parseFloat(selectDomStyle.flexGrow)) && parseFloat(selectDomStyle.flexGrow) > 0) || // flex-grow > 0
      !['0', '1'].includes(selectDomStyle.flexShrink) || // flex-shrink !== 0或1，此时空间收缩不忠于宽度配置，=== 0或1 的话会忠于宽度配置
      !['auto'].includes(selectDomStyle.flexBasis) // 子元素宽度被flex-basis覆盖，auto是默认值
    )) {

      // 考虑竖向排列的情况
      const isColumnDirection = parentDomStyle.flexDirection.includes('column');

      return {
        disableWidth: isColumnDirection ? false : true,
        disableHeight: isColumnDirection ? true : false
      }
    }
  }

  return {
    disableWidth: false,
    disableHeight: false
  }
}

function shouldOverflowDisabled(selectDom: HTMLElement) {
  // 定义不需要overflow的特殊标签
  const specialTags = [
    'SVG',
    'IMAGE',
    'IMG',
    'INPUT',
    'TEXTAREA',
    'VIDEO',
    'CANVAS',
    'IFRAME'
  ];

  // 检查是否是特殊标签
  if (specialTags.includes(selectDom.tagName.toUpperCase())) {
    return true;
  }

  return !selectDom.hasChildNodes() ||
    (selectDom.childNodes.length === 1 &&
      selectDom.firstChild instanceof Text &&
      selectDom.firstChild.nodeValue?.trim() === '');
}


/**
 * @description 找出当前Dom下方的所有带直接文本节点的Dom，注意是深层次的
 * @param element 
 * @returns 
 */
function findElementsWithDirectTextChildren(element: HTMLElement) {
  if (Array.from(element.childNodes).some(node =>
    node.nodeType === Node.TEXT_NODE && node.nodeValue && node.nodeValue.trim() !== ''
  )) {
    return element
  }
  // 选择所有不包含其他元素的节点，css选择器性能更好
  const leafElements = element.querySelectorAll(':not(:empty):not(:has(*))');

  if (element.tagName === 'INPUT' || element.tagName === 'TEXTAREA') {
    return void 0
  }

  // 过滤出只包含文本内容的元素
  return Array.from(leafElements).filter(el =>
    Array.from(el.childNodes).some(node =>
      node.nodeType === Node.TEXT_NODE && node.nodeValue && node.nodeValue.trim() !== ''
    ) || el.tagName === 'INPUT' || el.tagName === 'TEXTAREA'
  );
}

function getChildDomPath(currentDOM: HTMLElement, childElement: Element) {
  let res = []

  let current = childElement;

  // 当还没到达当前DOM节点，且仍有父节点时继续向上查找
  while (current && current !== currentDOM) {
    res.push(current)
    current = current.parentElement;
  }

  return res
}

function traverseDomFromChildToCurrent(
  currentDOM: HTMLElement,
  childElement: Element,
  callback: (current: HTMLElement) => boolean | void
) {
  if (!callback || typeof callback !== 'function') {
    return;
  }

  let current = childElement;

  // 当还没到达当前DOM节点，且仍有父节点时继续向上查找
  while (current && current !== currentDOM) {
    // 如果回调返回 true，则中止遍历
    if (callback(current) === true) {
      return;
    }
    current = current.parentElement;
  }
}


/** 计算Dom内部剩余可以布局的宽度 */
function calculateDomInnerWidth(element: HTMLElement) {
  const computedStyle = window.getComputedStyle(element);

  // 获取元素的总宽度
  const totalWidth = element.offsetWidth;

  // 获取padding和border的宽度
  const paddingLeft = parseFloat(computedStyle.paddingLeft) || 0;
  const paddingRight = parseFloat(computedStyle.paddingRight) || 0;
  const borderLeft = parseFloat(computedStyle.borderLeftWidth) || 0;
  const borderRight = parseFloat(computedStyle.borderRightWidth) || 0;

  // 根据box-sizing计算实际的内部可用宽度
  const boxSizing = computedStyle.boxSizing;

  if (boxSizing === 'border-box') {
    // border-box模式下需要减去padding和border
    return totalWidth - paddingLeft - paddingRight - borderLeft - borderRight;
  } else {
    // content-box模式下offsetWidth已经不包含padding和border
    return totalWidth;
  }
}


/**
 * @description 计算文本节点的宽度
 * @param textNode 
 * @returns 
 */
function calculateTextNodeWidth(textNode: Node) {
  // 参数校验
  if (!textNode || textNode.nodeType !== Node.TEXT_NODE) {
    return 0
  }

  // Range API
  if (typeof document.createRange === 'function') {
    const range = document.createRange();
    range.selectNodeContents(textNode);
    const rects = range.getClientRects();
    let width = 0;

    // 处理可能的换行情况，累加所有 rect 的宽度
    for (let i = 0; i < rects.length; i++) {
      width += rects[i].width;
    }

    range.detach();
    return Math.round(width * 100) / 100;
  }

  // Canvas计算
  const canvas = document.createElement('canvas');
  const context = canvas.getContext('2d');
  const text = textNode.textContent;

  if (context && text) {
    // 获取文本节点的计算样式
    const computedStyle = window.getComputedStyle(textNode.parentElement as Element);
    const font = [
      computedStyle.fontStyle,
      computedStyle.fontVariant,
      computedStyle.fontWeight,
      computedStyle.fontSize,
      computedStyle.fontFamily,
    ].join(' ');

    // 设置 canvas 字体并测量
    context.font = font;
    const width = context.measureText(text).width;

    // 考虑 letter-spacing 的影响
    const letterSpacing = parseFloat(computedStyle.letterSpacing);
    if (!isNaN(letterSpacing) && letterSpacing > 0) {
      return Math.round((width + (text.length - 1) * letterSpacing) * 100) / 100;
    }

    return Math.round(width * 100) / 100;
  }

  return 0;
}


// 定义类型
interface CacheItem {
  rules: CSSStyleRule[];
  timestamp: number;
}

interface StyleSheetCache {
  sheets: CSSStyleSheet[];
  timestamp: number;
}

/**
 * @description 通过缓存优化创建匹配Dom的CSS规则方法
 * @param cacheTimeout 
 * @param styleSheetCacheTimeout 
 * @returns 
 */
function createGetMatchedCssRulesWithCache(cacheTimeout = 5000, styleSheetCacheTimeout = 30000) {
  // 使用 WeakMap 存储元素规则缓存
  let rulesCache = new WeakMap<Element, CacheItem>();

  // 样式表缓存
  let styleSheetCache: StyleSheetCache | null = null;

  // 获取所有样式表（带缓存）
  const getAllStyleSheets = (): CSSStyleSheet[] => {
    const now = Date.now();

    // 如果缓存存在且未过期，返回缓存的样式表
    if (styleSheetCache && (now - styleSheetCache.timestamp) < styleSheetCacheTimeout) {
      return styleSheetCache.sheets;
    }

    // 获取新的样式表列表
    const sheets = Array.from(COSNT.DOCUMENT_ELEMENT.styleSheets);

    // 更新缓存
    styleSheetCache = {
      sheets,
      timestamp: now
    };

    return sheets;
  };


  /**
   * @description 获取Dom匹配的CSS规则
   * @param target 
   * @returns 
   */
  const getMatchedCssRules = (target: Element | string): CSSStyleRule[] => {
    // 如果传入的是选择器字符串，先获取元素
    const element = typeof target === 'string'
      ? document.querySelector(target)
      : target;

    if (!element) {
      return [];
    }

    // 检查规则缓存是否存在且未过期
    const now = Date.now();
    const cacheItem = rulesCache.get(element);

    if (cacheItem && (now - cacheItem.timestamp) < cacheTimeout) {
      return cacheItem.rules;
    }

    // 获取所有样式表（使用缓存）
    const styleSheets = getAllStyleSheets();

    // 查找匹配的规则
    const matchedRules = styleSheets.reduce((acc: CSSStyleRule[], sheet) => {
      try {
        const rules = Array.from(sheet.cssRules || sheet.rules);
        const filteredRules = rules
          .filter((rule): rule is CSSStyleRule => rule instanceof CSSStyleRule)
          .filter(rule => {
            try {
              return element.matches(rule.selectorText);
            } catch {
              return false;
            }
          });

        return acc.concat(filteredRules);
      } catch (e) {
        // 处理跨域样式表的错误
        console.warn('Cannot access rules from stylesheet:', e);
        return acc;
      }
    }, []);

    // 更新规则缓存
    rulesCache.set(element, {
      rules: matchedRules,
      timestamp: now
    });

    return matchedRules;
  };

  // 清理缓存的函数
  const cleanCache = () => {
    rulesCache = new WeakMap<Element, CacheItem>();
    styleSheetCache = null;
  };

  return {
    getMatchedCssRules,
    cleanCache
  };
}