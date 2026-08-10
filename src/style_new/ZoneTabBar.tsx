import React from 'react'

import css from './index.less'

function getZoneTabLabel(selector: string): string {
  const parts = selector.trim().split(/\s+/)
  const lastPart = parts[parts.length - 1]
  // 含伪类的选择器只显示伪类部分（如 ":hover"），基础态选择器保持原逻辑
  const pseudoMatch = lastPart.match(/(:{1,2}[a-zA-Z\-]+(?:\([^)]*\))?)$/)
  if (pseudoMatch) return pseudoMatch[1]

  const rawLabel = lastPart.replace(/^\./, '')
  // 若复合类中含有 CSS Modules 哈希类名（形如 "pages_xxx--cyan"），
  // 只显示哈希类名中 '--' 之后的原始部分（如 "cyan"），避免超长显示
  const classes = rawLabel.split('.')
  const hashedClasses = classes.filter((cls) => cls.includes('--'))
  return hashedClasses.length > 0
    ? hashedClasses.map((cls) => cls.slice(cls.lastIndexOf('--') + 2)).join('.')
    : rawLabel
}

export function ZoneTabBar(props: {
  selectors: string[]
  activeIdx: number
  onSelect: (idx: number) => void
}) {
  const { selectors, activeIdx, onSelect } = props

  return (
    <div className={css.zoneTabBar}>
      {selectors.map((sel, idx) => (
        <div
          key={sel}
          className={`${css.zoneTab}${idx === activeIdx ? ` ${css.zoneTabActive}` : ''}`}
          onClick={() => onSelect(idx)}
        >
          {getZoneTabLabel(sel)}
        </div>
      ))}
    </div>
  )
}
