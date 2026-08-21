import React, { CSSProperties } from 'react'

import { InputNumber, SketchPopup, VariableChip, VariableList } from '../'
import { Variable } from '../../icons/Variable'
import { FixedWidth } from '../../icons/FixedWidth'
import type { InputNumberProps, UnitOption } from '../InputNumber'
import type { VariableChipMenuOption } from '../VariableChip'
import type { LengthVarBinding } from '../../hooks/useLengthVarBinding'

import css from './index.less'

/** flex-basis 显式为 0：胶囊与输入区都不能把列宽撑开，否则会挤掉相邻字段 */
const DEFAULT_FIELD_STYLE: CSSProperties = { flex: '1 1 0', minWidth: 0, width: 0, marginLeft: 4 }

export const APPLY_VARIABLE_ACTION = 'applyVariable'
export const DETACH_VARIABLE_ACTION = 'detachVariable'

/** 各处单位菜单共用的「应用变量...」项，统一放在菜单末尾 */
export function getApplyVariableOption(hasVariables: boolean) {
  return {
    label: '应用变量...',
    value: APPLY_VARIABLE_ACTION,
    type: 'action' as const,
    icon: <Variable />,
    disabled: !hasVariables,
    tip: hasVariables ? undefined : '当前画布没有可用的尺寸变量',
  }
}

/** 在字段的单位菜单末尾追加「应用变量...」，未绑定态的入口 */
export function withApplyVariableOption(
  unitOptions: UnitOption[],
  hasVariables: boolean
): UnitOption[] {
  return [
    ...unitOptions,
    { label: '', value: '__variableDivider__', type: 'divider' },
    getApplyVariableOption(hasVariables),
  ]
}

/** 绑定态胶囊菜单里的「固定值」：落成变量当前解析值 */
export function buildDetachMenuOptions(fallbackValue: string): VariableChipMenuOption[] {
  return [
    {
      label: `固定值 (${fallbackValue})`,
      value: DETACH_VARIABLE_ACTION,
      type: 'action',
      icon: <FixedWidth />,
    },
  ]
}

interface VariableNumberInputProps {
  binding: LengthVarBinding
  /** 未绑定态的输入框配置，注意把「应用变量」项挂到 unitOptions 或 suffix 上 */
  inputProps: InputNumberProps
  /** 输入框的 key：单位变化时强制重挂载，避免拖拽改数字导致失焦 */
  inputKey?: string
  /** 绑定态胶囊的菜单：档位列表或固定值等操作，缺省即只有「固定值」一项 */
  menuOptions?: VariableChipMenuOption[]
  menuLayout?: 'menu' | 'presetList'
  menuStyle?: CSSProperties
  onMenuSelect?: (value: string) => void
  onMenuAction?: (value: string) => void
  /** 绑定态胶囊的外层样式，默认与相邻字段等分且可收缩 */
  chipStyle?: CSSProperties
  /** 绑定态胶囊左侧的图标，字段标识只画在输入框里时（如效果的 X/Y）需一并传入 */
  chipPrefix?: React.ReactNode
  /** 变量弹层开在另一个弹层里，点它不应关掉外层 */
  nestedPicker?: boolean
  emptyText?: string
  /** 窄列收紧绑定胶囊，与旁边的紧凑 InputNumber 对齐 */
  compact?: boolean
}

/**
 * 长度类字段的变量绑定态渲染：绑定后换成变量胶囊，未绑定沿用 InputNumber，
 * 并统一持有变量选择弹层（锚定到 binding.anchorRef 所在字段）。
 */
export function VariableNumberInput({
  binding,
  inputProps,
  inputKey,
  menuOptions,
  menuLayout,
  menuStyle,
  onMenuSelect,
  onMenuAction,
  chipStyle = DEFAULT_FIELD_STYLE,
  chipPrefix,
  nestedPicker = false,
  emptyText = '当前画布没有可用的尺寸变量',
  compact = false,
}: VariableNumberInputProps) {
  // 「固定值」是所有字段共有的解绑出口，调用方不传菜单时兜底给它
  const chipMenuOptions = menuOptions ?? buildDetachMenuOptions(binding.fallbackValue)

  const handleMenuAction = (action: string) => {
    if (action === DETACH_VARIABLE_ACTION) {
      binding.detach()
      return
    }
    onMenuAction?.(action)
  }

  return (
    <>
      {binding.varRef ? (
        <VariableChip
          value={binding.varRef}
          resolvedValue={binding.resolvedValue}
          display={binding.displayText}
          defaultUnit={binding.defaultUnit}
          onRequestPicker={binding.openPicker}
          menuOptions={chipMenuOptions}
          menuLayout={menuLayout}
          menuStyle={menuStyle}
          onMenuSelect={onMenuSelect}
          onMenuAction={handleMenuAction}
          onInputValue={inputProps.onChange as (value: string) => void}
          onDetach={binding.detach}
          prefix={chipPrefix}
          style={chipStyle}
          compact={compact}
          showIconOnHover={inputProps.showIconOnHover}
        />
      ) : (
        <InputNumber key={inputKey} {...inputProps} />
      )}
      <SketchPopup
        open={binding.pickerOpen}
        mounted={binding.pickerMounted}
        anchorRef={binding.anchorRef}
        onClose={binding.closePicker}
        className={css.variablePopup}
        nested={nestedPicker}
      >
        <VariableList
          list={binding.variables}
          open={binding.pickerOpen}
          selectedName={binding.varRef}
          onClose={binding.closePicker}
          onSelect={(item) => binding.selectVariable(item.name)}
          emptyText={emptyText}
        />
      </SketchPopup>
    </>
  )
}
