import React, { CSSProperties, ReactNode, useCallback, useMemo, useState } from 'react'

import { Panel, Dropdown, DownOutlined } from '../'
import { getCssVarName } from '../VariableList'
import { Variable } from '../../icons/Variable'
import lang from '../../../index.i18n'

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
  /** 与数值分开显示的单位文案，如不透明度的 % */
  unitLabel?: string
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
  unitLabel,
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
          { label: displayText, value: varName, tip: `${lang.variablePrefix}${varName}` },
          { label: '', value: '__currentVariableDivider__', type: 'divider' as const },
        ]
      : []),
    ...menuOptions,
    // 这段改动控制下拉菜单里有没有「替换变量...」。以网格设置中的列宽为例：
    // CSS 是 var(--col-width)，变量值为 100px，输入框显示数字胶囊「100」。点击右侧箭头：
    //   修改前的菜单：[固定值 (100)]、分隔线、[替换变量...]。
    //   修改后的菜单：[固定值 (100)]。
    // 原因：Grid 没有实现选择其他变量的弹窗，原来的「替换变量...」点了没反应。
    // onRequestPicker 就是打开该弹窗的函数；没传时，不添加「替换变量...」及其前面的分隔线。
    // 旧宽高输入框 Size、通用数值框 VariableNumberInput 都传了这个函数，仍显示该菜单项，点击仍打开变量列表。
    ...(onRequestPicker ? [
      ...(menuOptions.length ? [{ label: '', value: '__chipDivider__', type: 'divider' as const }] : []),
      isPresetList
        ? { label: '', value: REPLACE_ACTION, type: 'action' as const, icon: <Variable />, tip: lang.replaceVariable }
        : { label: lang.replaceVariable, value: REPLACE_ACTION, type: 'action' as const, icon: <Variable /> },
    ] : []),
  ]), [menuOptions, isPresetList, varName, displayText, onRequestPicker])

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

  // 新增 value 参数：失焦时传入 input 的实际文本，按 Enter 时仍默认使用 draft。
  // 这样 Esc 清空 input 后触发失焦，会收到空串并跳过提交，不会把已取消的 3fr 写回。
  // 数字校验和补单位沿用旧逻辑；提交/取消的修复也作用于 Size、VariableNumberInput 等历史调用方。
  const commitDraft = useCallback((value = draft) => {
    const trimmed = value.trim()
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
      // 例如原值是 var(--col-size)，输入 3fr 后按 Esc，应保留原变量。
      // setDraft('') 尚未更新输入框就会执行 blur，必须先清空实际 input，否则失焦仍会提交 3fr。
      event.currentTarget.value = ''
      event.currentTarget.blur()
    }
  }, [draft, commitDraft, onDetach])

  return (
    <Panel.Item style={style}>
      <div
        className={`${css.chip}${compact ? ` ${css.compact}` : ''}${showIconOnHover ? ` ${css.iconOnHover}` : ''}`}
        data-mybricks-tip={JSON.stringify({
          content: resolvedValue && resolvedValue !== displayText
            ? `${lang.variablePrefix}${varName || value}\n${resolvedValue}`
            : `${lang.variablePrefix}${varName || value}`,
          position: 'left',
        })}
      >
        {prefix && <div className={css.prefix}>{prefix}</div>}
        <div className={css.main}>
          {/* 开始输入后隐藏胶囊，避免「旧变量值 + 新输入」同时出现 */}
          {!draft && (
            <>
              <span className={css.valueBox} onClick={onRequestPicker}>{displayText}</span>
              {unitLabel && <span className={css.unit}>{unitLabel}</span>}
            </>
          )}
          {/* 与 Figma 一致：胶囊右侧仍可聚焦输入，输入数值即替换变量，删除键退化为固定值 */}
          <input
            className={css.input}
            value={draft}
            spellCheck={false}
            data-drag-ignore
            onChange={(event) => setDraft(event.target.value)}
            onKeyDown={handleKeyDown}
            // 普通失焦提交当前文本（如 3fr）；Esc 后这里读到空串，commitDraft 会跳过提交。
            onBlur={(event) => commitDraft(event.currentTarget.value)}
          />
          {draft && unitLabel && <span className={css.unit}>{unitLabel}</span>}
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
