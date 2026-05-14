import React from 'react';
import { useExportToFigma, FontfaceConfig } from '../hooks/useExportToFigma';
import { ProgressButton } from './ProgressButton';
import { CheckIcon } from './CheckIcon';
import { SpinIcon } from './SpinIcon';
import { figmaButtonStyle } from './styles';


/** 变体库映射状态图标（上下左右 4 菱形十字布局，Figma component set 风格） */
function VariantIcon({ active }: { active: boolean }) {
  const color = active ? 'var(--mybricks-color-primary, #1677ff)' : 'var(--mybricks-text-color-secondary, #aaa)';
  return (
    <svg width="13" height="13" viewBox="0 0 14 14" fill={color} xmlns="http://www.w3.org/2000/svg">
      {/* 上 */}
      <path d="M7 0.5 L10 3.5 L7 6.5 L4 3.5 Z" />
      {/* 右 */}
      <path d="M7.5 7 L10.5 4 L13.5 7 L10.5 10 Z" />
      {/* 下 */}
      <path d="M7 7.5 L10 10.5 L7 13.5 L4 10.5 Z" />
      {/* 左 */}
      <path d="M0.5 7 L3.5 4 L6.5 7 L3.5 10 Z" />
    </svg>
  );
}

export interface ExportToFigmaBtnProps {
  comEle: HTMLElement | null | undefined;
  comId: string;
  fontfaces?: FontfaceConfig[];
  getCanvasList?: () => ArrayLike<Element>;
}

export function ExportToFigmaBtn({ comEle, comId, fontfaces, getCanvasList }: ExportToFigmaBtnProps) {
  const [componentLibraryEnabled, setComponentLibraryEnabled] = React.useState(false);

  const handleToggle = React.useCallback(() => {
    setComponentLibraryEnabled(prev => !prev);
  }, []);

  const { loading, progress, handleExport, pendingClipboardHtml, handleRetryClipboard } = useExportToFigma(
    comEle,
    comId,
    { fontfaces, getCanvasList, componentLibraryEnabled }
  );

  const tip = componentLibraryEnabled
    ? '点击关闭变体库映射'
    : '点击开启变体库映射';

  // 变体库映射切换按钮（与主按钮共用一条边框，视觉上融为一体）
  function wrapWithVariantToggle(mainBtn: React.ReactNode, mainLabel?: React.ReactNode) {
    const isRetry = !!mainLabel;
    return (
      <div style={{ padding: '4px 0', display: 'flex' }}>
        {/* 主按钮区：复用 ProgressButton 样式但独立渲染以拼接右侧按钮 */}
        <button
          type="button"
          disabled={loading}
          onClick={isRetry ? handleRetryClipboard : handleExport}
          style={{
            ...figmaButtonStyle,
            flex: 1,
            borderRadius: '6px 0 0 6px',
            borderRight: 'none',
            cursor: loading ? 'not-allowed' : 'pointer',
            position: 'relative',
            overflow: 'hidden',
          }}
        >
          {loading && (
            <>
              <div style={{ position: 'absolute', inset: 0, background: 'var(--mybricks-border-color, rgba(0,0,0,0.12))', opacity: 0.35 }} />
              <div style={{
                position: 'absolute', top: 0, left: 0, height: '100%',
                width: `${Math.min(Math.max(progress.percent, 0), 100)}%`,
                background: 'var(--mybricks-color-primary, #1677ff)', opacity: 0.22,
                transition: 'width 320ms ease-out',
              }} />
            </>
          )}
          <span style={{ position: 'relative', zIndex: 1, display: 'inline-flex', alignItems: 'center', overflow: 'hidden' }}>
            {isRetry ? (
              mainLabel
            ) : loading ? (
              <>
                <SpinIcon />
                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flexShrink: 1, minWidth: 0 }}>
                  {progress.text}
                </span>
                <span style={{ flexShrink: 0, marginLeft: 4 }}>{Math.round(progress.percent)}%</span>
              </>
            ) : (
              <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{comEle ? '复制到 Figma' : '复制全部页面到 Figma'}</span>
            )}
          </span>
        </button>

        {/* 变体库映射切换按钮 */}
        <button
          type="button"
          onClick={handleToggle}
          data-mybricks-tip={`{"content":"${tip}","position":"left"}`}
          style={{
            ...figmaButtonStyle,
            width: 28,
            flex: 'none',
            borderRadius: '0 6px 6px 0',
            padding: 0,
            backgroundColor: componentLibraryEnabled
              ? 'rgba(22,119,255,0.07)'
              : figmaButtonStyle.backgroundColor,
          }}
        >
          <VariantIcon active={componentLibraryEnabled} />
        </button>
      </div>
    );
  }

  if (pendingClipboardHtml) {
    return wrapWithVariantToggle(null, (
      <>
        <CheckIcon />
        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          复制已生成的 Figma 数据
        </span>
      </>
    ));
  }

  return wrapWithVariantToggle(null);
}
