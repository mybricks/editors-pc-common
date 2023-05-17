import React, { useEffect, useMemo, useCallback } from 'react';
import { useComputed, useObservable } from '@mybricks/rxui';
import { EditConfig } from '@/interface';
import ListSetter from './listSetter/index';
import { isValid, getOptionsFromEditor } from '../utils';
import AryContext from './context';

export default function ({ editConfig, injectEditors, ...extraContext }: { editConfig: EditConfig }): any {
  const { value, options } = editConfig;

  const updateVal = useCallback((val) => {
    value.set(val);
  }, [value]);

  const opt = useMemo(() => {
    const opt = getOptionsFromEditor(options)
    if (Object.keys(opt).length === 1 && opt.options) {
      return opt.options
    }
    return opt
  }, [options])

  return (
    <AryContext.Provider value={{ injectEditors }}>
      <ListSetter
        value={isValid(value.get()) ? value.get() : []}
        onChange={updateVal}
        items={opt.items}
        getTitle={opt.getTitle}
        onSelect={opt.onSelect}
        onAdd={opt.onAdd}
        onRemove={opt.onRemove}
        draggable={opt.draggable}
        editable={opt.editable}
        deletable={opt.deletable}
        addable={opt.addable}
        selectable={opt.selectable}
        addText={opt.addText}
        customOptRender={opt.customOptRender}
        extraContext={extraContext}
      />
    </AryContext.Provider>
  );
}
