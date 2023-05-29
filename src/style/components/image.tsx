import React, { useMemo, useCallback, useEffect } from 'react';

import { AnyMap } from '../types';
import { presetColors } from '../const';
import { createPortal } from 'react-dom';
import UploadModal from '../../components/upload-modal';
// @ts-ignore
import { evt, useComputed, useObservable } from '@mybricks/rxui';

import css from './index.less';

interface Props {
  style: AnyMap;
  defaultValue: any;
  monitorValue?: boolean;

  onChange: (url: string) => void;
}

class ImageCtx {
  url: string | undefined;
  showUploadModal: boolean = false;
  node: HTMLDivElement | undefined | null;
}

export default function ({
  defaultValue,
  onChange,
  style = {},
  monitorValue,
  upload
}: Props): JSX.Element {
  const imageCtx: ImageCtx = useObservable(ImageCtx, (next) => {
    next({
      node: void 0,
      url: defaultValue,
      showUploadModal: false,
    });
  });

  useEffect(() => {
    if (monitorValue) {
      imageCtx.url = defaultValue;
    }
  }, [defaultValue]);

  const Render: JSX.Element = useComputed(() => {
    return (
      <>
        <div
          className={css.value}
          ref={(node) => (imageCtx.node = node)}
          style={{ backgroundImage: imageCtx.url }}
          onClick={() => {
            imageCtx.showUploadModal = true;
          }}
        />
        <div className={css.label}>图片</div>
      </>
    );
  });

  return (
    <div className={css.imageContainer} style={style}>
      {Render}
      <UploadModal
        type="image/*"
        title="上传图片"
        upload={upload}
        visible={imageCtx.showUploadModal}
        value={((imageCtx.url || '').match(/url\((.*)\)/) || ['', ''])[1]}
        onOk={(url) => {
          let finalUrl = typeof url === 'string' ? url : url.url
          const imgUrl = `url(${finalUrl})`;
          imageCtx.url = imgUrl;
          imageCtx.showUploadModal = false;
          onChange(imgUrl);
        }}
        onCancel={() => {
          imageCtx.showUploadModal = false;
        }}
      />
    </div>
  );
}
