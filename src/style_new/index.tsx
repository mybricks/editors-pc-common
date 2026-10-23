/**
 * STYLENEW 编辑器入口。
 * 回显引擎见 ./core，UI 壳见 StyleEditorShell / StyleMount / CssEditor。
 */
export { default } from './StyleEditorShell'

export type { StyleData } from './core/css-code-codec'
export { toLine, toHump, parseToStyleData } from './core/css-code-codec'
export { getSimilarZones } from './core/get-similar-zones'
export { emitUndo, emitRedo, emitUndoAll, getVariations, onVariationsChange, selectVariation, useVariation } from './core/variations'
export type { StyleVariation } from './core/variations'
import pkg from '../../package.json'
console.log(`%c ${pkg.name} %c@${pkg.version}`, "color:#FFF;background:#fa6400", "", "")
