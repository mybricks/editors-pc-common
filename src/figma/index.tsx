import React from 'react';
import { ExportToFigmaBtn } from './components/ExportToFigmaBtn';
import { PasteFigmaClipboardDebugBtn } from './components/PasteFigmaClipboardDebugBtn';
import type { FigmaImportItem } from './types';

export type { FigmaImportItem };

function FigmaEditor({ editConfig }: any) {
  const { value, edtContext, fontfaces } = editConfig;

  const comId: string = edtContext?.id;
  const comEle: HTMLElement = edtContext?.focusArea?.ele;
  // value.get() 可能返回旧格式（函数）或新格式（{ onSync }）
  const result = value?.get?.();
  const onSyncFromFigmaRaw: ((items: FigmaImportItem[], rootEl?: HTMLElement | null) => void) | undefined =
    typeof result === 'function' ? result : result?.onSync;
  const onSyncFromFigma: ((items: FigmaImportItem[]) => void) | undefined = onSyncFromFigmaRaw
    ? (items: FigmaImportItem[]) => onSyncFromFigmaRaw(items, comEle ?? null)
    : undefined;

  return (
    <div>
      <ExportToFigmaBtn comEle={comEle} comId={comId} fontfaces={fontfaces} />
      <PasteFigmaClipboardDebugBtn onSyncFromFigma={onSyncFromFigma} />
    </div>
  );
}

export default FigmaEditor;
