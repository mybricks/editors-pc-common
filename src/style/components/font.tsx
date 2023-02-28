import React, {CSSProperties, useMemo} from 'react';
import ColorEditor from '../../components/color-editor';
import {Ctx} from '../Style';
import RenderSelect from './select';
import {SelectOptions} from '../types';
import GreyContainer from './greyContainer';
import FontLayout from './fontLayout';
import {FontFamilyOptions} from '../const';
import {observe, useObservable} from '@mybricks/rxui';

import css from './index.less';

const fontFamilyRegex =
  /font-family\s*?:(([^";<>]*?"[^";<>]*?")|(\s*[^";<>\s]*))*;?/g;

class EditCtx {
  color!: string;
  fontSize!: string;
  fontStyle!: string;
  fontWeight!: string;
  fontFamily!: string;
  lineHeight!: string;
  letterSpacing!: string;
  fontFamilyOptions!: SelectOptions;

  /** 布局相关 */
  textAlign: CSSProperties['textAlign'];
  display: CSSProperties['display'];
  flexDirection: CSSProperties['flexDirection'];
  alignItems: CSSProperties['alignItems'];
  justifyContent: CSSProperties['justifyContent'];

  projectData: any;
}

export const Font = function ({hasLetterSpace = false}) {
  const ctx: Ctx = observe(Ctx, {from: 'parents'});
  const editCtx: EditCtx = useObservable(EditCtx, (next) => {
    // const pubFontFamily = decodeURIComponent(ctx.projectData.pubFontFamily);
    // const fontFamilyAry = pubFontFamily.match(fontFamilyRegex);
    const otherOptions: SelectOptions = (ctx.projectData.fontfaces || []).map((item: any) => {
      const {label} = item
      return {
        label,
        value: label
      }
    });

    const defaultOptions: SelectOptions = (ctx.projectData.defaultFontfaces || []).map((item: any) => {
      const {label} = item
      return {
        label,
        value: label
      }
    });

    // if (Array.isArray(fontFamilyAry)) {
    //   fontFamilyAry.forEach((item) => {
    //     const matchRes = item.match(/(\"(.*?)\")|\'(.*?)\'/gi);

    //     if (matchRes) {
    //       const value = matchRes[0];
    //       otherOptions.push({ label: value, value });
    //     }
    //   });
    // }

    next({
      color: ctx.val.color,
      fontSize: ctx.val.fontSize,
      fontStyle: ctx.val.fontStyle,
      textDecoration: ctx.val.textDecoration,
      fontWeight: ctx.val.fontWeight,
      fontFamily: ctx.val.fontFamily,
      lineHeight: ctx.val.lineHeight,
      letterSpacing: ctx.val.letterSpacing,
      fontFamilyOptions: otherOptions.concat(FontFamilyOptions).concat(defaultOptions),

      textAlign: ctx.val.textAlign,
      display: ctx.val.display,
      flexDirection: ctx.val.flexDirection,
      alignItems: ctx.val.alignItems,
      justifyContent: ctx.val.justifyContent
    });
  });

  const Render: JSX.Element = useMemo(() => {
    return (
      <div className={css.editorContainer}>
        <div className={css.editorTitle}>字体</div>
        {ctx?.fontProps && ctx?.fontProps?.fontFamily !== false ?
          <RenderSelect
            options={editCtx.fontFamilyOptions}
            defaultValue={editCtx.fontFamily}
            onChange={(fontFamily) => {
              ctx.set({fontFamily});
            }}
          />
          :
          <></>}
        <div className={css.toolbar}>
          <div className={css.item}>
            <ColorEditor
              value={editCtx.color}
              onChange={(color: string) => {
                ctx.set({color});
              }}
              style={{marginRight: 7, minWidth: 72, maxWidth: 72}}
            />
            <label className={css.label}>颜色</label>
          </div>
          <GreyContainer
            label="粗体"
            type="select"
            optionsKey="fontWeight"
            style={{marginRight: 7, flex: 1, cursor: 'pointer'}}
            defaultValue={editCtx.fontWeight}
            onChange={(fontWeight) => {
              ctx.set({fontWeight});
            }}
          />
          <GreyContainer
            label="斜体"
            type="select"
            optionsKey="fontStyle"
            style={{minWidth: 55, flex: 1, cursor: 'pointer'}}
            defaultValue={editCtx.fontStyle}
            onChange={(value) => {
              ctx.set({fontStyle: value})
            }}
          />
        </div>
        <div className={css.toolbar}>
          <GreyContainer
            type="input"
            label="大小(px)"
            onBlurFnKey=">0"
            regexFnKey="number"
            style={{marginRight: 7, minWidth: 72, maxWidth: 72}}
            defaultValue={parseInt(editCtx.fontSize)}
            onChange={(value) => {
              const lineHeight =
                parseInt(editCtx.lineHeight) -
                parseInt(editCtx.fontSize) +
                value +
                'px';
              const fontSize = value + 'px';
              editCtx.lineHeight = lineHeight;
              editCtx.fontSize = fontSize;
              ctx.set({
                lineHeight,
                fontSize,
              });
            }}
          />
          <GreyContainer
            label="行间距(px)"
            type="input"
            onBlurFnKey="default"
            regexFnKey="number"
            style={{marginRight: 7, flex: 1}}
            defaultValue={
              //parseInt(editCtx.lineHeight) - parseInt(editCtx.fontSize)
              parseInt(editCtx.lineHeight)
            }
            onChange={(value) => {
              //const lineHeight = parseInt(editCtx.fontSize) + Number(value) + 'px';
              const lineHeight = Number(value) + 'px';
              editCtx.lineHeight = lineHeight;
              ctx.set({
                lineHeight,
              });
            }}
          />
          <GreyContainer
            label="下划线"
            type="select"
            optionsKey="textDecoration"
            style={{minWidth: 55, flex: 1, cursor: 'pointer'}}
            defaultValue={editCtx.fontStyle}
            onChange={(value) => {
              ctx.set({textDecoration: value})
            }}
          />
        </div>
        {hasLetterSpace ? (
          <div className={css.toolbar}>
            <GreyContainer
              label="字间距(px)"
              type="input"
              onBlurFnKey="default"
              regexFnKey="number"
              style={{flex: 1}}
              defaultValue={parseInt(editCtx.letterSpacing)}
              onChange={(letterSpacing) => {
                ctx.set({letterSpacing: letterSpacing + 'px'});
              }}
            />
          </div>
        ) : null}
        <div style={{ width: '100%' }}>
          <FontLayout
            verticalAlign={ctx.fontProps?.verticalAlign ?? true}
            horizontalAlign={ctx.fontProps.horizontalAlign ?? true}
            value={{
              textAlign: editCtx.textAlign,
              display: editCtx.display,
              flexDirection: editCtx.flexDirection,
              alignItems: editCtx.alignItems,
              justifyContent: editCtx.justifyContent
            }}
            onChange={(nextVal) => {
              ctx.set({ ...(nextVal ?? {}) });
            }}
          />
        </div>
      </div>
    );
  }, [hasLetterSpace]);

  return Render;
};

export default () => <Font hasLetterSpace={false}/>;
