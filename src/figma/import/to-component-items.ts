import type { FigmaComponentPatch } from '../types';

const MB_TAG_RE = /\[mb:([^\]]+)\]/i;
const MBV_RE = /\[mbv:variant\]/i;
const DEBUG_SYNC_ID_HINT = '';

type GuidLike = { sessionID?: number; localID?: number };

function guidToKey(guid: GuidLike | null | undefined): string | null {
  if (!guid) return null;
  if (typeof guid.sessionID !== 'number' || typeof guid.localID !== 'number') return null;
  return `${guid.sessionID}:${guid.localID}`;
}

function parseTaggedSelector(name: string): string | null {
  const raw = (name || '').trim();
  const m = raw.match(MB_TAG_RE);
  if (!m || !m[1]) return null;
  const sel = m[1].trim();
  if (!sel.startsWith('.')) return null;
  return sel;
}

function parseSyncId(name: string): string | null {
  const raw = (name || '').trim();
  const token = '[mbid:';
  const start = raw.indexOf(token);
  if (start < 0) return null;
  let i = start + token.length;
  let depth = 1;
  let inString = false;
  let escaped = false;
  const out: string[] = [];
  for (; i < raw.length; i++) {
    const ch = raw[i];
    if (inString) {
      out.push(ch);
      if (escaped) {
        escaped = false;
      } else if (ch === '\\') {
        escaped = true;
      } else if (ch === '"') {
        inString = false;
      }
      continue;
    }
    if (ch === '"') {
      inString = true;
      out.push(ch);
      continue;
    }
    if (ch === '[') {
      depth += 1;
      out.push(ch);
      continue;
    }
    if (ch === ']') {
      depth -= 1;
      if (depth === 0) {
        return out.join('').trim() || null;
      }
      out.push(ch);
      continue;
    }
    out.push(ch);
  }
  return null;
}

