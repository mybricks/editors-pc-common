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
    if (Array.isArray(textElemnts) && textElemnts.length === 0) { // 未找到文本元素，隐藏字体配置
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
          disableTextAlign: false,
          ...(isFlexLike ? { textAlignMode: 'flex' } : {}),
        }
      } else {
        fontOption = void 0;
      }
    } else { // 自身或后代包含文本时，稳定展示全部通用字体配置
      fontOption.config = {
        ...(isFlexLike ? { textAlignMode: 'flex' } : {}),
      }
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
      config: {
        disableBorderRadius: shouldBorderRadiusDisabled(selectDom)
      }
    }

    const overflowOption = shouldOverflowDisabled(selectDom) ? void 0 : {
      type: 'overflow',
    }

    const isImgElement = selectDom.tagName.toUpperCase() === 'IMG';

    // 子项弹性：父为 flex/inline-flex 且自身非绝对定位时建议展示
    const parentDom = selectDom.parentElement;
    const parentDisplay = parentDom ? window.getComputedStyle(parentDom).display : '';
    const selfPosition = selectDomStyle.position;
    const flexOption =
      (parentDisplay === 'flex' || parentDisplay === 'inline-flex') &&
      selfPosition !== 'absolute' &&
      selfPosition !== 'fixed'
        ? { type: 'flex' }
        : void 0;

    const suggestion = [
      // 替换元素没有子节点可排，布局面板降级为 display 切换（默认 / 内联）
      isImgElement
        ? { type: 'layout', config: { displayOnly: true } }
        : { type: 'layout' },
      fontOption,
      marginOption,
      paddingOption,
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
      effectsOption,
      {
        type: 'zindex'
      },
      {
        type: 'rotation'
      },
      {
        type: 'position'
      },
      flexOption,
      sizeOption,
      {
        type: 'csspaste'
      }
    ].filter(t => !!t)

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

function shouldMarginDisabled(selectDom: HTMLElement) {
  const selectDomStyle = window.getComputedStyle(selectDom);

  // absolute/fixed/sticky 的 margin 仍会叠加偏移 top/left，需要保留编辑入口
  if (selectDomStyle.display === 'table-header-group' || selectDomStyle.display === 'table-row' || selectDomStyle.display === 'table-cell') {
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
