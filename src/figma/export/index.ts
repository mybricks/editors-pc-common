// eslint-disable-next-line @typescript-eslint/no-var-requires
const { convertIRToFigmaClipboardHtml } = require('./ir-to-figma/ir-to-figma');
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { elementToMybricksJsonWithInlineImages, elementToMybricksJson } = require('./dom-to-ir/dom-to-json');
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { inlineImageFillsInTree } = require('./dom-to-ir/image-inline');

export type { FontContext } from '../types';
export {
  convertIRToFigmaClipboardHtml,
  elementToMybricksJsonWithInlineImages,
  elementToMybricksJson,
  inlineImageFillsInTree,
};
