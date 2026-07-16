/**
 * 渐变边框（gradient border）相关的共享工具函数和常量。
 *
 * 实现原理：使用多层 background 模拟渐变边框，搭配 transparent border 和
 * background-origin/clip: padding-box + border-box，兼容 border-radius。
 *
 * CSS 格式：
 *   background-image: <content-layer>, <border-gradient>;
 *   background-origin: padding-box, border-box;
 *   background-clip:   padding-box, border-box;
 *   border: Xpx solid transparent;
 *
 * 跨面板角色保护见 paint-stack.preservePaintRoles（已替代原 preserveGradientBorderLayer）。
 */

/** background-origin / background-clip 双层值的标识字符串 */
export const GRADIENT_BORDER_BOX_VALUE = 'padding-box, border-box';

/** 检测是否是 CSS gradient 值 */
export const isGradientValue = (value?: string): boolean => {
  return typeof value === 'string' &&
    /\b(?:linear|radial|conic|repeating-linear|repeating-radial)-gradient\(/.test(value);
};

/**
 * 括号深度感知的 background-image 多层分割。
 * 例："linear-gradient(a,b), url(x)" → ["linear-gradient(a,b)", "url(x)"]
 */
export const splitBackgroundLayers = (value?: string): string[] => {
  if (!value || value === 'none') {
    return [];
  }
  const layers: string[] = [];
  let depth = 0;
  let start = 0;
  for (let i = 0; i < value.length; i++) {
    const char = value[i];
    if (char === '(') {
      depth++;
    } else if (char === ')') {
      depth = Math.max(0, depth - 1);
    } else if (char === ',' && depth === 0) {
      const layer = value.slice(start, i).trim();
      if (layer) layers.push(layer);
      start = i + 1;
    }
  }
  const last = value.slice(start).trim();
  if (last) layers.push(last);
  return layers;
};

/** 将颜色包裹成内容层占位格式：linear-gradient(color, color) */
export const toSolidBackgroundLayer = (color = 'transparent'): string =>
  `linear-gradient(${color}, ${color})`;

/** 检测是否是透明占位内容层（transparent 或 rgba(0,0,0,0)） */
export const isTransparentSolidLayer = (layer?: string): boolean => {
  if (!layer) return false;
  return /^linear-gradient\(\s*(transparent|rgba\(\s*0\s*,\s*0\s*,\s*0\s*,\s*0\s*\))\s*,\s*(transparent|rgba\(\s*0\s*,\s*0\s*,\s*0\s*,\s*0\s*\))\s*\)$/i
    .test(layer);
};

/**
 * 检测 linear-gradient(X, X) 格式的纯色渐变占位层（两端颜色相同）。
 * 用于区分"渐变边框内容层占位"和"用户真实设置的背景渐变"。
 */
export const isSolidColorGradient = (layer?: string): boolean => {
  if (!layer) return false;
  const trimmed = layer.trim();
  if (!trimmed.toLowerCase().startsWith('linear-gradient(') || !trimmed.endsWith(')')) return false;
  const inner = trimmed.slice('linear-gradient('.length, -1);
  let depth = 0;
  let splitIdx = -1;
  for (let i = 0; i < inner.length; i++) {
    const c = inner[i];
    if (c === '(') depth++;
    else if (c === ')') depth--;
    else if (c === ',' && depth === 0) {
      if (splitIdx === -1) splitIdx = i;
      else return false; // 3 个及以上停靠点，不是纯色
    }
  }
  if (splitIdx === -1) return false;
  return inner.slice(0, splitIdx).trim() === inner.slice(splitIdx + 1).trim();
};

/**
 * 过滤 ColorEditor 初始默认白色渐变——这是拾色器未设置时的占位值，
 * 不应被误认为是真实的渐变边框。
 */
export const isDefaultWhiteGradientLayer = (layer?: string): boolean => {
  if (!layer) return false;
  const n = layer.replace(/\s+/g, '').toLowerCase();
  return n === 'linear-gradient(90deg,rgba(255,255,255,1)0%,rgba(255,255,255,1)100%)'
    || n === 'linear-gradient(90deg,rgb(255,255,255)0%,rgb(255,255,255)100%)';
};

/**
 * 从多层 backgroundImage 中找出有效的渐变边框层。
 * 跳过默认白色占位层，优先从末尾往前找。
 */
export const getEffectiveGradientBorderLayer = (layers: string[]): string | undefined => {
  for (let i = layers.length - 1; i >= 0; i--) {
    const layer = layers[i];
    if (isGradientValue(layer) && !isDefaultWhiteGradientLayer(layer)) {
      return layer;
    }
  }
  return layers.find(isGradientValue);
};

// ---------------------------------------------------------------------------
// Style 组件初始化 / handleChange 级别的保护逻辑
// ---------------------------------------------------------------------------

/**
 * 构建 liveStyleRef 的初始值。
 *
 * 面板切换后 Style 组件重挂载时，value.get()（setValue）可能不返回 backgroundImage，
 * 但 defaultValue 源自 DOM computedStyle，能正确反映当前渐变边框状态。
 * 当 setValue 缺少渐变边框属性而 defaultValue 有时，从 defaultValue 补充，
 * 防止重挂载后丢失已设置的渐变边框。
 *
 * @param initial  已 deepCopy 过的 setValue，作为基础数据
 * @param dv       defaultValue（来自 DOM computedStyle）
 */
export const initLiveStyle = (
  initial: Record<string, any>,
  dv: Record<string, any>
): Record<string, any> => {
  const missingInInitial = !initial.backgroundImage || initial.backgroundImage === 'none';
  const hasGradientInDefault =
    dv.backgroundImage && dv.backgroundImage !== 'none' && isGradientValue(dv.backgroundImage);

  if (missingInInitial && hasGradientInDefault) {
    initial.backgroundImage = dv.backgroundImage;
    if (dv.backgroundOrigin) initial.backgroundOrigin = dv.backgroundOrigin;
    if (dv.backgroundClip) initial.backgroundClip = dv.backgroundClip;
    if (dv.backgroundColor && !initial.backgroundColor) initial.backgroundColor = dv.backgroundColor;
  }

  // 文字渐变：setValue 可能缺 clip/text-fill，从 defaultValue（DOM）补齐
  // 用 splitBackgroundLayers 判断 text，与 paint-stack.clipHasText 语义一致（避免循环依赖）
  const dvClip = dv.backgroundClip || dv.WebkitBackgroundClip || dv.webkitBackgroundClip;
  const initialClip =
    initial.backgroundClip || initial.WebkitBackgroundClip || initial.webkitBackgroundClip;
  const clipListHasText = (clip?: string) =>
    typeof clip === 'string' &&
    splitBackgroundLayers(clip).some((c) => c.trim() === 'text');
  if (clipListHasText(dvClip) && !clipListHasText(initialClip)) {
    if (dv.backgroundImage) initial.backgroundImage = dv.backgroundImage;
    if (dvClip) {
      initial.backgroundClip = dvClip;
      initial.WebkitBackgroundClip = dvClip;
    }
    const textFill =
      dv.WebkitTextFillColor || dv.webkitTextFillColor || 'transparent';
    initial.WebkitTextFillColor = textFill;
    if (dv.color !== undefined) initial.color = dv.color;
    if (dv.backgroundOrigin) initial.backgroundOrigin = dv.backgroundOrigin;
    if (dv.backgroundSize) initial.backgroundSize = dv.backgroundSize;
    if (dv.backgroundRepeat) initial.backgroundRepeat = dv.backgroundRepeat;
    if (dv.backgroundPosition) initial.backgroundPosition = dv.backgroundPosition;
  }

  return initial;
};

export type StyleChangeItem = { key: string; value: any };
