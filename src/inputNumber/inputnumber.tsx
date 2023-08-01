import React from 'react';
import { InputNumber } from 'antd';
import { useCallback } from 'react';
import { useComputed, useObservable } from '@mybricks/rxui';
import css from './index.less';
import { editorsConfigKey } from '../constant';

export default function ({ editConfig }): any {
  const { value, options = [] } = editConfig;
  const model = useObservable({ val: null, value }, [value]);

  // let resAry: any[] = deepCopy(model.val)

  // const update = useCallback(() => {
  //   model.val = resAry
  //   model.value.set(resAry)
  // }, [resAry])
  //const ffn = value.get

  return <Fn options={options} model={model} />;
}

function Fn({ options, model }) {
  return (
    <div>
      {options && options.length ? (
        options?.map(
          (
            { formatter = '', width = 66, ...other },
            index: number
          ) => {
            const defaultConfig = {
              min: -Infinity,
              max: Infinity,
              step: 1,
              size: (window as any)[editorsConfigKey]?.size || 'small',
              title: '',
            } as {
              size: 'small' | 'middle' | 'large' | undefined;
            };
            const item = Object.assign(defaultConfig, other);

            return (
              <Item
                key={index}
                index={index}
                model={model}
                formatter={formatter}
                item={item}
                width={width}
              />
            );
          }
        )
      ) : (
        <div>数据不合法</div>
      )}
    </div>
  );
}

function Item({ index, model, formatter, item, width }) {
  useComputed(() => {
    model.val = Array.isArray(model.value.get()) ? model.value.get() : [0];
  });

  const update = useCallback(() => {
    model.value.set(model.val);
  }, []);

  // useEffect(()=>{
  //   return ()=>{
  //     console.log(Math.random())
  //   }
  // },[])

  return (
    <div className={css.editInputnumber}>
      <div className={css.editInputnumberAll} style={{ width }}>
        <InputNumber
          {...item}
          value={
            Array.isArray(model.val) ? model.val[index] || 0 : model.val || 0
          }
          formatter={(evt) => `${evt}${formatter}`}
          parser={(evt) => (evt ? evt.replace(formatter, '') : '')}
          style={{ width }}
          onChange={(evt) => {
            if (typeof evt === 'number') {
              if (evt >= item.min && evt <= item.max) {
                model.val[index] = evt;
                update();
              }
            } else {
              if (model.val[index] !== item.min) {
                model.val[index] = item.min;
                update();
              }
            }
            // if (typeof evt === 'number' && evt >= item.min && evt <= item.max) {
            //   model.val[index] = evt;
            //   update();
            // }
          }}

        // onBlur={update}
        />
        <div className={css.editInputnumberAllTitle}>{item.title || ''}</div>
      </div>
    </div>
  );
}
