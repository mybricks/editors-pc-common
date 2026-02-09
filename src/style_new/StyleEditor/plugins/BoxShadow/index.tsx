import React, { useState, useRef, CSSProperties, useCallback } from 'react'

import {
  Panel,
  Select,
  ColorEditor,
  InputNumber,
  BoxShadowInnerOutlined,
  BoxShadowOuterOutlined,
  BoxShadowOfsetXOutlined,
  BoxShadowOfsetYOutlined,
  BoxShadowBlurRadiusOutlined,
  BoxShadowSpreadRadiusOutlined
} from '../../components'
import { useUpdateEffect, useDragNumber } from '../../hooks'

import type { ChangeEvent, PanelBaseProps } from '../../type'
import isEqual from 'lodash/isEqual';

interface BoxShadowProps extends PanelBaseProps {
  value: CSSProperties
  onChange: ChangeEvent
}

const INSET_OPTIONS = [
  {label: '向内', value: true},
  {label: '向外', value: false}
]

interface boxShadowType {
  inset: boolean;
  offsetX: string;
  offsetY: string;
  blurRadius: string;
  spreadRadius: string;
  color: string;
}

const defaultValue = {
  inset: false,
  offsetX: "0px",
  offsetY: "0px",
  blurRadius: "0px",
  spreadRadius: "0px",
  color: "#ffffff",
}

export function BoxShadow ({value, onChange, config, showTitle, collapse}: BoxShadowProps) {
  const [boxShadowValues, setBoxShadowValues] = useState<boxShadowType>(getInitValue(value.boxShadow))
  const [forceRenderKey, setForceRenderKey] = useState<number>(Math.random()); // 用于点击重置按钮重新渲染获取新value
  const isResettingRef = useRef(false);
  const getDragProps = useDragNumber({ continuous: true })
  
  useUpdateEffect(() => {
    if (isResettingRef.current) {
      isResettingRef.current = false;
      return;
    }
    const {
      inset,
      offsetX,
      offsetY,
      blurRadius,
      spreadRadius,
      color
    } = boxShadowValues
    let value = ''
    if (inset) {
      value = value + 'inset '
    }
    onChange({key: 'boxShadow', value: value + `${offsetX} ${offsetY} ${blurRadius} ${spreadRadius} ${color}`})
  }, [boxShadowValues]);

  const refresh = useCallback(() => {
    isResettingRef.current = true;
    onChange({key: 'boxShadow', value: null});
    setBoxShadowValues(defaultValue);
    setForceRenderKey(prev => prev + 1);
  }, [onChange]);

  return (
    <Panel title='阴影' showTitle={showTitle} showReset={true} resetFunction={refresh} collapse={collapse}>
      <React.Fragment key={forceRenderKey}>
        <Panel.Content>
          <Select
            tip='扩散方式'
            style={{width: 98}}
            defaultValue={boxShadowValues.inset}
            options={INSET_OPTIONS}
            prefix={boxShadowValues.inset ? <BoxShadowInnerOutlined /> : <BoxShadowOuterOutlined />}
            onChange={(value) => setBoxShadowValues((boxShadowValues) => {
              return {
                ...boxShadowValues,
                inset: value
              }
            })}
          />
          <InputNumber
            tip='x轴偏移'
            style={{flex: '1 1 0%'}}
            prefix={
              <div {...getDragProps(boxShadowValues.offsetX, '拖拽调整x轴偏移')}>
                <BoxShadowOfsetXOutlined />
              </div>
            }
            defaultValue={boxShadowValues.offsetX}
            onChange={(value) => setBoxShadowValues((boxShadowValues) => {
              return {
                ...boxShadowValues,
                offsetX: value
              }
            })}
          />
          <InputNumber
            tip='y轴偏移'
            style={{flex: '1 1 0%'}}
            prefix={
              <div {...getDragProps(boxShadowValues.offsetY, '拖拽调整y轴偏移')}>
                <BoxShadowOfsetYOutlined />
              </div>
            }
            defaultValue={boxShadowValues.offsetY}
            onChange={(value) => setBoxShadowValues((boxShadowValues) => {
              return {
                ...boxShadowValues,
                offsetY: value
              }
            })}
          />
        </Panel.Content>
        <Panel.Content>
          <ColorEditor
            // tip='颜色'
            style={{width: 140}}
            defaultValue={boxShadowValues.color}
            showSubTabs={false}
            onChange={(value) => setBoxShadowValues((boxShadowValues) => {
              return {
                ...boxShadowValues,
                color: value
              }
            })}
          />
          <InputNumber
            tip='模糊'
            style={{flex: '1 1 0%'}}
            prefix={
              <div {...getDragProps(boxShadowValues.blurRadius, '拖拽调整模糊半径')}>
                <BoxShadowBlurRadiusOutlined />
              </div>
            }
            defaultValue={boxShadowValues.blurRadius}
            onChange={(value) => setBoxShadowValues((boxShadowValues) => {
              return {
                ...boxShadowValues,
                blurRadius: value
              }
            })}
          />
          <InputNumber
            tip='扩散'
            style={{flex: '1 1 0%'}}
            prefix={
              <div {...getDragProps(boxShadowValues.spreadRadius, '拖拽调整扩散半径')}>
                <BoxShadowSpreadRadiusOutlined />
              </div>
            }
            defaultValue={boxShadowValues.spreadRadius}
            onChange={(value) => setBoxShadowValues((boxShadowValues) => {
              return {
                ...boxShadowValues,
                spreadRadius: value
              }
            })}
          />
          {/* <div style={{ width: "21px" }}/> */}
        </Panel.Content>
      </React.Fragment>
    </Panel>
  )
}

function getInitValue (boxShadow: string | undefined) {
  const result = {...defaultValue};

  if (!boxShadow) {
    return result
  }

  const args = boxShadow.split(/\s(?![^(]*\))/)  

  if (args.length < 2) {
    return result
  }

  if (args[0] === 'inset') {
    result.inset = true
    args.shift()
  } else if (args.at(-1) === 'inset') {
    result.inset = true
    args.pop()
  }

  if (isNaN(parseFloat(args[0]))) {
    result.color = args[0]
    args.shift()
  } else if (isNaN(parseFloat(args.at(-1) as string))) {
    result.color = args.at(-1) as string
    args.pop()
  }

  const [offsetX = '0px', offsetY = '0px', blurRadius = '0px', spreadRadius = '0px'] = args

  result.offsetX = offsetX
  result.offsetY = offsetY
  result.blurRadius = blurRadius
  result.spreadRadius = spreadRadius

  return result
}

