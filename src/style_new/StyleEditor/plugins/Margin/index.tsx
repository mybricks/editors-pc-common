import React, {
  useEffect,
  useMemo,
  useState,
  useCallback,
  CSSProperties
} from 'react'

import {
  Panel,
  InputNumber,
  PaddingAllOutlined,
  PaddingTopOutlined,
  PaddingLeftOutlined,
  PaddingRightOutlined,
  PaddingBottomOutlined
} from '../../components'
import { allEqual } from '../../utils'
import { useUpdateEffect, useDragNumber } from '../../hooks'

import type { ChangeEvent, PanelBaseProps } from '../../type'
import { useStyleEditorContext } from '../../context'

import css from './index.less'

/**
 * 检测当前元素与父容器 flex 对齐的冲突情况。
 * 返回 { isRow, alignItems } 表示父容器是行方向以及其对齐值，
 * 或返回 null（无 flex 父容器 / 元素已设置 align-self）。
 */
function getAlignConflict(targetDom: HTMLElement | null | undefined) {
  const parent = targetDom?.parentElement
  if (!parent) return null

  const ps = window.getComputedStyle(parent)
  if (ps.display !== 'flex' && ps.display !== 'inline-flex') return null

  // 元素自身已有明确的 align-self 时跳过（用户已主动控制对齐）
  const selfAlign = targetDom ? window.getComputedStyle(targetDom).alignSelf : 'auto'
  if (selfAlign !== 'auto' && selfAlign !== 'normal') return null

  const isRow = !ps.flexDirection || ps.flexDirection.startsWith('row')
  return { isRow, alignItems: ps.alignItems }
}

interface MarginProps extends PanelBaseProps {
  value: CSSProperties
  onChange: ChangeEvent
}

const DEFAULT_STYLE = {
  padding: 0,
  fontSize: 10,
  // minWidth: 41,
  // maxWidth: 41,
  // marginLeft: 4
}
const MARGIN_KEYS = ['marginTop', 'marginRight', 'marginBottom', 'marginLeft'] as const

const DEFAULT_CONFIG = {
  disableMarginTop: false,
  disableMarginRight: false,
  disableMarginBottom: false,
  disableMarginLeft: false
}

