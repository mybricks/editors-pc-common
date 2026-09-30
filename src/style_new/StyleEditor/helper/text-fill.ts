/**
 * 单层文字填充（Text Fill）工具。
 *
 * 产品语义对齐 Figma TEXT fills：字形填充与容器 Background 分离。
 * CSS：文字侧最多一层（实色支持 color 或 background-color + clip:text；渐变/图走 background-image）。
 * 多角色栈编排见 paint-stack.ts。
 */

import {
  clipHasText,
  composeBackgroundStack,
  decomposeBackgroundStack,
  getBackgroundClip,
  getContentBackgroundColor,
  getTextBackgroundColor,
  isTransparentColor,
} from './paint-stack';
import { splitBackgroundLayers } from './gradient-border';

export type TextFill = {
  type: 'solid' | 'gradient' | 'image';
  value: string;
};

export const isTextFillActive = (style: Record<string, any> = {}): boolean => {
  return clipHasText(getBackgroundClip(style));
};

/** 没有图片层时，clip:text 裁剪的纯色背景就是文字填充。 */
export const getSolidTextFillColor = (style: Record<string, any> = {}): string | undefined => {
  const hasImage = splitBackgroundLayers(style.backgroundImage).some(
    layer => !/^(none|initial|inherit|unset|revert|revert-layer)$/i.test(layer)
  );
  return hasImage ? undefined : getTextBackgroundColor(style, true);
};

/** ColorEditor / Font 回显用的单层显示值 */
export const parseTextFillDisplayValue = (
  style: Record<string, any> = {}
): string => {
  const solid = getSolidTextFillColor(style);
  if (solid) return solid;
  if (isTextFillActive(style)) {
    const { textLayer } = decomposeBackgroundStack(style);
    if (textLayer) return textLayer;
  }
  return style.color || '';
};

export const parseTextFill = (style: Record<string, any> = {}): TextFill => {
  const solid = getSolidTextFillColor(style);
  if (solid) return { type: 'solid', value: solid };
  if (isTextFillActive(style)) {
    const { textLayer } = decomposeBackgroundStack(style);
    if (textLayer) {
      if (textLayer.includes('url(')) {
        return { type: 'image', value: textLayer };
      }
      return { type: 'gradient', value: textLayer };
    }
  }
  return { type: 'solid', value: style.color || '' };
};

export const buildGradientTextFill = (
  gradient: string,
  currentStyle: Record<string, any> = {}
): Record<string, any> => {
  const {
    contentLayers,
    borderLayer,
    contentSizes,
    contentRepeats,
    contentPositions,
  } = decomposeBackgroundStack(currentStyle);
  const stack = composeBackgroundStack({
    textLayer: gradient,
    contentLayers,
    borderLayer,
    backgroundColor: getContentBackgroundColor(currentStyle),
    contentSizes,
    contentRepeats,
    contentPositions,
  });
  return {
    ...(getTextBackgroundColor(currentStyle) ? { backgroundColor: null } : {}),
    color: 'transparent',
    WebkitTextFillColor: 'transparent',
    ...stack,
  };
};

export const buildSolidTextFill = (
  color: string,
  currentStyle: Record<string, any> = {}
): Record<string, any> => {
  // 纯色文字背景改色保留原有绘制方式；空字符串仍表示清除文字填充。
  if (color && getSolidTextFillColor(currentStyle) !== undefined) {
    return { backgroundColor: color };
  }
  // 无文字渐变栈时只写 color，避免误发 background* 删除冲掉容器 background 简写
  if (!isTextFillActive(currentStyle)) {
    return {
      color,
      WebkitTextFillColor: null,
    };
  }

  const {
    contentLayers,
    borderLayer,
    contentSizes,
    contentRepeats,
    contentPositions,
  } = decomposeBackgroundStack(currentStyle);
  const stack = composeBackgroundStack({
    textLayer: undefined,
    contentLayers,
    borderLayer,
    backgroundColor: getContentBackgroundColor(currentStyle),
    contentSizes,
    contentRepeats,
    contentPositions,
  });
  return {
    ...(getTextBackgroundColor(currentStyle) ? { backgroundColor: null } : {}),
    color,
    WebkitTextFillColor: null,
    ...stack,
  };
};

/** 清空独占的文字背景时提交完整属性族，公共清理层才能删除原 background 简写。 */
export const buildTextFillClear = (currentStyle: Record<string, any> = {}): Record<string, any> => {
  const { contentLayers, borderLayer } = decomposeBackgroundStack(currentStyle);
  const clearWholeBackground = isTextFillActive(currentStyle) &&
    contentLayers.length === 0 && !borderLayer &&
    isTransparentColor(getContentBackgroundColor(currentStyle));
  return {
    ...buildSolidTextFill('', currentStyle),
    ...(clearWholeBackground ? { backgroundColor: null, backgroundAttachment: null } : {}),
    color: null,
    WebkitTextFillColor: null,
  };
};
