/**
 * 多角色背景栈（paint stack）：text / content / border 共用 background-* 属性。
 *
 * 层序约定（background-image 从左到右）：
 *   [text?] + content* + [border?]
 * 并行属性 backgroundSize / Repeat / Position 与 image 层一一对齐。
 */

import {
  GRADIENT_BORDER_BOX_VALUE,
  getEffectiveGradientBorderLayer,
  isGradientValue,
  isSolidColorGradient,
  isTransparentSolidLayer,
  splitBackgroundLayers,
  toSolidBackgroundLayer,
} from './gradient-border';
import type { StyleChangeItem } from './gradient-border';

export type BackgroundStack = {
  textLayer?: string;
  contentLayers: string[];
  borderLayer?: string;
  /** 与 contentLayers 对齐 */
  contentSizes?: string[];
  contentRepeats?: string[];
  contentPositions?: string[];
};

const TRANSPARENT_COLOR_RE =
  /^(transparent|rgba\(\s*0\s*,\s*0\s*,\s*0\s*,\s*0\s*\)|#00000000)$/i;

/** text / border 角色层的并行属性占位，与 Background serializeLayers 约定一致 */
const ROLE_LAYER_SIZE = 'auto';
const ROLE_LAYER_REPEAT = 'no-repeat';
const ROLE_LAYER_POSITION = '0% 0%';

export const isTransparentColor = (color?: string): boolean => {
  if (!color) return true;
  return TRANSPARENT_COLOR_RE.test(color.trim());
};

export const getBackgroundClip = (style: Record<string, any> = {}): string | undefined => {
  const clip =
    style.backgroundClip || style.WebkitBackgroundClip || style.webkitBackgroundClip;
  return typeof clip === 'string' ? clip : undefined;
};

/** clip 列表是否包含 text（支持多值） */
export const clipHasText = (clip?: string): boolean => {
  if (!clip || typeof clip !== 'string') return false;
  return splitBackgroundLayers(clip).some((c) => c.trim() === 'text');
};

const padParallel = (
  values: string[],
  length: number,
  fallback: string
): string[] => {
  const result = values.slice(0, length);
  while (result.length < length) {
    result.push(fallback);
  }
  return result;
};

const joinOrNull = (parts: string[]): string | null =>
  parts.length > 0 ? parts.join(', ') : null;

export const decomposeBackgroundStack = (
  style: Record<string, any> = {}
): BackgroundStack => {
  let layers = splitBackgroundLayers(style.backgroundImage);
  const clips = splitBackgroundLayers(getBackgroundClip(style));
  let sizes = splitBackgroundLayers(style.backgroundSize);
  let repeats = splitBackgroundLayers(style.backgroundRepeat);
  let positions = splitBackgroundLayers(style.backgroundPosition);

  const hasText = clipHasText(getBackgroundClip(style));

  let textLayer: string | undefined;
  if (hasText && layers.length > 0) {
    textLayer = layers[0];
    layers = layers.slice(1);
    sizes = sizes.slice(1);
    repeats = repeats.slice(1);
    positions = positions.slice(1);
  }

  let borderLayer: string | undefined;
  const origin = style.backgroundOrigin;
  const hasBorderOrigin =
    origin === GRADIENT_BORDER_BOX_VALUE ||
    (typeof origin === 'string' &&
      origin.includes('padding-box') &&
      origin.includes('border-box'));
  const hasBorderClip =
    clips.includes('border-box') && clips.includes('padding-box');
  const looksLikeBorder =
    layers.length >= 2 &&
    isGradientValue(layers[layers.length - 1]) &&
    (hasBorderOrigin ||
      hasBorderClip ||
      style.backgroundClip === GRADIENT_BORDER_BOX_VALUE ||
      style.backgroundOrigin === GRADIENT_BORDER_BOX_VALUE);

  if (looksLikeBorder) {
    borderLayer = getEffectiveGradientBorderLayer(layers) || layers[layers.length - 1];
    layers = layers.slice(0, -1);
    if (sizes.length > layers.length) sizes = sizes.slice(0, -1);
    if (repeats.length > layers.length) repeats = repeats.slice(0, -1);
    if (positions.length > layers.length) positions = positions.slice(0, -1);
  }

  const contentLayers = layers.filter((l) => l && l !== 'none' && l !== 'initial');
  // 若 filter 去掉了无效层，并行数组按剩余 content 长度截断/对齐
  const contentSizes = padParallel(sizes, contentLayers.length, ROLE_LAYER_SIZE);
  const contentRepeats = padParallel(repeats, contentLayers.length, ROLE_LAYER_REPEAT);
  const contentPositions = padParallel(
    positions,
    contentLayers.length,
    ROLE_LAYER_POSITION
  );

  return {
    textLayer,
    contentLayers,
    borderLayer,
    contentSizes,
    contentRepeats,
    contentPositions,
  };
};

export const composeBackgroundStack = ({
  textLayer,
  contentLayers,
  borderLayer,
  backgroundColor,
  contentSizes,
  contentRepeats,
  contentPositions,
}: BackgroundStack & { backgroundColor?: string }): Record<string, any> => {
  const images: string[] = [];
  const clips: string[] = [];
  const origins: string[] = [];
  const sizes: string[] = [];
  const repeats: string[] = [];
  const positions: string[] = [];

  if (textLayer) {
    images.push(textLayer);
    clips.push('text');
    origins.push('padding-box');
    sizes.push(ROLE_LAYER_SIZE);
    repeats.push(ROLE_LAYER_REPEAT);
    positions.push(ROLE_LAYER_POSITION);
  }

  const resolvedContents =
    borderLayer && contentLayers.length === 0
      ? [toSolidBackgroundLayer(backgroundColor || 'transparent')]
      : contentLayers;
  const resolvedSizes = padParallel(
    contentSizes || [],
    resolvedContents.length,
    ROLE_LAYER_SIZE
  );
  const resolvedRepeats = padParallel(
    contentRepeats || [],
    resolvedContents.length,
    ROLE_LAYER_REPEAT
  );
  const resolvedPositions = padParallel(
    contentPositions || [],
    resolvedContents.length,
    ROLE_LAYER_POSITION
  );

  if (borderLayer) {
    resolvedContents.forEach((layer, i) => {
      images.push(layer);
      clips.push('padding-box');
      origins.push('padding-box');
      sizes.push(resolvedSizes[i]);
      repeats.push(resolvedRepeats[i]);
      positions.push(resolvedPositions[i]);
    });
    images.push(borderLayer);
    clips.push('border-box');
    origins.push('border-box');
    sizes.push(ROLE_LAYER_SIZE);
    repeats.push(ROLE_LAYER_REPEAT);
    positions.push(ROLE_LAYER_POSITION);
  } else if (resolvedContents.length > 0) {
    resolvedContents.forEach((layer, i) => {
      images.push(layer);
      clips.push('padding-box');
      origins.push('padding-box');
      sizes.push(resolvedSizes[i]);
      repeats.push(resolvedRepeats[i]);
      positions.push(resolvedPositions[i]);
    });
  } else if (textLayer && !isTransparentColor(backgroundColor)) {
    // 单层文字渐变 + 纯色盒子底：多值 clip，让 background-color 走 border-box
    clips.push('border-box');
  }

  if (images.length === 0) {
    return {
      backgroundImage: null,
      backgroundClip: null,
      WebkitBackgroundClip: null,
      backgroundOrigin: null,
      backgroundSize: null,
      backgroundRepeat: null,
      backgroundPosition: null,
    };
  }

  const result: Record<string, any> = {
    backgroundImage: images.join(', '),
    backgroundClip: clips.join(', '),
    WebkitBackgroundClip: clips.join(', '),
    backgroundSize: joinOrNull(sizes),
    backgroundRepeat: joinOrNull(repeats),
    backgroundPosition: joinOrNull(positions),
  };

  if (borderLayer) {
    result.backgroundOrigin = origins.join(', ');
  } else if (textLayer && contentLayers.length > 0) {
    result.backgroundOrigin = origins.join(', ');
  } else {
    // 仅文字渐变（± backgroundColor）时清掉 origin，避免残留边框双层 origin
    result.backgroundOrigin = null;
  }

  return result;
};

/**
 * 从完整 style 中剥离 text / border，只保留容器 content 的 image。
 * 供 Background 面板 parseLayers 使用。
 */
export const getContentBackgroundImage = (
  style: Record<string, any> = {}
): string => {
  const { contentLayers } = decomposeBackgroundStack(style);
  if (!contentLayers.length) return 'none';
  return contentLayers.join(', ');
};

/** content 角色层的 image + 并行属性（已剥离 text/border） */
export const getContentBackgroundMeta = (
  style: Record<string, any> = {}
): {
  backgroundImage: string;
  backgroundSize: string;
  backgroundRepeat: string;
  backgroundPosition: string;
} => {
  const stack = decomposeBackgroundStack(style);
  if (!stack.contentLayers.length) {
    return {
      backgroundImage: 'none',
      backgroundSize: '',
      backgroundRepeat: '',
      backgroundPosition: '',
    };
  }
  return {
    backgroundImage: stack.contentLayers.join(', '),
    backgroundSize: (stack.contentSizes || []).join(', '),
    backgroundRepeat: (stack.contentRepeats || []).join(', '),
    backgroundPosition: (stack.contentPositions || []).join(', '),
  };
};

export const toStyleChangeItems = (
  props: Record<string, any>
): StyleChangeItem[] =>
  Object.entries(props).map(([key, value]) => ({ key, value }));

const STACK_KEYS = new Set([
  'backgroundImage',
  'backgroundClip',
  'WebkitBackgroundClip',
  'backgroundOrigin',
  'backgroundSize',
  'backgroundRepeat',
  'backgroundPosition',
  'WebkitTextFillColor',
  'webkitTextFillColor',
]);

function patchBackgroundItems(
  items: StyleChangeItem[],
  patch: Record<string, any>
): StyleChangeItem[] {
  const patchKeySet = new Set(Object.keys(patch));
  const kept = items.filter(
    (i) => !STACK_KEYS.has(i.key) && !patchKeySet.has(i.key)
  );
  const patched = Object.entries(patch).map(([key, value]) => ({ key, value }));
  return [...kept, ...patched];
}

function contentParallelFromStyle(style: Record<string, any>): Pick<
  BackgroundStack,
  'contentSizes' | 'contentRepeats' | 'contentPositions'
> {
  const stack = decomposeBackgroundStack(style);
  return {
    contentSizes: stack.contentSizes,
    contentRepeats: stack.contentRepeats,
    contentPositions: stack.contentPositions,
  };
}

function contentParallelFromItems(
  items: StyleChangeItem[],
  fallbackStyle: Record<string, any>,
  contentLayerCount: number
): Pick<BackgroundStack, 'contentSizes' | 'contentRepeats' | 'contentPositions'> {
  const getItem = (key: string) => items.find((i) => i.key === key)?.value;
  const hasParallel =
    getItem('backgroundSize') != null ||
    getItem('backgroundRepeat') != null ||
    getItem('backgroundPosition') != null;

  if (!hasParallel) {
    return contentParallelFromStyle(fallbackStyle);
  }

  // Background 写出的并行列表对应纯 content；若长度不匹配则 pad
  return {
    contentSizes: padParallel(
      splitBackgroundLayers(getItem('backgroundSize')),
      contentLayerCount,
      ROLE_LAYER_SIZE
    ),
    contentRepeats: padParallel(
      splitBackgroundLayers(getItem('backgroundRepeat')),
      contentLayerCount,
      ROLE_LAYER_REPEAT
    ),
    contentPositions: padParallel(
      splitBackgroundLayers(getItem('backgroundPosition')),
      contentLayerCount,
      ROLE_LAYER_POSITION
    ),
  };
}

/**
 * 合并保护：Background / Border / Font 互相改写时，按角色保留未编辑层。
 */
export const preservePaintRoles = (
  items: StyleChangeItem[],
  currentSetValue: Record<string, any>
): StyleChangeItem[] => {
  const currentStack = decomposeBackgroundStack(currentSetValue);

  const getItem = (key: string) => items.find((i) => i.key === key);
  const incomingClip = getItem('backgroundClip')?.value;
  const incomingTextFill =
    getItem('WebkitTextFillColor') ?? getItem('webkitTextFillColor');
  const incomingImageItem = getItem('backgroundImage');
  const incomingOrigin = getItem('backgroundOrigin')?.value;

  const isNullishBg = (value: any) =>
    value == null || value === 'none' || value === '';

  const isTextFillUpdate =
    incomingTextFill !== undefined ||
    (typeof incomingClip === 'string' && clipHasText(incomingClip));

  // Border.refresh 会同时把 backgroundImage/Origin/Clip 置 null；
  // Background.reset 只清 image/color/size/repeat/position，不含 origin/clip。
  const originItem = getItem('backgroundOrigin');
  const clipItem = getItem('backgroundClip');
  const isClearingGradientBorderProps =
    !!currentStack.borderLayer &&
    incomingImageItem !== undefined &&
    isNullishBg(incomingImageItem.value) &&
    ((originItem !== undefined && isNullishBg(originItem.value)) ||
      (clipItem !== undefined && isNullishBg(clipItem.value)));

  // Font 写入文字渐变时会带 WebkitTextFillColor:transparent；
  // Border 清渐变但保留文字时通常不带该字段。
  const isFontTextFillWrite =
    incomingTextFill !== undefined &&
    (incomingTextFill.value === 'transparent' ||
      incomingTextFill.value == null);

  const withTextFillIfNeeded = (composed: Record<string, any>, keepText: boolean) =>
    keepText
      ? {
          ...composed,
          color: 'transparent',
          WebkitTextFillColor: 'transparent',
        }
      : composed;

  // ── Border.refresh：显式清掉渐变边框 props，保留 text + content ──
  if (isClearingGradientBorderProps) {
    const composed = composeBackgroundStack({
      textLayer: currentStack.textLayer,
      contentLayers: currentStack.contentLayers,
      borderLayer: undefined,
      backgroundColor: currentSetValue.backgroundColor,
      contentSizes: currentStack.contentSizes,
      contentRepeats: currentStack.contentRepeats,
      contentPositions: currentStack.contentPositions,
    });
    return patchBackgroundItems(
      items,
      withTextFillIfNeeded(composed, !!currentStack.textLayer)
    );
  }

  // ── Font：文字填充写入 ──────────────────────────────────────────
  if (isTextFillUpdate) {
    const incomingHasText = clipHasText(String(incomingClip || ''));
    if (!incomingHasText) {
      const composed = composeBackgroundStack({
        textLayer: undefined,
        contentLayers: currentStack.contentLayers,
        borderLayer: currentStack.borderLayer,
        backgroundColor:
          getItem('backgroundColor')?.value ?? currentSetValue.backgroundColor,
        contentSizes: currentStack.contentSizes,
        contentRepeats: currentStack.contentRepeats,
        contentPositions: currentStack.contentPositions,
      });
      return patchBackgroundItems(items, {
        ...composed,
        WebkitTextFillColor: null,
      });
    }

    const incomingStack = decomposeBackgroundStack({
      backgroundImage: incomingImageItem?.value,
      backgroundClip: incomingClip,
      backgroundOrigin: incomingOrigin,
    });

    // Font 写入：以 live content/border 为准，避免陈旧 value 冲掉。
    // Border 清渐变但保留文字：incoming 无 border，且不是 Font 写入 → 尊重清除。
    const nextBorderLayer = isFontTextFillWrite
      ? currentStack.borderLayer
      : incomingStack.borderLayer;

    const composed = composeBackgroundStack({
      textLayer: incomingStack.textLayer,
      contentLayers: currentStack.contentLayers,
      borderLayer: nextBorderLayer,
      backgroundColor: currentSetValue.backgroundColor,
      contentSizes: currentStack.contentSizes,
      contentRepeats: currentStack.contentRepeats,
      contentPositions: currentStack.contentPositions,
    });

    return patchBackgroundItems(items, {
      ...composed,
      color: 'transparent',
      WebkitTextFillColor: 'transparent',
    });
  }

  // ── Border：完整渐变边框格式 ────────────────────────────────────
  const incomingAlreadyHasGradientBorderSetup = items.some(
    (i) =>
      i.key === 'backgroundOrigin' &&
      (i.value === GRADIENT_BORDER_BOX_VALUE ||
        (typeof i.value === 'string' &&
          i.value.includes('padding-box') &&
          i.value.includes('border-box')))
  );

  if (incomingAlreadyHasGradientBorderSetup) {
    const incomingStack = decomposeBackgroundStack({
      backgroundImage: incomingImageItem?.value,
      backgroundClip: incomingClip ?? GRADIENT_BORDER_BOX_VALUE,
      backgroundOrigin: incomingOrigin ?? GRADIENT_BORDER_BOX_VALUE,
    });
    const contentLayers =
      currentStack.contentLayers.length > 0
        ? currentStack.contentLayers
        : incomingStack.contentLayers;
    const composed = composeBackgroundStack({
      textLayer: currentStack.textLayer,
      contentLayers,
      borderLayer: incomingStack.borderLayer,
      backgroundColor: currentSetValue.backgroundColor,
      contentSizes:
        currentStack.contentLayers.length > 0
          ? currentStack.contentSizes
          : incomingStack.contentSizes,
      contentRepeats:
        currentStack.contentLayers.length > 0
          ? currentStack.contentRepeats
          : incomingStack.contentRepeats,
      contentPositions:
        currentStack.contentLayers.length > 0
          ? currentStack.contentPositions
          : incomingStack.contentPositions,
    });
    return patchBackgroundItems(
      items,
      withTextFillIfNeeded(composed, !!currentStack.textLayer)
    );
  }

  // ── Background：改 image / color / 并行属性时保住 text + border ─
  const hasBackgroundImageChange = items.some((i) => i.key === 'backgroundImage');
  const hasBackgroundColorChange = items.some((i) => i.key === 'backgroundColor');
  const hasParallelChange = items.some(
    (i) =>
      i.key === 'backgroundSize' ||
      i.key === 'backgroundRepeat' ||
      i.key === 'backgroundPosition'
  );

  if (!hasBackgroundImageChange && !hasBackgroundColorChange && !hasParallelChange) {
    return items;
  }

  if (!currentStack.textLayer && !currentStack.borderLayer) {
    return items;
  }

  const nextBackgroundColor =
    getItem('backgroundColor')?.value ??
    currentSetValue.backgroundColor ??
    'transparent';

  if (hasBackgroundImageChange || hasParallelChange) {
    const raw = hasBackgroundImageChange
      ? incomingImageItem?.value
      : currentStack.contentLayers.join(', ') || 'none';
    let contentLayers: string[] = [];
    if (raw && raw !== 'none') {
      const parsed = decomposeBackgroundStack({
        backgroundImage: raw,
        backgroundClip: undefined,
        backgroundOrigin: undefined,
      });
      contentLayers =
        parsed.contentLayers.length > 0
          ? parsed.contentLayers
          : splitBackgroundLayers(raw);
      if (
        currentStack.textLayer &&
        contentLayers[0] === currentStack.textLayer
      ) {
        contentLayers = contentLayers.slice(1);
      }
    }

    const parallel = contentParallelFromItems(
      items,
      currentSetValue,
      contentLayers.length
    );

    const composed = composeBackgroundStack({
      textLayer: currentStack.textLayer,
      contentLayers,
      borderLayer: currentStack.borderLayer,
      backgroundColor: nextBackgroundColor,
      ...parallel,
    });

    return patchBackgroundItems(
      items,
      withTextFillIfNeeded(composed, !!currentStack.textLayer)
    );
  }

  // 仅 backgroundColor：更新纯色占位 content（渐变边框场景）
  if (currentStack.borderLayer && currentStack.contentLayers.length > 0) {
    const first = currentStack.contentLayers[0];
    if (isTransparentSolidLayer(first) || isSolidColorGradient(first)) {
      const newContent = [toSolidBackgroundLayer(nextBackgroundColor)];
      const composed = composeBackgroundStack({
        textLayer: currentStack.textLayer,
        contentLayers: newContent,
        borderLayer: currentStack.borderLayer,
        backgroundColor: nextBackgroundColor,
        contentSizes: [ROLE_LAYER_SIZE],
        contentRepeats: [ROLE_LAYER_REPEAT],
        contentPositions: [ROLE_LAYER_POSITION],
      });
      return patchBackgroundItems(items, composed);
    }
  }

  // 文字渐变 + 仅改 backgroundColor：重写 dual clip
  if (currentStack.textLayer && !currentStack.borderLayer) {
    const composed = composeBackgroundStack({
      textLayer: currentStack.textLayer,
      contentLayers: currentStack.contentLayers,
      borderLayer: undefined,
      backgroundColor: nextBackgroundColor,
      contentSizes: currentStack.contentSizes,
      contentRepeats: currentStack.contentRepeats,
      contentPositions: currentStack.contentPositions,
    });
    return patchBackgroundItems(items, {
      ...composed,
      WebkitTextFillColor: 'transparent',
      color:
        currentSetValue.color === 'transparent'
          ? 'transparent'
          : currentSetValue.color,
    });
  }

  return items;
};
