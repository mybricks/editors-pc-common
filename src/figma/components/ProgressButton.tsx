import React from 'react';
import { SpinIcon } from './SpinIcon';
import { figmaButtonStyle } from './styles';
import type { ExportProgress } from '../hooks/useExportToFigma';

interface ProgressButtonProps {
  loading: boolean;
  progress: ExportProgress;
  onClick: () => void;
  label?: string;
}

export function ProgressButton({
  loading,
  progress,
  onClick,
  label = '复制到 Figma',
}: ProgressButtonProps) {
  const widthPercent = Math.min(Math.max(progress.percent, 0), 100);
  const displayPercent = Math.round(widthPercent);

  return (
    <div style={{ padding: '4px 0' }}>
      <button
        type="button"
        disabled={loading}
        onClick={onClick}
        style={{
          ...figmaButtonStyle,
          position: 'relative',
          overflow: 'hidden',
          cursor: loading ? 'not-allowed' : 'pointer',
        }}
      >
        {loading && (
          <>
            <div
              style={{
                position: 'absolute',
                inset: 0,
                background: 'var(--mybricks-border-color, rgba(0,0,0,0.12))',
                opacity: 0.35,
              }}
            />
            <div
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                height: '100%',
                width: `${widthPercent}%`,
                background: 'var(--mybricks-color-primary, #1677ff)',
                opacity: 0.22,
                transition: 'width 320ms ease-out',
              }}
            />
            <div
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                height: '100%',
                width: `${widthPercent}%`,
                overflow: 'hidden',
                transition: 'width 320ms ease-out',
              }}
            >
              <div
                style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  width: '35%',
                  height: '100%',
                  borderRadius: 999,
                  background:
                    'linear-gradient(90deg, transparent, var(--mybricks-color-primary, #1677ff), transparent)',
                  animation: 'vibeui-progress-slide 1.1s linear infinite',
                  pointerEvents: 'none',
                  mixBlendMode: 'screen',
                  opacity: 0.5,
                }}
              />
            </div>
          </>
        )}
        <span
          style={{
            position: 'relative',
            zIndex: 1,
            display: 'inline-flex',
            alignItems: 'center',
          }}
        >
          {loading ? (
            <>
              <SpinIcon />
              {progress.text} {displayPercent}%
            </>
          ) : (
            label
          )}
        </span>
      </button>
    </div>
  );
}
