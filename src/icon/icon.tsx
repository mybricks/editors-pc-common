import React, { useCallback, useMemo } from 'react';
import { Drawer } from 'antd';
import * as icons from '@ant-design/icons';
import { CloseOutlined } from '@ant-design/icons';
import { isValid } from '../utils';
import { useComputed, useObservable } from '@mybricks/rxui';
// import { EditorProps } from '../index'
import css from './index.less';

const IconList = Object.keys(icons).filter(key => key.endsWith('ed'))
const Icon = (props: any) => {
  const {
    type,
    fontSize,
    color,
    spin,
    className,
    rotate
  } = props

  // @ts-ignore
  const RenderIcon = icons[type]

  if (!RenderIcon) return <></>

  return <RenderIcon
    style={{ fontSize, color }}
    spin={spin}
    className={className}
    rotate={rotate}
  />
}

export default function ({ editConfig }): any {
  const { value, options = {} } = editConfig;
  const { readonly = false } = options;
  const model: any = useObservable({ length: 80, value }, [value]);

  useComputed(() => {
    model.val = isValid(value.get()) ? String(value.get()) : '';
  });

  const updateVal = useCallback((item) => {
    model.val = item;
    model.value.set(item);
    close();
  }, []);

  const modalContext = useObservable({
    visible: false,
  });

  const toggle = useCallback(() => {
    if (readonly) return;
    modalContext.visible = !modalContext.visible;
    setTimeout(() => {
      model.length = renderIcons.length;
    }, 0);
  }, []);

  const close = useCallback(() => {
    modalContext.visible = false;
    model.length = 80;
  }, []);

  const renderIcons = useMemo(() => {
    if (readonly) return [];

    return IconList.map((item: string) => (
      <div
        key={item}
        className={css.icon}
        onClick={() => {
          updateVal(item);
        }}
      >
        <Icon type={item} fontSize={40} />
      </div>
    ));
  }, []);

  return (
    <div className={css['editor-icon']}>
      <button
        className={css['editor-icon__button']}
        onClick={toggle}
        style={{ cursor: readonly ? 'defatult' : 'pointer' }}
      >
        {readonly ? (
          <Icon type={model.val} />
        ) : (
          <span>
            <Icon
              type={model.val}
              className={css['editor-icon__button-editIcon']}
            />
            {`${modalContext.visible ? '关闭' : '打开'}`}图标选择器
          </span>
        )}
      </button>
      <Drawer
        className={`${css.iconBody} fangzhou-theme`}
        bodyStyle={{
          padding: 0,
          borderLeft: '1px solid #bbb',
          backgroundColor: '#F7F7F7',
          overflow: 'hidden'
        }}
        placement="right"
        mask={false}
        closable={false}
        destroyOnClose={true}
        visible={modalContext.visible}
        onClose={close}
        width={390}
        getContainer={() => document.querySelector('div[class^="lyStage-"]')}
        style={{ position: 'absolute' }}
      >
        <div
          className={css['drawerTitle']}
        >
          {'选择图标'}
          <CloseOutlined onClick={close} />
        </div>
        <div
          className={css.iconWrapper}
        >
          {renderIcons.slice(0, model.length)}
        </div>
      </Drawer>
    </div >
  );
}
