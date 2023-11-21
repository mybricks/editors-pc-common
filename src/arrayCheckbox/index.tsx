import React, { useMemo, useCallback } from 'react';
import { useObservable } from '@mybricks/rxui';
import { EditConfig } from '@/interface';
import ListSetter from './listSetter/index';
import { isValid, getOptionsFromEditor } from '../utils';
import AryContext from '../array/context';

export default function ({ editConfig, injectEditors, ...extraContext }: { editConfig: EditConfig, injectEditors: any }): any {
  const { value, options, getDefaultOptions, locales } = editConfig;

  const model = useObservable(
    { val: isValid(value.get()) ? value.get() : false, value },
    [value]
  );

  const updateVal = useCallback((val) => {
    model.val = val;
    model.value.set(model.val);
  }, []);

  const opt = useMemo(() => {
    return getOptionsFromEditor(options)
  }, [options])

  return (
    <AryContext.Provider value={{ injectEditors }}>
      <ListSetter
        value={model.val}
        onChange={updateVal}
        items={opt.items}
        getTitle={opt.getTitle}
        editable={opt.editable}
        checkField={opt.checkField}
        visibleField={opt.visibleField}
        locales={locales}
        extraContext={extraContext}
        getDefaultOptions={getDefaultOptions}
      />
    </AryContext.Provider>
  );
}
