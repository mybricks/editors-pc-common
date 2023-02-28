import React, { CSSProperties, useEffect, useMemo, useState } from 'react'
import { Tooltip } from 'antd';
import css from './index.less'

interface OptionsItem {
  key: string,
  desc: string,
  icon: JSX.Element
}

const Align = ({ options, value, style, onSelect }: { options: OptionsItem[], value: string, style?: CSSProperties, onSelect?: (key: string, opt: OptionsItem) => void }) => {
  return (
    <div className={css.aligns} style={style}>
      {options.map((option, index) => {
        return (
          <Tooltip overlayInnerStyle={{ fontSize: 12 }} placement="bottom" title={option?.desc} key={`${option.key}_${index}`}>
            <div
              className={`${css.alignItem} ${
                value === option.key ? css.active : ''
              }`}
              onClick={() => onSelect?.(option.key, option)}
            >
                {option.icon}
            </div>
          </Tooltip>
        )
      })}
    </div>
  )
}

const VerticalMap = {
  top: JSON.stringify({
    display: 'flex',
    flexDirection: 'row',
    alignItems: 'flex-start',
  }),
  center: JSON.stringify({
    display: 'flex',
    flexDirection: 'row',
    alignItems: 'center',
  }),
  bottom: JSON.stringify({
    display: 'flex',
    flexDirection: 'row',
    alignItems: 'flex-end',
  }),
}

const HorizontalMap = {
  left: JSON.stringify({
    display: 'flex',
    flexDirection: 'row',
    justifyContent: 'flex-start',
    textAlign: 'left',
  }),
  center: JSON.stringify({
    display: 'flex',
    flexDirection: 'row',
    justifyContent: 'center',
    textAlign: 'center',
  }),
  right: JSON.stringify({
    display: 'flex',
    flexDirection: 'row',
    justifyContent: 'flex-end',
    textAlign: 'right',
  }),
}

type LayoutState = Pick<CSSProperties, 'display' | 'flexDirection' | 'alignItems' | 'textAlign' | 'justifyContent'>

interface FontLayout {
  verticalAlign: boolean,
  horizontalAlign: boolean,
  value: LayoutState,
  onChange: (state: LayoutState) => void
}

export default ({ verticalAlign, horizontalAlign, value, onChange }: FontLayout) => {
  const [state, setState] = useState({
    display: value?.display,
    flexDirection: value?.flexDirection,
    alignItems: value?.alignItems,
    textAlign: value?.textAlign,
    justifyContent: value?.justifyContent
  })

  const verticalValue = useMemo(() => {
    return JSON.stringify({
      display: state?.display,
      flexDirection: state?.flexDirection,
      alignItems: state?.alignItems,
    })
  }, [state?.display, state?.flexDirection, state?.alignItems])

  const horizontalValue = useMemo(() => {
    return JSON.stringify({
      display: state?.display,
      flexDirection: state?.flexDirection,
      justifyContent: state?.justifyContent,
      textAlign: state?.textAlign
    })
  }, [state?.display, state?.flexDirection, state?.justifyContent, state.textAlign])

  useEffect(() => {
    onChange?.(state)
  }, [state])

  if (!horizontalAlign && !verticalAlign) {
    return null
  }

  return (
    <div className={css.fontLayout}>
      <div className={css.layoutDesc}>对齐</div>
      <div className={css.layoutContent}> 
        <Align
          key={'horizontal'}
          value={horizontalValue}
          options={[
            { key: HorizontalMap.left, desc: '水平居左', icon: <svg width="14" height="10" viewBox="0 0 14 10" xmlns="http://www.w3.org/2000/svg"><path d="M0 0h14v1H0V0zm0 4h8v1H0V4zm10 4H0v1h10V8z" fill="#000" stroke="none"></path></svg> },
            { key: HorizontalMap.center, desc: '水平居中', icon: <svg width="14" height="10" viewBox="0 0 14 10" xmlns="http://www.w3.org/2000/svg"><path d="M0 0h14v1H0V0zm3 4h8v1H3V4zm9 4H2v1h10V8z" fill="#000" stroke="none"></path></svg> },
            { key: HorizontalMap.right, desc: '水平居右', icon: <svg width="14" height="10" viewBox="0 0 14 10" xmlns="http://www.w3.org/2000/svg"><path d="M0 0h14v1H0V0zm6 4h8v1H6V4zm8 4H4v1h10V8z" fill="#000" stroke="none"></path></svg> },
          ]}
          onSelect={(nextValue) => {
            setState(c => ({ ...c, ...JSON.parse(nextValue) }))
          }}
        />
        {
          verticalAlign && 
          <>
            <div style={{ height: 24, background: 'rgb(229, 229, 229)', width: 1 }}></div>
            <Align
              key={'vertical'}
              value={verticalValue}
              options={[
                { key: VerticalMap.top, desc: '垂直居上', icon: <svg width="16" height="16" viewBox="0 0 16 16" xmlns="http://www.w3.org/2000/svg"><path d="M15 1H1v1h14V1zM7.854 3.646L7.5 3.293l-.354.353-3 3 .708.708L7 5.207V13h1V5.207l2.146 2.147.708-.708-3-3z" fill="#000" stroke="none"></path></svg> },
                { key: VerticalMap.center, desc: '垂直居中', icon: <svg width="16" height="16" viewBox="0 0 16 16" xmlns="http://www.w3.org/2000/svg"><path d="M7.5 5.707l.354-.353 2-2-.708-.708L8 3.793V.5H7v3.293L5.854 2.646l-.708.708 2 2 .354.353zm0 3.586l.354.353 2 2-.708.708L8 11.207V14.5H7v-3.293l-1.146 1.147-.708-.708 2-2 .354-.353zM1 8h13V7H1v1z" fill="#000" stroke="none"></path></svg> },
                { key: VerticalMap.bottom, desc: '垂直居下', icon: <svg width="16" height="16" viewBox="0 0 16 16" xmlns="http://www.w3.org/2000/svg"><path d="M7.854 12.354l-.354.353-.354-.353-3-3 .708-.708L7 10.793V3h1v7.793l2.146-2.147.708.708-3 3zM15 14v1H1v-1h14z" fill="#000" stroke="none"></path></svg> },
              ]}
              onSelect={(nextValue) => {
                setState(c => ({ ...c, ...JSON.parse(nextValue) }))
              }}
            />
          </>
        }
      </div>
    </div>
  )
}
