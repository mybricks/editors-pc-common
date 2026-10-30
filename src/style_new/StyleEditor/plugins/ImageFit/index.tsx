import React, { useEffect, useState } from 'react'
import { Panel, Select } from '../../components'
import { useEffectiveStyleValue, useStyleChange, useStyleClear, useStyleEditorContext } from '../../context'
import type { ChangeEvent, PanelBaseProps } from '../../type'
import lang from '../../../index.i18n'

const IMAGE_FIT_KEYS = ['objectFit', 'objectPosition'] as const

export function ImageFit({ onChange: fallbackOnChange, showTitle, collapse }:
  Pick<PanelBaseProps, 'showTitle' | 'collapse'> & { onChange: ChangeEvent }) {
  const onChange = useStyleChange(fallbackOnChange)
  const { clear } = useStyleClear(IMAGE_FIT_KEYS, { mode: 'remove-declaration', fallbackOnChange })
  const context = useStyleEditorContext()
  const targetDom = context?.targetDom
  const effectiveValue = useEffectiveStyleValue()
  const value = {
    objectFit: effectiveValue.objectFit || '',
    objectPosition: effectiveValue.objectPosition || ''
  }
  // 保留生效值回显，仅把 unset 和未声明时的浏览器初始值显示为默认。
  IMAGE_FIT_KEYS.forEach(key => {
    const source = context?.effectiveStyle?.[key]
    if (/^unset$/i.test(String(source?.value).trim()) ||
      (source?.type === 'computed' && value[key] === (key === 'objectFit' ? 'fill' : '50% 50%'))) {
      value[key] = ''
    }
  })
  const [imageStyle, setImageStyle] = useState(() => ({
    objectFit: value.objectFit, objectPosition: value.objectPosition
  }))
  // 点击加号的临时展开仍由 Panel 自己维护。
  const effectiveCollapse = !imageStyle.objectFit && !imageStyle.objectPosition
    ? true
    : collapse === 'inherited' ? 'inherited' : false

  useEffect(() => {
    setImageStyle({ objectFit: value.objectFit, objectPosition: value.objectPosition })
  }, [targetDom, value.objectFit, value.objectPosition])

  if (targetDom?.tagName !== 'IMG') return null

  const fitOptions = [
    { value: '', label: lang.imageStyleDefault },
    { value: 'fill', label: lang.imageFitFill },
    { value: 'contain', label: lang.imageFitContain },
    { value: 'cover', label: lang.imageFitCover },
    { value: 'none', label: lang.imageFitNone },
    { value: 'scale-down', label: lang.imageFitScaleDown },
  ]
  const positionOptions = [
    { value: '', label: lang.imageStyleDefault },
    { value: '0% 0%', label: lang.imagePositionTopLeft },
    { value: '50% 0%', label: lang.imagePositionTop },
    { value: '100% 0%', label: lang.imagePositionTopRight },
    { value: '0% 50%', label: lang.imagePositionLeft },
    { value: '50% 50%', label: lang.imagePositionCenter },
    { value: '100% 50%', label: lang.imagePositionRight },
    { value: '0% 100%', label: lang.imagePositionBottomLeft },
    { value: '50% 100%', label: lang.imagePositionBottom },
    { value: '100% 100%', label: lang.imagePositionBottomRight },
  ]
  const fields = [
    { key: 'objectFit' as const, label: lang.imageFitLabel, options: fitOptions },
    { key: 'objectPosition' as const, label: lang.imageFitAlignLabel,
      options: positionOptions.some(({ value }) => value === imageStyle.objectPosition)
        ? positionOptions
        : [...positionOptions, { value: imageStyle.objectPosition, label: imageStyle.objectPosition }] },
  ]

  // 单项默认和整组清空都交给公共链路决定删除声明或写入 unset。
  return (
    <Panel title={lang.imageFitPanelTitle} showTitle={showTitle} collapse={effectiveCollapse} showDelete={!!clear}
      resetFunction={() => {
        clear?.()
        setImageStyle({ objectFit: '', objectPosition: '' })
      }}>
      <Panel.Content style={{ flexDirection: 'column', gap: 10 }}>
        {fields.filter(field => field.key !== 'objectPosition' || imageStyle.objectFit !== 'fill').map(field => (
          <div key={field.key} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ width: 24, flexShrink: 0, fontSize: 11, color: 'var(--mybricks-text-color-secondary, #999)' }}>{field.label}</span>
            <div style={{ flex: 1, minWidth: 0 }}>
              <Select
                style={{ padding: '0 8px 0 0' }}
                value={imageStyle[field.key]}
                options={field.options}
                onChange={value => {
                  onChange({ key: field.key, value: value === '' ? null : value })
                  setImageStyle(previous => ({ ...previous, [field.key]: value }))
                }}
              />
            </div>
          </div>
        ))}
      </Panel.Content>
    </Panel>
  )
}
