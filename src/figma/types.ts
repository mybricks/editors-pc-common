export interface FigmaImportItem {
  selectors: string[];
  value: Record<string, string>;
}

export type FontContext = {
  font: any;
  fontDigest: Uint8Array;
  /** 字体样式名，如 'Regular' / 'Light' / 'Semibold' */
  style?: string;
  /** PostScript 名，如 'PingFangSC-Regular' */
  postscript?: string;
} | null;

/** 字重数值 → FontContext 的映射，key 为 CSS font-weight 数值（100~600） */
export type FontContextMap = Record<number, NonNullable<FontContext>>;
