import type { CSSProperties } from 'react'
import { buildSoloSelector } from './build-solo-selector'
import { buildZoneSelectorsFromCssom } from './build-zone-selectors-from-cssom'
import { getDocument } from './dom'
import { getEffectedCssPropertyAndOptions } from './get-effected-css'
import { createAbsolutePatch } from './position'
import { createStyleWriteTargetResolver } from './style-write-target'
import { collectZoneTabs, mergeZoneTabsByState } from './zone-tab'

export type FreedomPlanOptions = { selector: string; soloEdit?: boolean; comId: string }
type StylePlanItem = {
  target: HTMLElement
  selector: string
  style: CSSProperties & { '--layout-mode'?: string }
}

export function buildFreedomPlan(parent: HTMLElement, parentStyle: CSSProperties, options: FreedomPlanOptions) {
  const { selector, soloEdit, comId } = options
  const componentRoot = getDocument().getElementById(comId)
  const changes: StylePlanItem[] = [{
    target: parent,
    selector,
    style: {
      '--layout-mode': 'freedom',
      position: !parentStyle.position || parentStyle.position === 'static' ? 'relative' : parentStyle.position,
    },
  }]

  for (const child of Array.from(parent.children) as HTMLElement[]) {
    const selectors = buildZoneSelectorsFromCssom(child, comId)
    const tab = mergeZoneTabsByState(collectZoneTabs([child], selectors, comId)).find(tab => !tab.pseudo)!
    const [currentStyle] = getEffectedCssPropertyAndOptions(child, selectors, comId, tab)
    const sharedSelector = createStyleWriteTargetResolver(tab, child)('position', 'current-rule').selector!

    changes.push({
      target: child,
      selector: soloEdit ? buildSoloSelector(child, sharedSelector, componentRoot) : sharedSelector,
      style: createAbsolutePatch(child, currentStyle as CSSProperties, parent),
    })
  }

  return { scope: soloEdit ? 'single' : 'all', changes }
}
