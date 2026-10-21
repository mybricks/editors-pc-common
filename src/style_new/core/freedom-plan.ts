import type { CSSProperties } from 'react'
import { buildSoloSelector } from './build-solo-selector'
import { buildZoneSelectorsFromCssom } from './build-zone-selectors-from-cssom'
import { detectContainerCollapse } from './detect-container-collapse'
import { getDocument } from './dom'
import { getEffectedCssPropertyAndOptions } from './get-effected-css'
import { createAbsolutePatch } from './position'
import { createStyleWriteTargetResolver } from './style-write-target'
import { collectZoneTabs, mergeZoneTabsByState } from './zone-tab'

export type FreedomPlanOptions = { selector: string; soloEdit?: boolean; comId: string }
type StylePlanItem = {
  target: HTMLElement
  selector: string
  style: { [K in keyof CSSProperties]?: CSSProperties[K] | null } & { '--layout-mode'?: string | null }
}

export function buildFreedomPlan(parent: HTMLElement, parentStyle: CSSProperties, options: FreedomPlanOptions, mode: 'freedom' | 'flex' = 'freedom') {
  const { selector, soloEdit, comId } = options
  const componentRoot = getDocument().getElementById(comId)
  const changes: StylePlanItem[] = [{
    target: parent,
    selector,
    style: mode === 'freedom' ? {
      '--layout-mode': 'freedom',
      position: !parentStyle.position || parentStyle.position === 'static' ? 'relative' : parentStyle.position,
    } : { ...parentStyle, '--layout-mode': null },
  }]

  for (const child of Array.from(parent.children) as HTMLElement[]) {
    const selectors = buildZoneSelectorsFromCssom(child, comId)
    const tab = mergeZoneTabsByState(collectZoneTabs([child], selectors, comId)).find(tab => !tab.pseudo)!
    const [currentStyle] = getEffectedCssPropertyAndOptions(child, selectors, comId, tab)
    const sharedSelector = createStyleWriteTargetResolver(tab, child)('position', 'current-rule').selector!

    changes.push({
      target: child,
      selector: soloEdit ? buildSoloSelector(child, sharedSelector, componentRoot) : sharedSelector,
      style: mode === 'freedom'
        ? createAbsolutePatch(child, currentStyle as CSSProperties, parent)
        : { position: null, left: null, top: null },
    })
  }

  if (mode === 'freedom') {
    const parentPatch = changes[0].style
    const result = detectContainerCollapse(parent, parentPatch.position!)
    if (result.collapseWidth) parentPatch.minWidth = result.before.width
    if (result.collapseHeight) parentPatch.minHeight = result.before.height
  }

  return { scope: soloEdit ? 'single' : 'all', changes }
}
