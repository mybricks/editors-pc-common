import React from 'react';
import { ExportToFigmaBtn } from './components/ExportToFigmaBtn';
import { PasteFigmaClipboardDebugBtn } from './components/PasteFigmaClipboardDebugBtn';
import type { FigmaImportItem } from './types';

export type { FigmaImportItem };

function FigmaEditor(props: any) {
  const  { editConfig } = props 
  const { value, edtContext, fontfaces,scenes } = editConfig;

  const comId: string = edtContext?.id;
  const comEle: HTMLElement = edtContext?.focusArea?.ele;
  // value.get() 可能返回旧格式（函数）或新格式（{ onSync, getCanvasList }）
  const result = value?.get?.();
  const onSyncFromFigmaRaw: ((items: FigmaImportItem[], rootEl?: HTMLElement | null) => void) | undefined =
    typeof result === 'function' ? result : result?.onSync;
  const onSyncFromFigma: ((items: FigmaImportItem[]) => void) | undefined = onSyncFromFigmaRaw
    ? (items: FigmaImportItem[]) => onSyncFromFigmaRaw(items, comEle ?? null)
    : undefined;
  const canvasList: ArrayLike<Element> = result?.getCanvasList?.() ?? [];

  // 原有路径（comEle 下的 [data-zone-type="page"]）是否可用
  const hasPrimaryEle = !!(comEle?.dataset?.zoneType === 'page'
    ? comEle
    : comEle?.querySelector('[data-zone-type="page"]'));

  return (
    <div>
      <ExportToFigmaBtn comEle={comEle} comId={comId} fontfaces={fontfaces} canvasList={canvasList} />
      {hasPrimaryEle && <PasteFigmaClipboardDebugBtn onSyncFromFigma={onSyncFromFigma} />}
    </div>
  );
}

export default FigmaEditor;
