import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'

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
    return labels[idx]
  })
}

export function ZoneTabBar(props: {
  selectors: string[]
  activeIdx: number
  onSelect: (idx: number) => void
}) {
  const { selectors, activeIdx, onSelect } = props
  const barRef = useRef<HTMLDivElement>(null)
  const tabRefs = useRef<(HTMLDivElement | null)[]>([])
  const [fadeLeft, setFadeLeft] = useState(false)
  const [fadeRight, setFadeRight] = useState(false)
  const [centered, setCentered] = useState(true)
  const labels = useMemo(() => getZoneTabLabels(selectors), [selectors])

  const updateFades = useCallback(() => {
    const barEl = barRef.current
    if (!barEl) return
    const { scrollLeft, scrollWidth, clientWidth } = barEl
    const maxScroll = scrollWidth - clientWidth
    const overflow = maxScroll > 1
    setCentered(!overflow)
    setFadeLeft(overflow && scrollLeft > 1)
    setFadeRight(overflow && scrollLeft < maxScroll - 1)
  }, [])

  useEffect(() => {
    const barEl = barRef.current
    const activeEl = tabRefs.current[activeIdx]
    if (!barEl || !activeEl) return

    // 选中项滚到可视区水平居中，而不是仅保证露全
    const targetLeft =
      activeEl.offsetLeft - (barEl.clientWidth - activeEl.offsetWidth) / 2
    const maxScroll = Math.max(0, barEl.scrollWidth - barEl.clientWidth)
    const nextLeft = Math.min(maxScroll, Math.max(0, targetLeft))
    if (typeof barEl.scrollTo === 'function') {
      barEl.scrollTo({ left: nextLeft, behavior: 'smooth' })
    } else {
      barEl.scrollLeft = nextLeft
    }
    requestAnimationFrame(updateFades)
  }, [activeIdx, selectors, updateFades])

  useEffect(() => {
    const barEl = barRef.current
    if (!barEl) return

    updateFades()
    barEl.addEventListener('scroll', updateFades, { passive: true })

    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(updateFades) : null
    ro?.observe(barEl)

    const onWheel = (e: WheelEvent) => {
      if (barEl.scrollWidth <= barEl.clientWidth) return
      const delta =
        Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : e.deltaY
      if (delta === 0) return
      const maxScroll = barEl.scrollWidth - barEl.clientWidth
      const next = Math.min(maxScroll, Math.max(0, barEl.scrollLeft + delta))
      if (next !== barEl.scrollLeft) {
        e.preventDefault()
        barEl.scrollLeft = next
      }
    }

    barEl.addEventListener('wheel', onWheel, { passive: false })
    return () => {
      barEl.removeEventListener('scroll', updateFades)
      barEl.removeEventListener('wheel', onWheel)
      ro?.disconnect()
    }
  }, [selectors.length, updateFades])

  const classNames = [
    css.zoneTabBar,
    centered ? css.zoneTabBarCentered : '',
    fadeLeft && fadeRight
      ? css.zoneTabBarFadeBoth
      : fadeLeft
        ? css.zoneTabBarFadeLeft
        : fadeRight
          ? css.zoneTabBarFadeRight
          : '',
  ]
    .filter(Boolean)
    .join(' ')

  return (
    <div className={classNames} ref={barRef}>
      {selectors.map((sel, idx) => (
        <div
          key={sel}
          ref={(el) => {
            tabRefs.current[idx] = el
          }}
          className={`${css.zoneTab}${idx === activeIdx ? ` ${css.zoneTabActive}` : ''}`}
          onClick={() => onSelect(idx)}
        >
          {labels[idx]}
        </div>
      ))}
    </div>
  )
}
