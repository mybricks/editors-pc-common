import React from 'react';
import { ExportToFigmaBtn } from './components/ExportToFigmaBtn';
import { SyncFromFigmaBtn } from './components/SyncFromFigmaBtn';
import { PasteFigmaClipboardDebugBtn } from './components/PasteFigmaClipboardDebugBtn';
import type { FigmaImportItem } from './types';

export type { FigmaImportItem };

function FigmaEditor({ editConfig }: any) {
  const { value, edtContext, fontfaces } = editConfig;

  const comId: string = edtContext?.id;
  const comEle: HTMLElement = edtContext?.focusArea?.ele;
  // value.get() 可能返回旧格式（函数）或新格式（{ onSync, saveBaseline }）
  const result = value?.get?.();
  const onSyncFromFigmaRaw: ((items: FigmaImportItem[], rootEl?: HTMLElement | null) => void) | undefined =
    typeof result === 'function' ? result : result?.onSync;
  const onSyncFromFigma: ((items: FigmaImportItem[]) => void) | undefined = onSyncFromFigmaRaw
    ? (items: FigmaImportItem[]) => onSyncFromFigmaRaw(items, comEle ?? null)
    : undefined;
  const saveBaselineRaw: ((rootEl?: HTMLElement | null) => void) | undefined =
    result && typeof result === 'object' ? result.saveBaseline : undefined;
  const saveBaseline: ((rootEl: HTMLElement | null) => void) | undefined = saveBaselineRaw
    ? (rootEl: HTMLElement | null) => saveBaselineRaw(rootEl)
    : undefined;

  return (
    <div>
      <ExportToFigmaBtn comEle={comEle} comId={comId} fontfaces={fontfaces} onExportSuccess={saveBaseline} />
      <PasteFigmaClipboardDebugBtn onSyncFromFigma={onSyncFromFigma} />
      {/* {onSyncFromFigma && <SyncFromFigmaBtn onSync={onSyncFromFigma} />} */}
    </div>
  );
}

export default FigmaEditor;
