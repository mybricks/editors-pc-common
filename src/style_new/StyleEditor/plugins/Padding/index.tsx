import React, {
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
import { useUpdateEffect } from '../../hooks'

import type { ChangeEvent } from '../../type'

import css from './index.less'

interface PaddingProps {
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

export function Padding ({value, onChange, config, showTitle}: PaddingProps) {
  const [toggle, setToggle] = useState(getToggleDefaultValue(value))
  const [paddingValue, setPaddingValue] = useState({...value})
  const [splitPaddingIcon, setSplitPaddingIcon] = useState(<PaddingTopOutlined />)

  const handleChange = useCallback((value: any) => {
    setPaddingValue((val) => {
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
        paddingTop: paddingValue.paddingTop,
        paddingRight: paddingValue.paddingTop,
        paddingBottom: paddingValue.paddingTop,
        paddingLeft: paddingValue.paddingTop
      })
    }
  }, [toggle])

  const paddingConfig = useMemo(() => {
    if (toggle) {
      return (
        <div className={css.row}>
          <Panel.Content style={{padding: 3}}>
            <Panel.Item className={css.editArea} style={{padding: '0px 8px'}}>
              <div className={css.icon} data-mybricks-tip={`{content:'统一设置',position:'left'}`}>
                <PaddingAllOutlined />
              </div>
              <InputNumber
                style={DEFAULT_STYLE}
                defaultValue={paddingValue.paddingTop}
                // suffix={'px'}
                onChange={(value) => handleChange({
                  paddingTop: value,
                  paddingRight: value,
                  paddingBottom: value,
                  paddingLeft: value,
                })}
              />
            </Panel.Item>
          </Panel.Content>
          <div
            data-mybricks-tip={`{content:'统一设置',position:'left'}`}
            className={css.actionIcon}
            onClick={() => setToggle(false)}
          >
            <PaddingAllOutlined />
          </div>
        </div>
      )
    } else {
      return (
        <div className={css.row}>
          <Panel.Content style={{padding: 3}}>
            <Panel.Item className={css.editArea} style={{padding: '0px 8px'}}>
              <div className={css.icon} data-mybricks-tip={'上边距'}>
                <PaddingTopOutlined />
              </div>
              <InputNumber
                tip='上边距'
                style={DEFAULT_STYLE}
                defaultValue={paddingValue.paddingTop}
                // suffix={'px'}
                onFocus={() => setSplitPaddingIcon(<PaddingTopOutlined />)}
                onChange={(value) => handleChange({paddingTop: value})}
              />
              <div className={css.icon} data-mybricks-tip={'右边距'}>
                <PaddingRightOutlined />
              </div>
              <InputNumber
                tip='右边距'
                style={DEFAULT_STYLE}
                defaultValue={paddingValue.paddingRight}
                // suffix={'px'}
                onFocus={() => setSplitPaddingIcon(<PaddingRightOutlined />)}
                onChange={(value) => handleChange({paddingRight: value})}
              />
              <div className={css.icon} data-mybricks-tip={'下边距'}>
                <PaddingBottomOutlined />
              </div>
              <InputNumber
                tip='下边距'
                style={DEFAULT_STYLE}
                defaultValue={paddingValue.paddingBottom}
                // suffix={'px'}
                onFocus={() => setSplitPaddingIcon(<PaddingBottomOutlined />)}
                onChange={(value) => handleChange({paddingBottom: value})}
              />
              <div className={css.icon} data-mybricks-tip={'左边距'}>
                <PaddingLeftOutlined />
              </div>
              <InputNumber
                tip='左边距'
                style={DEFAULT_STYLE}
                defaultValue={paddingValue.paddingLeft}
                // suffix={'px'}
                onFocus={() => setSplitPaddingIcon(<PaddingLeftOutlined />)}
                onChange={(value) => handleChange({paddingLeft: value})}
              />
            </Panel.Item>
          </Panel.Content>
          <div
            data-mybricks-tip={`{content:'分别设置',position:'left'}`}
            className={css.actionIcon}
            onClick={() => setToggle(true)}
          >
            <PaddingTopOutlined /> 
          </div>
        </div>
      )
    }
  }, [toggle, splitPaddingIcon])

  return (
    <Panel title='内边距' showTitle={showTitle}>
      {paddingConfig}
    </Panel>
  )
}

function getToggleDefaultValue (value: CSSProperties): boolean {
  return allEqual([value.paddingTop, value.paddingRight, value.paddingBottom, value.paddingLeft])
}
