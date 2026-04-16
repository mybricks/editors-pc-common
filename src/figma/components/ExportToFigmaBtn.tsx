import React from 'react';
import { useExportToFigma, FontfaceConfig } from '../hooks/useExportToFigma';
import { ProgressButton } from './ProgressButton';

export interface ExportToFigmaBtnProps {
  comEle: HTMLElement | null | undefined;
  comId: string;
  fontfaces?: FontfaceConfig[];
}

export function ExportToFigmaBtn({ comEle, comId, fontfaces }: ExportToFigmaBtnProps) {
  const { loading, progress, handleExport } = useExportToFigma(comEle, comId, { fontfaces });
  return <ProgressButton loading={loading} progress={progress} onClick={handleExport} />;
}
