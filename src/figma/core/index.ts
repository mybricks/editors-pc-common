// eslint-disable-next-line @typescript-eslint/no-var-requires
const { convertIRToFigmaClipboardHtml } = require('./ir-to-figma/ir-to-figma');
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { elementToMybricksJsonWithInlineImages } = require('./dom-to-ir/dom-to-json');

export type { FontContext } from '../types';
export { convertIRToFigmaClipboardHtml, elementToMybricksJsonWithInlineImages };
