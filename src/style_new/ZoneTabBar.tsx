import React, { useMemo } from 'react'

import css from './index.less'

const PSEUDO_TAIL_RE = /(:{1,2}[a-zA-Z\-]+(?:\([^)]*\))?)$/

function shortenClassLabel(rawLabel: string): string {
  // 若复合类中含有 CSS Modules 哈希类名（形如 "pages_xxx--cyan"），
  // 只显示哈希类名中 '--' 之后的原始部分（如 "cyan"），避免超长显示
  const classes = rawLabel.split('.')
  const hashedClasses = classes.filter((cls) => cls.includes('--'))
  return hashedClasses.length > 0
    ? hashedClasses.map((cls) => cls.slice(cls.lastIndexOf('--') + 2)).join('.')
    : rawLabel
}

function getZoneTabLabel(selector: string): string {
  const parts = selector.trim().split(/\s+/)
  const lastPart = parts[parts.length - 1]
  // 含伪类的选择器只显示伪类部分（如 ":hover"），基础态选择器保持原逻辑
  const pseudoMatch = lastPart.match(PSEUDO_TAIL_RE)
  if (pseudoMatch) return pseudoMatch[1]

  return shortenClassLabel(lastPart.replace(/^\./, ''))
}

/** 伪类标签带上基础类名，如 aiChat-inputArea::placeholder */
function getDisambiguatedZoneTabLabel(selector: string): string {
  const parts = selector.trim().split(/\s+/)
  const lastPart = parts[parts.length - 1]
  const pseudoMatch = lastPart.match(PSEUDO_TAIL_RE)
  if (!pseudoMatch) return getZoneTabLabel(selector)

  const base = lastPart.slice(0, -pseudoMatch[1].length).replace(/^\./, '')
  if (!base) return pseudoMatch[1]
  return `${shortenClassLabel(base)}${pseudoMatch[1]}`
}

/**
 * 基础选择器末段冲突时带上父段，避免两个不同路径都显示成 "textarea"。
 * 例：.aiChat-inputArea textarea / .inputArea textarea → "aiChat-inputArea textarea" / "inputArea textarea"
 */
function getDisambiguatedBaseLabel(selector: string): string {
  const parts = selector.trim().split(/\s+/)
  const lastPart = parts[parts.length - 1] || ''
  const self = shortenClassLabel(lastPart.replace(/^\./, ''))
  if (parts.length < 2) return self
  const parent = shortenClassLabel(parts[parts.length - 2].replace(/^\./, ''))
  if (!parent) return self
  return `${parent} ${self}`
}

function isPseudoSelector(selector: string): boolean {
  const lastPart = selector.trim().split(/\s+/).pop() || ''
  return PSEUDO_TAIL_RE.test(lastPart)
}

function getZoneTabLabels(selectors: string[]): string[] {
  // 多个基础选择器并存时，伪类 tab 必须带所属类名，否则看不出 ::placeholder 属于谁
  const baseCount = selectors.filter((sel) => !isPseudoSelector(sel)).length
  const needBasePrefix = baseCount > 1

  const labels = selectors.map(getZoneTabLabel)
  const counts = new Map<string, number>()
  for (const label of labels) {
    counts.set(label, (counts.get(label) ?? 0) + 1)
  }

  return selectors.map((sel, idx) => {
    if (
      isPseudoSelector(sel) &&
      (needBasePrefix || (counts.get(labels[idx]) ?? 0) > 1)
    ) {
      return getDisambiguatedZoneTabLabel(sel)
    }
    // 基础态末段撞名（如两条路径都以 textarea 结尾）时带上父段消歧
    if (!isPseudoSelector(sel) && (counts.get(labels[idx]) ?? 0) > 1) {
      return getDisambiguatedBaseLabel(sel)
    }
    return labels[idx]
  })
}

export function ZoneTabBar(props: {
  selectors: string[]
  activeIdx: number
  onSelect: (idx: number) => void
}) {
  const { selectors, activeIdx, onSelect } = props
  const labels = useMemo(() => getZoneTabLabels(selectors), [selectors])

  return (
    <div className={css.zoneTabBar}>
      {selectors.map((sel, idx) => (
        <div
          key={sel}
          className={`${css.zoneTab}${idx === activeIdx ? ` ${css.zoneTabActive}` : ''}`}
          onClick={() => onSelect(idx)}
        >
          {labels[idx]}
        </div>
      ))}
    </div>
  )
}
