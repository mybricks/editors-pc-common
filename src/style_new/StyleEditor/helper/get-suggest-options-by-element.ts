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

    const { getMatchedCssRules } = getMatchedCssRulesWithCache

    // 处理字体相关
    let fontOption: any = {
      type: 'font',
      config: {}
    }
    /** 深层遍历，当前Dom下方所有的带直接文本节点的元素 */
    const textElemnts = findElementsWithDirectTextChildren(selectDom);
    // flex/inline-flex/grid/inline-grid 容器：text-align 无效，需映射到 justify-content
    const selectDomStyle = window.getComputedStyle(selectDom);
    const selectDomDisplay = selectDomStyle.display;
    const isFlexLike = ['flex', 'inline-flex', 'grid', 'inline-grid'].includes(selectDomDisplay);
    // flex 容器也要判断容器是否比内容更宽，不够宽时 justify-content 同样没有视觉效果
    const flexAlignDisabled = isFlexLike && !isContainerWiderThanContent(selectDom);
    if (Array.isArray(textElemnts) && textElemnts.length) { // 有多个文本元素
      // 有文本子元素，判断这些元素中，是否存在所有含文本元素及其父元素都没配置的属性，这些是可以配置的
      const isMoreThanOne = textElemnts.length > 1;
      // 下面默认设置true的为特殊规则
      // 1.text-align在多个子元素中，有特殊性（计算是否足够textAlign的宽度 + 继承规则过于复杂），直接不允许配置
      // 2.fontFamily 和 letterSpacing 虽然可以继承，但是，同时配置多个子元素的情况太少了，直接不允许配置
      // 3. whiteSpace 和 lineHeight 继承规则比较复杂，在多个子元素时同时配置的情况也很少，直接不允许配置
      const inheritDisabledConfig = getInheritedDisabledConfig(selectDom, textElemnts, getMatchedCssRules, isMoreThanOne);
      fontOption.config = {
        disableFontFamily: inheritDisabledConfig.disableFontFamily,
        disableColor: inheritDisabledConfig.disableColor,
        disableFontSize: inheritDisabledConfig.disableFontSize,
        disableFontWeight: inheritDisabledConfig.disableFontWeight,
        disableLetterSpacing: inheritDisabledConfig.disableLetterSpacing,
        disableLineHeight: inheritDisabledConfig.disableLineHeight,
        disableWhiteSpace: inheritDisabledConfig.disableWhiteSpace,
        disableTextAlign: isMoreThanOne ? true : (isFlexLike ? flexAlignDisabled : shouldTextAlignDisabled(selectDom, selectDomStyle)),
        ...(isFlexLike && !isMoreThanOne && !flexAlignDisabled ? { textAlignMode: 'flex' } : {}),
      }
    } else if (Array.isArray(textElemnts) && textElemnts.length === 0) { // 未找到文本元素，隐藏字体配置
      const hasIconChild = !!selectDom.querySelector('svg, .anticon, [role="img"]');
      if (hasIconChild) {
        fontOption.config = {
          disableFontFamily: true,
          disableColor: false,
          disableFontSize: false,
          disableFontWeight: true,
          disableLetterSpacing: true,
          disableLineHeight: true,
          disableWhiteSpace: true,
          disableTextAlign: true,
        }
      } else {
        fontOption = void 0;
      }
    } else { // 本身就是含文本的元素，开启字体配置，除了textAlign需要测量距离
      fontOption.config = {
        disableFontFamily: false,
        disableColor: false,
        disableFontSize: false,
        disableFontWeight: false,
        disableLetterSpacing: false,
        disableLineHeight: false,
        disableWhiteSpace: false,
        disableTextAlign: isFlexLike ? flexAlignDisabled : shouldTextAlignDisabled(selectDom, selectDomStyle),
        ...(isFlexLike && !flexAlignDisabled ? { textAlignMode: 'flex' } : {}),
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

    // 效果（阴影 / 模糊）：模糊不受祖先 overflow 裁切影响，整面板始终建议展示
    // （外阴影在窄裁切容器中可能不可见，但仍可通过面板编辑模糊等效果）
    const effectsOption = {
      type: 'effects',
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
    }

    const overflowOption = shouldOverflowDisabled(selectDom) ? void 0 : {
      type: 'overflow',
    }

    const isImgElement = selectDom.tagName.toUpperCase() === 'IMG';

    const suggestion = [
      isImgElement ? void 0 : {
        type: 'layout'
      },
      fontOption,
      marginOption,
      paddingOption,
      effectsOption,
      {
        type: 'background'
      },
      borderOption,
      {
        type: 'cursor'
      },
      overflowOption,
      {
        type: 'appearance'
      },
      {
        type: 'zindex'
      },
      {
        type: 'rotation'
      },
      sizeOption,
      {
        type: 'csspaste'
      }
    ].filter(t => !!t)

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

const INHERIT_DISABLE_PROPERTY_MAP = {
  disableFontFamily: 'fontFamily',
  disableColor: 'color',
  disableFontSize: 'fontSize',
  disableFontWeight: 'fontWeight',
  disableLetterSpacing: 'letterSpaceing',
  disableLineHeight: 'lineHeight',
  disableWhiteSpace: 'whiteSpace',
} as const;

type InheritDisableKey = keyof typeof INHERIT_DISABLE_PROPERTY_MAP;

function createInheritDisableConfig(isMoreThanOne: boolean) {
  return {
    disableFontFamily: isMoreThanOne,
    disableColor: false,
    disableFontSize: false,
    disableFontWeight: false,
    disableLetterSpacing: isMoreThanOne,
    disableLineHeight: isMoreThanOne,
    disableWhiteSpace: isMoreThanOne,
  };
}

function getInheritedDisabledConfig(
  selectDom: HTMLElement,
  textElemnts: Element[],
  getMatchedCssRules: GetMatchedCssRulesFunctionType,
  isMoreThanOne: boolean
) {
  const disableConfig = createInheritDisableConfig(isMoreThanOne);
  const unresolvedKeys = (Object.keys(INHERIT_DISABLE_PROPERTY_MAP) as InheritDisableKey[]).filter((key) => !disableConfig[key]);

  if (!unresolvedKeys.length) {
    return disableConfig;
  }

  let hasAnyHiddenPath = false;

  for (const element of textElemnts) {
    const doms = getChildDomPath(selectDom, element);

    for (const dom of doms) {
      const domStyle = window.getComputedStyle(dom);
      if (domStyle.visibility === 'hidden' && domStyle.pointerEvents === 'none') {
        hasAnyHiddenPath = true;
        break;
      }

      const cssRules = getMatchedCssRules(dom);
      for (const cssRule of cssRules) {
        let isMatchedBySelectDom = false;
        try {
          isMatchedBySelectDom = selectDom.matches(cssRule.selectorText);
        } catch {
          isMatchedBySelectDom = false;
        }
        if (isMatchedBySelectDom) {
          continue;
        }

        for (const key of unresolvedKeys) {
          if (disableConfig[key]) {
            continue;
          }
          const property = INHERIT_DISABLE_PROPERTY_MAP[key];
          if (cssRule.style[property as any]) {
            disableConfig[key] = true;
          }
        }

        if (unresolvedKeys.every((key) => disableConfig[key])) {
          return disableConfig;
        }
      }
    }

    if (hasAnyHiddenPath) {
      break;
    }
  }

  if (hasAnyHiddenPath) {
    unresolvedKeys.forEach((key) => {
      disableConfig[key] = true;
    });
  }

  return disableConfig;
}

function shouldTextAlignDisabled(
  selectDom: HTMLElement,
  selectDomStyle = window.getComputedStyle(selectDom)
) {

  if (selectDomStyle.display === 'flex' || selectDomStyle.display === 'grid') {
    return true
  }

  const isAllInline = Array.from(selectDom.childNodes).reduce((acc, child) => {
    if (child.nodeType === Node.TEXT_NODE) {
      return acc && true
    } else if (child.nodeType === Node.ELEMENT_NODE) {
      // br 是纯换行符，offsetWidth=0，不影响 textAlign 是否有意义，跳过
      if ((child as HTMLElement).tagName === 'BR') {
        return acc && true
      }

      const childStyle = window.getComputedStyle(child as HTMLElement);

      // TODO，这好像是设计器加的Dom，审查不到
      if (childStyle.position === 'absolute' || childStyle.position === 'fixed') {
        return true
      }

      return childStyle.display === 'inline' || childStyle.display === 'inline-block' || childStyle.display === 'inline-flex' || childStyle.display === 'inline-grid' || childStyle.display === 'inline-table'
    } else {
      return true
    }
  }, true)

  if (!isAllInline) {
    return true
  }

  // 多行文本（lineHeight * 1.5 以上）时，text-align 对每一行都有意义，直接放行
  const lineHeightPx = parseFloat(selectDomStyle.lineHeight);
  if (!isNaN(lineHeightPx) && selectDom.clientHeight > lineHeightPx * 1.5) {
    return false
  }

  // 单行文本：比较容器宽度与内容自然宽度
  if (!isContainerWiderThanContent(selectDom)) {
    return true
  }

  return false
}

/**
 * 检测元素宽度是否大于其内容的自然宽度（内容不换行时所需的最小宽度）。
 * 适用于：文本元素（text-align 是否有意义）和 flex 容器（justify-content 是否有意义）。
 *
 * 原理：临时将元素宽度设为 max-content，读取 offsetWidth（内容自然宽度），立即还原。
 * scrollWidth 永远 >= clientWidth，无法用于此目的。
 */
function isContainerWiderThanContent(element: HTMLElement): boolean {
  const containerWidth = element.clientWidth;
  const savedInlineWidth = element.style.width;
  element.style.width = 'max-content';
  const naturalWidth = element.offsetWidth;
  element.style.width = savedInlineWidth;
  return containerWidth > naturalWidth + 1;
}

function shouldBorderDisabled(selectDom: HTMLElement) {
  return false
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

  if (selectDom.tagName === 'IMG') {
    return true;
  }

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

    if ((parentDomStyle.display === 'flex' || parentDomStyle.display === 'inline-flex') && (
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
  const res: Element[] = []
  let current: Element | null = childElement;

  // 当还没到达当前DOM节点，且仍有父节点时继续向上查找
  while (current && current !== currentDOM) {
    res.push(current)
    current = current.parentElement;
  }

  return res
}

// 定义类型
interface CacheItem {
  rules: CSSStyleRule[];
  timestamp: number;
}

interface StyleSheetCache {
  rules: CSSStyleRule[];
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
  const getAllCssRules = (): CSSStyleRule[] => {
    const now = Date.now();

    // 如果缓存存在且未过期，返回缓存的样式表
    if (styleSheetCache && (now - styleSheetCache.timestamp) < styleSheetCacheTimeout) {
      return styleSheetCache.rules;
    }

    const sheets = Array.from(COSNT.DOCUMENT_ELEMENT.styleSheets);
    const mergedRules: CSSStyleRule[] = [];
    sheets.forEach((sheet) => {
      try {
        const rules = Array.from(sheet.cssRules || sheet.rules);
        rules.forEach((rule) => {
          if (rule instanceof CSSStyleRule) {
            mergedRules.push(rule);
          }
        });
      } catch {}
    });

    // 更新缓存
    styleSheetCache = {
      rules: mergedRules,
      timestamp: now
    };

    return mergedRules;
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

    // 获取所有样式规则（使用缓存）
    const cssRules = getAllCssRules();
    // 查找匹配的规则
    const matchedRules: CSSStyleRule[] = [];
    cssRules.forEach((rule) => {
      try {
        if (element.matches(rule.selectorText)) {
          matchedRules.push(rule);
        }
      } catch {
        // 过滤非法 selectorText
      }
    });

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

const getMatchedCssRulesWithCache = createGetMatchedCssRulesWithCache();
