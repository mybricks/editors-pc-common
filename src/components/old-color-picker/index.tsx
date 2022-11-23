import Sketch from '@mybricks/color-picker';
import React, { useCallback, useMemo } from 'react';
import css from './index.less';

const transparentData = {
  hsl: {
    h: 0,
    s: 0,
    l: 1,
    a: 0,
  },
  hex: '#ffffff',
  rgb: {
    r: 255,
    g: 255,
    b: 255,
    a: 0,
  },
  hsv: {
    h: 0,
    s: 0,
    v: 1,
    a: 0,
  },
  oldHue: 0,
  source: 'hex',
};

export default function (props: {
  color: string;
  presetColors: string[];
  onChangeComplete: (
    color: {
      colorHex: string;
      colorRgba: string;
      colorAlpha: number;
    },
    data: any
  ) => void;
}) {
  const { color, presetColors, onChangeComplete } = props;
  const customOnChangeComplete = useCallback(
    (data: { rgb: any; hex: string }) => {
      const { hex, rgb } = data;
      const { r, g, b, a } = rgb;
      const colorHex = hex;
      const colorRgba = `rgba(${r},${g},${b},${a})`;
      const colorAlpha = Number((a * 100).toFixed(0));
      onChangeComplete(
        {
          colorHex,
          colorRgba,
          colorAlpha,
        },
        data
      );
    },
    []
  );

  // 没找到如何可以自定义快捷选择的颜色块，用了这种方式，后续如果更改presetColors配置，请注意这里
  const RenderTransparentBox: JSX.Element = useMemo(() => {
    return (
      <div
        className={css.colorBoxContainer}
        onClick={() => customOnChangeComplete(transparentData)}
      >
        <span>
          <div className={css.box} title="rgba(255, 255, 255, 0)">
            <div />
            <div />
            <div />
            <div />
          </div>
        </span>
      </div>
    );
  }, []);

  return (
    <>
      {/* <SketchPicker
        onChangeComplete={customOnChangeComplete}
        color={color}
        presetColors={presetColors}
      /> */}
        <Sketch
        color={color}
        onChange={({rgba, hex}) => {
          customOnChangeComplete({rgb: rgba, hex})
        }}
        // presetColors={presetColors}
       />
      {/* {RenderTransparentBox} */}
    </>
  );
}
