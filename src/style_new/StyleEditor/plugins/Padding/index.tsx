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
import {allEqual} from '../../utils'
import {useUpdateEffect} from '../../hooks'

import type {ChangeEvent, PanelBaseProps} from '../../type'

import css from './index.less'

interface PaddingProps extends PanelBaseProps {
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

export function Padding({value, onChange, config, showTitle, collapse}: PaddingProps) {
  const [toggle, setToggle] = useState(getToggleDefaultValue(value))
  const [paddingValue, setPaddingValue] = useState({...value})
  const [splitPaddingIcon, setSplitPaddingIcon] = useState(<PaddingTopOutlined/>)

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
        <div className={css.row}
        >
          <Panel.Content style={{padding: 3}}>
            <Panel.Item className={css.editArea} style={{padding: '0px 8px'}}>
              <div className={css.icon}
                   data-mybricks-tip={`{content:'内边距',position:'top'}`}>
                <PaddingAllOutlined/>
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
                tip={`{content:'内边距',position:'top'}`}
              />
            </Panel.Item>
          </Panel.Content>
          <div
            data-mybricks-tip={`{content:'切换为单独配置',position:'left'}`}
            className={css.actionIcon}
            onClick={() => setToggle(false)}
          >
            <PaddingAllOutlined/>
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
                  <div className={css.icon} data-mybricks-tip={'左边距'}>
                    <PaddingLeftOutlined/>
                  </div>
                  <InputNumber
                    style={DEFAULT_STYLE}
                    defaultValue={paddingValue.paddingLeft}
                    onChange={(value) => handleChange({paddingLeft: value})}
                    onFocus={() => setSplitPaddingIcon(<PaddingLeftOutlined/>)}
                  />
                </Panel.Item>
              </Panel.Content>
              <Panel.Content style={{ padding: 3 }}>
                <Panel.Item className={css.editArea} style={{ padding: "0px 8px" }}>
                  <div className={css.icon} data-mybricks-tip={'上边距'}>
                    <PaddingTopOutlined/>
                  </div>
                  <InputNumber
                    style={DEFAULT_STYLE}
                    defaultValue={paddingValue.paddingTop}
                    onChange={(value) => handleChange({paddingTop: value})}
                    onFocus={() => setSplitPaddingIcon(<PaddingTopOutlined/>)}
                  />
                </Panel.Item>
              </Panel.Content>
            </div>
            <div className={css.row} style={{ paddingRight: 0 }}>
              <Panel.Content style={{ padding: 3 }}>
                <Panel.Item className={css.editArea} style={{ padding: "0px 8px" }}>
                  <div className={css.icon} data-mybricks-tip={'右边距'}>
                    <PaddingRightOutlined/>
                  </div>
                  <InputNumber
                    style={DEFAULT_STYLE}
                    defaultValue={paddingValue.paddingRight}
                    onChange={(value) => handleChange({paddingRight: value})}
                    onFocus={() => setSplitPaddingIcon(<PaddingRightOutlined/>)}
                  />
                </Panel.Item>
              </Panel.Content>
              <Panel.Content style={{ padding: 3 }}>
                <Panel.Item className={css.editArea} style={{ padding: "0px 8px" }}>
                  <div className={css.icon} data-mybricks-tip={'下边距'}>
                    <PaddingBottomOutlined/>
                  </div>
                  <InputNumber
                    style={DEFAULT_STYLE}
                    defaultValue={paddingValue.paddingBottom}
                    onChange={(value) => handleChange({paddingBottom: value})}
                    onFocus={() => setSplitPaddingIcon(<PaddingBottomOutlined/>)}
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
  }, [toggle, splitPaddingIcon])

  return (
    <Panel title='内边距' showTitle={showTitle} collapse={collapse}>
      {paddingConfig}
    </Panel>
  )
}

function getToggleDefaultValue(value: CSSProperties): boolean {
  return allEqual([value.paddingTop, value.paddingRight, value.paddingBottom, value.paddingLeft])
}
