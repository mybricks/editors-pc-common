import React, { useCallback } from 'react';

import { useObservable } from '@mybricks/rxui';
import { Checkbox } from 'antd';
import { isValid } from '../utils';
import css from './index.less';

export default function ({ editConfig }): any {
  const { value, options } = editConfig;
  let datasource;
  let props = {};
  if (Array.isArray(options)) {
    datasource = options;
  } else {
    props = options || {};
  }

  const model = useObservable(
    { val: isValid(value.get()) ? value.get() : [], value },
    [value]
  );

  const updateVal = useCallback((val: any[]) => {
    model.val = val;
    model.value.set(model.val);
  }, []);
  
  return (
    <div className={css.editor}>
      <Checkbox.Group
        options={datasource}
        // buttonStyle={'solid'}
        onChange={updateVal}
        value={model.val}
        // optionType="button"
        // size="small"
        {...props}
      />
    </div>
  );
}
