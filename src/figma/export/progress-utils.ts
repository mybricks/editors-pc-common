import React from 'react';

export interface ExportProgress {
  percent: number;
  text: string;
}

export function waitForPaint(): Promise<void> {
  return new Promise((resolve) => {
    requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
  });
}

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

export function startProgressTrickle(
  setProgress: React.Dispatch<React.SetStateAction<ExportProgress>>,
  options: { text: string; start: number; max: number; step?: number; intervalMs?: number }
): () => void {
  const { text, start, max, step = 2, intervalMs = 220 } = options;
  let current = start;
  setProgress((prev) => ({ percent: Math.max(prev.percent, start), text }));

  const timer = window.setInterval(() => {
    current = Math.min(max, current + step);
    setProgress((prev) => {
      if (prev.text !== text || prev.percent >= max) return prev;
      return { percent: Math.max(prev.percent, current), text };
    });
  }, intervalMs);

  return () => window.clearInterval(timer);
}