function normalizePathLike(v: string): string {
  return String(v || '').replace(/\\/g, '/').replace(/^\.\//, '').trim();
}

function parseLocMeta(syncId?: string | null): {
  fileJsx?: string;
  jsxStart?: number;
  jsxEnd?: number;
  codeLineStart?: number;
  cn?: string[];
} {
  if (!syncId) return {};
  try {
    const p = JSON.parse(syncId);
    const fileJsx = normalizePathLike(String(p?.files?.jsx || ''));
    const jsxStart = Number(p?.jsx?.start);
    const jsxEnd = Number(p?.jsx?.end);
    const codeLineStart = Number(p?.codeLine?.start);
    const cn = Array.isArray(p?.cn) ? p.cn.map((x: unknown) => String(x)).filter(Boolean) : undefined;
    return {
      fileJsx: fileJsx || undefined,
      jsxStart: Number.isFinite(jsxStart) ? jsxStart : undefined,
      jsxEnd: Number.isFinite(jsxEnd) ? jsxEnd : undefined,
      codeLineStart: Number.isFinite(codeLineStart) ? codeLineStart : undefined,
      cn,
    };
  } catch {
    return {};
  }
}

function parseNameDims(name: string): Record<string, string> {
  const out: Record<string, string> = {};
  const re = /([^,=，]+)=([^,，]+)/g;
  let m: RegExpExecArray | null = null;
  while ((m = re.exec(name || ''))) {
    const k = (m[1] || '').trim();
    const v = (m[2] || '').trim();
    if (k && v) out[k] = v;
  }
  return out;
}

function toBoolByOnOff(v?: string): boolean | undefined {
  if (v === 'on') return true;
  if (v === 'off') return false;
  return undefined;
}

function parseComponentFromDescription(description?: string): string {
  if (!description) return '';
  const m = description.match(/<([A-Z][A-Za-z.]*)[\s/>]/);
  if (!m) return '';
  return m[1].split('.')[0] || '';
}

function getTextOverrideCharacters(instance: Record<string, unknown>): string | undefined {
  const sd = instance.symbolData as Record<string, unknown> | undefined;
  const overs = sd?.symbolOverrides as unknown[] | undefined;
  if (!Array.isArray(overs) || overs.length === 0) return undefined;
  for (const o of overs) {
    const oo = o as Record<string, unknown>;
    const td = oo.textData as Record<string, unknown> | undefined;
    const chars = td?.characters;
    if (typeof chars === 'string' && chars.trim()) return chars;
  }
  return undefined;
}

function parsePropsFromDescription(
  description: string,
  component: string
): Record<string, string | boolean | number> {
  const out: Record<string, string | boolean | number> = {};
  if (!description) return out;

  const assignString = (prop: string) => {
    const m = description.match(new RegExp(`\\b${prop}="([^"]*)"`, 'm'));
    if (m) out[prop] = m[1];
  };
  const assignBool = (prop: string) => {
    const m = description.match(new RegExp(`\\b${prop}=\\{(true|false)\\}`, 'm'));
    if (m) {
      out[prop] = m[1] === 'true';
      return;
    }
    if (new RegExp(`\\b${prop}(?=\\s|>|/)`, 'm').test(description) && !new RegExp(`\\b${prop}=`, 'm').test(description)) {
      out[prop] = true;
    }
  };

  if (component === 'Input') {
    ['size', 'addonBefore', 'addonAfter', 'placeholder', 'prefix', 'suffix'].forEach(assignString);
    ['allowClear', 'showCount', 'disabled', 'bordered'].forEach(assignBool);
  } else if (component === 'Button') {
    ['size', 'type', 'shape'].forEach(assignString);
    ['danger', 'ghost', 'loading', 'disabled'].forEach(assignBool);
  } else if (component === 'Alert') {
    ['type', 'message', 'description'].forEach(assignString);
    ['showIcon', 'closable', 'banner'].forEach(assignBool);
  } else if (component === 'Tag') {
    ['color'].forEach(assignString);
    ['closable', 'bordered'].forEach(assignBool);
  }

  return out;
}

function buildPropsFromDims(
  component: string,
  dims: Record<string, string>,
  textOverride?: string,
  description?: string
): Record<string, string | boolean | number> {
  const props: Record<string, string | boolean | number> = parsePropsFromDescription(description || '', component);
  const sizeMap: Record<string, string> = { 大: 'large', 中: 'middle', 小: 'small' };
  const typeMap: Record<string, string> = {
    主色: 'primary',
    默认: 'default',
    虚线: 'dashed',
    文本: 'text',
    链接: 'link',
  };

  if (dims['尺寸'] && sizeMap[dims['尺寸']]) props.size = sizeMap[dims['尺寸']];
  if (dims['类型'] && typeMap[dims['类型']]) props.type = typeMap[dims['类型']];
  if (dims['禁用中']) {
    const b = toBoolByOnOff(dims['禁用中']);
    if (b !== undefined) props.disabled = b;
  }
  if (dims['禁用']) {
    const b = toBoolByOnOff(dims['禁用']);
    if (b !== undefined) props.disabled = b;
  }
  if (dims['危险']) {
    const b = toBoolByOnOff(dims['危险']);
    if (b !== undefined) props.danger = b;
  }
  if (dims['边框']) {
    const b = toBoolByOnOff(dims['边框']);
    if (b !== undefined) props.bordered = b;
  }
  if (dims['可关闭']) {
    const b = toBoolByOnOff(dims['可关闭']);
    if (b !== undefined) props.closable = b;
  }
  if (dims['图标']) {
    const b = toBoolByOnOff(dims['图标']);
    if (b !== undefined) props.showIcon = b;
  }
  if (dims['颜色']) {
    props.color = dims['颜色'];
  }
  if (dims['字数计数']) {
    const b = toBoolByOnOff(dims['字数计数']);
    if (b !== undefined) props.showCount = b;
  }
  if (component === 'Alert' && textOverride) {
    props.message = textOverride;
  } else if (component === 'Input' && textOverride) {
    props.placeholder = textOverride;
  } else if (textOverride) {
    props.children = textOverride;
  }
  return props;
}

export function extractComponentPatchesFromNodeChanges(
  nodeChanges: unknown[] | null
): FigmaComponentPatch[] {
  if (!nodeChanges || !nodeChanges.length) return [];

  const byGuid = new Map<string, Record<string, unknown>>();
  const byParentKey = new Map<string, Record<string, unknown>[]>();
  for (const raw of nodeChanges) {
    const n = raw as Record<string, unknown>;
    const gk = guidToKey(n.guid as GuidLike);
    if (gk) byGuid.set(gk, n);
    const pg = (n.parentIndex as Record<string, unknown> | undefined)?.guid as GuidLike | undefined;
    const pgk = guidToKey(pg);
    if (pgk) {
      const arr = byParentKey.get(pgk) || [];
      arr.push(n);
      byParentKey.set(pgk, arr);
    }
  }

  const out: FigmaComponentPatch[] = [];
  const occurrenceByKey = new Map<string, number>();

  for (const raw of nodeChanges) {
    const n = raw as Record<string, unknown>;
    if (n.type !== 'FRAME') continue;
    const frameName = String(n.name || '');
    if (!MBV_RE.test(frameName)) continue;
    const selector = parseTaggedSelector(frameName);
    const syncId = parseSyncId(frameName);
    const shouldDebug = !!syncId && (!DEBUG_SYNC_ID_HINT || syncId.includes(DEBUG_SYNC_ID_HINT));
    const locMeta = parseLocMeta(syncId);
    if (shouldDebug) {
      console.log('[figma-sync][extract] hit-variant-anchor', {
        frameName,
        selector,
        syncId,
      });
    }
    if (!selector && !syncId) continue;

    const frameGuid = guidToKey(n.guid as GuidLike);
    if (!frameGuid) continue;
    const children = byParentKey.get(frameGuid) || [];
    const instance = children.find((c) => c.type === 'INSTANCE') as Record<string, unknown> | undefined;
    if (!instance) {
      if (shouldDebug) {
        console.warn('[figma-sync][extract] no-instance-under-anchor', { frameGuid, childCount: children.length });
      }
      continue;
    }

    const sd = instance.symbolData as Record<string, unknown> | undefined;
    const sid = sd?.symbolID as GuidLike | undefined;
    const symbol = sid ? byGuid.get(guidToKey(sid) || '') : null;
    if (!symbol || symbol.type !== 'SYMBOL') {
      if (shouldDebug) {
        console.warn('[figma-sync][extract] no-symbol-by-symbolID', {
          symbolID: sid || null,
          instanceName: String(instance.name || ''),
        });
      }
      continue;
    }

    const description = typeof symbol.symbolDescription === 'string' ? symbol.symbolDescription : '';
    const component = parseComponentFromDescription(description);
    if (!component) {
      if (shouldDebug) {
        console.warn('[figma-sync][extract] component-parse-empty', { description });
      }
      continue;
    }
    if (component !== 'Button' && component !== 'Alert' && component !== 'Tag' && component !== 'Input') {
      if (shouldDebug) {
        console.warn('[figma-sync][extract] component-not-in-mvp', { component });
      }
      continue;
    }

    // 变体在 Figma 中切换后，实例名会反映实时维度；symbol.name 常是库默认值。
    // 这里优先使用 instance.name，避免把已改成 large 的按钮回写成默认 middle。
    const dimsFromInstance = parseNameDims(String(instance.name || ''));
    const dimsFromSymbol = parseNameDims(String(symbol.name || ''));
    const dims = Object.assign({}, dimsFromSymbol, dimsFromInstance);
    const textOverride = getTextOverrideCharacters(instance);
    const props = buildPropsFromDims(component, dims, textOverride, description);
    if (!Object.keys(props).length) {
      if (shouldDebug) {
        console.warn('[figma-sync][extract] empty-props-from-variant', {
          component,
          variantName: String(symbol.name || ''),
          dims,
          textOverride,
        });
      }
      continue;
    }

    const componentKey = typeof symbol.componentKey === 'string' ? symbol.componentKey : undefined;
    const variantName = typeof symbol.name === 'string' ? symbol.name : undefined;
    const key = `${selector || '__no_selector__'}|${component}`;
    const nth = occurrenceByKey.get(key) || 0;
    occurrenceByKey.set(key, nth + 1);
    out.push({
      selector: selector || '',
      component,
      props,
      meta: {
        componentKey,
        variantName,
        syncId: syncId || undefined,
        fileJsx: locMeta.fileJsx,
        jsxStart: locMeta.jsxStart,
        jsxEnd: locMeta.jsxEnd,
        codeLineStart: locMeta.codeLineStart,
        instanceNth: nth,
      },
    });
    if (shouldDebug) {
      console.log('[figma-sync][extract] patch-generated', {
        selector: selector || '',
        component,
        props,
        instanceNth: nth,
      });
    }
  }

  return out;
}

