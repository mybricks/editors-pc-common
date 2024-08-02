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

import type { ChangeEvent } from '../../type'

import css from './index.less'

interface MarginProps {
  value: CSSProperties
  onChange: ChangeEvent
  config: {
    [key: string]: any
  }
  showTitle: boolean;
}

const DEFAULT_STYLE = {
  padding: 0,
  fontSize: 10,
  // minWidth: 41,
  // maxWidth: 41,
  // marginLeft: 4
}

export function Margin ({value, onChange, config, showTitle}: MarginProps) {
  const [toggle, setToggle] = useState(getToggleDefaultValue(value))
  const [marginValue, setMarginValue] = useState({...value})
  // const [splitMarginIcon, setSplitMarginIcon] = useState(<MarginTopOutlined />)
  const [splitMarginIcon, setSplitMarginIcon] = useState(<MarginTopOutlined />)
  

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
                style={DEFAULT_STYLE}
                defaultValue={marginValue.marginTop}
                // suffix={'px'}
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
              <div className={css.icon} data-mybricks-tip={"上边距"}>
                <MarginTopOutlined />
              </div>
              <InputNumber
                tip='上边距'
                style={DEFAULT_STYLE}
                defaultValue={marginValue.marginTop}
                // suffix={'px'}
                onFocus={() => setSplitMarginIcon(<MarginTopOutlined />)}
                onChange={(value) => handleChange({marginTop: value})}
              />
              <div className={css.icon} data-mybricks-tip={"右边距"}>
                <MarginRightOutlined />
              </div>
              <InputNumber
                tip='右边距'
                style={DEFAULT_STYLE}
                defaultValue={marginValue.marginRight}
                // suffix={'px'}
                onFocus={() => setSplitMarginIcon(<MarginRightOutlined />)}
                onChange={(value) => handleChange({marginRight: value})}
              />
              <div className={css.icon} data-mybricks-tip={"下边距"}>
                <MarginBottomOutlined />
              </div>
              <InputNumber
                tip='下边距'
                style={DEFAULT_STYLE}
                defaultValue={marginValue.marginBottom}
                // suffix={'px'}
                onFocus={() => setSplitMarginIcon(<MarginBottomOutlined />)}
                onChange={(value) => handleChange({marginBottom: value})}
              />
              <div className={css.icon} data-mybricks-tip={"左边距"}>
                <MarginLeftOutlined />
              </div>
              <InputNumber
                tip='左边距'
                style={DEFAULT_STYLE}
                defaultValue={marginValue.marginLeft}
                // suffix={'px'}
                onFocus={() => setSplitMarginIcon(<MarginLeftOutlined />)}
                onChange={(value) => handleChange({marginLeft: value})}
              />
            </Panel.Item>
          </Panel.Content>
          <div
            data-mybricks-tip={`{content:'分别设置',position:'left'}`}
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
    <Panel title='外边距' showTitle={showTitle}>
      {marginConfig}
    </Panel>
  )
}

function getToggleDefaultValue (value: CSSProperties): boolean {
  return allEqual([value.marginTop, value.marginRight, value.marginBottom, value.marginLeft])
}
