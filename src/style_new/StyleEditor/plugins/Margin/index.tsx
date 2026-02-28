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

import css from './index.less'

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
  const getDragProps = useDragNumber({ continuous: true })
  const [isReset, setIsReset] = useState(false)

  const cfg = useMemo(() => ({ ...DEFAULT_CONFIG, ...(config ?? {}) }), [config]);

  const handleChange = useCallback((value: CSSProperties & Record<string, any>) => {
    setMarginValue((val) => {
      return {
        ...val,
        ...value
      }
    })
    onChange(Object.keys(value).map((key) => {
      return {
        key,
        value: value[key]
      }
    }))
  }, [])

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
            onClick={() => setToggle(true)}
          >
            <PaddingAllOutlined/>
          </div>
        </div>
      )
    }
  }, [toggle, splitMarginIcon, marginValue, getDragProps, handleChange])

  const MARGIN_KEYS = new Set(['marginTop', 'marginRight', 'marginBottom', 'marginLeft'])

  const refresh = useCallback(() => {
    const keys = Object.keys(value ?? {}).filter(key => MARGIN_KEYS.has(key))
    console.log("margin refresh", keys);
    onChange(keys.map(key => ({ key, value: null })))
    setIsReset(true)
    setMarginValue({} as any)
    setForceRenderKey(prev => prev + 1)
  }, [value,onChange])

  useEffect(() => {
    if (isReset && value && Object.keys(value).some(k => value[k] != null)) {
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
