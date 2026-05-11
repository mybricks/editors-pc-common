import React from 'react';
import { useExportToFigma, FontfaceConfig } from '../hooks/useExportToFigma';
import { ProgressButton } from './ProgressButton';
import { CheckIcon } from './CheckIcon';

export interface ExportToFigmaBtnProps {
  comEle: HTMLElement | null | undefined;
  comId: string;
  fontfaces?: FontfaceConfig[];
  getCanvasList?: () => ArrayLike<Element>;
}

export function ExportToFigmaBtn({ comEle, comId, fontfaces, getCanvasList }: ExportToFigmaBtnProps) {
  const { loading, progress, handleExport, pendingClipboardHtml, handleRetryClipboard } = useExportToFigma(
    comEle,
    comId,
    { fontfaces, getCanvasList }
  );

  // 数据已生成但因失焦未写入剪贴板时，按钮切换为"复制已生成的 Figma 数据"，
  // 点击后直接复用已生成的数据写入剪贴板，避免重新生成
  if (pendingClipboardHtml) {
    return (
      <ProgressButton
        loading={false}
        progress={progress}
        onClick={handleRetryClipboard}
        label={
          <>
            <CheckIcon />
            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              复制已生成的 Figma 数据
            </span>
          </>
        }
      />
    );
  }

  return <ProgressButton loading={loading} progress={progress} onClick={handleExport} />;
}
