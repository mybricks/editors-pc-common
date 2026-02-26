import React, { useState, useRef, CSSProperties, useCallback, useEffect } from 'react'
import { createPortal } from 'react-dom'

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
  BoxShadowSpreadRadiusOutlined,
  ReloadOutlined,
} from '../../components'
import { useUpdateEffect, useDragNumber } from '../../hooks'

import type { ChangeEvent, PanelBaseProps } from '../../type'
import isEqual from 'lodash/isEqual';
import css from './index.less'

interface BoxShadowProps extends PanelBaseProps {
  value: CSSProperties
  onChange: ChangeEvent
}

const INSET_OPTIONS = [
  { label: '内阴影', value: true },
  { label: '外阴影', value: false }
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

const CloseIcon = (
  <svg viewBox='64 64 896 896' focusable='false' width='10' height='10' fill='currentColor' aria-hidden='true'>
    <path d='M563.8 512l262.5-312.9c4.4-5.2.7-13.1-6.1-13.1h-79.8c-4.7 0-9.2 2.1-12.3 5.7L511.6 449.8 295.1 191.7c-3-3.6-7.5-5.7-12.3-5.7H203c-6.8 0-10.5 7.9-6.1 13.1L459.4 512 196.9 824.9A7.95 7.95 0 00203 838h79.8c4.7 0 9.2-2.1 12.3-5.7l216.5-258.1 216.5 258.1c3 3.6 7.5 5.7 12.3 5.7h79.8c6.8 0 10.5-7.9 6.1-13.1L563.8 512z'></path>
  </svg>
)

const selectStyle = { backgroundColor: '#fff', border: '1px solid #e6e6e6' }


export function BoxShadow({ value, onChange, config, showTitle, collapse }: BoxShadowProps) {
  const [boxShadowValues, setBoxShadowValues] = useState<boxShadowType>(getInitValue(value.boxShadow))
  const [forceRenderKey, setForceRenderKey] = useState<number>(Math.random()); // 用于点击重置按钮重新渲染获取新value
  const isResettingRef = useRef(false);
  // 记录最后一次由内部写出的 CSS 值，用于区分外部变更，避免同步循环
  const lastSentValueRef = useRef<string | null | undefined>(value.boxShadow);
  const getDragProps = useDragNumber({ continuous: true })

  const [popupOpen, setPopupOpen] = useState(false)
  const [showPopup, setShowPopup] = useState(false)
  const triggerRef = useRef<HTMLDivElement>(null)
  const popupChildRef = useRef<HTMLDivElement>(null)

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
    let cssValue = inset ? 'inset ' : ''
    cssValue += `${offsetX} ${offsetY} ${blurRadius} ${spreadRadius} ${color}`
    lastSentValueRef.current = cssValue;
    onChange({ key: 'boxShadow', value: cssValue })
  }, [boxShadowValues]);

  // 监听外部对 value.boxShadow 的变更（如弹窗中修改），同步到本地状态
  useEffect(() => {
    if (value.boxShadow === lastSentValueRef.current) return;
    const newValues = getInitValue(value.boxShadow);
    setBoxShadowValues(prev => (isEqual(prev, newValues) ? prev : newValues));
    setForceRenderKey(prev => prev + 1);
  }, [value.boxShadow]);

  const refresh = useCallback(() => {
    isResettingRef.current = true;
    lastSentValueRef.current = null;
    onChange({ key: 'boxShadow', value: null });
    setBoxShadowValues(defaultValue);
    setForceRenderKey(prev => prev + 1);
  }, [onChange]);

  const handleTriggerClick = useCallback(() => {
    setShowPopup(true)
    setPopupOpen(prev => !prev)
  }, [])

  useEffect(() => {
    if (!popupOpen) return
    const handleClickOutside = (event: MouseEvent) => {
      if (
        !popupChildRef.current?.contains(event.target as Node) &&
        !triggerRef.current?.contains(event.target as Node) &&
        !(event.target as Element)?.closest?.('[data-dropdown-portal="true"]')
      ) {
        setPopupOpen(false)
      }
    }
    setTimeout(() => document.addEventListener('click', handleClickOutside))
    return () => document.removeEventListener('click', handleClickOutside)
  }, [popupOpen])

  return (
    <Panel title='阴影' showTitle={showTitle} showReset={true} resetFunction={refresh} collapse={collapse}>
      <React.Fragment key={forceRenderKey}>
        <Panel.Content>
          <div
            ref={triggerRef}
            className={`${css.trigger}${popupOpen ? ` ${css.triggerActive}` : ''}`}
            onClick={handleTriggerClick}
          >
            {boxShadowValues.inset ? <BoxShadowInnerOutlined /> : <BoxShadowOuterOutlined />}
          </div>
          <Select
            tip='扩散方式'
            style={{ width: '100%', ...selectStyle }}
            value={boxShadowValues.inset}
            options={INSET_OPTIONS}
            //prefix={boxShadowValues.inset ? <BoxShadowInnerOutlined /> : <BoxShadowOuterOutlined />}
            onChange={(value) => setBoxShadowValues((boxShadowValues) => {
              return {
                ...boxShadowValues,
                inset: value
              }
            })}
          />
        </Panel.Content>
        {/* <Panel.Content>
          <Select
            tip='扩散方式'
            style={{ width: 98 }}
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
            style={{ flex: '1 1 0%' }}
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
            style={{ flex: '1 1 0%' }}
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
        </Panel.Content> */}
        {/* <Panel.Content>
          <ColorEditor
            // tip='颜色'
            style={{ width: 140 }}
            defaultValue={boxShadowValues.color}
            showSubTabs={false}
            onChange={(value) => setBoxShadowValues((boxShadowValues) => {
              return {
                ...boxShadowValues,
                color: value as string
              }
            })}
          />
          <InputNumber
            tip='模糊'
            style={{ flex: '1 1 0%' }}
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
            style={{ flex: '1 1 0%' }}
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
          <div style={{ width: "21px" }}/>
        </Panel.Content> */}


        {showPopup && (createPortal(
          <BoxShadowSketch
            open={popupOpen}
            positionElementRef={triggerRef}
            childRef={popupChildRef}
            values={boxShadowValues}
            onChange={setBoxShadowValues}
            onClose={() => setPopupOpen(false)}
            onReset={refresh}
          />,
          document.body
        ) as unknown as React.ReactNode)}
      </React.Fragment>
    </Panel>
  )
}

