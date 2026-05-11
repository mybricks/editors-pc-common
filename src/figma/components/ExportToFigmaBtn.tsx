import React from 'react';
import { useExportToFigma, FontfaceConfig } from '../hooks/useExportToFigma';
import { ProgressButton } from './ProgressButton';

export interface ExportToFigmaBtnProps {
  comEle: HTMLElement | null | undefined;
  comId: string;
  fontfaces?: FontfaceConfig[];
  canvasList?: ArrayLike<Element>;
}

export function ExportToFigmaBtn({ comEle, comId, fontfaces, canvasList }: ExportToFigmaBtnProps) {
  const { loading, progress, handleExport } = useExportToFigma(comEle, comId, { fontfaces, canvasList });
  return <ProgressButton loading={loading} progress={progress} onClick={handleExport} />;
}
