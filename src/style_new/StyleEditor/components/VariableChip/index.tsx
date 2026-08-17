import React, { CSSProperties, ReactNode, useCallback, useMemo, useState } from 'react'

import { Panel, Dropdown, DownOutlined } from '../'
import { getCssVarName } from '../VariableList'
import { Variable } from '../../icons/Variable'

import css from './index.less'

/** 与 Dropdown 选项结构对齐，只暴露菜单需要的字段 */
export interface VariableChipMenuOption {
  label: string
  value: string
  type?: 'action' | 'divider'
  icon?: ReactNode
  iconSize?: 'sm' | 'md'
  disabled?: boolean
  tip?: string
}

const REPLACE_ACTION = '__replaceVariable__'
const NUMBER_WITH_UNIT_RE = /^-?(?:\d+\.?\d*|\.\d+)([a-z%]*)$/i

interface VariableChipProps {
  /** 当前绑定值，如 var(--spacing-lg) */
  value: string
  /** 变量解析出的具体值，用于提示与「固定值」文案 */
  resolvedValue?: string | null
  /** 框内展示文案，默认用解析值；如尺寸会省略 px 只显示数字 */
  display?: string
  /** 请求打开变量选择弹层（换绑）。弹层由插件统一持有，便于锚定到当前字段 */
  onRequestPicker?: () => void
  /** 「替换变量...」之前的菜单项，如 固定值 / 适应内容 / 移除 */
  menuOptions?: VariableChipMenuOption[]
  onMenuAction?: (value: string) => void
  /** 在胶囊右侧直接输入数值：传入已补好单位的 CSS 值，如 24px / 50% */
  onInputValue?: (value: string) => void
  /** 光标处按删除键：变量退化为当前的固定数值 */
  onDetach?: () => void
  style?: CSSProperties
}

/**
 * 变量绑定态的展示单元：框内显示变量当前的值并加一层描边衬底，
 * 点击胶囊可换绑，右侧下拉提供解绑等操作，胶囊右侧仍可聚焦输入。
 * 变量名收在 hover 提示里。
 */
export function VariableChip({
  value,
  resolvedValue,
  display,
  onRequestPicker,
  menuOptions = [],
  onMenuAction,
  onInputValue,
  onDetach,
  style,
}: VariableChipProps) {
  /** 胶囊右侧输入中的文本，提交后即替换变量 */
  const [draft, setDraft] = useState('')

  const varName = getCssVarName(value)
  // 面板宽度有限，框内只放值；解析不到时退回变量名
  const displayText = display || resolvedValue || varName?.replace(/^--/, '') || value

  const options = useMemo<VariableChipMenuOption[]>(() => ([
    ...menuOptions,
    ...(menuOptions.length ? [{ label: '', value: '__chipDivider__', type: 'divider' as const }] : []),
    { label: '替换变量...', value: REPLACE_ACTION, type: 'action', icon: <Variable /> },
  ]), [menuOptions])

  const handleAction = useCallback((actionValue: string) => {
    if (actionValue === REPLACE_ACTION) {
      onRequestPicker?.()
      return
    }
    onMenuAction?.(actionValue)
  }, [onRequestPicker, onMenuAction])

  const commitDraft = useCallback(() => {
    const trimmed = draft.trim()
    setDraft('')
    if (!trimmed) return
    const matched = trimmed.match(NUMBER_WITH_UNIT_RE)
    if (!matched) return
    // 不带单位时按编辑器默认单位 px 处理
    onInputValue?.(matched[1] ? trimmed : `${trimmed}px`)
  }, [draft, onInputValue])

  const handleKeyDown = useCallback((event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Backspace' || event.key === 'Delete') {
      if (draft) return
      event.preventDefault()
      onDetach?.()
      return
    }
    if (event.key === 'Enter') {
      commitDraft()
      return
    }
    if (event.key === 'Escape') {
      setDraft('')
      event.currentTarget.blur()
    }
  }, [draft, commitDraft, onDetach])

  return (
    <Panel.Item style={style}>
      <div
        className={css.chip}
        data-mybricks-tip={`${value}${resolvedValue ? ` = ${resolvedValue}` : ''}`}
      >
        <div className={css.main}>
          {/* 开始输入后隐藏胶囊，避免「旧变量值 + 新输入」同时出现 */}
          {!draft && <span className={css.valueBox} onClick={onRequestPicker}>{displayText}</span>}
          {/* 与 Figma 一致：胶囊右侧仍可聚焦输入，输入数值即替换变量，删除键退化为固定值 */}
          <input
            className={css.input}
            value={draft}
            spellCheck={false}
            data-drag-ignore
            onChange={(event) => setDraft(event.target.value)}
            onKeyDown={handleKeyDown}
            onBlur={commitDraft}
          />
        </div>
        {/* Dropdown 容器是 width:100%，需外层限宽，否则会挤掉左侧的胶囊与输入区 */}
        <div className={css.arrowWrap}>
          <Dropdown value={varName} options={options} onClick={handleAction} onAction={handleAction}>
            <span className={css.arrow}>
              <DownOutlined />
            </span>
          </Dropdown>
        </div>
      </div>
    </Panel.Item>
  )
}
