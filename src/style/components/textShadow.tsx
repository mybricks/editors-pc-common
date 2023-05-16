import React, { useMemo } from 'react';

import { Ctx } from '../Style';
import GreyContainer from './greyContainer';
import ColorEditor from '../../components/color-editor';
import { observe, useObservable } from '@mybricks/rxui';

import css from './index.less';
import { initValues } from '../utils';

// 这种写法看起来只是用作defaultvalue，有感觉有点多余
class EditCtx {
  shadowX?: string; // x偏移量
  shadowY?: string; // y偏移量
  blur?: string; // 阴影模糊半径
  color?: string; // 阴影颜色
}

const getModelFromShadow = (textShadow) => {
  if (!textShadow || !textShadow.split) {
    return {};
  }

  const [shadowX, shadowY, blur, color] = textShadow.split(' ');
  return {
    shadowX,
    shadowY,
    blur,
    color,
  };
};

const getFromNewShadow = (model: EditCtx, mergeModel: EditCtx) => {
  const { shadowX, shadowY, blur, color } = {
    ...getModelFromShadow(model),
    ...mergeModel,
  };
  return {
    textShadow: [shadowX, shadowY, blur, color].join(' '),
  };
};

export default function () {
  const ctx: Ctx = observe(Ctx, { from: 'parents' });
  const editCtx: EditCtx = useObservable(EditCtx, (next) => {

    const nextValue = initValues({
      textShadow: '0px 0px 0px #000000'
    }, ctx.val)

    next(getModelFromShadow(nextValue.textShadow));
  });

  return (
    <div className={css.editorContainer}>
      <div className={css.editorTitle}>文字阴影</div>
      <div className={css.toolbar}>
        <ColorEditor
          style={{ marginRight: 3, flex: 1 }}
          value={editCtx.color}
          onChange={(color) => {
            ctx.set(getFromNewShadow(ctx.val.textShadow, { color }));
          }}
        />
        <GreyContainer
          type="input"
          label="X"
          onBlurFnKey=">0"
          regexFnKey="number"
          style={{ marginRight: 3, flex: 1 }}
          defaultValue={parseFloat(editCtx.shadowX) || 0}
          onChange={(shadowX) => {
            ctx.set(
              getFromNewShadow(ctx.val.textShadow, { shadowX: shadowX + 'px' })
            );
          }}
        />
        <GreyContainer
          type="input"
          label="Y"
          onBlurFnKey=">0"
          regexFnKey="number"
          style={{ marginRight: 3, flex: 1 }}
          defaultValue={parseFloat(editCtx.shadowY) || 0}
          onChange={(shadowY) => {
            ctx.set(
              getFromNewShadow(ctx.val.textShadow, { shadowY: shadowY + 'px' })
            );
          }}
        />
        <GreyContainer
          type="input"
          label="模糊"
          onBlurFnKey=">0"
          regexFnKey="number"
          style={{ marginRight: 3, flex: 1 }}
          defaultValue={parseFloat(editCtx.blur) || 0}
          onChange={(blur) => {
            ctx.set(
              getFromNewShadow(ctx.val.textShadow, { blur: blur + 'px' })
            );
          }}
        />
      </div>
    </div>
  );
}
