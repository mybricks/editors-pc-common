import React from 'react';
import { figmaButtonStyle } from './styles';
import {
  decodeFigmaClipboardHtml,
  getNodeChangesFromMessage,
} from '../import/decode-clipboard';
import { readFigmaClipboardHtml } from '../import/read-clipboard';
import { nodeChangesToSimpleFigmaImportItems } from '../import/to-import-items';
import type { FigmaImportItem } from '../types';

export interface PasteFigmaClipboardDebugBtnProps {
  /** 与「从 Figma 同步样式」相同：写入组件 Less（由组件库 value.get 提供） */
  onSyncFromFigma?: (
    items: FigmaImportItem[]
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

      const antdMsg = (window as any).antd?.message;
      if (onSyncFromFigma && items.length) {
        const syncResult = await Promise.resolve(onSyncFromFigma(items));
        const actualChangedCount =
          typeof syncResult === 'number'
            ? syncResult
            : syncResult && typeof syncResult === 'object' && typeof syncResult.actualChangedCount === 'number'
              ? syncResult.actualChangedCount
              : null;
        if (actualChangedCount != null) {
          if (antdMsg) antdMsg.success(`成功从Figma同步${actualChangedCount}条样式改动`);
          else alert(`成功从Figma同步${actualChangedCount}条样式改动`);
        } else {
          if (antdMsg) antdMsg.success(`已解析${items.length}条候选样式`);
          else alert(`已解析${items.length}条候选样式`);
        }
      } else if (onSyncFromFigma && !items.length) {
        if (antdMsg) antdMsg.warning('未解析到可同步节点（图层名需为单个 class，如 myCard）');
        else alert('未解析到可同步节点');
      } else {
        if (antdMsg) antdMsg.success('已解码完成');
        else alert('已解码完成');
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
        {busy ? '读取中…' : '从 Figma 同步样式'}
      </button>
    </div>
  );
}
