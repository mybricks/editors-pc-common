import { CSSProperties } from "react";

const paddingProperties = ['paddingTop', 'paddingRight', 'paddingBottom', 'paddingLeft'];

export function getPaddingValue(style: CSSProperties): number[] {
  const result: number[] = [];

  paddingProperties.forEach((property) => {
    const value = property.match(/\d+/g);
    if (!value || value.length === 0) {
      result.push(0);
    } else {
      result.push(Number(value[0]));
    }
  });

  return result;
}

export function injectPadding(style: any, value: number[]): CSSProperties {
  paddingProperties.forEach((property, index) => {
    style[property] = value[index];
  });

  if (style['padding']) delete style['padding'];

  return style;
}

export function injectFlex(style: any, value: string[]): CSSProperties {

  return style;
}