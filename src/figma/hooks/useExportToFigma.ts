import React from 'react';
import { convertIRToFigmaClipboardHtml, elementToMybricksJsonWithInlineImages } from '../export';
import { loadFontContextMapForFamilies, collectFontFamiliesFromIR } from '../export/font-loader';
import { writeHtmlToClipboard, isNotFocusedClipboardError } from '../export/clipboard';
import {
  ExportProgress,
  waitForPaint,
  sleep,
  startProgressTrickle,
} from '../export/progress-utils';

export type { ExportProgress };

export interface FontfaceConfig {
  label?: string;
  value?: string;
  /** 字体文件 URL，用于导出到 Figma 时加载字形数据 */
  url?: string;
}

export function useExportToFigma(
  comEle: HTMLElement | null | undefined,
  comId: string,
  options?: { fontfaces?: FontfaceConfig[]; onExportSuccess?: (rootEl: HTMLElement | null) => void }
) {
  const [loading, setLoading] = React.useState(false);
  const [progress, setProgress] = React.useState<ExportProgress>({
    percent: 0,
    text: '准备中...',
  });
  const progressRef = React.useRef<ExportProgress>(progress);

  React.useEffect(() => {
    progressRef.current = progress;
  }, [progress]);

  const setStage = React.useCallback(
    async (
      percent: number,
      text: string,
      options?: { smooth?: boolean; durationMs?: number }
    ) => {
      const target = Math.max(0, Math.min(percent, 100));
      if (!options?.smooth) {
        setProgress({ percent: target, text });
        await waitForPaint();
        return;
      }
      const from = Math.min(Math.max(progressRef.current.percent, 0), target);
      const durationMs = options.durationMs ?? 420;
      if (target <= from || durationMs <= 0) {
        setProgress({ percent: target, text });
        await waitForPaint();
        return;
      }
      await new Promise<void>((resolve) => {
        const start = performance.now();
        const tick = (now: number) => {
          const t = Math.min((now - start) / durationMs, 1);
          const current = from + (target - from) * t;
          setProgress({ percent: current, text });
          if (t >= 1) {
            resolve();
            return;
          }
          requestAnimationFrame(tick);
        };
        requestAnimationFrame(tick);
      });
      await waitForPaint();
    },
    []
  );

  const waitStageWithTrickle = React.useCallback(
    async <T,>(options: {
      text: string;
      from: number;
      to: number;
      task: () => Promise<T>;
      intervalMs?: number;
      taskStartDelayMs?: number;
    }): Promise<T> => {
      const { text, from, to, task, intervalMs = 130, taskStartDelayMs = 0 } = options;
      await setStage(from, text, { smooth: true, durationMs: 260 });
      const trickleMax = Math.max(from, to - 1);
      const current = Math.round(
        Math.min(Math.max(progressRef.current.percent, from), trickleMax)
      );
      const start = Math.max(from, current);
      const stopTrickle =
        trickleMax > start
          ? startProgressTrickle(setProgress, {
              text,
              start,
              max: trickleMax,
              step: 1,
              intervalMs,
            })
          : null;
      try {
        if (taskStartDelayMs > 0) await sleep(taskStartDelayMs);
        const result = await task();
        if (stopTrickle) stopTrickle();
        await setStage(to, text, { smooth: true, durationMs: 260 });
        return result;
      } catch (err) {
        if (stopTrickle) stopTrickle();
        throw err;
      }
    },
    [setStage]
  );

  // 从外部 fontfaces 配置构建 { cssName -> url } 映射，供字体加载器使用
  const fontUrlMap = React.useMemo<Record<string, string>>(() => {
    const map: Record<string, string> = {};
    for (const item of options?.fontfaces ?? []) {
      if (item.value && item.url) map[item.value] = item.url;
    }
    return map;
  }, [options?.fontfaces]);

  const handleExport = React.useCallback(() => {
    if (loading) return;
    const ele = (comEle?.dataset?.zoneType === 'page'
      ? comEle
      : comEle?.querySelector('[data-zone-type="page"]')) as HTMLElement | null;
    if (!ele) {
      return;
    }

    const msg = (window as any).antd?.message;
    setProgress({ percent: 0, text: '准备中...' });
    setLoading(true);

    requestAnimationFrame(() => {
      requestAnimationFrame(async () => {
        try {
          await setStage(8, '准备中...');

          await waitStageWithTrickle({
            text: '解析页面结构...',
            from: 10,
            to: 25,
            task: () => sleep(650),
          });

          // 先跑 DOM→IR，收集实际用到的字体族，再按需加载
          const irPayload = await waitStageWithTrickle({
            text: '拉取图片资源...',
            from: 25,
            to: 55,
            task: () =>
              elementToMybricksJsonWithInlineImages(ele, comId, {
                componentLibraryEnabled: false,
              }),
            taskStartDelayMs: 320,
          });

          const _fontFamilies = collectFontFamiliesFromIR(irPayload);
          const fontCtx = await waitStageWithTrickle({
            text: `加载字体（${_fontFamilies.filter(f => f !== 'PingFang SC').join('、') || 'PingFang SC'}）...`,
            from: 55,
            to: 70,
            task: () => loadFontContextMapForFamilies(_fontFamilies, fontUrlMap),
          });

          await setStage(75, '生成 Figma 数据...', { smooth: true, durationMs: 360 });
          const clipboardHtml = convertIRToFigmaClipboardHtml(irPayload, fontCtx);

          await waitStageWithTrickle({
            text: '写入剪贴板...',
            from: 90,
            to: 98,
            task: () => writeHtmlToClipboard(clipboardHtml),
          });

          // baseline 快照：写入剪贴板成功后立即保存，此时 Less 文件与 Figma 内容一致
          try { options?.onExportSuccess?.(ele); } catch {}

          await setStage(100, '完成', { smooth: true, durationMs: 280 });
          await sleep(220);
          setLoading(false);

          if (msg) msg.success('已复制，请前往 Figma 直接 Cmd+V / Ctrl+V 粘贴');
          else alert('已复制，请前往 Figma 直接 Cmd+V / Ctrl+V 粘贴');
        } catch (err: any) {
          setLoading(false);
          setProgress({ percent: 0, text: '准备中...' });
          const failMsg = isNotFocusedClipboardError(err)
            ? '导出失败：当前页面未聚焦，请先切回页面再重试'
            : '导出失败: ' + (err?.message || '未知错误');
          if (msg) msg.error(failMsg);
          else alert(failMsg);
        }
      });
    });
  }, [loading, comEle, comId, fontUrlMap, setStage, waitStageWithTrickle]);

  return { loading, progress, handleExport };
}
