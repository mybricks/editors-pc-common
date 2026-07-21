import { useCallback, useState } from 'react'

export type BatchMeta = {
  enabled: boolean
  dirtyCount: number
  submitting: boolean
}

export function useBatchMeta(editConfig: any) {
  const [batchMeta, setBatchMeta] = useState<BatchMeta>({
    enabled: false,
    dirtyCount: 0,
    submitting: false,
  })

  const refreshBatchMeta = useCallback(() => {
    const localMeta = editConfig.value.getBatchMeta?.()
    const bridgeMeta = (window as any).__mybricks_style_batch_bridge?.getMeta?.()
    const localDirty = Number(localMeta?.dirtyCount || 0)
    const bridgeDirty = Number(bridgeMeta?.dirtyCount || 0)
    const dirtyCount = Math.max(localDirty, bridgeDirty)
    const submitting = !!(localMeta?.submitting || bridgeMeta?.submitting)
    const enabled = !!(localMeta?.enabled || bridgeMeta?.enabled || dirtyCount > 0)
    setBatchMeta((prev) => {
      if (
        prev.enabled === enabled &&
        prev.dirtyCount === dirtyCount &&
        prev.submitting === submitting
      ) {
        return prev
      }
      return { enabled, dirtyCount, submitting }
    })
  }, [editConfig])

  const onBatchDiscard = useCallback(() => {
    if (editConfig.value.discardBatch) {
      editConfig.value.discardBatch()
    } else {
      ;(window as any).__mybricks_style_batch_bridge?.discard?.()
    }
    refreshBatchMeta()
  }, [editConfig, refreshBatchMeta])

  const onBatchCommit = useCallback(() => {
    if (editConfig.value.commitBatch) {
      editConfig.value.commitBatch()
    } else {
      ;(window as any).__mybricks_style_batch_bridge?.commit?.()
    }
    refreshBatchMeta()
  }, [editConfig, refreshBatchMeta])

  return { batchMeta, refreshBatchMeta, onBatchDiscard, onBatchCommit }
}
