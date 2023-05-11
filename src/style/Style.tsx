import React, { useMemo, useCallback } from 'react';

import css from './Style.less';
import { EditorProps } from '@/interface';
import { typeCheck } from '../utils';
import CaretDownOutlined from '@ant-design/icons/CaretDownOutlined';
import CaretLeftOutlined from '@ant-design/icons/CaretLeftOutlined';
import { TitleMap, Sequence } from './const';
// @ts-ignore
import { useComputed, useObservable } from '@mybricks/rxui';

import {
  Size,
  Padding,
  Shadow,
  TextShadow,
  Font,
  FontWidthSpace,
  Border,
  Bgcolor,
  Bgimage,
} from './components';

import { AnyMap } from './types';
import { setBgColor, setBgImage } from './utils';

export class Ctx {
  val: any;
  value: any;
  title!: string;
  projectData: any;
  options!: Array<string>;
  visible!: () => void;
  set!: (arg: object) => void;
  updateBgColor!: (color: string) => void;
  updateBgImage!: (image: string) => void;
  delete!: (ary: string[]) => void;
}

const EditorsMap: {
  SIZE: () => JSX.Element;
  PADDING: () => JSX.Element;
  FONT: () => JSX.Element;
  BORDER: () => JSX.Element;
  BGCOLOR: () => JSX.Element;
  BGIMAGE: () => JSX.Element;
  [key: string]: () => JSX.Element;
} = {
  SIZE: Size,
  PADDING: Padding,
  FONT: Font,
  BORDER: Border,
  BGCOLOR: Bgcolor,
  BGIMAGE: Bgimage,
  SHADOW: Shadow,
  TEXTSHADOW: TextShadow,
};

const render = ({ editConfig, projectData }: EditorProps): JSX.Element => {
  const { value, options } = editConfig;

  const ctx: Ctx = useObservable(
    Ctx,
    (next) => {
      const val = getVal(value.get());
      let fontProps = {};
      let opts = Sequence;

      if (typeCheck(options, 'array')) {
        opts = options;
      } else if (typeCheck(options, 'object')) {
        const { defaultOpen = true, plugins = Sequence, items } = options;

        // 字间距特殊逻辑，只有配置这个属性才显示，因为字间距本身有bug，需要特殊实现
        if (options.fontProps) {
          fontProps = options.fontProps;
        }

        if (typeof val.styleEditorUnfold !== 'boolean') {
          val.styleEditorUnfold = defaultOpen;
        }

        if (typeCheck(plugins, 'array')) {
          opts = plugins;
        }

        /** 新版更加语义化的API */
        if (Array.isArray(items)) {
          opts = items.map((attr: any) => {
            if (typeCheck(attr, 'string')) {
              return attr
            }
            if (typeCheck(attr?.use, 'string')) {
              switch (true) {
                case attr.use === 'font': {
                  fontProps = { ...fontProps, ...(attr?.option ?? {}) }
                  break
                }
              }
              return attr?.use
            }
            return
          }).filter((t: string | undefined) => t)
        }
      }

      opts = merge_Width_Height_forSize(opts);

      opts = Sequence.filter((i) => {
        return opts.find((o: string) => typeof o === 'string' && o.toLocaleUpperCase() === i);
      });

      const length: number = opts.length;
      const title: string = opts.reduce((f: string, s: string, i: number) => {
        return f + TitleMap[s.toLocaleUpperCase()] + (i === length - 1 ? '' : ',');
      }, '');

      next({
        val,
        value,
        title,
        projectData,
        options: opts,
        codeEditVisible: false,
        fontProps,
        visible: () => {
          ctx.val.styleEditorUnfold = !ctx.val.styleEditorUnfold;
        },
        set: (obj: AnyMap) => Update(obj),
        updateBgColor: (color: string) => {
          updateBgColor(color);
        },
        updateBgImage: (image: string) => {
          updateBgImage(image);
        },
        delete: (ary: string[]) => Delete(ary),
      });
    },
    { to: 'children' }
  );

  const Update = useCallback((obj: AnyMap) => {
    ctx.val = { ...ctx.val, ...obj };
    value.set(ctx.val);
  }, []);

  const Delete = useCallback((ary: string[]) => {
    let config = { ...ctx.val };
    ary.forEach((key: string) => {
      delete config[key];
    });
    ctx.val = config;
    value.set(ctx.val);
  }, []);

  const updateBgColor = useCallback((color: string) => {
    delete ctx.val.backgroundColor;
    ctx.val = {
      ...ctx.val,
      background: setBgColor(color, ctx.val.background),
    };
    value.set(ctx.val);
  }, []);

  const updateBgImage = useCallback((image: string) => {
    delete ctx.val.backgroundImage;
    delete ctx.val.backgroundSize;
    delete ctx.val.backgroundRepeat;
    delete ctx.val.backgroundPosition;
    ctx.val = {
      ...ctx.val,
      background: setBgImage(image, ctx.val.background),
    };
    value.set(ctx.val);
  }, []);

  const RenderTitle: JSX.Element = useComputed(() => {
    return (
      <div className={css.titleContainer} style={{ marginBottom: ctx.val.styleEditorUnfold ? 3 : 0 }}>
        <div className={css.title} onClick={ctx.visible}>
          <div>{editConfig.title}</div>
          <div className={css.preview} style={{ display: !ctx.val.styleEditorUnfold ? 'block' : 'none' }}>
            ({ctx.title})
          </div>
        </div>
        <div className={css.actions}>
          <div onClick={ctx.visible}>{ctx.val.styleEditorUnfold ? <CaretDownOutlined style={{ color: '#555' }} /> : <CaretLeftOutlined style={{ color: '#555' }} />}</div>
        </div>
      </div>
    );
  });

  const RenderEditors: JSX.Element[] = useMemo(() => {
    const editors: JSX.Element[] = [];

    ctx.options.forEach((t, idx) => {
      if (typeof t === 'string') {
        const T: string = t.toLocaleUpperCase();
        const Editor: () => JSX.Element = T === 'FONT' && ctx?.fontProps?.letterSpace ? FontWidthSpace : EditorsMap[T];

        if (Editor) {
          editors.push(
            <div
              key={t + idx}
              style={
                idx
                  ? {
                    borderTop: '1px solid #E5E5E5',
                    marginTop: 8,
                    paddingTop: 8,
                  }
                  : {}
              }
            >
              {<Editor />}
            </div>
          );
        }
      }
    });

    return editors;
  }, []);

  return (
    <div className={css.container}>
      {RenderTitle}
      <div style={{ display: ctx.val.styleEditorUnfold ? 'block' : 'none' }}>
        {RenderEditors}
      </div>
    </div>
  );
};

export default function ({ editConfig, projectData }: EditorProps) {
  return {
    render: render({ editConfig, projectData }),
  };
}

function getVal(rawVal: any) {
  let val;
  if (Object.prototype.toString.call(rawVal) !== '[object Object]') {
    val = {};
  } else {
    val = { ...rawVal };
  }

  return val;
}

// 兼容代码
function merge_Width_Height_forSize(opts: string[]) {
  const ary = opts.filter((opt) => {
    return ['width', 'height'].includes(opt);
  });

  if (ary.length) {
    opts.push('Size');
  }

  return opts;
}
