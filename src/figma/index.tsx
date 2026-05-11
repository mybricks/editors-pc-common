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
  // 传函数引用而非立即调用，推迟到点击导出时才查 DOM，避免页面未聚焦时拿到空列表
  const getCanvasList: (() => ArrayLike<Element>) | undefined = result?.getCanvasList;

  // 原有路径（comEle 下的 [data-zone-type="page"]）是否可用
  const hasPrimaryEle = !!(comEle?.dataset?.zoneType === 'page'
    ? comEle
    : comEle?.querySelector('[data-zone-type="page"]'));

  return (
    <div>
      <ExportToFigmaBtn comEle={comEle} comId={comId} fontfaces={fontfaces} getCanvasList={getCanvasList} />
      {hasPrimaryEle && <PasteFigmaClipboardDebugBtn onSyncFromFigma={onSyncFromFigma} />}
    </div>
  );
}

export default FigmaEditor;
