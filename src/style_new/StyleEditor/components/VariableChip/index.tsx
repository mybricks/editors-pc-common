import React, { CSSProperties, ReactNode, useCallback, useMemo, useState } from 'react'

import { Panel, Dropdown, DownOutlined } from '../'
import { getCssVarName } from '../VariableList'
import { Variable } from '../../icons/Variable'

import css from './index.less'

/** 与 Dropdown 选项结构对齐，只暴露菜单需要的字段 */
export interface VariableChipMenuOption {
  label: string
  value: string
  /** 不传即普通可选项（如字号档位），点选走 onMenuSelect */
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
  /** 变量解析出的具体值，display 缺省时用作框内文案 */
  resolvedValue?: string | null
  /** 框内展示文案，默认用解析值；如尺寸会省略 px 只显示数字 */
  display?: string
  /** 请求打开变量选择弹层（换绑）。弹层由插件统一持有，便于锚定到当前字段 */
  onRequestPicker?: () => void
  /** 「替换变量...」之前的菜单项，如 固定值 / 适应内容 / 移除，或字号档位 */
  menuOptions?: VariableChipMenuOption[]
  onMenuAction?: (value: string) => void
  /** menuOptions 里的普通项被点选，如选中某个字号档位 */
  onMenuSelect?: (value: string) => void
  /**
   * 菜单形态：menu 为操作菜单（默认）；
   * presetList 对齐 Figma 的档位列表——顶部单列当前变量并勾选，底部换绑入口只留图标
   */
  menuLayout?: 'menu' | 'presetList'
  /** 覆盖菜单容器样式，如档位较多时 maxHeight: 'none' 全展开 */
  menuStyle?: CSSProperties
  /** 在胶囊右侧直接输入数值：传入已补好单位的 CSS 值，如 24px / 50% */
  onInputValue?: (value: string) => void
  /** 裸数字输入时补的单位，默认 px；如字间距绑定 em 变量时传 em */
  defaultUnit?: string
  /** 光标处按删除键：变量退化为当前的固定数值 */
  onDetach?: () => void
  /** 胶囊左侧的图标，用于保留未绑定态输入框里的字段标识（如 X / Y） */
  prefix?: ReactNode
  style?: CSSProperties
  /** 窄列（如边框四边宽度）收紧胶囊内边距和箭头，避免数字和箭头之间空一截 */
  compact?: boolean
  /** 与 InputNumber 对齐：默认隐藏下拉箭头，hover / 聚焦时再显示 */
  showIconOnHover?: boolean
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
  onMenuSelect,
  menuLayout = 'menu',
  menuStyle,
  onInputValue,
  defaultUnit = 'px',
  onDetach,
  prefix,
  style,
  compact = false,
  showIconOnHover = false,
}: VariableChipProps) {
  /** 胶囊右侧输入中的文本，提交后即替换变量 */
  const [draft, setDraft] = useState('')

  const varName = getCssVarName(value)
  // 面板宽度有限，框内只放值；解析不到时退回变量名
  const displayText = display || resolvedValue || varName?.replace(/^--/, '') || value

  const isPresetList = menuLayout === 'presetList'

  const options = useMemo<VariableChipMenuOption[]>(() => ([
    // 当前绑定的变量单列一行并勾选：与框内一致显示变量的值，变量名放在 hover 提示里
    ...(isPresetList && varName
      ? [
          { label: displayText, value: varName, tip: `变量：${varName}` },
          { label: '', value: '__currentVariableDivider__', type: 'divider' as const },
        ]
      : []),
    ...menuOptions,
    ...(menuOptions.length ? [{ label: '', value: '__chipDivider__', type: 'divider' as const }] : []),
    isPresetList
      ? { label: '', value: REPLACE_ACTION, type: 'action' as const, icon: <Variable />, tip: '替换变量...' }
      : { label: '替换变量...', value: REPLACE_ACTION, type: 'action' as const, icon: <Variable /> },
  ]), [menuOptions, isPresetList, varName, displayText])

  const handleAction = useCallback((actionValue: string) => {
    if (actionValue === REPLACE_ACTION) {
      onRequestPicker?.()
      return
    }
    onMenuAction?.(actionValue)
  }, [onRequestPicker, onMenuAction])

  const handleSelect = useCallback((selectedValue: string) => {
    // 顶部那行就是当前变量，点它不产生改动
    if (selectedValue === varName) return
    onMenuSelect?.(selectedValue)
  }, [varName, onMenuSelect])

  const commitDraft = useCallback(() => {
    const trimmed = draft.trim()
    setDraft('')
    if (!trimmed) return
    const matched = trimmed.match(NUMBER_WITH_UNIT_RE)
    if (!matched) return
    // 不带单位时按字段当前单位补全
    onInputValue?.(matched[1] ? trimmed : `${trimmed}${defaultUnit}`)
  }, [draft, onInputValue, defaultUnit])

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
        className={`${css.chip}${compact ? ` ${css.compact}` : ''}${showIconOnHover ? ` ${css.iconOnHover}` : ''}`}
        data-mybricks-tip={
          resolvedValue && resolvedValue !== displayText
            ? `变量：${varName || value}\n${resolvedValue}`
            : `变量：${varName || value}`
        }
      >
        {prefix && <div className={css.prefix}>{prefix}</div>}
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
          <Dropdown
            value={varName}
            options={options}
            onClick={handleSelect}
            onAction={handleAction}
            menuStyle={menuStyle}
          >
            <span className={css.arrow}>
              <DownOutlined />
            </span>
          </Dropdown>
        </div>
      </div>
    </Panel.Item>
  )
}
