import React, {
  useMemo,
  useState,
  useCallback,
  CSSProperties
} from 'react'

import {
  Panel,
  InputNumber,
  MarginAllOutlined,
  MarginTopOutlined,
  MarginLeftOutlined,
  MarginRightOutlined,
  MarginBottomOutlined
} from '../../components'
import { allEqual } from '../../utils'
import { useUpdateEffect } from '../../hooks'

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
  // const [splitMarginIcon, setSplitMarginIcon] = useState(<MarginTopOutlined />)
  const [splitMarginIcon, setSplitMarginIcon] = useState(<MarginTopOutlined />)

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
        <div className={css.row}>
          <Panel.Content style={{padding: 3}}>
            <Panel.Item className={css.editArea} style={{padding: '0px 8px'}}>
              <div className={css.icon}>
                <MarginAllOutlined />
              </div>
              <InputNumber
                data-mybricks-tip={"内边距"}
                style={DEFAULT_STYLE}
                defaultValue={marginValue.marginTop}
                // suffix={'px'}
                allowNegative
                onChange={(value) => handleChange({
                  marginTop: value,
                  marginRight: value,
                  marginBottom: value,
                  marginLeft: value,
                })}
              />
            </Panel.Item>
          </Panel.Content>
          <div
            data-mybricks-tip={`{content:'统一设置',position:'left'}`}
            className={css.actionIcon}
            onClick={() => setToggle(false)}
          >
            <MarginAllOutlined />
          </div>
        </div>
      )
    } else {
      return (
        <div className={css.row}>
          <Panel.Content style={{padding: 3}}>
            <Panel.Item className={css.editArea} style={{padding: '0px 8px'}}>
              {
                cfg.disableMarginTop ? null : <>
                  <div className={css.icon} data-mybricks-tip={"上边距"}>
                    <MarginTopOutlined />
                  </div>
                  <InputNumber
                    tip='上边距'
                    style={DEFAULT_STYLE}
                    defaultValue={marginValue.marginTop}
                    // suffix={'px'}
                    allowNegative
                    onFocus={() => setSplitMarginIcon(<MarginTopOutlined />)}
                    onChange={(value) => handleChange({marginTop: value})}
                  />
                </>
              }
              {
                cfg.disableMarginRight ? null : <>
                  <div className={css.icon} data-mybricks-tip={"右边距"}>
                    <MarginRightOutlined />
                  </div>
                  <InputNumber
                    tip='右边距'
                    style={DEFAULT_STYLE}
                    defaultValue={marginValue.marginRight}
                    // suffix={'px'}
                    allowNegative
                    onFocus={() => setSplitMarginIcon(<MarginRightOutlined />)}
                    onChange={(value) => handleChange({marginRight: value})}
                  />
                </>
              }
              {
                cfg.disableMarginBottom ? null : <>
                  <div className={css.icon} data-mybricks-tip={"下边距"}>
                    <MarginBottomOutlined />
                  </div>
                  <InputNumber
                    tip='下边距'
                    style={DEFAULT_STYLE}
                    defaultValue={marginValue.marginBottom}
                    // suffix={'px'}
                    allowNegative
                    onFocus={() => setSplitMarginIcon(<MarginBottomOutlined />)}
                    onChange={(value) => handleChange({marginBottom: value})}
                  />
                </>
              }
              {
                cfg.disableMarginLeft ? null : <>
                  <div className={css.icon} data-mybricks-tip={"左边距"}>
                    <MarginLeftOutlined />
                  </div>
                  <InputNumber
                    tip='左边距'
                    style={DEFAULT_STYLE}
                    defaultValue={marginValue.marginLeft}
                    // suffix={'px'}
                    allowNegative
                    onFocus={() => setSplitMarginIcon(<MarginLeftOutlined />)}
                    onChange={(value) => handleChange({marginLeft: value})}
                  />
                </>
              }
            </Panel.Item>
          </Panel.Content>
          <div
            data-mybricks-tip={`{content:'切换编辑方式',position:'left'}`}
            className={css.actionIcon}
            onClick={() => setToggle(true)}
          >
            <MarginTopOutlined />
          </div>
        </div>
      )
    }
  }, [toggle, splitMarginIcon])

  return (
    <Panel title='外边距' showTitle={showTitle} collapse={collapse}>
      {marginConfig}
    </Panel>
  )
}

function getToggleDefaultValue (value: CSSProperties): boolean {
  return allEqual([value.marginTop, value.marginRight, value.marginBottom, value.marginLeft])
}
