export interface FigmaImportItem {
  selectors: string[];
  value: Record<string, string>;
}

export type FontContext = {
  font: any;
  fontDigest: Uint8Array;
} | null;
