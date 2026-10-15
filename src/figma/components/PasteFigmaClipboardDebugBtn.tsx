import React from 'react';
import { figmaButtonStyle } from './styles';
import {
  decodeFigmaClipboardHtml,
  getNodeChangesFromMessage,
} from '../import/decode-clipboard';
import { readFigmaClipboardHtml } from '../import/read-clipboard';
import { nodeChangesToSimpleFigmaImportItems } from '../import/to-import-items';
import { extractComponentPatchesFromNodeChanges } from '../import/to-component-items';
import type { FigmaComponentPatch, FigmaImportItem } from '../types';
import lang from '../../style_new/index.i18n';

export interface PasteFigmaClipboardDebugBtnProps {
  /** 与「从 Figma 同步样式」相同：写入组件 Less（由组件库 value.get 提供） */
  onSyncFromFigma?: (
    items: FigmaImportItem[],
    componentPatches?: FigmaComponentPatch[]
  ) => void | number | { actualChangedCount?: number } | Promise<void | number | { actualChangedCount?: number }>;
}

export function PasteFigmaClipboardDebugBtn({ onSyncFromFigma }: PasteFigmaClipboardDebugBtnProps) {
  const [busy, setBusy] = React.useState(false);

  const handleClick = async () => {
    if (busy) return;
    setBusy(true);
    try {
      const html = await readFigmaClipboardHtml();
      const decoded = decodeFigmaClipboardHtml(html);
      const nodeChanges = getNodeChangesFromMessage(decoded.message);
      const items = nodeChangesToSimpleFigmaImportItems(nodeChanges);
      const componentPatches = extractComponentPatchesFromNodeChanges(nodeChanges);

      const antdMsg = (window as any).antd?.message;
      if (onSyncFromFigma && (items.length || componentPatches.length)) {
        const syncResult = await Promise.resolve(onSyncFromFigma(items, componentPatches));
        const actualChangedCount =
          typeof syncResult === 'number'
            ? syncResult
            : syncResult && typeof syncResult === 'object' && typeof syncResult.actualChangedCount === 'number'
              ? syncResult.actualChangedCount
              : null;
        if (actualChangedCount != null) {
          const msg = lang.figmaSyncSuccess.replace('{n}', String(actualChangedCount));
          if (antdMsg) antdMsg.success(msg);
          else alert(msg);
        } else {
          const msg = lang.figmaParsedCandidates.replace('{n}', String(items.length)).replace('{m}', String(componentPatches.length));
          if (antdMsg) antdMsg.success(msg);
          else alert(msg);
        }
      } else if (onSyncFromFigma && !items.length && !componentPatches.length) {
        if (antdMsg) antdMsg.warning(lang.figmaNoNodeParsed);
        else alert(lang.figmaNoNodeParsed);
      } else {
        if (antdMsg) antdMsg.success(lang.figmaDecodeDone);
        else alert(lang.figmaDecodeDone);
      }
    } catch (e) {
      const err = e instanceof Error ? e.message : String(e);
      const message = (window as any).antd?.message;
      if (message) message.error(err);
      else alert(err);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div style={{ padding: '4px 0' }}>
      <button
        type="button"
        disabled={busy}
        onClick={handleClick}
        style={{
          ...figmaButtonStyle,
          opacity: busy ? 0.65 : 1,
          cursor: busy ? 'wait' : 'pointer',
          width: '100%',
        }}
      >
        {busy ? lang.figmaReading : lang.syncStyleFromFigma}
      </button>
    </div>
  );
}