interface BoxShadowSketchProps {
  open: boolean
  positionElementRef: React.RefObject<HTMLDivElement>
  childRef: React.RefObject<HTMLDivElement>
  values: boxShadowType
  onChange: React.Dispatch<React.SetStateAction<boxShadowType>>
  onClose: () => void
  onReset: () => void
}

function BoxShadowSketch({
  open,
  positionElementRef,
  childRef,
  values,
  onChange,
  onClose,
  onReset,
}: BoxShadowSketchProps) {
  const getDragProps = useDragNumber({ continuous: true })

  useEffect(() => {
    const container = childRef.current
    const positionElement = positionElementRef.current
    if (!container || !positionElement) return

    if (open) {
      const posRect = positionElement.getBoundingClientRect()
      const containerRect = container.getBoundingClientRect()

      let top = posRect.top
      if (top + containerRect.height > window.innerHeight) {
        top = top - containerRect.height + posRect.height
      }

      container.style.top = top + 'px'
      container.style.right = (window.innerWidth - posRect.left) + 'px'
      container.style.visibility = 'visible'
    } else {
      container.style.visibility = 'hidden'
    }
  }, [open])

  const update = useCallback((key: keyof boxShadowType) => (value: any) => {
    onChange(prev => ({ ...prev, [key]: value }))
  }, [onChange])

  return (
    <div ref={childRef} className={css.shadowSketch} onFocus={(e) => e.stopPropagation()}>
      <div className={css.shadowHeader}>
        <Select
          value={values.inset}
          options={INSET_OPTIONS}
          onChange={update('inset')}
          style={{ ...selectStyle, width: '50%' }}
        />
        <button className={css.shadowHeaderBtn} data-mybricks-tip='关闭' onClick={onClose}>
          {CloseIcon}
        </button>
      </div>

      <div className={css.shadowRow}>
        <span className={css.shadowLabel}>位置</span>
        <InputNumber
          style={{ flex: 1 }}
          prefix={
            <div {...getDragProps(values.offsetX, '拖拽调整x轴偏移')}>
              <div className={css.shadowLabelIcon}>X</div>
            </div>
          }
          defaultValue={values.offsetX}
          onChange={update('offsetX')}
        />
      </div>

      <div className={css.shadowRow}>
        <span className={css.shadowLabel}></span>
        <InputNumber
          style={{ flex: 1 }}
          prefix={
            <div {...getDragProps(values.offsetY, '拖拽调整y轴偏移')}>
              <div className={css.shadowLabelIcon}>Y</div>
            </div>
          }
          defaultValue={values.offsetY}
          onChange={update('offsetY')}
        />
      </div>

      <div className={css.shadowRow}>
        <span className={css.shadowLabel}>模糊</span>
        <InputNumber
          style={{ flex: 1 }}
          prefix={
            <div {...getDragProps(values.blurRadius, '拖拽调整模糊半径')}>
              <div className={css.shadowLabelIcon}>
              <BoxShadowBlurRadiusOutlined />
              </div>
            </div>
          }
          defaultValue={values.blurRadius}
          onChange={update('blurRadius')}
        />
      </div>

      <div className={css.shadowRow}>
        <span className={css.shadowLabel}>扩散</span>
        <InputNumber
          style={{ flex: 1 }}
          prefix={
            <div {...getDragProps(values.spreadRadius, '拖拽调整扩散半径')}>
              <div className={css.shadowLabelIcon}>
              <BoxShadowSpreadRadiusOutlined />
              </div>
            </div>
          }
          defaultValue={values.spreadRadius}
          onChange={update('spreadRadius')}
        />
      </div>

      <div className={css.shadowRow}>
        <span className={css.shadowLabel}>颜色</span>
        <ColorEditor
          style={{ flex: 1 }}
          defaultValue={values.color}
          showSubTabs={false}
          onChange={(value) => onChange(prev => ({ ...prev, color: value as string }))}
        />
      </div>
    </div>
  )
}

function getInitValue(boxShadow: string | undefined) {
  const result = { ...defaultValue };

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
