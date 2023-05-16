import React from 'react';

import { Ctx } from '../Style';
import { initValues } from '../utils';
import GreyContainer from './greyContainer';
import { observe, useObservable } from '@mybricks/rxui';

import css from './index.less';

type StyleConfig = {
  unit: string;
  value: string;
  unitIdx: number;
  unitValueMap: any;
};

class EditCtx {
  width!: StyleConfig;
  height!: StyleConfig;
}

const unitOptions = ['auto', 'px', '%'];

const unitOptionsLength: number = unitOptions.length;

const unitOptionsMap: any = {
  auto: 0,
  px: 1,
  '%': 2,
};
const inputUnitMap: any = {
  px: true,
  '%': true,
};
const styleKeyAry: Array<{
  key: 'width' | 'height';
  label: string;
}> = [
  { key: 'width', label: '宽' },
  { key: 'height', label: '高' },
];

const styleKeyAryLength = 2;

export default function (): JSX.Element {
  const ctx: Ctx = observe(Ctx, { from: 'parents' });
  const editCtx: EditCtx = useObservable(EditCtx, (next) => {
    const nextValue = initValues({
      width: 'auto',
      height: 'auto'
    }, ctx.val)

    next({
      width: transform(nextValue.width),
      height: transform(nextValue.height),
    });
  });

  return (
    <div className={css.editorContainer}>
      <div className={css.editorTitle}>尺寸</div>
      <div className={css.toolbar} style={{ justifyContent: 'space-between' }}>
        {styleKeyAry.map((style, idx) => {
          const { key, label } = style;
          const { value, unitIdx, unit, unitValueMap } = editCtx[key];
          const isInput = inputUnitMap[unit];
          const containerCfg = {
            type: isInput ? 'input' : 'button',
            label,
            onBlurFnKey: '>0',
            regexFnKey: 'number',
            defaultValue: value,
            monitorValue: true,
            onChange: (val: string) => {
              unitValueMap[unit] = val;
              ctx.set({ [key]: val + unit });
            },
            onClick: () => {
              const uIdx = unitIdx + 1;
              const resUnitIdx = uIdx > unitOptionsLength - 1 ? 0 : uIdx;
              const resUnit = unitOptions[resUnitIdx];
              const resValue = unitValueMap[resUnit] || '0';
              const isInput = inputUnitMap[resUnit];

              editCtx[key].unitIdx = resUnitIdx;
              editCtx[key].value = unitValueMap[resUnit] || '0';
              editCtx[key].unit = resUnit;

              ctx.set({ [key]: resValue + (isInput ? resUnit : '') });
            },
          };

          // @ts-ignore
          const Control = (
            <GreyContainer
              {...containerCfg}
              child={
                isInput && (
                  <div
                    className={css.greyContainer}
                    style={{ width: 20, marginLeft: 2 }}
                  >
                    <span className={css.button}>{unit}</span>
                  </div>
                )
              }
            />
          );

          return (
            <div
              key={key}
              style={{
                marginRight: idx !== styleKeyAryLength - 1 ? 8 : 0,
                flex: 1,
              }}
            >
              <div style={{ display: 'flex' }}>
                <div style={{ width: '100%' }}>{Control}</div>
                {isInput && (
                  <div
                    className={css.greyContainer}
                    style={{ width: 20, marginLeft: 2 }}
                    onClick={() => {
                      const uIdx = unitIdx + 1;
                      const resUnitIdx =
                        uIdx > unitOptionsLength - 1 ? 0 : uIdx;
                      const resUnit = unitOptions[resUnitIdx];
                      const resValue = unitValueMap[resUnit] || '0';
                      const isInput = inputUnitMap[resUnit];

                      editCtx[key].unitIdx = resUnitIdx;
                      editCtx[key].value = unitValueMap[resUnit] || '0';
                      editCtx[key].unit = resUnit;

                      ctx.set({ [key]: resValue + (isInput ? resUnit : '') });
                    }}
                  >
                    <span className={css.button}>{unit}</span>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function transform(value?: string | number): StyleConfig {
  const unitValueMap: any = {
    auto: 'auto',
    px: '0',
    '%': '0',
  };
  let res: StyleConfig = {
    value: 'auto',
    unit: 'auto',
    unitIdx: 0,
    unitValueMap,
  };
  // @ts-ignore
  let num: any = parseFloat(value);

  if (!isNaN(num)) {
    num = `${num}`;
    let unit = 'px';

    if (typeof value === 'string') {
      unit = value.replace(num, '') || 'px';
    }

    const unitIdx: number = unitOptionsMap[unit];

    const hasUnit: boolean = unitIdx !== -1;

    if (hasUnit) {
      unitValueMap[unit] = num;
      res = {
        value: num,
        unit,
        unitIdx,
        unitValueMap,
      };
    }
  }

  return res;
}
