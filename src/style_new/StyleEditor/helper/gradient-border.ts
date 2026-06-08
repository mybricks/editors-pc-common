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
  return initial;
};

export type StyleChangeItem = { key: string; value: any };

/**
 * 从 liveStyle 快照中取出渐变边框层（始终是 backgroundImage 的最后一层）。
 * 当 backgroundOrigin / backgroundClip 不符合双层格式时返回 undefined。
 */
export const getGradientBorderLayerFromStyle = (
  style: Record<string, any>
): string | undefined => {
  if (
    typeof style.backgroundImage === 'string' &&
    style.backgroundOrigin === GRADIENT_BORDER_BOX_VALUE &&
    style.backgroundClip === GRADIENT_BORDER_BOX_VALUE
  ) {
    const layers = splitBackgroundLayers(style.backgroundImage);
    // 边框渐变层始终是最后一层，直接取最后一层，避免 isDefaultWhiteGradientLayer 误过滤
    const lastLayer = layers[layers.length - 1];
    return (layers.length > 1 && isGradientValue(lastLayer)) ? lastLayer : undefined;
  }
  return undefined;
};

/**
 * 当 liveStyle 已存在渐变边框时，保护渐变边框层不被其他面板（Background、颜色等）的
 * onChange 事件覆盖掉。
 *
 * 处理三种情况：
 * 1. 入参已包含完整渐变边框格式（Border 插件主动发来）→ 若当前已有，则只替换边框层，
 *    保留当前内容层，避免 contentBackgroundLayersRef 的初始化时差覆盖用户改过的背景。
 * 2. 入参包含 backgroundImage 变更（Background 面板） → 追加边框层，保持多层格式。
 * 3. 入参只含 backgroundColor 变更，且内容层是占位层 → 同步更新内容层颜色。
 */
export const preserveGradientBorderLayer = (
  items: StyleChangeItem[],
  currentSetValue: Record<string, any>
): StyleChangeItem[] => {
  // Case 1：Border 插件已完整设置渐变边框格式（content + border 双层）
  const incomingAlreadyHasGradientBorderSetup = items.some(
    i => i.key === 'backgroundOrigin' && i.value === GRADIENT_BORDER_BOX_VALUE
  );
  if (incomingAlreadyHasGradientBorderSetup) {
    const currentBgImageLayers = splitBackgroundLayers(currentSetValue.backgroundImage);
    const currentHasGradientBorderFormat =
      currentSetValue.backgroundOrigin === GRADIENT_BORDER_BOX_VALUE &&
      currentSetValue.backgroundClip === GRADIENT_BORDER_BOX_VALUE &&
      currentBgImageLayers.length > 1;
    if (currentHasGradientBorderFormat) {
      // 保留当前内容层，只替换入参中的边框渐变层
      const currentContentLayer = currentBgImageLayers[0];
      return items.map(item => {
        if (item.key !== 'backgroundImage') return item;
        const incomingLayers = splitBackgroundLayers(item.value);
        if (incomingLayers.length < 2) return item;
        const newBorderGradient = incomingLayers[incomingLayers.length - 1];
        return { key: 'backgroundImage', value: `${currentContentLayer}, ${newBorderGradient}` };
      });
    }
    return items;
  }

  const borderLayer = getGradientBorderLayerFromStyle(currentSetValue);
  if (!borderLayer) {
    return items;
  }

  const hasBackgroundImageChange = items.some(item => item.key === 'backgroundImage');
  const hasBackgroundColorChange = items.some(item => item.key === 'backgroundColor');

  if (!hasBackgroundImageChange && !hasBackgroundColorChange) {
    return items;
  }

  const nextBackgroundColor = items.find(item => item.key === 'backgroundColor')?.value
    ?? currentSetValue.backgroundColor
    ?? 'transparent';

  // Case 2：backgroundImage 变更 → 把新的 backgroundImage 作为内容层，追加边框层
  if (hasBackgroundImageChange) {
    return items.flatMap(item => {
      if (item.key !== 'backgroundImage') return [item];
      const contentLayer = item.value && item.value !== 'none'
        ? item.value
        : toSolidBackgroundLayer(nextBackgroundColor);
      return [
        { key: 'backgroundImage', value: `${contentLayer}, ${borderLayer}` },
        { key: 'backgroundOrigin', value: GRADIENT_BORDER_BOX_VALUE },
        { key: 'backgroundClip', value: GRADIENT_BORDER_BOX_VALUE },
      ];
    });
  }

  // Case 3：仅 backgroundColor 变更 —— 内容层是透明/纯色占位时同步更新
  const existingLayers = splitBackgroundLayers(currentSetValue.backgroundImage);
  if (existingLayers.length > 1) {
    const firstLayer = existingLayers[0];
    if (isTransparentSolidLayer(firstLayer) || isSolidColorGradient(firstLayer)) {
      const newContentLayer = toSolidBackgroundLayer(nextBackgroundColor);
      const newBackgroundImage = [newContentLayer, ...existingLayers.slice(1)].join(', ');
      return [
        ...items,
        { key: 'backgroundImage', value: newBackgroundImage },
        { key: 'backgroundOrigin', value: GRADIENT_BORDER_BOX_VALUE },
        { key: 'backgroundClip', value: GRADIENT_BORDER_BOX_VALUE },
      ];
    }
  }

  return items;
};