export function Margin ({value, onChange, config, showTitle, collapse}: MarginProps) {
  const [toggle, setToggle] = useState(getToggleDefaultValue(value))
  const [marginValue, setMarginValue] = useState({...value})
  const [forceRenderKey, setForceRenderKey] = useState<number>(Math.random())
  const [splitMarginIcon, setSplitMarginIcon] = useState(<PaddingTopOutlined />)
  const getDragProps = useDragNumber({ continuous: true, min: -Infinity })
  const [isReset, setIsReset] = useState(false)
  const context = useStyleEditorContext()
  const handleSwitchToUnified = useCallback(() => {
    onChange(MARGIN_KEYS.map((key) => ({ key, value: null })))
    setToggle(true)
  }, [onChange])

  const cfg = useMemo(() => ({ ...DEFAULT_CONFIG, ...(config ?? {}) }), [config]);

  const handleChange = useCallback((value: CSSProperties & Record<string, any>) => {
    setMarginValue((val) => {
      return {
        ...val,
        ...value
      }
    })

    const changeList = Object.keys(value).map((key) => ({ key, value: value[key] }))

    // 检测父容器 flex 对齐冲突，自动追加 align-self 修复
    const conflict = getAlignConflict(context?.targetDom)
    if (conflict) {
      const { isRow, alignItems } = conflict
      const crossStart = isRow ? 'marginTop' : 'marginLeft'
      const crossEnd   = isRow ? 'marginBottom' : 'marginRight'

      if (alignItems === 'flex-end' && value[crossStart] != null) {
        // 父容器底/右对齐，用户设置 cross-start 方向 margin → 自动顶/左对齐
        onChange([...changeList, { key: 'alignSelf', value: 'flex-start' }])
        return
      }
      if (alignItems === 'flex-start' && value[crossEnd] != null) {
        // 父容器顶/左对齐，用户设置 cross-end 方向 margin → 自动底/右对齐
        onChange([...changeList, { key: 'alignSelf', value: 'flex-end' }])
        return
      }
      if (alignItems === 'center') {
        if (value[crossStart] != null) {
          onChange([...changeList, { key: 'alignSelf', value: 'flex-start' }])
          return
        }
        if (value[crossEnd] != null) {
          onChange([...changeList, { key: 'alignSelf', value: 'flex-end' }])
          return
        }
      }
    }

    onChange(changeList)
  }, [context?.targetDom, onChange])

  useUpdateEffect(() => {
    if (toggle) {
      handleChange({
        marginTop: marginValue.marginTop,
        marginRight: marginValue.marginTop,
        marginBottom: marginValue.marginTop,
        marginLeft: marginValue.marginTop
      })
    }
  }, [toggle])

  const marginConfig = useMemo(() => {
    if (toggle) {
      return (
        <div className={css.row}
        >
          <Panel.Content style={{padding: 3}}>
            <Panel.Item className={css.editArea} style={{padding: '0px 8px'}}>
              <div 
                className={css.icon}
                {...getDragProps(marginValue.marginTop, `{content:'拖拽调整外边距',position:'top'}`)}
              >
                <PaddingAllOutlined />
              </div>
              <InputNumber
                style={DEFAULT_STYLE}
                defaultValue={marginValue.marginTop}
                defaultUnitValue="px"
                allowNegative
                onChange={(value) => handleChange({
                  marginTop: value,
                  marginRight: value,
                  marginBottom: value,
                  marginLeft: value,
                })}
                tip={`{content:'外边距',position:'top'}`}
              />
            </Panel.Item>
          </Panel.Content>
          <div
            data-mybricks-tip={`{content:'切换为单独配置',position:'left'}`}
            className={css.actionIcon}
            onClick={() => setToggle(false)}
          >
            <PaddingAllOutlined />
          </div>
        </div>
      )
    } else {
      return (
        <div className={css.independentBox}>
          <div style={{ minWidth: "120px", flex: 1 }}>
            <div className={css.row} style={{ paddingRight: 0 }}>
              <Panel.Content style={{ padding: 3 }}>
                <Panel.Item className={css.editArea} style={{ padding: "0px 8px" }}>
                  <div 
                    className={css.icon} 
                    {...getDragProps(marginValue.marginLeft, '拖拽调整左外边距')}
                  >
                    <PaddingLeftOutlined/>
                  </div>
                  <InputNumber
                    style={DEFAULT_STYLE}
                    defaultValue={marginValue.marginLeft}
                    defaultUnitValue="px"
                    allowNegative
                    onChange={(value) => handleChange({marginLeft: value})}
                    onFocus={() => setSplitMarginIcon(<PaddingLeftOutlined/>)}
                  />
                </Panel.Item>
              </Panel.Content>
              <Panel.Content style={{ padding: 3 }}>
                <Panel.Item className={css.editArea} style={{ padding: "0px 8px" }}>
                  <div 
                    className={css.icon} 
                    {...getDragProps(marginValue.marginTop, '拖拽调整上外边距')}
                  >
                    <PaddingTopOutlined/>
                  </div>
                  <InputNumber
                    style={DEFAULT_STYLE}
                    defaultValue={marginValue.marginTop}
                    defaultUnitValue="px"
                    allowNegative
                    onChange={(value) => handleChange({marginTop: value})}
                    onFocus={() => setSplitMarginIcon(<PaddingTopOutlined/>)}
                  />
                </Panel.Item>
              </Panel.Content>
            </div>
            <div className={css.row} style={{ paddingRight: 0 }}>
              <Panel.Content style={{ padding: 3 }}>
                <Panel.Item className={css.editArea} style={{ padding: "0px 8px" }}>
                  <div 
                    className={css.icon} 
                    {...getDragProps(marginValue.marginRight, '拖拽调整右外边距')}
                  >
                    <PaddingRightOutlined/>
                  </div>
                  <InputNumber
                    style={DEFAULT_STYLE}
                    defaultValue={marginValue.marginRight}
                    defaultUnitValue="px"
                    allowNegative
                    onChange={(value) => handleChange({marginRight: value})}
                    onFocus={() => setSplitMarginIcon(<PaddingRightOutlined/>)}
                  />
                </Panel.Item>
              </Panel.Content>
              <Panel.Content style={{ padding: 3 }}>
                <Panel.Item className={css.editArea} style={{ padding: "0px 8px" }}>
                  <div 
                    className={css.icon} 
                    {...getDragProps(marginValue.marginBottom, '拖拽调整下外边距')}
                  >
                    <PaddingBottomOutlined/>
                  </div>
                  <InputNumber
                    style={DEFAULT_STYLE}
                    defaultValue={marginValue.marginBottom}
                    defaultUnitValue="px"
                    allowNegative
                    onChange={(value) => handleChange({marginBottom: value})}
                    onFocus={() => setSplitMarginIcon(<PaddingBottomOutlined/>)}
                  />
                </Panel.Item>
              </Panel.Content>
            </div>
          </div>

          <div
            data-mybricks-tip={`{content:'切换为统一配置',position:'left'}`}
            className={css.independentActionIcon}
            onClick={handleSwitchToUnified}
          >
            <PaddingAllOutlined/>
          </div>
        </div>
      )
    }
  }, [toggle, splitMarginIcon, marginValue, getDragProps, handleChange])

  const marginKeySet = new Set(MARGIN_KEYS)

  const refresh = useCallback(() => {
    const keys = Object.keys(value ?? {}).filter(key => marginKeySet.has(key as any))
    console.log("margin refresh", keys);
    onChange(keys.map(key => ({ key, value: null })))
    setIsReset(true)
    setMarginValue({} as any)
    setForceRenderKey(prev => prev + 1)
  }, [value, onChange])

  useEffect(() => {
    const currentValue = value as Record<string, any> | undefined
    if (isReset && currentValue && Object.keys(currentValue).some(k => currentValue[k] != null)) {
      setIsReset(false)
    }
  }, [value, isReset])

  return (
    <Panel title='外边距' showTitle={showTitle} showReset={true} resetFunction={refresh} collapse={collapse}>
      <React.Fragment key={forceRenderKey}>
        {marginConfig}
      </React.Fragment>
    </Panel>
  )
}

function getToggleDefaultValue (value: CSSProperties): boolean {
  return allEqual([value.marginTop, value.marginRight, value.marginBottom, value.marginLeft])
}
