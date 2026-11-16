/**
 * Effects 专用入口，目前仅接管文字阴影的空值、清空和提交准备。
 * type.ts 定义接口；style-empty-state 规划清空；readonly-candidates 收集外部来源；
 * prepare-effect-changes 准备提交数据。实际写入仍由面板的 onChange 完成。
 */
export { getStyleEmptyState, isStyleValueEmpty } from './style-empty-state'
export { prepareEffectChanges } from './prepare-effect-changes'
export type { EffectsCore, StyleEmptyState, StyleEmptyStrategy } from './type'
