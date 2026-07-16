/**
 * 单层文字填充（Text Fill）工具。
 *
 * 产品语义对齐 Figma TEXT fills：字形填充与容器 Background 分离。
 * CSS：文字侧最多一层（实色走 color；渐变/图走 background-image + background-clip:text）。
 * 多角色栈编排见 paint-stack.ts。
 */

import {
  clipHasText,
  composeBackgroundStack,
  decomposeBackgroundStack,
  getBackgroundClip,
} from './paint-stack';

export type TextFill = {
  type: 'solid' | 'gradient' | 'image';
  value: string;
};

export const isTextFillActive = (style: Record<string, any> = {}): boolean => {
  return clipHasText(getBackgroundClip(style));
};

/** ColorEditor / Font 回显用的单层显示值 */
export const parseTextFillDisplayValue = (
  style: Record<string, any> = {}
): string => {
  if (isTextFillActive(style)) {
    const { textLayer } = decomposeBackgroundStack(style);
    if (textLayer) return textLayer;
  }
  return style.color || '';
};

export const parseTextFill = (style: Record<string, any> = {}): TextFill => {
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
    backgroundColor: currentStyle.backgroundColor,
    contentSizes,
    contentRepeats,
    contentPositions,
  });
  return {
    color: 'transparent',
    WebkitTextFillColor: 'transparent',
    ...stack,
  };
};

export const buildSolidTextFill = (
  color: string,
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
    textLayer: undefined,
    contentLayers,
    borderLayer,
    backgroundColor: currentStyle.backgroundColor,
    contentSizes,
    contentRepeats,
    contentPositions,
  });
  return {
    color,
    WebkitTextFillColor: null,
    ...stack,
  };
};
