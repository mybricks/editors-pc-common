import type { StyleChangeItem, StyleMutation } from '../type'

/** 面板提交的修改意图 → 内部 mutation；writeTo 等意图字段在这里原样保留。 */
export function buildStyleMutations(items: readonly StyleChangeItem[]): StyleMutation[] {
  return items.map((item) => item.value == null
    ? {
        type: 'clear',
        key: item.key,
        borderMode: item.borderMode,
        ...(item.writeTo ? { writeTo: item.writeTo } : {}),
      }
    : {
        type: 'set',
        key: item.key,
        value: item.value,
        target: item.target,
        borderMode: item.borderMode,
        ...(item.paintRole ? { paintRole: item.paintRole } : {}),
        ...(item.writeTo ? { writeTo: item.writeTo } : {}),
      })
}

/** 将属性编辑器命令转换为现有执行器使用的内部结构。 */
export function buildStyleMutationChange(
  mutations: StyleMutation[]
): StyleChangeItem[] {
  return mutations.map((mutation) => {
    if (mutation.type === 'clear') {
      return {
        key: mutation.key,
        value: null,
        intent: 'clear-effective-style',
        ...(mutation.borderMode ? { borderMode: mutation.borderMode } : {}),
        ...(mutation.writeTo ? { writeTo: mutation.writeTo } : {}),
      }
    }
    return {
      key: mutation.key,
      value: mutation.value,
      intent: 'set-effective-style',
      ...(mutation.target ? { target: mutation.target } : {}),
      ...(mutation.borderMode ? { borderMode: mutation.borderMode } : {}),
      ...(mutation.paintRole ? { paintRole: mutation.paintRole } : {}),
      ...(mutation.writeTo ? { writeTo: mutation.writeTo } : {}),
    }
  })
}
