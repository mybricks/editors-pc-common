import React, { useCallback } from 'react';

import { Input } from 'antd';
import tinycolor from 'tinycolor2';
import { observe, useObservable } from '@mybricks/rxui';

import { Ctx } from '../Style';
import { bgParse, initValues } from '../utils';
import ColorEditor from '../../components/color-editor';

import css from './index.less';

class EditCtx {
  bgColor!: string;
  hex!: string;
  alpha!: string;
  color!: string;
  isTheme!: boolean;
  showText!: boolean;
}

const svg = (
  <svg
    viewBox="0 0 1024 1024"
    version="1.1"
    xmlns="http://www.w3.org/2000/svg"
    p-id="3217"
    width="200"
    height="200"
  >
    <path
      d="M914.56 1010.56H109.44a96 96 0 0 1-95.36-96V110.08A96 96 0 0 1 109.44 14.08h805.12a96 96 0 0 1 95.36 96v804.48a96 96 0 0 1-95.36 96zM109.44 78.08a32 32 0 0 0-31.36 32v804.48a32 32 0 0 0 31.36 32h805.12a32 32 0 0 0 31.36-32V110.08a32 32 0 0 0-31.36-32z"
      fill="#323333"
      p-id="3218"
    ></path>
    <path
      d="M287.36 238.08h448v71.68H553.6v476.8H471.04V309.76H287.36z"
      fill="#323333"
      p-id="3219"
    ></path>
  </svg>
);

export default function (): JSX.Element {
  const ctx: Ctx = observe(Ctx, { from: 'parents' });
  const editCtx: EditCtx = useObservable(EditCtx, (next) => {
    const nextValue = initValues({
      background: 'url() center top / 100% 100% no-repeat, rgba(255,255,255,1)'
    }, ctx.val)
    const { bgColor = 'transparent' } = bgParse(nextValue.background);
    const { hex, alpha, isTheme, isGradient } = getColor(bgColor);
    next({
      bgColor,
      hex,
      alpha,
      isTheme,
      showText: false,
    });
  });

  const toggleGradient = useCallback(() => {
    editCtx.showText = !editCtx.showText;
  }, []);

  const onInput = useCallback((e) => {
    const value = e.target.value;
    editCtx.bgColor = value;
    ctx.updateBgColor(value);
  }, []);

  return (
    <div className={`${css.editorContainer} fangzhou-theme`}>
      <div className={css.editorTitle}>
        背景色
        <div
          className={`
            ${css.gradientIcon} 
            ${editCtx.showText ? css.acitve : ''}
          `}
          onClick={toggleGradient}
        >
          {svg}
        </div>
      </div>
      <div className={css.toolbar} style={{ height: '40px' }}>
        {editCtx.showText ? (
          <Input
            size="small"
            value={editCtx.bgColor}
            onChange={onInput}
            style={{ height: '24px' }}
          />
        ) : (
          <ColorEditor
            value={editCtx.bgColor}
            onChange={(color: string) => {
              const { hex, alpha, isTheme, isGradient } = getColor(color);
              editCtx.hex = hex;
              editCtx.alpha = alpha;
              editCtx.isTheme = isTheme;
              editCtx.bgColor = color;
              ctx.updateBgColor(color);
            }}
          />
        )}
      </div>
    </div>
  );
}

function getColor(c: string | undefined) {
  const color = tinycolor(c);
  const hex = color.toHexString();
  const alpha = Math.round(color.getAlpha() * 100) + '';
  return {
    hex,
    alpha,
    isTheme: !!c?.match(/^var\(--(.*)\)$/),
    isGradient: !!c?.match(/\-gradient/),
  };
}
