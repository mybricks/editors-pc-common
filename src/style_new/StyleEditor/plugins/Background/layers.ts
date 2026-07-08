import ColorUtil from 'color';
import { splitBackgroundLayers, isSolidColorGradient } from '../../helper/gradient-border';

export type LayerType = 'solid' | 'gradient' | 'image';

export interface BgLayer {
  id: string;
  type: LayerType;
  /** CSS value: color string / gradient string / url(...) */
  value: string;
  visible: boolean;
  /** image-only: background-size */
  size: string;
  /** image-only: background-repeat */
  repeat: string;
  /** image-only: background-position */
  position: string;
}

let _counter = 0;
export const generateLayerId = () => `bgl-${Date.now()}-${_counter++}`;

export function detectLayerType(value: string): LayerType {
  if (!value || value === 'none' || value === '') return 'solid';
  if (value.includes('url(')) return 'image';
  if (value.includes('gradient')) return 'gradient';
  return 'solid';
}

/** Extract opacity (0-100) from a color string */
export function getColorOpacity(color: string): number {
  try {
    return Math.round(new ColorUtil(color).alpha() * 100);
  } catch {
    return 100;
  }
}

/** Apply opacity (0-100) to a color string, returns hexa */
export function setColorOpacity(color: string, opacity: number): string {
  try {
    return new ColorUtil(color).alpha(Math.max(0, Math.min(100, opacity)) / 100).hexa().toLowerCase();
  } catch {
    return color;
  }
}

/** Parse CSS background values into ordered layers (index 0 = top) */
export function parseLayers(
  backgroundImage?: string,
  backgroundColor?: string,
  backgroundSize?: string,
  backgroundRepeat?: string,
  backgroundPosition?: string,
): BgLayer[] {
  const layers: BgLayer[] = [];

  if (backgroundImage && backgroundImage !== 'none') {
    const imageLayers = splitBackgroundLayers(backgroundImage);
    const sizes = splitBackgroundLayers(backgroundSize || '');
    const repeats = splitBackgroundLayers(backgroundRepeat || '');
    const positions = splitBackgroundLayers(backgroundPosition || '');

    const CSS_LAYER_KEYWORD_RE = /^(initial|inherit|unset|revert|none)$/i;
    imageLayers.forEach((layerVal, i) => {
      const trimmed = layerVal.trim();
      if (CSS_LAYER_KEYWORD_RE.test(trimmed)) return; // skip invalid layer values

      // solid-color gradient wrapper: linear-gradient(color, color) → solid layer
      if (isSolidColorGradient(trimmed)) {
        const inner = trimmed.slice('linear-gradient('.length, -1);
        // Bracket-aware comma scan: handles rgba(r,g,b,a) colors whose inner
        // commas would confuse a plain indexOf(',').
        let _depth = 0;
        let commaIdx = -1;
        for (let ci = 0; ci < inner.length; ci++) {
          if (inner[ci] === '(') _depth++;
          else if (inner[ci] === ')') _depth--;
          else if (inner[ci] === ',' && _depth === 0) { commaIdx = ci; break; }
        }
        const color = (commaIdx >= 0 ? inner.slice(0, commaIdx) : inner).trim();
        layers.push({
          id: generateLayerId(),
          type: 'solid',
          value: color,
          visible: true,
          size: '',
          repeat: '',
          position: '',
        });
        return;
      }

      const type = detectLayerType(trimmed);
      layers.push({
        id: generateLayerId(),
        type,
        value: trimmed,
        visible: true,
        size: sizes[i]?.trim() || (type === 'image' ? 'auto' : ''),
        repeat: repeats[i]?.trim() || (type === 'image' ? 'no-repeat' : ''),
        position: positions[i]?.trim() || (type === 'image' ? 'center center' : ''),
      });
    });
  }

  // Backward compatibility: if old-format data has an explicit background-color
  // (before the multi-layer rewrite), parse it as the bottom-most solid layer.
  // DOM hover-state contamination is safe here because the component's useEffect
  // guard only triggers a re-parse when backgroundImage changes — hover states
  // only mutate backgroundColor, so the guard blocks those spurious re-parses.
  const SKIP_BG_COLOR = /^(transparent|initial|inherit|unset|revert|none)$/i;
  // rgba(0,0,0,0) 是浏览器 computedStyle 中 transparent 的等价形式，统一跳过，避免误建图层
  const isTransparentComputed = (color: string) =>
    /^rgba?\(\s*0\s*,\s*0\s*,\s*0\s*,\s*0\s*\)$/i.test(color.trim()) ||
    /^#00000000$/i.test(color.trim());
  if (backgroundColor && !SKIP_BG_COLOR.test(backgroundColor.trim()) && !isTransparentComputed(backgroundColor)) {
    try {
      new ColorUtil(backgroundColor); // throws for unparseable / computed values
      layers.push({
        id: generateLayerId(),
        type: 'solid',
        value: backgroundColor,
        visible: true,
        size: '',
        repeat: '',
        position: '',
      });
    } catch {
      // skip anything ColorUtil can't parse (e.g. CSS custom-property runtime values)
    }
  }

  return layers;
}

