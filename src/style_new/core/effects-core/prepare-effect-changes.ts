import { serializeEffects } from '../../StyleEditor/plugins/Effects/layers'
import type { EffectsCore } from './type'
import { getStyleEmptyState } from './style-empty-state'
import { getStyleResolution } from '../style-property'
import { createStyleWriteTargetResolver } from '../style-write-target'

/**
 * 仅在 Effects 提交前补齐文字阴影的清空值和优先级，后续仍通过原 onChange 写入。
 * 返回 undefined 表示本次清空不可执行，调用方应保留当前图层、不提交修改。
 */
export const prepareEffectChanges: EffectsCore['prepareEffectChanges'] = (
  next, previousLayers, previous, tab, target,
) => {
  const changes = serializeEffects(next, previous)
  // 单独编辑或没有 Zone 的面板沿用原序列化结果，不进入这次新增的来源判定。
  if (!tab) return changes

  // 1. 比较前后图层，而不是只看 CSS 快照。
  // 例如文字阴影已写为 none，此时新增模糊，两次图层序列化的 textShadow 都是 null。
  // 必须移除这个未变化字段，否则随模糊一起提交的 null 会删掉用于阻断继承的 none。
  const textShadow = changes.find(item => item.key === 'textShadow')!
  const previousTextShadow = serializeEffects(previousLayers, previous).find(item => item.key === 'textShadow')!
  if (textShadow.value === previousTextShadow.value) return changes.filter(item => item.key !== 'textShadow')

  // 2. 删除最后一层时，null 只代表“面板没有文字阴影层了”。
  // 提交前还要根据实时来源决定：删除自身声明，还是写 unset/none 覆盖外部阴影。
  const resolution = getStyleResolution(tab, target)
  const plan = getStyleEmptyState('textShadow', tab, target, resolution)!.clearPlan
  if (textShadow.value === null) {
    if (plan.disabledReason) return undefined
    // 计划只有 deletions 时继续提交 null；有 style 时使用计划中的覆盖值。
    textShadow.value = plan.groups.find(group => group.style.textShadow != null)?.style.textShadow ?? null
  } else if (!/!important\s*$/i.test(String(textShadow.value))) {
    // 3. 新增或删除部分阴影层仍属于写值操作，需要保留覆盖外部规则的优先级。
    // 例如先用 unset !important 清除了 Ant 阴影，再添加新阴影时不能丢掉 !important。
    const selector = createStyleWriteTargetResolver(tab, target, resolution)('textShadow').selector
    const previous = resolution.get('textShadow').candidates.find(candidate =>
      candidate.currentState && candidate.label === selector && candidate.important)
    // 尚无自身声明时，由清空计划判断外部规则是否要求提升优先级。
    if (previous || plan.groups.some(group => group.selector === selector && /!important\s*$/i.test(String(group.style.textShadow)))) {
      textShadow.value = `${textShadow.value} !important`
    }
  }
  return changes
}
