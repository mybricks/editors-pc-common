import React from 'react';
import { useExportToFigma } from '../hooks/useExportToFigma';
import { ProgressButton } from './ProgressButton';

export interface ExportToFigmaBtnProps {
  comEle: HTMLElement | null | undefined;
  comId: string;
}

export function ExportToFigmaBtn({ comEle, comId }: ExportToFigmaBtnProps) {
  const { loading, progress, handleExport } = useExportToFigma(comEle, comId);
  return <ProgressButton loading={loading} progress={progress} onClick={handleExport} />;
}
