/**
 * ============================================================
 * shape-detector.js  —  CSS 形状检测层
 * ============================================================
 * 职责：
 *   识别"由 CSS 渲染、无子元素"的纯视觉形状，返回形状描述符。
 *   描述符供 dom-to-json.js 输出 `vector-shape` IR 节点，
 *   该节点在 ir-to-figma.js 直接映射为 Figma VECTOR，无需 FRAME 壳。
 *
 * 扩展方式（不改主流程）：
 *   向 SHAPE_DETECTORS 数组追加新的检测函数即可。
 *   每个检测函数签名：(el, computed, rect) => ShapeDescriptor | null
 *   ShapeDescriptor: {
 *     kind: 'polygon' | 'ellipse' | 'path', // 未来可扩展
 *     points?: Array<{ x: number, y: number }>,  // for 'polygon'
 *     fillColor: string,                          // CSS color string
 *   }
 * ============================================================
 */

function _isTr(c) {
  return !c || c === 'transparent' || c === 'rgba(0, 0, 0, 0)';
}

// ─── 检测器：CSS border 三角形 ────────────────────────────────
//
// 原理：content box 为 0 时，视觉包围盒 = 四边 border 之和。
// 令一对边透明、另一边有色，浏览器渲染出三角形。
//
// 识别条件：
//   ① border 左右宽度之和 ≈ 元素渲染宽度（±1.5px DPR 容忍）
//   ② border 上下宽度之和 ≈ 元素渲染高度（±1.5px DPR 容忍）
//   ③ 恰好一条边有色，其相邻两条边透明
//
function _detectBorderTriangle(el, computed, rect) {
  var blW = parseFloat(computed.borderLeftWidth)  || 0;
  var brW = parseFloat(computed.borderRightWidth) || 0;
  var btW = parseFloat(computed.borderTopWidth)   || 0;
  var bbW = parseFloat(computed.borderBottomWidth)|| 0;
  var bSumW = blW + brW;
  var bSumH = btW + bbW;

  // 视觉尺寸必须 ≈ 四边 border 宽度之和（content box ≈ 0）
  if (bSumW <= 0 || bSumH <= 0) return null;
  if (Math.abs(bSumW - rect.width)  >= 1.5) return null;
  if (Math.abs(bSumH - rect.height) >= 1.5) return null;

  var btT = _isTr(computed.borderTopColor);
  var brT = _isTr(computed.borderRightColor);
  var bbT = _isTr(computed.borderBottomColor);
  var blT = _isTr(computed.borderLeftColor);

  var W = rect.width, H = rect.height;

  // 方向表：[命中条件, 三角顶点, 颜色来源]
  var DIRS = [
    // ► 右指：left 有色，top/bottom 透明
    [!blT && btT && bbT && blW > 0, [{x:0,y:0},{x:0,y:H},{x:W,y:H/2}],    computed.borderLeftColor  ],
    // ◄ 左指：right 有色，top/bottom 透明
    [!brT && btT && bbT && brW > 0, [{x:W,y:0},{x:W,y:H},{x:0,y:H/2}],    computed.borderRightColor ],
    // ▼ 下指：top 有色，left/right 透明
    [!btT && blT && brT && btW > 0, [{x:0,y:0},{x:W,y:0},{x:W/2,y:H}],    computed.borderTopColor   ],
    // ▲ 上指：bottom 有色，left/right 透明
    [!bbT && blT && brT && bbW > 0, [{x:W/2,y:0},{x:0,y:H},{x:W,y:H}],    computed.borderBottomColor],
  ];

  for (var i = 0; i < DIRS.length; i++) {
    if (DIRS[i][0]) {
      return { kind: 'polygon', points: DIRS[i][1], fillColor: DIRS[i][2] };
    }
  }
  return null;
}

// ─── 注册表 ───────────────────────────────────────────────────
// 新增形状类型：在此追加检测函数，无需修改主流程。
// 未来示例：
//   _detectClipPathCircle   — clip-path: circle() / ellipse()
//   _detectConicTriangle    — conic-gradient 三角形
var SHAPE_DETECTORS = [
  _detectBorderTriangle,
];

// ─── 公共入口 ─────────────────────────────────────────────────
/**
 * 对当前元素运行所有已注册的形状检测器。
 * 只考虑「无子元素」的叶节点——有子元素的容器继续走 frame 路径
 * （如带 clip-path 背景的容器，子节点依然参与布局）。
 *
 * @param {Element}            el       - DOM 元素
 * @param {CSSStyleDeclaration} computed - window.getComputedStyle(el)
 * @param {{ left, top, width, height }} rect - design-space 矩形（来自 getDesignRect）
 * @returns {ShapeDescriptor | null}
 */
function detectCssShape(el, computed, rect) {
  if (!rect || rect.width <= 0 || rect.height <= 0) return null;
  // 有子元素的容器不走 shape 路径（可能有内容布局）
  if (el && el.children && el.children.length > 0) return null;

  for (var i = 0; i < SHAPE_DETECTORS.length; i++) {
    var result = SHAPE_DETECTORS[i](el, computed, rect);
    if (result) return result;
  }
  return null;
}

if (typeof module !== 'undefined') {
  module.exports = {
    detectCssShape:    detectCssShape,
    SHAPE_DETECTORS:   SHAPE_DETECTORS,
  };
}
