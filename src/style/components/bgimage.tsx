import React, { useCallback } from 'react';

import Input from './text';
import { Ctx } from '../Style';
import { Popover } from 'antd';
import RenderImage from './image';
import { DefaultBgImage } from '../const';
import GreyContainer from './greyContainer';
import { uuid, deepCopy } from '../../utils';
import PlusOutlined from '@ant-design/icons/PlusOutlined';
import { observe, useObservable } from '@mybricks/rxui';
import DeleteOutlined from '@ant-design/icons/DeleteOutlined';

import Button from './btn';

import css from './index.less';
import { bgParse } from '../utils';

class EditCtx {
  type?: string;
  backgroundSize?: string;
  backgroundImage?: string;
  backgroundRepeat?: string;
  backgroundPosition?: string;
}

export default function (): JSX.Element {
  const ctx: Ctx = observe(Ctx, { from: 'parents' });
  const editCtx: EditCtx = useObservable(EditCtx, (next) => {
    const { bgImage } = bgParse(ctx.val.background);
    const {
      backgroundImage,
      backgroundRepeat,
      backgroundPosition,
      backgroundSize,
    } = getImage(bgImage);
    next({
      backgroundImage: backgroundImage || DefaultBgImage['backgroundImage'],
      backgroundSize: backgroundSize || DefaultBgImage['backgroundSize'],
      backgroundRepeat: backgroundRepeat || DefaultBgImage['backgroundRepeat'],
      backgroundPosition:
        backgroundPosition || DefaultBgImage['backgroundPosition'],
    });
  });

  const setImage = useCallback(() => {
    const background = `${editCtx.backgroundImage} ${editCtx.backgroundPosition} / ${editCtx.backgroundSize} ${editCtx.backgroundRepeat}`;
    ctx.updateBgImage(background);
  }, []);

  return (
    <div className={css.editorContainer}>
      <div className={css.editorTitle}>
        <div>背景图</div>
      </div>
      <div className={css.toolbar}>
        <div className={css.icon}>
          <DeleteOutlined
            onClick={() => {
              editCtx.backgroundImage = 'url()';
              setImage();
            }}
          />
        </div>
        <RenderImage
          style={{ marginRight: 7, minWidth: 72, maxWidth: 72 }}
          defaultValue={editCtx.backgroundImage}
          monitorValue
          onChange={(backgroundImage) => {
            editCtx.backgroundImage = backgroundImage;
            setImage();
          }}
          upload={ctx.upload}
        />
        <GreyContainer
          label="平铺"
          type="select"
          optionsKey="backgroundRepeat"
          style={{ marginRight: 7, flex: 1, cursor: 'pointer' }}
          defaultValue={editCtx.backgroundRepeat}
          monitorValue
          onChange={(backgroundRepeat) => {
            editCtx.backgroundRepeat = backgroundRepeat;
            setImage();
          }}
        />
        <GreyContainer
          label="位置"
          type="select"
          optionsKey="backgroundPosition"
          style={{ flex: 1, cursor: 'pointer' }}
          defaultValue={editCtx.backgroundPosition}
          monitorValue
          onChange={(backgroundPosition) => {
            editCtx.backgroundPosition = backgroundPosition;
            setImage();
          }}
        />
      </div>
      <div className={css.toolbar}>
        <div className={css.icon} />
        <GreyContainer
          label="大小"
          type="select"
          optionsKey="backgroundSize"
          style={{ minWidth: 72, maxWidth: 72, cursor: 'pointer' }}
          defaultValue={editCtx.backgroundSize}
          monitorValue
          onChange={(backgroundSize) => {
            editCtx.backgroundSize = backgroundSize;
            setImage();
          }}
        />
      </div>
    </div>
  );
}
// url("")) center top / cover no-repeat
function getImage(background: string = '') {
  const arr = background.split(' ').filter((item) => item);
  const backgroundImage = arr.shift();
  const backgroundRepeat = arr.pop();
  const rest = arr.join(' ').split('/');
  let backgroundPosition = rest.shift();
  const backgroundSize = rest.pop();

  return {
    backgroundImage,
    backgroundRepeat,
    backgroundPosition,
    backgroundSize,
  };
}
