// eslint-disable-next-line @typescript-eslint/no-var-requires
const { convertIRToFigmaClipboardHtml } = require('./ir-to-figma');

export type FontContext = {
  font: any;
  fontDigest: Uint8Array;
} | null;

export { convertIRToFigmaClipboardHtml };
