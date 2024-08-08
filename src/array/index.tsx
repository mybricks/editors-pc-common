import React, {useCallback, useMemo} from 'react';
import {EditConfig} from '@/interface';
import ListSetter from './listSetter/index';
import {getOptionsFromEditor, isValid} from '../utils';
import AryContext from './context';

export default function ({editConfig, injectEditors, ...extraContext}: { editConfig: EditConfig }): any {
  const {value, options, getDefaultOptions, locales} = editConfig;
  
  const updateVal = useCallback((val) => {
    value.set(val);
  }, [value]);
  /** 获取应用层配置的 editor options */
  const defaultOptions = useMemo(() => getDefaultOptions?.('array') || {}, []);
  
  const opt = useMemo(() => {
    const opt = getOptionsFromEditor(options)
    if (opt && Object.keys(opt).length === 1 && opt.options) {
      return opt.options
    }
    return opt || {}
  }, [options])
  
  return (
    <AryContext.Provider value={{injectEditors}}>
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
        defaultSelect={opt.defaultSelect}
        selectable={opt.selectable}
        addText={opt.addText}
        customOptRender={opt.customOptRender}
        extraContext={extraContext}
        locales={locales}
        cdnMap={defaultOptions.CDN || {}}
        getDefaultOptions={getDefaultOptions}
      />
    </AryContext.Provider>
  );
}
