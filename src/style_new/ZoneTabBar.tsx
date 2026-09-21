import React, { useMemo } from 'react'
import { Button, Dropdown, Menu } from 'antd'
import { PlusOutlined } from '@ant-design/icons'

import css from './index.less'

const PSEUDO_TAIL_RE = /(:{1,2}[a-zA-Z\-]+(?:\([^)]*\))?)$/

function getZoneTabLabel(selector: string): string {
  const parts = selector.trim().split(/\s+/)
  const lastPart = parts[parts.length - 1]
  // 含伪类的选择器只显示伪类部分（如 ":hover"），基础态选择器保持原逻辑
  const pseudoMatch = lastPart.match(PSEUDO_TAIL_RE)
  if (pseudoMatch) {
    const pseudoLabels: Record<string, string> = {
      ':hover': '悬浮态',
      ':focus': '聚焦态',
      ':focus-visible': '键盘聚焦态',
      ':active': '按下态',
      ':disabled': '禁用态',
      '::before': '前缀元素',
      '::after': '后缀元素',
      ':first-child': '首项',
      ':last-child': '末项',
      ':only-child': '唯一项',
    }
    const nthChild = pseudoMatch[1].match(/^:nth-child\((\d+)\)$/)
    if (nthChild) return `第${nthChild[1]}项`
    return pseudoLabels[pseudoMatch[1]] || pseudoMatch[1]
  }

  return '常规'
}

/** 伪类标签带上基础类名，如 aiChat-inputArea::placeholder */
function getDisambiguatedZoneTabLabel(selector: string): string {
  const parts = selector.trim().split(/\s+/)
  const lastPart = parts[parts.length - 1]
  const pseudoMatch = lastPart.match(PSEUDO_TAIL_RE)
  if (!pseudoMatch) return getZoneTabLabel(selector)

  return getZoneTabLabel(selector)
}

/**
 * 基础选择器末段冲突时带上父段，避免两个不同路径都显示成 "textarea"。
 * 例：.aiChat-inputArea textarea / .inputArea textarea → "aiChat-inputArea textarea" / "inputArea textarea"
 */
function getDisambiguatedBaseLabel(selector: string): string {
  return getZoneTabLabel(selector)
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
  labels?: string[]
  activeIdx: number
  onSelect: (idx: number) => void
  onAdd?: (type: string) => void
  addOptions?: Array<{ key: string; label: string }>
}) {
  const {
    selectors,
    labels: providedLabels,
    activeIdx,
    onSelect,
    onAdd,
    addOptions = [],
  } = props
  const labels = useMemo(
    () => providedLabels ?? getZoneTabLabels(selectors),
    [providedLabels, selectors]
  )

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
      {onAdd && addOptions.length > 0 && (
        <Dropdown
          trigger={['click']}
          overlay={
            <Menu onClick={({ key }) => onAdd(String(key))}>
              {addOptions.map((option) => (
                <Menu.Item key={option.key}>{option.label}</Menu.Item>
              ))}
            </Menu>
          }
        >
          <Button type="text" size="small" icon={<PlusOutlined />} aria-label="新增状态" />
        </Dropdown>
      )}
    </div>
  )
}
