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

const render = ({ editConfig, projectData = {} }: EditorProps): JSX.Element => {
  const { value, options, upload } = editConfig;

  const ctx: Ctx = useObservable(
    Ctx,
    (next) => {
      let val = getVal(value.get());
      let fontProps = {};
      let opts = Sequence;
      let title: any = '';

      if (typeCheck(options, 'array')) {
        opts = options;
      } else if (typeCheck(options, 'object')) {
        const { defaultOpen = true, showTitle = true, plugins = Sequence, items, targetDom } = options

        if (targetDom) {
          val = Object.assign(getStyle(targetDom), val)
        }

        // 字间距特殊逻辑，只有配置这个属性才显示，因为字间距本身有bug，需要特殊实现
        if (options.fontProps) {
          fontProps = options.fontProps;
        }

        if (typeof val.styleEditorUnfold !== 'boolean') {
          val.styleEditorUnfold = defaultOpen;
        }

        if (!showTitle) {
          title = false
          if (!defaultOpen) {
            val.styleEditorUnfold = true
          }
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

      if (typeof title === 'string') {
        title = opts.reduce((f: string, s: string, i: number) => {
          return f + TitleMap[s.toLocaleUpperCase()] + (i === length - 1 ? '' : ',');
        }, '');
      }

      next({
        upload,
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
    if (options?.targetDom) {
      const { styleEditorUnfold, ...other } = ctx.val
      value.set(other);
    } else {
      value.set(ctx.val);
    }
  }, []);

  const Delete = useCallback((ary: string[]) => {
    let config = { ...ctx.val };
    ary.forEach((key: string) => {
      delete config[key];
    });
    ctx.val = config;
    if (options?.targetDom) {
      const { styleEditorUnfold, ...other } = ctx.val
      value.set(other);
    } else {
      value.set(ctx.val);
    }
  }, []);

  const updateBgColor = useCallback((color: string) => {
    delete ctx.val.backgroundColor;
    ctx.val = {
      ...ctx.val,
      background: setBgColor(color, ctx.val.background),
    };
    if (options?.targetDom) {
      const { styleEditorUnfold, ...other } = ctx.val
      value.set(other);
    } else {
      value.set(ctx.val);
    }
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
    if (options?.targetDom) {
      const { styleEditorUnfold, ...other } = ctx.val
      value.set(other);
    } else {
      value.set(ctx.val);
    }
  }, []);

  const RenderTitle: JSX.Element = useComputed(() => {
    return ctx.title ? (
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
    ) : <></>;
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

// TODO:迁移新版style时各插件提供默认值该如何赋予
function getStyle(element) {
  const value = {}
  const cssRules = []
  const computedStyle = window.getComputedStyle(element)

  element.classList.forEach((classname) => {
    const cssRule = getCssRule(`.${classname}`, element)
    if (cssRule) {
      cssRules.push(cssRule)
    }
  })

  cssRules.sort((f, s) => {
    return f.selectorText.split(' ').length - s.selectorText.split(' ').length
  })

  const cssRulesLength = cssRules.length

  cssRules.forEach((rule, index) => {
    const isLastCssRule = cssRulesLength === index + 1
    const { style } = rule
    const {
      // padding
      paddingTop,
      paddingRight,
      paddingBottom,
      paddingLeft,

      // size
      height,
      width,

      //font
      lineHeight,
      letterSpacing,
      fontSize,
      fontWeight,
      color,
      fontStyle,
      fontFamily,
      textDecoration,

      //textShadow
      textShadow,

      // border
      borderWidth,
      borderRadius,
      borderStyle,
      borderColor,

      // bgcolor
      background,

      // shadow
      boxShadow
    } = style

    if (paddingTop) {
      value.paddingTop = paddingTop
    }
    if (paddingRight) {
      value.paddingRight = paddingRight
    }
    if (paddingBottom) {
      value.paddingBottom = paddingBottom
    }
    if (paddingLeft) {
      value.paddingLeft = paddingLeft
    }

    if (height) {
      value.height = height
    }
    if (width) {
      value.width = width
    }

    if (lineHeight) {
      value.lineHeight = lineHeight
    }
    if (letterSpacing) {
      value.letterSpacing = letterSpacing
    }
    if (fontSize) {
      value.fontSize = fontSize
    }
    if (fontWeight) {
      value.fontWeight = fontWeight
    }
    if (color) {
      value.color = color
    }
    if (fontStyle) {
      value.fontStyle = fontStyle
    }
    if (fontFamily) {
      value.fontFamily = fontFamily
    }
    if (textDecoration) {
      value.textDecoration = textDecoration
    }

    if (textShadow) {
      value.textShadow = textShadow
    }

    if (borderWidth) {
      // value.borderWidth = borderWidth
      value.borderWidth = `${style.borderTopWidth} ${style.borderRightWidth} ${style.borderBottomWidth} ${style.borderLeftWidth}`
    }
    if (borderRadius) {
      // value.borderRadius = borderRadius
      value.borderRadius = `${style.borderTopLeftRadius} ${style.borderTopRightRadius} ${style.borderBottomRightRadius} ${style.borderBottomLeftRadius}`
    }
    if (borderStyle) {
      // value.borderStyle = borderStyle
      value.borderStyle = `${style.borderTopStyle} ${style.borderRightStyle} ${style.borderBottomStyle} ${style.borderLeftStyle}`
    }
    if (borderColor) {
      // value.borderColor = borderColor
      value.borderColor = `${style.borderTopColor.replace(/\s/g, "")} ${style.borderRightColor.replace(/\s/g, "")} ${style.borderBottomColor.replace(/\s/g, "")} ${style.borderLeftColor.replace(/\s/g, "")}`
    }

    if (background) {
      value.background = background
    }

    if (boxShadow) {
      value.boxShadow = boxShadow
    }
      
    if (isLastCssRule) {
      if (!value.paddingTop) {
        // 0
        value.paddingTop = '0px'
      }
      if (!value.paddingRight) {
        // 0
        value.paddingRight = '0px'
      }
      if (!value.paddingBottom) {
        // 0
        value.paddingBottom = '0px'
      }
      if (!value.paddingLeft) {
        // 0
        value.paddingLeft = '0px'
      }

      if (!value.height) {
        // auto
        value.height = 'auto'
      }
      if (!value.width) {
        // auto
        value.width = 'auto'
      }

      // TODO: 目前只支持px，不支持倍数
      if (!value.lineHeight || typeof value.lineHeight === 'number') {
        // normal
        value.lineHeight = computedStyle.lineHeight
      }
      if (!value.letterSpacing) {
        // normal
        value.letterSpacing = computedStyle.letterSpacing
      }
      if (!value.fontSize) {
        value.fontSize = computedStyle.fontSize
      }
      if (!value.fontWeight) {
        // normal
        value.fontWeight = computedStyle.fontWeight
      }
      if (!value.color) {
        value.color = computedStyle.color
      }
      if (!value.fontStyle) {
        // normal
        value.fontStyle = computedStyle.fontStyle
      }
      if (!value.fontFamily) {
        // 用户定义
        value.fontFamily = ''
      }
      if (!value.textDecoration) {
        /**
         * text-decoration-color:currentcolor
            text-decoration-style:solid
            text-decoration-line:none
         */
        value.textDecoration = 'normal'
      }

      // TODO:应该拿到当前文字颜色
      if (!value.textShadow) { // none
        value.textShadow = `0px 0px 0px ${value.color}`
      }

      // TODO:现在border默认展开有问题
      if (!value.borderWidth) {
        // 上下左右0
        value.borderWidth = '0px'
      }
      if (!value.borderRadius) {
        // 上下左右0
        value.borderRadius = '0px'
      }
      if (!value.borderStyle) {
        // 上下左右null
        value.borderStyle = 'solid'
      }
      if (!value.borderColor) {
        // 上下左右currentColor，给白色吧
        value.borderColor = '#ffffff'
      }


      if (!value.background) {
        // TODO:后面不用background了
        value.background = 'url() center top / 100% 100% no-repeat, rgba(255,255,255,1)'
        // value.background = computedStyle.background
      }

      if (!value.boxShadow) {
        // none
        value.boxShadow = '0px 0px 0px 0px #ffffff'
      }

    }
  })

  return value
}

function getCssRule(selector: string, element: HTMLDivElement) {
  for (let i = 0; i < document.styleSheets.length; i++) {
    try {
      const sheet = document.styleSheets[i]
      const rules = sheet.cssRules ? sheet.cssRules : sheet.rules
  
      for (let j = 0; j < rules.length; j++) {
        const rule = rules[j]
        if (rule instanceof CSSStyleRule) {
          if (rule.selectorText && rule.selectorText.endsWith(selector)) {
            if (element.matches(rule.selectorText)) {
              return rule
            }
          }
        }
      }
    } catch {}
   }
}