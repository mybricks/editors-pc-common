// eslint-disable-next-line @typescript-eslint/no-var-requires
const pakoInflate = require('../shared/vendors/pako-inflate.min');
// eslint-disable-next-line @typescript-eslint/no-var-requires
const fzstd = require('../shared/vendors/fzstd');
// eslint-disable-next-line @typescript-eslint/no-var-requires
const kiwi = require('../shared/vendors/kiwi-schema');
import {
  decodeFigmaClipboardHtmlWithDeps,
  getNodeChangesFromMessage as sharedGetNodeChangesFromMessage,
  buildNodeTreeLines as sharedBuildNodeTreeLines,
} from '../shared/decode-figma-clipboard.shared.js';

export interface DecodeFigmaClipboardResult {
  meta: unknown;
  archiveVersion: number;
  message: Record<string, unknown>;
}

export interface FigmaClipboardNodeLine {
  index: number;
  type: string;
  name: string;
  x: string | number;
  y: string | number;
  w: string | number;
  h: string | number;
  layout?: string;
  childCount: number;
}

export function decodeFigmaClipboardHtml(html: string): DecodeFigmaClipboardResult {
  const out = decodeFigmaClipboardHtmlWithDeps(html, {
    inflateRaw: pakoInflate.inflateRaw,
    inflate: pakoInflate.inflate,
    ungzip: pakoInflate.ungzip,
    zstdDecompress: fzstd.decompress,
    decodeBinarySchema: kiwi.decodeBinarySchema,
    compileSchema: kiwi.compileSchema,
  });
  return {
    meta: out.meta,
    archiveVersion: out.archiveVersion,
    message: out.message,
  };
}

export function getNodeChangesFromMessage(message: Record<string, unknown>): unknown[] | null {
  return sharedGetNodeChangesFromMessage(message) as unknown[] | null;
}

export function buildNodeTreeLines(nodeChanges: unknown[] | null): FigmaClipboardNodeLine[] {
  return sharedBuildNodeTreeLines(nodeChanges) as FigmaClipboardNodeLine[];
}
