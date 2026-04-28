import type { FigmaImportItem } from '../types';

const SYNCABLE_TYPES = new Set([
  'FRAME',
  'RECTANGLE',
  'TEXT',
  'ELLIPSE',
  'VECTOR',
  'INSTANCE',
  'COMPONENT',
  'GROUP',
]);

const SKIP_NAMES = new Set(['', 'Frame', 'Text', 'Group', 'Rectangle', 'Ellipse']);
const MB_TAG_RE = /\s*\[mb:([^\]]+)\]\s*$/i;
const FIGMA_IMPORT_GAP_DEBUG_FLAG = '__MB_FIGMA_IMPORT_GAP_DEBUG__';

function roundCssNum(n: number): number {
  return Math.round(n * 100) / 100;
}

function isFigmaImportGapDebugEnabled(): boolean {
  try {
    const g = globalThis as typeof globalThis & {
      [FIGMA_IMPORT_GAP_DEBUG_FLAG]?: unknown;
      localStorage?: Storage;
    };
    if (Boolean(g[FIGMA_IMPORT_GAP_DEBUG_FLAG])) return true;
    const ls = g.localStorage;
    if (!ls) return false;
    const raw = ls.getItem(FIGMA_IMPORT_GAP_DEBUG_FLAG);
    return raw === '1' || raw === 'true';
  } catch {
    return false;
  }
}

function debugFigmaImportGap(payload: Record<string, unknown>): void {
  if (!isFigmaImportGapDebugEnabled()) return;
  try {
    // 统一前缀，便于在控制台快速过滤：[figma-import][gap]
    console.info('[figma-import][gap]', payload);
  } catch {}
}

/** Figma SOLID：color 多为 0~1，opacity 在 paint 上 */
function solidPaintToRgba(paint: Record<string, unknown> | null | undefined): string | null {
  if (!paint || paint.visible === false) return null;
  if (paint.type !== 'SOLID') return null;
  const color = paint.color as { r?: number; g?: number; b?: number; a?: number } | undefined;
  if (!color) return null;
  let r = Number(color.r);
  let g = Number(color.g);
  let b = Number(color.b);
  if (r <= 1 && g <= 1 && b <= 1) {
    r *= 255;
    g *= 255;
    b *= 255;
  }
  const ca = color.a != null ? Number(color.a) : 1;
  const po = paint.opacity != null ? Number(paint.opacity) : 1;
  const a = Math.min(1, Math.max(0, ca * po));
  const ri = Math.round(Math.min(255, Math.max(0, r)));
  const gi = Math.round(Math.min(255, Math.max(0, g)));
  const bi = Math.round(Math.min(255, Math.max(0, b)));
  if (a >= 1 - 1e-4) return `rgb(${ri}, ${gi}, ${bi})`;
  const af = roundCssNum(a);
  return `rgba(${ri}, ${gi}, ${bi}, ${af})`;
}

/**
 * 图层名 → 与 Less 一致的 class 选择器（与 dom 导出时 node.name 取首个 class 的习惯对齐）
 */
function parseTaggedSelector(name: string): { selector: string | null; displayName: string } {
  const raw = (name || '').trim();
  const m = raw.match(MB_TAG_RE);
  if (!m) return { selector: null, displayName: raw };
  const tagged = (m[1] || '').trim();
  const displayName = raw.replace(MB_TAG_RE, '').trim();
  if (/^\.[\w-]+$/.test(tagged)) return { selector: tagged, displayName };
  return { selector: null, displayName };
}

function layerNameToClassSelector(name: string): string | null {
  const parsed = parseTaggedSelector(name);
  if (parsed.selector) return parsed.selector;
  const raw = parsed.displayName;
  if (!raw || raw.length > 200) return null;
  const first = raw.split(/\s+/)[0];
  if (!/^\.?[\w-]+$/.test(first)) return null;
  const sel = first.startsWith('.') ? first : `.${first}`;
  const bare = sel.slice(1);
  if (SKIP_NAMES.has(bare)) return null;
  return sel;
}

/**
 * 多文件编码选择器（如 .pages_xxx_less-ant-steps-item）还原后用于 ant 判断。
 * 仅用于噪音过滤，不影响真实 selector 回传。
 */
