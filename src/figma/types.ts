export interface FigmaImportItem {
  selectors: string[];
  value: Record<string, string>;
  /** AL 容器节点的直接子节点 selectors（仅二进制剪贴板路径填充） */
  childSelectors?: string[];
  /** 附加元数据（用于同步阶段决策） */
  meta?: {
    dimension?: {
      /** Figma 水平方向尺寸语义：FIXED / FILL / HUG / 其他 */
      sizingHorizontal?: string;
      /** Figma 垂直方向尺寸语义：FIXED / FILL / HUG / 其他 */
      sizingVertical?: string;
      /** Figma 上报的原始尺寸（快照值） */
      sourceSize?: {
        x?: number;
        y?: number;
      };
      /** 是否来自 Auto Layout 容器 */
      hasAutoLayout?: boolean;
      /** Auto Layout 方向：HORIZONTAL / VERTICAL */
      stackMode?: string;
    };
  };
}

export type FontContext = {
  font: any;
  fontDigest: Uint8Array;
  /** 字体样式名，如 'Regular' / 'Light' / 'Semibold' */
  style?: string;
  /** PostScript 名，如 'PingFangSC-Regular' */
  postscript?: string;
  /**
   * 实际 Figma 字体族名（当 CSS font-family 使用 PostScript 名时才有值）。
   * 例如 CSS="AlibabaPuHuiTi-115-Black" → figmaFamily="Alibaba PuHuiTi 3.0"
   */
  figmaFamily?: string;
  /**
   * 实际 Figma 样式名（与 figmaFamily 配套）。
   * 例如 CSS="AlibabaPuHuiTi-115-Black" → figmaStyle="115 Black"
   */
  figmaStyle?: string;
} | null;

/** 字重数值 → FontContext 的映射，key 为 CSS font-weight 数值（100~900） */
export type FontContextByWeight = Record<number, NonNullable<FontContext>>;

/** 字体族名 → 字重映射，支持同时导出多个字体族 */
export type FontContextMap = Record<string, FontContextByWeight>;
