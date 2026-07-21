/**
 * STYLENEW 编辑器入口。
 * 回显引擎见 ./core，UI 壳见 StyleEditorShell / StyleMount / CssEditor。
 */
export { default } from './StyleEditorShell'

export type { StyleData } from './core/css-code-codec'
export { toLine, toHump, parseToStyleData } from './core/css-code-codec'