function resolveLogicalSelectorForAntCheck(selector: string): string {
  if (!selector) return selector;
  if (/^\.ant-/.test(selector)) return selector;
  // 多文件编码 class 常见形态：.xxx_less-ant-yyy
  if (/^\.?[A-Za-z0-9_]+_less-/.test(selector)) {
    const inner = selector.startsWith('.') ? selector.slice(1) : selector;
    const dashIdx = inner.indexOf('-');
    if (dashIdx > 0 && dashIdx < inner.length - 1) {
      return '.' + inner.slice(dashIdx + 1);
    }
  }
  return selector.startsWith('.') ? selector : `.${selector}`;
}

type FreeformDirection = 'row' | 'column';

function getNodeRect(n: Record<string, unknown>): { x: number; y: number; w: number; h: number; cx: number; cy: number } | null {
  const tr = n.transform as unknown[] | undefined;
  const sz = n.size as { x?: number; y?: number } | undefined;
  const x = Array.isArray(tr) && Array.isArray(tr[0]) ? Number((tr[0] as unknown[])[2]) : NaN;
  const y = Array.isArray(tr) && Array.isArray(tr[1]) ? Number((tr[1] as unknown[])[2]) : NaN;
  const w = sz && typeof sz.x === 'number' ? Number(sz.x) : NaN;
  const h = sz && typeof sz.y === 'number' ? Number(sz.y) : NaN;
  if (!Number.isFinite(x) || !Number.isFinite(y) || !Number.isFinite(w) || !Number.isFinite(h)) return null;
  if (w <= 0 || h <= 0) return null;
  return { x, y, w, h, cx: x + w / 2, cy: y + h / 2 };
}

/**
 * 从子节点位置推断 freeform 布局方向和平均间距。
 *
 * Figma 对 freeform 节点不传 stackSpacing，因此无法直接读取间距值；
 * 改为从子节点的实际坐标/尺寸中推算：
 *  - 方向：需要明显的主轴优势（spreadRatio > 1.2），否则返回 null（网格/散布场景不推断）
 *  - gap：按主轴方向排序后，取相邻边界差的均值（负值 → 0，最后 Math.round）
 */
function inferFreeformLayoutFromChildren(
  childNodes: Record<string, unknown>[]
): { direction: FreeformDirection; gap: number } | null {
  const rects = childNodes.map(getNodeRect).filter((r): r is NonNullable<ReturnType<typeof getNodeRect>> => r != null);
  if (rects.length < 2) return null;
  const cxs = rects.map(r => r.cx);
  const cys = rects.map(r => r.cy);
  const spreadX = Math.max(...cxs) - Math.min(...cxs);
  const spreadY = Math.max(...cys) - Math.min(...cys);
  if (spreadX < 1 && spreadY < 1) return null;
  const ratio = 1.2;
  let direction: FreeformDirection;
  if (spreadX > spreadY * ratio) {
    direction = 'row';
  } else if (spreadY > spreadX * ratio) {
    direction = 'column';
  } else {
    return null;
  }
  // 按主轴排序后取相邻节点边界差均值
  let gap = 0;
  if (direction === 'row') {
    const sorted = [...rects].sort((a, b) => a.x - b.x);
    const gaps: number[] = [];
    for (let i = 1; i < sorted.length; i++) {
      gaps.push(Math.max(0, sorted[i].x - (sorted[i - 1].x + sorted[i - 1].w)));
    }
    if (gaps.length > 0) gap = Math.round(gaps.reduce((s, g) => s + g, 0) / gaps.length);
  } else {
    const sorted = [...rects].sort((a, b) => a.y - b.y);
    const gaps: number[] = [];
    for (let i = 1; i < sorted.length; i++) {
      gaps.push(Math.max(0, sorted[i].y - (sorted[i - 1].y + sorted[i - 1].h)));
    }
    if (gaps.length > 0) gap = Math.round(gaps.reduce((s, g) => s + g, 0) / gaps.length);
  }
  return { direction, gap };
}

