import React, {
  useMemo,
  useReducer,
  useCallback,
  CSSProperties
} from 'react'

import ColorUtil from 'color'

import {
  Dropdown,
  BindingOutlined,
  QuestionCircleOutlined,
  TransparentColorOutlined
} from '../../components'
import { Panel, Colorpicker, UnbindingOutlined } from '../'

import css from './index.less'

type ColorOption = {
  label: string
  value: string
  resetValue?: string
}
type ColorOptions = Array<ColorOption>

interface ColorEditorProps {
  options?: ColorOptions
  defaultValue: any
  style?: CSSProperties
  onChange: (value: any) => void
}

interface State {
  /** 可修改值 */
  value: string
  /** 最终值 */
  finalValue: string
  /** 非色值 */
  nonColorValue: boolean
  /** 非色值选项 */
  options: ColorOptions
}

function getInitialState ({value, options}: {value: string, options: ColorOptions}): State {
  let finalValue = value
  let nonColorValue = false

  try {
    const color = new ColorUtil(value)
    finalValue = (color.alpha() === 1 ? color.hex() : color.hexa()).toLowerCase()
  } catch {
    nonColorValue = true
  }
  // TODO
  const finalOptions = options.concat(window.MYBRICKS_CSS_VARIABLE_LIST || [], COLOR_OPTIONS)

  return {
    value: nonColorValue ? (finalOptions.find(option => option.value === finalValue)?.label || finalValue) : finalValue,
    finalValue: nonColorValue ? (finalOptions.find(option => option.value === finalValue)?.value || finalValue) : finalValue,
    nonColorValue,
    options: finalOptions
  }
}

function reducer (state: State, action: any): State {
  return {
    ...state,
    ...action
  }
}

const COLOR_OPTIONS = [
  {label: 'inherit', value: 'inherit'}
]

export function ColorEditor ({defaultValue, style = {}, onChange, options = []}: ColorEditorProps) {
  const [state, dispatch] = useReducer(reducer, getInitialState({value: defaultValue, options}))

  const handleInputChange = useCallback((e) => {
    const value = e.target.value
    const state: any = {
      value
    }
    try {
      const hex = getHex(value)
      state.finalValue = hex
      onChange(hex)
    } catch {}

    dispatch(state)
  }, [])

  const handleInputBlur = useCallback(() => {
    const { value, finalValue } = state

    if (value !== finalValue) {
      dispatch({
        value: finalValue
      })
    }
  }, [state.value, state.finalValue])

  const handleColorpickerChange = useCallback((color) => {
    const hex = getHex(color.hexa)

    dispatch({
      value: hex,
      finalValue: hex
    })
    onChange(hex)
  }, [])

  const input = useMemo(() => {
    const { value, nonColorValue } = state
    return (
      <input
        value={value}
        className={css.input}
        onChange={handleInputChange}
        onBlur={handleInputBlur}
        disabled={nonColorValue}
      />
    )
  }, [state.value, state.nonColorValue])

  const block = useMemo(() => {
    const { finalValue, nonColorValue } = state
    const style = nonColorValue ? {
      backgroundColor: finalValue || 'transparent',
      cursor: 'not-allowed'
    } : {
      backgroundColor: finalValue
    }

    return (
      <Colorpicker
        value={finalValue}
        onChange={handleColorpickerChange}
        disabled={nonColorValue}
        className={css.colorPickerContainer}
      >
        <div className={css.block} style={style} />
        <div className={css.icon}>
          {nonColorValue ? (finalValue ? <></> : <QuestionCircleOutlined />) : <TransparentColorOutlined />}
        </div>
      </Colorpicker>
    )
  }, [state.finalValue, state.nonColorValue])

  /** 绑定 */
  const bind = useCallback((value) => {
    const option = state.options.find((option) => option.value === value) as ColorOption
    const { label, resetValue } = option

    onChange(option.value)

    dispatch({
      nonColorValue: true,
      value: label || value,
      finalValue: resetValue || ''
    })
  }, [])

  /** 解除绑定 */
  const unBind = useCallback(() => {
    const { value, finalValue } = state
    // TODO
    const option = state.options.find((option) => (option.resetValue ? (option.resetValue === finalValue) : option.value === value) || option.value === finalValue) as ColorOption
    const resetValue = option?.resetValue || ''
    const hex = getHex(resetValue || '')

    onChange(hex)
    
    dispatch({
      nonColorValue: false,
      value: hex,
      finalValue: hex
    })
  }, [state.nonColorValue])

  /** 绑定操作按钮 */
  const preset = useMemo(() => {
    const { options, finalValue, nonColorValue } = state

    return (
      <div
        className={`${css.preset} ${nonColorValue ? css.binding : css.unBinding}`}
        data-mybricks-tip={nonColorValue ? '解除绑定' : '绑定'}
      >
        {nonColorValue ? (
          <div onClick={unBind} className={css.iconContainer}>
            <BindingOutlined /> 
          </div>
        ) : (
          <Dropdown
            className={css.iconContainer}
            options={options}
            value={finalValue}
            onClick={bind}
          >
            <UnbindingOutlined /> 
          </Dropdown>
        )}
      </div>
    )
  }, [state.finalValue, state.nonColorValue])

  return (
    <Panel.Item style={style} className={css.container}>
      <div className={`${css.color}${state.nonColorValue ? ` ${css.disabled}` : ''}`} >
        {block}
        {input}
      </div>
      {preset}
    </Panel.Item>
  )
}

const getHex = (str: string) => {
  let finalValue = str
  try {
    const color = new ColorUtil(str)
    finalValue = (color.alpha() === 1 ? color.hex() : color.hexa()).toLowerCase()
  } catch {}

  return finalValue
}
