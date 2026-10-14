import React, { ReactElement, useMemo } from 'react'
import { Dropdown, Menu } from 'antd'
import { CloseOutlined } from '@ant-design/icons'
import { MoreOutlined } from './StyleEditor/components/Icon'
import { collectSubjectClassSelectors } from './core/build-zone-selectors-from-cssom'
import lang from './index.i18n'

import css from './index.less'

const PSEUDO_TAIL_RE = /(:{1,2}[a-zA-Z\-]+(?:\([^)]*\))?)$/

function getZoneTabLabel(selector: string): string {
  const parts = selector.trim().split(/\s+/)
  const lastPart = parts[parts.length - 1]
  // 含伪类的选择器只显示伪类部分（如 ":hover"），基础态选择器保持原逻辑
  const pseudoMatch = lastPart.match(PSEUDO_TAIL_RE)
  if (pseudoMatch) {
    const pseudoLabels: Record<string, string> = {
      ':hover': lang.hoverState,
      ':focus': lang.focusState,
      ':focus-visible': lang.focusVisibleState,
      ':active': lang.activeState,
      ':disabled': lang.disabledState,
      '::before': lang.beforePseudo,
      '::after': lang.afterPseudo,
    }
    return pseudoLabels[pseudoMatch[1]] || pseudoMatch[1]
  }

  return lang.commonTab
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

/**
 * zonetab 提示
 */
function getZoneTabTip(selector: string): string {
  const lastPart = selector.trim().split(/\s+/).pop() || ''
  const pseudoMatch = lastPart.match(PSEUDO_TAIL_RE)
  if (!pseudoMatch) {
    return lang.commonStyleTip
  }
  const pseudo = pseudoMatch[1]
  const tipMap: Record<string, string> = {
    ':hover': lang.hoverStateTip,
    ':focus': lang.focusStateTip,
    ':focus-visible': lang.focusVisibleStateTip,
    ':focus-within': lang.focusWithinStateTip,
    ':active': lang.activeStateTip,
    ':disabled': lang.disabledStateTip,
    ':checked': lang.checkedStateTip,
    ':placeholder-shown': lang.placeholderShownStateTip,
    '::before': lang.beforePseudoTip,
    '::after': lang.afterPseudoTip,
    '::placeholder': lang.placeholderPseudoTip,
  }
  if (tipMap[pseudo]) return tipMap[pseudo]
  // 兜底：未收录的伪类/伪元素按类型拼格式
  return pseudo.startsWith('::')
    ? `${lang.pseudoElementTip} ${pseudo}`
    : `${lang.pseudoClassTip} ${pseudo}`
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
  targetDom?: HTMLElement | null
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
    targetDom,
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
            {lang.addStateLabel}
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
  const isNoSelector = selectors.length === 0
  const subjectClassSelectors = targetDom ? collectSubjectClassSelectors(targetDom) : []
  // 元素自身没有可编辑 class 时，不展示 MoreOutlined 按钮
  const hasNoClass = subjectClassSelectors.length === 0

  return (
    <div className={css.zoneTabBar}>
      {(isSingleNormalTab || isNoSelector) ? (
        <span className={css.zoneTabSingleTitle}>{lang.commonStyleLabel}</span>
      ) : (
        <div className={css.zoneTabList}>
          {selectors.map((sel, idx) => (
            <div
              key={sel}
              className={`${css.zoneTab}${idx === activeIdx ? ` ${css.zoneTabActive}` : ''}`}
              onClick={() => onSelect(idx)}
            >
              <span data-mybricks-tip={getZoneTabTip(sel)}>{labels[idx]}</span>
              {onDelete && deletableSelectors.includes(sel) && (
                <button
                  className={css.zoneTabDelete}
                  type="button"
                  aria-label={`${lang.deleteLabel}${labels[idx]}`}
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
      {!hasNoClass && (
        <Dropdown
          overlayClassName={css.zoneTabDropdown}
          overlay={moreOverlay}
        >
          <button
            className={css.moreBtn}
            type="button"
            aria-label={lang.moreActionsLabel}
            style={{ transform: 'rotate(90deg)' }}
          >
            <MoreOutlined />
          </button>
        </Dropdown>
      )}
    </div>
  )
}
