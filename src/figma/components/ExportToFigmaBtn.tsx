import React from 'react';
import { useExportToFigma, FontfaceConfig } from '../hooks/useExportToFigma';
import { ProgressButton } from './ProgressButton';

export interface ExportToFigmaBtnProps {
  comEle: HTMLElement | null | undefined;
  comId: string;
  fontfaces?: FontfaceConfig[];
  /** 导出成功写入剪贴板后触发，用于保存 baseline */
  onExportSuccess?: (rootEl: HTMLElement | null) => void;
}

export function ExportToFigmaBtn({ comEle, comId, fontfaces, onExportSuccess }: ExportToFigmaBtnProps) {
  const { loading, progress, handleExport } = useExportToFigma(comEle, comId, { fontfaces, onExportSuccess });
  return <ProgressButton loading={loading} progress={progress} onClick={handleExport} />;
}
