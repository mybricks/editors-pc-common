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

function roundCssNum(n: number): number {
  return Math.round(n * 100) / 100;
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

function extractSimpleStyles(n: Record<string, unknown>): Record<string, string> {
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
  const cr = n.cornerRadius;
  if (typeof cr === 'number' && cr > 0) value['border-radius'] = `${roundCssNum(cr)}px`;

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

    // Auto Layout → flex 布局属性（仅针对已是 flex 的容器，baseline diff 保证只写真正变化的值）
    // stackMode 存在说明该节点有 Auto Layout
    const stackMode = n.stackMode as string | undefined;
    if (stackMode === 'HORIZONTAL' || stackMode === 'VERTICAL') {
      value['flex-direction'] = stackMode === 'VERTICAL' ? 'column' : 'row';
      const sp = n.stackSpacing;
      if (typeof sp === 'number' && sp >= 0) {
        value['gap'] = `${roundCssNum(sp)}px`;
      }
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
      const pa = n.stackPrimaryAlignItems as string | undefined;
      if (pa && PRIMARY_ALIGN[pa]) value['justify-content'] = PRIMARY_ALIGN[pa];

      // 交叉轴对齐（align-items）
      // 注意：CSS align-items:stretch 在导出时被映射为 MIN（与 flex-start 相同），无法区分。
      // 为避免从未改过对齐的容器被误写为 flex-start，MIN 不输出；其他值正常输出。
      const COUNTER_ALIGN: Record<string, string> = {
        CENTER: 'center', MAX: 'flex-end', STRETCH: 'stretch',
      };
      const ca = n.stackCounterAlignItems as string | undefined;
      if (ca && COUNTER_ALIGN[ca]) value['align-items'] = COUNTER_ALIGN[ca];
    }
  }

  return value;
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

  for (const raw of nodeChanges) {
    const n = raw as Record<string, unknown>;
    const guidRaw = n.guid as { sessionID: number; localID: number } | undefined;
    if (!guidRaw || typeof guidRaw.sessionID !== 'number' || typeof guidRaw.localID !== 'number') continue;
    const guidKey = `${guidRaw.sessionID}:${guidRaw.localID}`;

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
    const value = extractSimpleStyles(n);
    // antd 内部节点（含多文件编码选择器）尺寸是渲染快照像素值，不应写回 CSS
    const logicalSelector = resolveLogicalSelectorForAntCheck(selector);
    if (/^\.ant-/.test(logicalSelector)) {
      delete value['width'];
      delete value['height'];
    }
    if (!Object.keys(value).length) continue;

    // AL 容器节点填充 childSelectors（供 sync.ts expandNonFlexUpgradeItems 使用）
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

    out.push({ selectors: [selector], value, ...(childSelectors ? { childSelectors } : {}) });
  }
  return out;
}