/**
 * 从 Figma wire 合成 `border-radius`：
 * - 仅 `cornerRadius`：单值
 * - `rectangleCornerRadiiIndependent` 或任一 `rectangle*CornerRadius`：四值简写（TL TR BR BL，与 CSS 顺时针一致）
 * - 缺角的数值回退到 `cornerRadius`（若存在），否则 0
 */
function formatBorderRadiusFromNode(n: Record<string, unknown>): string | null {
  const cr = n.cornerRadius;
  const defUniform =
    typeof cr === 'number' && Number.isFinite(cr) ? Math.max(0, cr) : 0;

  const readCorner = (key: string): number | null => {
    const v = n[key];
    if (typeof v !== 'number' || !Number.isFinite(v)) return null;
    return Math.max(0, v);
  };

  const tl = readCorner('rectangleTopLeftCornerRadius');
  const tr = readCorner('rectangleTopRightCornerRadius');
  const brR = readCorner('rectangleBottomRightCornerRadius');
  const bl = readCorner('rectangleBottomLeftCornerRadius');
  const independent = n.rectangleCornerRadiiIndependent === true;
  const hasExplicitCorner = tl != null || tr != null || brR != null || bl != null;

  if (independent || hasExplicitCorner) {
    const tlv = tl ?? defUniform;
    const trv = tr ?? defUniform;
    const brv = brR ?? defUniform;
    const blv = bl ?? defUniform;
    const a = roundCssNum(tlv);
    const b = roundCssNum(trv);
    const c = roundCssNum(brv);
    const d = roundCssNum(blv);
    if (a <= 0 && b <= 0 && c <= 0 && d <= 0) return null;
    if (a === b && b === c && c === d && a > 0) return `${a}px`;
    return `${a}px ${b}px ${c}px ${d}px`;
  }

  if (typeof cr === 'number' && cr > 0) return `${roundCssNum(cr)}px`;
  return null;
}

/** Figma effects[] 单项 → 单层 CSS box-shadow（DROP_SHADOW / INNER_SHADOW） */
function figmaEffectToBoxShadowLayer(effect: Record<string, unknown>): string | null {
  if (effect.visible === false) return null;
  const t = effect.type;
  if (t !== 'DROP_SHADOW' && t !== 'INNER_SHADOW') return null;
  const paintLike = {
    type: 'SOLID',
    color: effect.color,
    opacity: effect.opacity != null ? Number(effect.opacity) : 1,
    visible: true,
  };
  const rgba = solidPaintToRgba(paintLike as Record<string, unknown>);
  if (!rgba) return null;
  const off = effect.offset as { x?: number; y?: number } | undefined;
  const ox = roundCssNum(Number(off?.x) || 0);
  const oy = roundCssNum(Number(off?.y) || 0);
  const blur = roundCssNum(Number(effect.radius) || 0);
  const spread = roundCssNum(Number(effect.spread) || 0);
  const inset = t === 'INNER_SHADOW';
  const insetStr = inset ? 'inset ' : '';
  const lenParts = [`${ox}px`, `${oy}px`, `${blur}px`];
  if (spread !== 0) lenParts.push(`${spread}px`);
  return `${insetStr}${lenParts.join(' ')} ${rgba}`.trim();
}

/** 将 Figma node.effects 转为单层或多层 box-shadow（逗号分隔），顺序与 effects 一致 */
function figmaEffectsToBoxShadowCss(effects: unknown[] | undefined): string | null {
  if (!Array.isArray(effects) || !effects.length) return null;
  const layers: string[] = [];
  for (const raw of effects) {
    const eff = raw as Record<string, unknown>;
    const layer = figmaEffectToBoxShadowLayer(eff);
    if (layer) layers.push(layer);
  }
  if (!layers.length) return null;
  return layers.join(', ');
}

