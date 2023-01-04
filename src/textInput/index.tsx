import React, { useMemo, useCallback } from 'react';

import { Input } from 'antd';
import { debounce } from '../util/lodash';
import { EditorProps } from '../interface';
import { useObservable } from '@mybricks/rxui';
import { getOptionsFromEditor, isValid } from '../utils';

import css from './index.less';
import { editorsConfigKey } from '../constant';

export default function ({ editConfig }: EditorProps): JSX.Element {
  const { value, options = {} } = editConfig;
  const model = useObservable(
    { val: isValid(value.get()) ? value.get() : '', value },
    [value]
  );
  const {
    readonly = false,
    ...config
  } = getOptionsFromEditor(options);

  const setVal = useCallback(() => {
    model.value.set(model.val);
  }, []);

  const debouncedSetVal = debounce(setVal, 300);
  const updateVal = useCallback((evt: any) => {
    model.val = evt.target.value;
    debouncedSetVal();
  }, []);

  return (
    <div className={css['editor-textArea']}>
      <Input
        size={(window as any)[editorsConfigKey]?.size || 'small'}
        onChange={updateVal}
        disabled={readonly}
        defaultValue={model.val}
        {...config}
      />
    </div>
  );
}
