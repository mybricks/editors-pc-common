import React, { ReactElement, useMemo } from 'react'
import { Dropdown, Menu } from 'antd'
import { CloseOutlined } from '@ant-design/icons'
import { MoreOutlined } from './StyleEditor/components/Icon'

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
      ':active': '激活态',
      ':disabled': '禁用态',
      '::before': '前缀元素',
      '::after': '后缀元素',
    }
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
  deletableSelectors?: string[]
  onDelete?: (selector: string) => void
  moreMenus: ReactElement
}) {
  const {
    selectors,
    labels: providedLabels,
    activeIdx,
    onSelect,
    onAdd,
    addOptions = [],
    deletableSelectors = [],
    onDelete,
    moreMenus,
  } = props
  const labels = useMemo(
    () => providedLabels ?? getZoneTabLabels(selectors),
    [providedLabels, selectors]
  )

  const moreOverlay = useMemo(() => {
    if (!onAdd || addOptions.length === 0) {
      return moreMenus
    }
    const addStateSubMenu = (
      <Menu.SubMenu
        key="__addState"
        popupClassName={css.zoneTabDropdown}
        popupOffset={[-0.5, 0]}
        title={
          <span style={{ fontWeight: 'normal', display: 'inline-flex', alignItems: 'center' }}>
            添加状态
          </span>
        }
      >
        {addOptions.map((option) => (
          <Menu.Item key={option.key} onClick={() => onAdd(String(option.key))}>
            {option.label}
          </Menu.Item>
        ))}
      </Menu.SubMenu>
    )
    const existingChildren = moreMenus.props.children
    const childrenArray = Array.isArray(existingChildren)
      ? existingChildren
      : existingChildren != null
      ? [existingChildren]
      : []
    return React.cloneElement(moreMenus, {}, addStateSubMenu, ...childrenArray)
  }, [onAdd, addOptions, moreMenus])

  const isSingleNormalTab =
    selectors.length === 1 && !isPseudoSelector(selectors[0])
  // 无 selector 时，只展示"常规样式"，不展示 MoreOutlined 按钮
  const isNoSelector = selectors.length === 0

  return (
    <div className={css.zoneTabBar}>
      {(isSingleNormalTab || isNoSelector) ? (
        <span className={css.zoneTabSingleTitle}>常规样式</span>
      ) : (
        <div className={css.zoneTabList}>
          {selectors.map((sel, idx) => (
            <div
              key={sel}
              className={`${css.zoneTab}${idx === activeIdx ? ` ${css.zoneTabActive}` : ''}`}
              onClick={() => onSelect(idx)}
            >
              <span>{labels[idx]}</span>
              {onDelete && deletableSelectors.includes(sel) && (
                <button
                  className={css.zoneTabDelete}
                  type="button"
                  aria-label={`删除${labels[idx]}`}
                  onClick={(event) => {
                    event.stopPropagation()
                    onDelete(sel)
                  }}
                >
                  <CloseOutlined />
                </button>
              )}
            </div>
          ))}
        </div>
      )}
      {!isNoSelector && (
        <Dropdown
          overlayClassName={css.zoneTabDropdown}
          overlay={moreOverlay}
        >
          <button
            className={css.moreBtn}
            type="button"
            aria-label="更多操作"
            style={{ transform: 'rotate(90deg)' }}
          >
            <MoreOutlined />
          </button>
        </Dropdown>
      )}
    </div>
  )
}
