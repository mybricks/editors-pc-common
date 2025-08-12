import { EditConfig } from "@/interface";
import React, { useCallback, useMemo } from "react";
import { getOptionsFromEditor, isValid } from "../utils";
import AryContext from "./context";
import ListSetter from "./listSetter/index";

export default function ({
  editConfig,
  injectEditors,
  ...extraContext
}: {
  editConfig: EditConfig;
  injectEditors: any;
}): any {
  const { value, options, getDefaultOptions, locales } = editConfig;

  const updateVal = useCallback(
    (val: Array<any>) => {
      value.set(val);
    },
    [value]
  );
  /** 获取应用层配置的 editor options */
  const defaultOptions = useMemo(() => getDefaultOptions?.("array") || {}, []);

  const opt = useMemo(() => {
    const opt = getOptionsFromEditor(options);
    if (opt && Object.keys(opt).length === 1 && opt.options) {
      return opt.options;
    }
    return opt || {};
  }, [options]);

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
        defaultSelect={opt.defaultSelect}
        selectable={opt.selectable}
        addText={opt.addText}
        customOptRender={opt.customOptRender}
        extraContext={extraContext}
        locales={locales}
        cdnMap={defaultOptions.CDN || {}}
        getDefaultOptions={getDefaultOptions}
        handleDelete={opt.handleDelete}
        tagsRender={opt.tagsRender}
        batchEditable={opt.batchEditable}
        batchWidth={opt.batchWidth}
      />
    </AryContext.Provider>
  );
}
