import React from 'react';
import { figmaButtonStyle } from './styles';
import type { FigmaImportItem } from '../types';

export interface SyncFromFigmaBtnProps {
  onSync: (items: FigmaImportItem[]) => void;
}

export function SyncFromFigmaBtn({ onSync }: SyncFromFigmaBtnProps) {
  const handleClick = () => {
    navigator.clipboard.readText().then(
      (text) => {
        if (!text || String(text).trim() === '') {
          alert('剪切板无内容，请先从 Figma 复制后再同步');
          return;
        }
        try {
          const parsed = JSON.parse(text);
          const figmaItems: FigmaImportItem[] = Array.isArray(parsed) ? parsed : [parsed];
          onSync(figmaItems);
        } catch (e) {
          console.error('[从 Figma 同步] 剪切板内容不是合法 JSON', e);
          alert('剪切板内容不是合法 JSON，请确认已从 Figma 正确复制');
        }
      },
      (err) => {
        console.error('[从 Figma 同步] 读取剪切板失败', err);
        alert('读取剪切板失败，请检查浏览器权限或剪切板是否有内容');
      }
    );
  };

  return (
    <div style={{ padding: '4px 0' }}>
      <button type="button" onClick={handleClick} style={figmaButtonStyle}>
        从 Figma 同步样式
      </button>
    </div>
  );
}
