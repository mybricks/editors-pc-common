import React, { useEffect, useMemo, useCallback } from 'react';
import { useComputed, useObservable } from '@mybricks/rxui';
import { EditConfig } from '@/interface';
import ListSetter from './listSetter/index';
import { isValid, getOptionsFromEditor } from '../utils';
import AryContext from './context';

export default function ({ editConfig, injectEditors, ...extraContext }: { editConfig: EditConfig }): any {
  const { value, options } = editConfig;

  const model = useObservable(
    { val: isValid(value.get()) ? value.get() : false, value },
    [value]
  );

  const updateVal = useCallback((val) => {
    model.val = val;
    model.value.set(model.val);
  }, []);
	
	/** 响应外层值变化 */
	useEffect(() => {
		model.val = value.get();
	}, [value.get()]);

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
        value={model.val}
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