function extractSimpleStyles(
  n: Record<string, unknown>,
  inferredFreeformDirection?: FreeformDirection | null,
  inferredFreeformGap?: number | null,
  debugMeta?: {
    selector?: string;
    childRects?: Array<{ x: number; y: number; w: number; h: number }>;
  }
): Record<string, string> {
  const value: Record<string, string> = {};
  const type = String(n.type || '');
  const fills = n.fillPaints as unknown[] | undefined;
  if (Array.isArray(fills) && fills.length) {
    const rgba = solidPaintToRgba(fills[0] as Record<string, unknown>);
    if (rgba) {
      if (type === 'TEXT') value['color'] = rgba;
      else value['background-color'] = rgba;
    }
  }
  const borderRadiusStr = formatBorderRadiusFromNode(n);
  if (borderRadiusStr) value['border-radius'] = borderRadiusStr;

  // Stroke → border / box-shadow / outline
  let strokeOutsideSolidBoxShadow: string | null = null;
  const strokes = n.strokePaints as unknown[] | undefined;
  const sw = n.strokeWeight;
  if (Array.isArray(strokes) && strokes.length && typeof sw === 'number' && sw > 0) {
    const strokeColor = solidPaintToRgba(strokes[0] as Record<string, unknown>);
    if (strokeColor) {
      const w = roundCssNum(sw);
      const dashPattern = n.dashPattern as number[] | undefined;
      const isDashed = Array.isArray(dashPattern) && dashPattern.length > 0;
      const strokeAlign = (n.strokeAlign as string | undefined) || 'INSIDE';
      if (strokeAlign === 'OUTSIDE') {
        if (isDashed) {
          // box-shadow 不支持虚线，OUTSIDE dashed → outline 近似
          value['outline'] = `${w}px dashed ${strokeColor}`;
        } else {
          strokeOutsideSolidBoxShadow = `0 0 0 ${w}px ${strokeColor}`;
        }
      } else {
        // INSIDE / CENTER → border shorthand
        value['border'] = `${w}px ${isDashed ? 'dashed' : 'solid'} ${strokeColor}`;
      }
    }
  }

  // Figma Effects（投影 / 内阴影）→ box-shadow；与外描边模拟的 ring 合并为逗号分隔多层
  const effectsShadow = figmaEffectsToBoxShadowCss(n.effects as unknown[] | undefined);
  const shadowParts: string[] = [];
  if (effectsShadow) shadowParts.push(effectsShadow);
  if (strokeOutsideSolidBoxShadow) shadowParts.push(strokeOutsideSolidBoxShadow);
  if (shadowParts.length) {
    value['box-shadow'] = shadowParts.join(', ');
  }

  const op = n.opacity;
  if (typeof op === 'number' && op < 1 - 1e-6 && op >= 0) value['opacity'] = String(roundCssNum(op));

  if (type === 'TEXT' && typeof n.fontSize === 'number' && n.fontSize > 0) {
    value['font-size'] = `${roundCssNum(n.fontSize)}px`;
  }
  const fn = n.fontName as { family?: string; fontFamily?: string } | undefined;
  if (type === 'TEXT' && fn) {
    const fam = fn.family || fn.fontFamily;
    if (typeof fam === 'string' && fam.trim()) {
      const esc = fam.replace(/\\/g, '\\\\').replace(/'/g, "\\'");
      value['font-family'] = `'${esc}', sans-serif`;
    }
  }

  if (type !== 'TEXT') {
    const sz = n.size as { x?: number; y?: number } | undefined;
    const sizingH = n.layoutSizingHorizontal as string | undefined;
    const sizingV = n.layoutSizingVertical as string | undefined;
    if (sz && typeof sz.x === 'number' && sz.x > 0) {
      if (sizingH === 'HUG') value['width'] = 'fit-content';
      else if (sizingH === 'FILL') value['width'] = '100%';
      else value['width'] = `${roundCssNum(sz.x)}px`;
    }
    if (sz && typeof sz.y === 'number' && sz.y > 0) {
      if (sizingV === 'HUG') value['height'] = 'fit-content';
      else if (sizingV === 'FILL') value['height'] = '100%';
      else value['height'] = `${roundCssNum(sz.y)}px`;
    }

    // 布局属性同步：
    // - flex-direction / 对齐 仍以 stackMode(=Auto Layout) 为准
    // - gap 允许弱依赖 stackMode：部分 Figma 场景会回传 stackSpacing 但不带 stackMode
    //   （例如未显式切到 Auto Layout 仅调整 spacing），此时也应同步到 DOM。
    const stackMode = n.stackMode as string | undefined;
    const hasAutoLayout = stackMode === 'HORIZONTAL' || stackMode === 'VERTICAL';
    const pa = n.stackPrimaryAlignItems as string | undefined;
    const isSpaceBetweenPrimary = hasAutoLayout && pa === 'SPACE_BETWEEN';
    const sp = n.stackSpacing;
    const shouldSyncGap =
      typeof sp === 'number' &&
      (hasAutoLayout ? sp >= 0 : sp > 0) &&
      // SPACE_BETWEEN 场景下，Figma 的 stackSpacing 常是“剩余空间分配值”，不是 CSS gap 语义。
      // 这里跳过 gap 回写，避免把 distribute 空白固化成超大 gap。
      !isSpaceBetweenPrimary;
    if (shouldSyncGap) {
      value['gap'] = `${roundCssNum(sp)}px`;
      debugFigmaImportGap({
        source: 'stackSpacing',
        selector: debugMeta?.selector,
        name: n.name,
        type,
        stackMode,
        stackSpacing: sp,
        stackPrimaryAlignItems: n.stackPrimaryAlignItems,
        stackCounterAlignItems: n.stackCounterAlignItems,
        justifyContent: value['justify-content'],
        inferredFreeformDirection,
        inferredFreeformGap,
        childRects: debugMeta?.childRects,
      });
    } else if (isSpaceBetweenPrimary && typeof sp === 'number') {
      debugFigmaImportGap({
        source: 'skipGapForSpaceBetween',
        selector: debugMeta?.selector,
        name: n.name,
        type,
        stackMode,
        stackPrimaryAlignItems: pa,
        stackSpacing: sp,
      });
    } else if (!hasAutoLayout && typeof inferredFreeformGap === 'number' && inferredFreeformGap > 0) {
      // Figma freeform 节点不传 stackSpacing，用子节点位置推断的间距作为 fallback
      value['gap'] = `${roundCssNum(inferredFreeformGap)}px`;
      debugFigmaImportGap({
        source: 'inferredFreeformGap',
        selector: debugMeta?.selector,
        name: n.name,
        type,
        stackMode,
        stackSpacing: sp,
        inferredFreeformDirection,
        inferredFreeformGap,
        childRects: debugMeta?.childRects,
      });
    }
    if (hasAutoLayout) {
      value['flex-direction'] = stackMode === 'VERTICAL' ? 'column' : 'row';
    } else if (
      inferredFreeformDirection &&
      (shouldSyncGap || (typeof inferredFreeformGap === 'number' && inferredFreeformGap > 0))
    ) {
      // Freeform 可改 spacing：当能稳定推断子节点主轴且有非零间距时，补齐方向，便于后续升级为 flex。
      value['flex-direction'] = inferredFreeformDirection;
    }
    if (hasAutoLayout) {
      // flex-wrap: wrap 场景 —— 同时同步行间距
      if (n.stackWrap === 'WRAP') {
        value['flex-wrap'] = 'wrap';
        const counterSp = n.stackCounterSpacing;
        if (typeof counterSp === 'number' && counterSp > 0) {
          value['row-gap'] = `${roundCssNum(counterSp)}px`;
        }
      }
      // 主轴对齐（justify-content）
      // MIN/CENTER/MAX/SPACE_BETWEEN 全量映射；space-around/space-evenly 在导出时已合并为 CENTER，属已知有损
      const PRIMARY_ALIGN: Record<string, string> = {
        MIN: 'flex-start', CENTER: 'center', MAX: 'flex-end', SPACE_BETWEEN: 'space-between',
      };
      if (pa && PRIMARY_ALIGN[pa]) value['justify-content'] = PRIMARY_ALIGN[pa];
      if (pa === 'SPACE_BETWEEN' && value['gap']) {
        // SPACE_BETWEEN 下 gap 偏大的常见排查点：Figma 可能把分散剩余空间反映在 stackSpacing 中
        debugFigmaImportGap({
          source: 'spaceBetweenWithGap',
          selector: debugMeta?.selector,
          name: n.name,
          type,
          stackMode,
          stackPrimaryAlignItems: pa,
          stackSpacing: sp,
          emittedGap: value['gap'],
          childRects: debugMeta?.childRects,
        });
      }
      if (pa === 'SPACE_BETWEEN') {
        // 与 SPACE_BETWEEN 配套：避免历史 gap 残留（如 var(--margin-element)）导致视觉不对齐。
        // Figma 在该模式下的 stackSpacing 语义不稳定（可能是剩余空间），统一回写 0 清空旧 gap。
        value['gap'] = '0px';
      }

      // 交叉轴对齐（align-items）
      // 注意：CSS align-items:stretch 在导出时被映射为 MIN（与 flex-start 相同），无法区分。
      // 为避免从未改过对齐的容器被误写为 flex-start，MIN 不输出；其他值正常输出。
      const COUNTER_ALIGN: Record<string, string> = {
        CENTER: 'center', MAX: 'flex-end', STRETCH: 'stretch',
      };
      const ca = n.stackCounterAlignItems as string | undefined;
      if (ca && COUNTER_ALIGN[ca]) value['align-items'] = COUNTER_ALIGN[ca];
      if (ca === 'MIN' && n.stackWrap === 'WRAP') {
        // WRAP 场景下 MIN 更接近“顶对齐”意图，这里允许回写 flex-start 修正旧的 center 残留。
        value['align-items'] = 'flex-start';
      }

      // Auto Layout 内边距（与 ir-to-figma.js stack*Padding ↔ padding* 对称）
      const emitStackPadding = (wireKey: string, cssKey: string) => {
        const v = n[wireKey];
        // 与 row-gap 一致：仅 >0 输出，避免无内边距的 AL 节点在剪贴板里带 0 时刷四条噪音
        if (typeof v === 'number' && Number.isFinite(v) && v > 0) {
          value[cssKey] = `${roundCssNum(v)}px`;
        }
      };
      emitStackPadding('stackVerticalPadding', 'padding-top');
      emitStackPadding('stackHorizontalPadding', 'padding-left');
      emitStackPadding('stackPaddingRight', 'padding-right');
      emitStackPadding('stackPaddingBottom', 'padding-bottom');
    }
  }

  return value;
}

function extractDimensionMeta(n: Record<string, unknown>): FigmaImportItem['meta'] | undefined {
  const type = String(n.type || '');
  if (type === 'TEXT') return undefined;

  const size = n.size as { x?: number; y?: number } | undefined;
  const sizingHorizontal = n.layoutSizingHorizontal as string | undefined;
  const sizingVertical = n.layoutSizingVertical as string | undefined;
  const stackMode = n.stackMode as string | undefined;
  const hasAutoLayout = stackMode === 'HORIZONTAL' || stackMode === 'VERTICAL';

  const hasUsefulDimensionInfo =
    (typeof size?.x === 'number' && size.x > 0) ||
    (typeof size?.y === 'number' && size.y > 0) ||
    !!sizingHorizontal ||
    !!sizingVertical ||
    hasAutoLayout;
  if (!hasUsefulDimensionInfo) return undefined;

  return {
    dimension: {
      sizingHorizontal,
      sizingVertical,
      sourceSize: {
        ...(typeof size?.x === 'number' && size.x > 0 ? { x: roundCssNum(size.x) } : {}),
        ...(typeof size?.y === 'number' && size.y > 0 ? { y: roundCssNum(size.y) } : {}),
      },
      hasAutoLayout,
      ...(stackMode ? { stackMode } : {}),
    },
  };
}

/**
 * 从解码后的 nodeChanges 生成 FigmaImportItem（按图层名 = `.className` 与 Less 匹配）
 *
 * Pass 1：构建 guid→selector 和 parentGuid→childGuids Map，用于填充 AL 容器的 childSelectors。
 * Pass 2：生成 items，AL 容器节点（有 stackMode）额外填充 childSelectors。
 */
export function nodeChangesToSimpleFigmaImportItems(nodeChanges: unknown[] | null): FigmaImportItem[] {
  if (!nodeChanges || !nodeChanges.length) return [];

  // Pass 1: 构建 guid→selector 和 parentGuid→childGuids Map
  const guidToSelector = new Map<string, string>();
  const parentToChildren = new Map<string, string[]>();
  const guidToNode = new Map<string, Record<string, unknown>>();

  for (const raw of nodeChanges) {
    const n = raw as Record<string, unknown>;
    const guidRaw = n.guid as { sessionID: number; localID: number } | undefined;
    if (!guidRaw || typeof guidRaw.sessionID !== 'number' || typeof guidRaw.localID !== 'number') continue;
    const guidKey = `${guidRaw.sessionID}:${guidRaw.localID}`;
    guidToNode.set(guidKey, n);

    const name = n.name != null ? String(n.name) : '';
    const sel = layerNameToClassSelector(name);
    if (sel) guidToSelector.set(guidKey, sel);

    const parentIndex = n.parentIndex as { guid?: { sessionID: number; localID: number } } | undefined;
    const pg = parentIndex?.guid;
    if (pg && typeof pg.sessionID === 'number' && typeof pg.localID === 'number') {
      const parentKey = `${pg.sessionID}:${pg.localID}`;
      if (!parentToChildren.has(parentKey)) parentToChildren.set(parentKey, []);
      parentToChildren.get(parentKey)!.push(guidKey);
    }
  }

  // Pass 2: 生成 items
  const out: FigmaImportItem[] = [];
  for (const raw of nodeChanges) {
    const n = raw as Record<string, unknown>;
    const type = String(n.type || '');
    if (!SYNCABLE_TYPES.has(type)) continue;
    const name = n.name != null ? String(n.name) : '';
    const selector = layerNameToClassSelector(name);
    if (!selector) continue;
    let inferredFreeformDirection: FreeformDirection | null = null;
    let inferredFreeformGap: number | null = null;
    let inferredChildRects: Array<{ x: number; y: number; w: number; h: number }> | undefined;
    const stackMode = n.stackMode as string | undefined;
    const hasAutoLayout = stackMode === 'HORIZONTAL' || stackMode === 'VERTICAL';
    if (!hasAutoLayout) {
      const guidRaw = n.guid as { sessionID: number; localID: number } | undefined;
      if (guidRaw && typeof guidRaw.sessionID === 'number' && typeof guidRaw.localID === 'number') {
        const guidKey = `${guidRaw.sessionID}:${guidRaw.localID}`;
        const childGuids = parentToChildren.get(guidKey) || [];
        const childNodes = childGuids
          .map(cg => guidToNode.get(cg))
          .filter((cn): cn is Record<string, unknown> => cn != null);
        inferredChildRects = childNodes
          .map(getNodeRect)
          .filter((r): r is NonNullable<ReturnType<typeof getNodeRect>> => r != null)
          .map(({ x, y, w, h }) => ({ x, y, w, h }));
        const inferred = inferFreeformLayoutFromChildren(childNodes);
        if (inferred) {
          inferredFreeformDirection = inferred.direction;
          inferredFreeformGap = inferred.gap;
        }
      }
    }
    const value = extractSimpleStyles(
      n,
      inferredFreeformDirection,
      inferredFreeformGap,
      { selector, childRects: inferredChildRects }
    );
    // antd 内部节点（含多文件编码选择器）尺寸是渲染快照像素值，不应写回 CSS
    const logicalSelector = resolveLogicalSelectorForAntCheck(selector);
    if (/^\.ant-/.test(logicalSelector)) {
      delete value['width'];
      delete value['height'];
    }
    if (!Object.keys(value).length) continue;

    // 容器节点填充 childSelectors（供 sync.ts expandNonFlexUpgradeItems 使用）
    let childSelectors: string[] | undefined;
    const guidRaw = n.guid as { sessionID: number; localID: number } | undefined;
    if (guidRaw && typeof guidRaw.sessionID === 'number' && typeof guidRaw.localID === 'number') {
      const guidKey = `${guidRaw.sessionID}:${guidRaw.localID}`;
      const childGuids = parentToChildren.get(guidKey);
      if (childGuids?.length) {
        const resolved = childGuids
          .map(cg => guidToSelector.get(cg))
          .filter((s): s is string => s != null);
        if (resolved.length) childSelectors = resolved;
      }
    }

    const meta = extractDimensionMeta(n);
    out.push({
      selectors: [selector],
      value,
      ...(childSelectors ? { childSelectors } : {}),
      ...(meta ? { meta } : {}),
    });
  }
  return out;
}
