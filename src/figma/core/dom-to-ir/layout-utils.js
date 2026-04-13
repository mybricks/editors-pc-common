/**
 * ============================================================
 * layout-utils.js  —  Auto Layout 间距 / margin 处理层
 * ============================================================
 * 职责：
 *   - 读取 / 推断节点 margin：getM
 *   - gap 合并后清理子 margin：pruneChildMarginsAfterGapMerge
 *   - 子节点 margin 一致性检查：anyChildHasMargin / childrenHaveUniformMargin
 *   - 均匀 margin → 父级 itemSpacing：applyUniformMarginAsGap
 *   - 由坐标位置反推 itemSpacing：ensureItemSpacingFromPositions
 * 规则：只操作 JSON 节点对象，不直接读取 DOM 属性。
 * ============================================================
 */

function getM(node, side) {
  var s = node.style || {};
  if (side === 'T') return s.marginTop ?? 0;
  if (side === 'R') return s.marginRight ?? 0;
  if (side === 'B') return s.marginBottom ?? 0;
  return s.marginLeft ?? 0;
}

/**
 * 父级已从子项 margin 推断出 itemSpacing 后，删除子项 margin 以免与 Figma Auto Layout 重复。
 * 但若子项在主轴上的 margin 大于 itemSpacing（典型：margin-left/right:auto 吃掉的剩余空间），
 * 必须保留，供消费端识别并关闭父级 Auto Layout，否则换行后第二行会贴左（x 被忽略）。
 * @param {object} parentStyle
 * @param {object} childStyle
 * @param {string} layoutMode 'HORIZONTAL' | 'VERTICAL'
 */
function pruneChildMarginsAfterGapMerge(parentStyle, childStyle, layoutMode) {
  if (!childStyle) return;
  var spacing = parentStyle && parentStyle.itemSpacing != null ? parentStyle.itemSpacing : 0;
  var thresh = spacing + 1;
  var ml0 = childStyle.marginLeft;
  var mr0 = childStyle.marginRight;
  if (layoutMode === 'HORIZONTAL') {
    if (childStyle.marginLeft != null) {
      if (!(childStyle.marginLeft > thresh)) delete childStyle.marginLeft;
    }
    if (childStyle.marginRight != null) {
      if (!(childStyle.marginRight > thresh)) delete childStyle.marginRight;
    }
    if (childStyle.marginTop != null) delete childStyle.marginTop;
    if (childStyle.marginBottom != null) delete childStyle.marginBottom;
  } else if (layoutMode === 'VERTICAL') {
    if (childStyle.marginTop != null) {
      if (!(childStyle.marginTop > thresh)) delete childStyle.marginTop;
    }
    if (childStyle.marginBottom != null) {
      if (!(childStyle.marginBottom > thresh)) delete childStyle.marginBottom;
    }
    if (childStyle.marginLeft != null) delete childStyle.marginLeft;
    if (childStyle.marginRight != null) delete childStyle.marginRight;
  } else {
    if (childStyle.marginTop != null) delete childStyle.marginTop;
    if (childStyle.marginRight != null) delete childStyle.marginRight;
    if (childStyle.marginBottom != null) delete childStyle.marginBottom;
    if (childStyle.marginLeft != null) delete childStyle.marginLeft;
  }
}

/** 任意 flex 流中的子节点存在负值 margin，说明 flex 间距不均匀，不能用 Auto Layout */
function anyChildHasMargin(childNodes) {
  for (var i = 0; i < childNodes.length; i++) {
    var s = childNodes[i].style || {};
    // 绝对定位子节点不参与 flex 流，其 margin 不影响布局，跳过
    if (s.positionType === 'absolute') continue;
    if (s.marginTop < 0 || s.marginRight < 0 || s.marginBottom < 0 || s.marginLeft < 0) return true;
  }
  return false;
}

