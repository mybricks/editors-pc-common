import type { StyleChangeItem, StyleMutation } from '../type'

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
      }
    }
    return {
      key: mutation.key,
      value: mutation.value,
      intent: 'set-effective-style',
    }
  })
}
