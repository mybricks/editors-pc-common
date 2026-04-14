import React from 'react';
import { ExportToFigmaBtn } from './components/ExportToFigmaBtn';
import { SyncFromFigmaBtn } from './components/SyncFromFigmaBtn';
import type { FigmaImportItem } from './types';

export type { FigmaImportItem };

function FigmaEditor({ editConfig }: any) {
  const { value, edtContext } = editConfig;

  const comId: string = edtContext?.id;
  const comEle: HTMLElement = edtContext?.focusArea?.ele;
  // onSyncFromFigma 由外部通过 value.get() 提供，签名：(items: FigmaImportItem[]) => void
  const onSyncFromFigma: ((items: FigmaImportItem[]) => void) | undefined = value?.get?.();

  return (
    <div>
      <ExportToFigmaBtn comEle={comEle} comId={comId} />
      {onSyncFromFigma && <SyncFromFigmaBtn onSync={onSyncFromFigma} />}
    </div>
  );
}

export default FigmaEditor;
