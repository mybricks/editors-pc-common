import React, { useMemo } from 'react';

import { Ctx } from '../Style';
import { initValues } from '../utils';
import GreyContainer from './greyContainer';
import { observe, useObservable } from '@mybricks/rxui';

import css from './index.less';

class EditCtx {
  paddingTop!: string;
  paddingBottom!: string;
  paddingLeft!: string;
  paddingRight!: string;
}

export default function () {
  const ctx: Ctx = observe(Ctx, { from: 'parents' });
  const editCtx: EditCtx = useObservable(EditCtx, (next) => {
    next(initValues({
      paddingTop: '0px',
      paddingBottom: '0px',
      paddingLeft: '0px',
      paddingRight: '0px'
    }, ctx.val));
  });

  return (
    <div className={css.editorContainer}>
      <div className={css.editorTitle}>内间距</div>
      <div className={css.toolbar}>
        {useMemo(() => {
          return (
            <GreyContainer
              type="input"
              label="上"
              onBlurFnKey=">0"
              regexFnKey="number"
              style={{ marginRight: 3, flex: 1 }}
              defaultValue={parseFloat(editCtx.paddingTop) || 0}
              onChange={(paddingTop) => {
                ctx.set({ paddingTop: paddingTop + 'px' });
              }}
            />
          );
        }, [])}
        {useMemo(() => {
          return (
            <GreyContainer
              type="input"
              label="下"
              onBlurFnKey=">0"
              regexFnKey="number"
              style={{ marginRight: 3, flex: 1 }}
              defaultValue={parseFloat(editCtx.paddingBottom) || 0}
              onChange={(paddingBottom) => {
                ctx.set({ paddingBottom: paddingBottom + 'px' });
              }}
            />
          );
        }, [])}
        {useMemo(() => {
          return (
            <GreyContainer
              type="input"
              label="左"
              onBlurFnKey=">0"
              regexFnKey="number"
              style={{ marginRight: 3, flex: 1 }}
              defaultValue={parseFloat(editCtx.paddingLeft) || 0}
              onChange={(paddingLeft) => {
                ctx.set({ paddingLeft: paddingLeft + 'px' });
              }}
            />
          );
        }, [])}
        {useMemo(() => {
          return (
            <GreyContainer
              type="input"
              label="右"
              onBlurFnKey=">0"
              regexFnKey="number"
              style={{ marginRight: 0, flex: 1 }}
              defaultValue={parseFloat(editCtx.paddingRight) || 0}
              onChange={(paddingRight) => {
                ctx.set({ paddingRight: paddingRight + 'px' });
              }}
            />
          );
        }, [])}
      </div>
    </div>
  );
}
