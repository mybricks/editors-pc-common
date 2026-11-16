import type { StyleSourceCandidate } from '../../../../core/style-property'
import type { MarginClearInput } from './type'

/** 后备来源也属于本次待删来源时，整组删除无需再用 unset 屏蔽。 */
export function canDeleteMarginTogether({ properties }: MarginClearInput): boolean {
  // 只从四边 winner 收集待删来源，不把集合外的后备规则一起删除。
  const plannedSources = properties
    .map(property => property.winner)
    .filter((source): source is StyleSourceCandidate => source !== null)

  for (const property of properties) {
    for (const candidate of property.candidates) {
      // 本次只接管当前状态的 class；内联、运行时和其他状态沿用原处理。
      if (!candidate.currentState || candidate.inline || candidate.source?.isRuntimeStyle) return false

      const covered = plannedSources.some(source =>
        source.label === candidate.label && source.source === candidate.source
      )
      if (!covered) return false
    }
  }
  return true
}