/** 兄弟之间间距是否均匀（相邻间距 = prev.marginB + curr.marginT 都相同），可合并成 itemSpacing */
function childrenHaveUniformMargin(childNodes, layoutMode) {
  if (childNodes.length <= 1) return true;
  var isVertical = layoutMode === 'VERTICAL';
  var gapBetween = isVertical
    ? getM(childNodes[0], 'B') + getM(childNodes[1], 'T')
    : getM(childNodes[0], 'R') + getM(childNodes[1], 'L');
  for (var i = 1; i < childNodes.length - 1; i++) {
    var g = isVertical
      ? getM(childNodes[i], 'B') + getM(childNodes[i + 1], 'T')
      : getM(childNodes[i], 'R') + getM(childNodes[i + 1], 'L');
    if (g !== gapBetween) return false;
  }
  return true;
}

/** 均匀时把相邻间距并入父级 itemSpacing，并从子节点 style 移除 margin */
function applyUniformMarginAsGap(parentNode, childNodes, layoutMode) {
  if (childNodes.length <= 1) return;
  var sty = parentNode.style || {};
  var isVertical = layoutMode === 'VERTICAL';
  var gapBetween = isVertical
    ? getM(childNodes[0], 'B') + getM(childNodes[1], 'T')
    : getM(childNodes[0], 'R') + getM(childNodes[1], 'L');
  sty.itemSpacing = (sty.itemSpacing || 0) + gapBetween;
  for (var i = 0; i < childNodes.length; i++) {
    var s = childNodes[i].style || {};
    if (s.marginTop != null) delete s.marginTop;
    if (s.marginRight != null) delete s.marginRight;
    if (s.marginBottom != null) delete s.marginBottom;
    if (s.marginLeft != null) delete s.marginLeft;
  }
}

/**
 * 有自动布局时用子节点的实际位置反推间距。
 * 只有所有相邻节点对的间距一致时，才写入 itemSpacing；
 * 若间距不均匀，说明这个 flex 容器本不应保留 Auto Layout，不写入（让调用方降级）。
 */
function ensureItemSpacingFromPositions(parentNode, childNodes, layoutMode) {
  if (childNodes.length < 2) return;
  // 跳过绝对定位节点（如 ::before/::after 伪元素），只取真正参与 flex 流的节点
  var flowNodes = [];
  for (var fi = 0; fi < childNodes.length; fi++) {
    var fs = childNodes[fi].style || {};
    if (fs.positionType !== 'absolute') flowNodes.push(childNodes[fi]);
  }
  if (flowNodes.length < 2) return;
  var isVertical = layoutMode === 'VERTICAL';

  function getPairGap(sa, sb) {
    if (isVertical) {
      var aBottom = (sa.y != null && sa.height != null) ? sa.y + sa.height : null;
      if (aBottom != null && sb.y != null) return Math.round(sb.y - aBottom);
    } else {
      var aRight = (sa.x != null && sa.width != null) ? sa.x + sa.width : null;
      if (aRight != null && sb.x != null) return Math.round(sb.x - aRight);
    }
    return null;
  }

  var firstGap = getPairGap(flowNodes[0].style || {}, flowNodes[1].style || {});
  if (firstGap == null || firstGap <= 0) return;

  // 验证所有相邻对的间距是否与第一对一致，不一致则间距不均匀，不设 itemSpacing
  for (var gi = 1; gi < flowNodes.length - 1; gi++) {
    var g = getPairGap(flowNodes[gi].style || {}, flowNodes[gi + 1].style || {});
    if (g == null || g !== firstGap) return;
  }

  var sty = parentNode.style || {};
  var current = sty.itemSpacing || 0;
  if (firstGap > current) sty.itemSpacing = firstGap;
}


if (typeof module !== 'undefined') {
  module.exports = {
    getM: getM,
    pruneChildMarginsAfterGapMerge: pruneChildMarginsAfterGapMerge,
    anyChildHasMargin: anyChildHasMargin,
    childrenHaveUniformMargin: childrenHaveUniformMargin,
    applyUniformMarginAsGap: applyUniformMarginAsGap,
    ensureItemSpacingFromPositions: ensureItemSpacingFromPositions,
  };
}
