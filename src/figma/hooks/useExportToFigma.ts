import React from 'react';
import {
  convertIRToFigmaClipboardHtml,
  elementToMybricksJson,
  inlineImageFillsInTree,
} from '../export';
import { loadFontContextMapForFamilies, collectFontFamiliesFromIR } from '../export/font-loader';
import { writeHtmlToClipboard, isNotFocusedClipboardError } from '../export/clipboard';
import {
  ExportProgress,
  waitForPaint,
  sleep,
  startProgressTrickle,
} from '../export/progress-utils';
import lang from '../../style_new/index.i18n';

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
  options?: { fontfaces?: FontfaceConfig[]; svgExportMode?: 'image' | 'vector'; getCanvasList?: () => ArrayLike<Element>; componentLibraryEnabled?: boolean }
) {
  const [loading, setLoading] = React.useState(false);
  const [progress, setProgress] = React.useState<ExportProgress>({
    percent: 0,
    text: lang.figmaPreparing,
  });
  const progressRef = React.useRef<ExportProgress>(progress);
  const [pendingClipboardHtml, setPendingClipboardHtml] = React.useState<string | null>(null);

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
  // 默认 'image'：image-inline.js 将 SVG 栅格化为 PNG，保真优先（保留 fill/颜色/阴影等所有视觉细节）。
  // 小图标（≤64px）已自动提倍率至最短边 ≥ 128px，消除锯齿。
  // 若需矢量（任意缩放清晰，但复杂 SVG 可能解析失败）可传入 options.svgExportMode = 'vector'。
  const svgExportMode = options?.svgExportMode || 'image';
  const getCanvasList = options?.getCanvasList;
  const componentLibraryEnabled = !!options?.componentLibraryEnabled;

  function countComponentLibraryNodes(node: any): number {
    if (!node || typeof node !== 'object') return 0;
    let count = node.type === 'component-library' ? 1 : 0;
    if (Array.isArray(node.children)) {
      for (const child of node.children) count += countComponentLibraryNodes(child);
    }
    return count;
  }

  const handleExport = React.useCallback(() => {
    if (loading) return;
    // 有 primaryEle：导出单张页面；没有 primaryEle：遍历 canvasList 全部帧合并导出
    const primaryEle = (comEle?.dataset?.zoneType === 'page'
      ? comEle
      : comEle?.querySelector('[data-zone-type="page"]')) as HTMLElement | null;

    // 点击时才懒调用 getCanvasList，确保此时 DOM 已挂载
    const canvasList =  getCanvasList?.() ?? null

    const msg = (window as any).antd?.message;

    if (!primaryEle && (!canvasList || canvasList.length === 0)) {
      const tip = lang.figmaNoPageFound;
      if (msg) msg.warning(tip);
      else alert(tip);
      return;
    }
    setPendingClipboardHtml(null);
    setProgress({ percent: 0, text: lang.figmaPreparing });
    setLoading(true);

    requestAnimationFrame(() => {
      requestAnimationFrame(async () => {
        let generatedHtml = '';
        try {
          await setStage(8, lang.figmaPreparing);

          await waitStageWithTrickle({
            text: lang.figmaParsingPageStructure,
            from: 10,
            to: 25,
            task: () => sleep(650),
          });

          // ===== 阶段 1: 同步构建 DOM 模型（25 → 32）=====
          // 注意：elementToMybricksJson 是纯同步的 DOM walking，会阻塞主线程
          //       不能用 trickle 包裹（setInterval 会被冻结），改为前后插 waitForPaint 让 UI 刷新一帧
          await setStage(25, lang.figmaBuildingDomModel, { smooth: true, durationMs: 200 });
          await waitForPaint();
          await waitForPaint(); // 双帧确保浏览器已绘制

          let irPayload: any;
          if (primaryEle) {
            irPayload = elementToMybricksJson(primaryEle, comId, {
              componentLibraryEnabled,
              svgExportMode,
            });
          } else {
            const canvasArr = Array.from(canvasList!) as HTMLElement[];
            const allIRs = canvasArr.map((canvas, i) =>
              elementToMybricksJson(canvas, `${comId}-canvas${i}`, {
                componentLibraryEnabled,
                svgExportMode,
              })
            );
            const rootFrames = allIRs.map((ir: any) => ir?.page?.content?.[0]).filter(Boolean) as any[];
            if (rootFrames.length === 0) throw new Error(lang.figmaNoValidFrameInCanvasList);
            if (rootFrames.length === 1) {
              irPayload = allIRs[0];
            } else {
              const totalWidth = rootFrames.reduce((sum: number, f: any) => sum + (f?.style?.width || 0), 0)
                + (rootFrames.length - 1) * 40;
              const maxHeight = Math.max(...rootFrames.map((f: any) => f?.style?.height || 0), 100);
              irPayload = {
                page: {
                  'component-def': allIRs.flatMap((ir: any) => ir?.page?.['component-def'] || []),
                  content: [{
                    name: lang.figmaCopiedPagesName.replace('{n}', String(rootFrames.length)),
                    style: {
                      x: 0, y: 0,
                      width: totalWidth,
                      height: maxHeight,
                      layoutMode: 'HORIZONTAL',
                      itemSpacing: 40,
                      paddingTop: 0, paddingBottom: 0, paddingLeft: 0, paddingRight: 0,
                    },
                    children: rootFrames,
                  }],
                },
              };
            }
          }

          await setStage(32, lang.figmaBuildingDomModel, { smooth: true, durationMs: 200 });

          // ===== 阶段 2: 异步拉取图片资源（32 → 55）=====
          // 图片进度回调：
          // - 用闭包 hwm（高水位线）保证百分比只升不降
          // - 直接赋值（非函数式 prev=>）避免 React 18 批调度时读到陈旧 prev
          // - sqrt 缩放：前几张就有肉眼可见的推进，图片数量多时也不会长期停滞
          const PROGRESS_FROM = 32;
          const PROGRESS_TO = 54;
          let imgHwm = PROGRESS_FROM;
          const onImageProgress = (done: number, total: number) => {
            if (total <= 0) return;
            const raw = PROGRESS_FROM + Math.sqrt(done / total) * (PROGRESS_TO - PROGRESS_FROM);
            const next = Math.max(imgHwm, Math.round(raw));
            imgHwm = next;
            setProgress({ percent: next, text: lang.figmaFetchingImageResources.replace('{done}', String(done)).replace('{total}', String(total)) });
          };

          const rootContent = irPayload?.page?.content?.[0];
          if (rootContent) {
            // 多画布 wrapper 时，需要对每个子 frame 分别 inline；这里统一在 wrapper 上调一次即可，
            // 因为 inlineImageFillsInTree 会递归处理所有 children
            await inlineImageFillsInTree(rootContent, {
              svgExportMode,
              onImageProgress,
            });
          }

          await setStage(55, lang.figmaFetchImageResourcesDone, { smooth: true, durationMs: 200 });

          const _fontFamilies = collectFontFamiliesFromIR(irPayload);
          const fontCtx = await waitStageWithTrickle({
            text: lang.figmaLoadingFonts.replace('{fonts}', _fontFamilies.filter(f => f !== 'PingFang SC').join('、') || 'PingFang SC'),
            from: 55,
            to: 70,
            task: () => loadFontContextMapForFamilies(_fontFamilies, fontUrlMap, (text) => {
              setProgress(prev => ({ ...prev, text }));
            }),
          });

          await setStage(75, lang.figmaGeneratingData, { smooth: true, durationMs: 360 });
          // 提前生成并缓存，便于剪贴板失败时复用
          generatedHtml = convertIRToFigmaClipboardHtml(irPayload, fontCtx);

          await waitStageWithTrickle({
            text: lang.figmaWritingClipboard,
            from: 90,
            to: 98,
            task: () => writeHtmlToClipboard(generatedHtml),
          });

          await setStage(100, lang.figmaDone, { smooth: true, durationMs: 280 });
          await sleep(220);
          setLoading(false);

          if (msg) msg.success(lang.figmaCopiedPastePrompt);
          else alert(lang.figmaCopiedPastePrompt);
        } catch (err: any) {
          setLoading(false);
          // 若剪贴板写入因失焦失败，但数据已生成 → 缓存数据，提示用户点击按钮手动复制
          if (isNotFocusedClipboardError(err) && generatedHtml) {
            setPendingClipboardHtml(generatedHtml);
            setProgress({ percent: 100, text: lang.figmaDataReadyClickToCopy });
            const tip = lang.figmaClickToCopyManuallyTip;
            if (msg) msg.warning(tip);
            else alert(tip);
          } else {
            setProgress({ percent: 0, text: lang.figmaPreparing });
            const failMsg = lang.figmaExportFailed.replace('{error}', err?.message || lang.figmaUnknownError);
            if (msg) msg.error(failMsg);
            else alert(failMsg);
          }
        }
      });
    });
  }, [loading, comEle, comId, fontUrlMap, svgExportMode, getCanvasList, componentLibraryEnabled, setStage, waitStageWithTrickle]);

  const handleRetryClipboard = React.useCallback(async () => {
    if (!pendingClipboardHtml) return;
    const msg = (window as any).antd?.message;
    try {
      await writeHtmlToClipboard(pendingClipboardHtml);
      setPendingClipboardHtml(null);
      setProgress({ percent: 0, text: lang.figmaPreparing });
      if (msg) msg.success(lang.figmaCopiedPastePrompt);
      else alert(lang.figmaCopiedPastePrompt);
    } catch (err: any) {
      const failMsg = isNotFocusedClipboardError(err)
        ? lang.figmaCopyFailedNotFocused
        : lang.figmaCopyFailed.replace('{error}', err?.message || lang.figmaUnknownError);
      if (msg) msg.error(failMsg);
      else alert(failMsg);
    }
  }, [pendingClipboardHtml]);

  return { loading, progress, handleExport, pendingClipboardHtml, handleRetryClipboard };
}
