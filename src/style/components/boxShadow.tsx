import React, { useCallback } from 'react';

import { Ctx } from '../Style';
import GreyContainer from './greyContainer';
import { observe, useObservable } from '@mybricks/rxui';

import css from './index.less';
import ColorEditor from '../../components/color-editor';
import { initValues } from '../utils';

// 这种写法看起来只是用作defaultvalue，有感觉有点多余
class EditCtx {
  shadowX?: string; // x偏移量
  shadowY?: string; // y偏移量
  blur?: string; // 阴影模糊半径
  extend?: string; // 阴影扩散半径
  color?: string; // 阴影颜色
}

const getModelFromBoxShadow = (boxShadow) => {
  if (!boxShadow || !boxShadow.split) {
    return {};
  }

  const [shadowX, shadowY, blur, extend, color] = boxShadow.split(' ');
  return {
    shadowX,
    shadowY,
    blur,
    extend,
    color,
  };
};

const getNewBoxShadow = (model: EditCtx, mergeModel: EditCtx) => {
  const { shadowX, shadowY, blur, extend, color } = {
    ...getModelFromBoxShadow(model),
    ...mergeModel,
  };
  return {
    boxShadow: [shadowX, shadowY, blur, extend, color].join(' '),
  };
};

export default function () {
  const ctx: Ctx = observe(Ctx, { from: 'parents' });
  const editCtx: EditCtx = useObservable(EditCtx, (next) => {
    const nextValues = initValues({
      boxShadow: '0px 0px 0px 0px #ffffff'
    }, ctx.val)
    next({...getModelFromBoxShadow(nextValues.boxShadow), ...nextValues});
  });

  const handleChange = useCallback((config) => {
    const value = getNewBoxShadow(editCtx.boxShadow, config)
    editCtx.boxShadow = value.boxShadow
    ctx.set(value);
  }, [])

  return (
    <div className={css.editorContainer}>
      <div className={css.editorTitle}>阴影</div>
      <div className={css.toolbar}>
        <ColorEditor
          style={{ marginRight: 3, flex: 1 }}
          value={editCtx.color}
          onChange={(color: string) => handleChange({color})}
        />
        <GreyContainer
          type="input"
          label="X"
          onBlurFnKey=">0"
          regexFnKey="number"
          style={{ marginRight: 3, flex: 1 }}
          defaultValue={parseFloat(editCtx.shadowX) || 0}
          onChange={(shadowX) => handleChange({shadowX: shadowX + 'px'})}
        />
        <GreyContainer
          type="input"
          label="Y"
          onBlurFnKey=">0"
          regexFnKey="number"
          style={{ marginRight: 3, flex: 1 }}
          defaultValue={parseFloat(editCtx.shadowY) || 0}
          onChange={(shadowY) => handleChange({shadowY: shadowY + 'px'})}
        />
        <GreyContainer
          type="input"
          label="模糊"
          onBlurFnKey=">0"
          regexFnKey="number"
          style={{ marginRight: 3, flex: 1 }}
          defaultValue={parseFloat(editCtx.blur) || 0}
          onChange={(blur) => handleChange({blur: blur + 'px'})}
        />
        <GreyContainer
          type="input"
          label="扩散"
          onBlurFnKey=">0"
          regexFnKey="number"
          style={{ marginRight: 3, flex: 1 }}
          defaultValue={parseFloat(editCtx.extend) || 0}
          onChange={(extend) => handleChange({extend: extend + 'px'})}
        />
      </div>
    </div>
  );
}
