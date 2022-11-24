import React, { useCallback } from 'react';
import { useObservable } from '@mybricks/rxui';
import {debounce} from '../util/lodash';
import { Slider, InputNumber } from 'antd';
import { isValid, typeCheck } from '../utils';
import { EditorProps } from '../interface';
import css from './index.less';

const getOptions = (opt: any) => {
  const options = typeof opt === 'function' ? opt().options || opt() : opt;
  return Array.isArray(options) ? options.find(def => typeCheck(def, 'OBJECT')) : options;
}

export default function ({ editConfig }: EditorProps): JSX.Element {
  const { value, options = {} } = editConfig;
  const model = useObservable(
    { val: isValid(value.get()) ? value.get() : 0, value },
    [value]
  );

  const {
    min = 0,
    max = 100,
    step = 1,
    formatter = '',
    readonly = false,
  } = getOptions(options);

  const updateVal = useCallback((evt: any) => {
    if (typeof evt !== 'number') return;
    const v = Number(evt) || 0;

    if (v >= min && v <= max) {
      model.val = v;
    } else if (v > max) {
      model.val = max;
    } else {
      model.val = min;
    }
  }, []);

  const setVal = useCallback(() => {
    model.value.set(model.val);
  }, []);

  const debouncedSetVal = debounce(setVal, 300);
  const updateValForInputNumber = useCallback((evt: any) => {
    updateVal(evt);
    debouncedSetVal();
  }, []);

  return !readonly ? (
    <div className={css['editor-slider']}>
      <Slider
        min={min}
        max={max}
        step={step}
        tipFormatter={null}
        value={model.val}
        onChange={updateVal}
        onAfterChange={setVal}
        className={css['editor-slider__slider']}
      />
      <InputNumber
        min={min}
        max={max}
        step={step}
        size="small"
        className={css['editor-slider__input']}
        value={model.val}
        onChange={updateValForInputNumber}
      />
      <span className={css['editor-slider__formatter']}>{formatter}</span>
    </div>
  ) : (
    <div>{`${model.val}${formatter}`}</div>
  );
}