const toSolidGradientLayer = (color: string) => `linear-gradient(${color}, ${color})`;

/**
 * Ensure url() values have a quoted URL so Less won't misinterpret "//" as a
 * line comment.  e.g.  url(http://...)  →  url("http://...")
 */
function quoteUrlIfNeeded(value: string): string {
  return value.replace(/url\(\s*(?!['"])(.*?)\s*\)/g, (_, inner) => `url("${inner}")`);
}

/**
 * Serialize BgLayer[] into CSS key-value pairs.
 *
 * All layers — including solid colors — are expressed as background-image
 * entries (solid colors via `linear-gradient(color, color)`).
 * background-color is always cleared to '' so the output is a single,
 * predictable property with no mixed-property edge cases.
 */
export function serializeLayers(
  layers: BgLayer[],
): Array<{ key: string; value: any }> {
  const visibleLayers = layers.filter(l => l.visible);

  if (visibleLayers.length === 0) {
    return [
      { key: 'backgroundColor', value: null },
      { key: 'backgroundImage', value: null },
      { key: 'backgroundSize', value: null },
      { key: 'backgroundRepeat', value: null },
      { key: 'backgroundPosition', value: null },
    ];
  }

  const bgImages: string[] = [];
  const bgSizes: string[] = [];
  const bgRepeats: string[] = [];
  const bgPositions: string[] = [];

  visibleLayers.forEach(layer => {
    if (layer.type === 'solid') {
      bgImages.push(toSolidGradientLayer(layer.value));
      bgSizes.push('auto');
      bgRepeats.push('no-repeat');
      bgPositions.push('0% 0%');
    } else {
      bgImages.push(quoteUrlIfNeeded(layer.value));
      bgSizes.push(layer.size || 'auto');
      bgRepeats.push(layer.repeat || 'no-repeat');
      bgPositions.push(layer.position || 'center center');
    }
  });

  return [
    { key: 'backgroundColor', value: null },
    { key: 'backgroundImage', value: bgImages.join(', ') },
    { key: 'backgroundSize', value: bgSizes.join(', ') },
    { key: 'backgroundRepeat', value: bgRepeats.join(', ') },
    { key: 'backgroundPosition', value: bgPositions.join(', ') },
  ];
}

/** Interpret a Colorpicker onChange payload for a specific layer */
export function interpretPickerChange(
  change: any,
  currentLayer: BgLayer,
): Partial<BgLayer> | null {
  if (Array.isArray(change)) {
    const bgColorItem = change.find((c: any) => c.key === 'backgroundColor');
    const bgImageItem = change.find((c: any) => c.key === 'backgroundImage');
    const bgSizeItem = change.find((c: any) => c.key === 'backgroundSize');
    const bgRepeatItem = change.find((c: any) => c.key === 'backgroundRepeat');
    const bgPositionItem = change.find((c: any) => c.key === 'backgroundPosition');

    if (bgImageItem && bgImageItem.value && bgImageItem.value !== 'none') {
      const type = detectLayerType(bgImageItem.value);
      return {
        type,
        value: bgImageItem.value,
        size: bgSizeItem?.value || (type === 'image' ? 'auto' : ''),
        repeat: bgRepeatItem?.value || (type === 'image' ? 'no-repeat' : ''),
        position: bgPositionItem?.value || (type === 'image' ? 'center center' : ''),
      };
    }
    if (bgColorItem && bgColorItem.value !== undefined && bgColorItem.value !== '') {
      return { type: 'solid', value: bgColorItem.value };
    }
    // backgroundImage: 'none' and backgroundColor: '' → switching to image but no image yet, no update
    return null;
  }

  const { key, value } = change as { key: string; value: string };
  if (key === 'backgroundImage') {
    if (!value || value === 'none') return null;
    return { type: detectLayerType(value), value };
  }
  if (key === 'backgroundColor') {
    if (!value) return null;
    return { type: 'solid', value };
  }
  if (key === 'backgroundSize') return { size: value };
  if (key === 'backgroundRepeat') return { repeat: value };
  if (key === 'backgroundPosition') return { position: value };
  return null;
}
