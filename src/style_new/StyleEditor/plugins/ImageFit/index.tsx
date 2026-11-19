import React, { useEffect, useMemo, useState } from 'react'
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
  const { objectFit, objectPosition } = useMemo(() => {
    let objectFit = effectiveValue.objectFit || ''
    let objectPosition = effectiveValue.objectPosition || ''
    const fitSource = context?.effectiveStyle?.objectFit
    const positionSource = context?.effectiveStyle?.objectPosition
    // 未声明或已清空时保持未配置，计算值不作为展开依据。
    if (/^unset$/i.test(String(fitSource?.value).trim()) ||
      fitSource?.type === 'computed') {
      objectFit = ''
    }
    if (/^unset$/i.test(String(positionSource?.value).trim()) ||
      positionSource?.type === 'computed') {
      objectPosition = ''
    }
    return { objectFit, objectPosition }
  }, [effectiveValue, context?.effectiveStyle])
  const [imageStyle, setImageStyle] = useState(() => ({
    objectFit, objectPosition
  }))
  const displayObjectFit = imageStyle.objectFit || 'fill'
  const displayObjectPosition = imageStyle.objectPosition || '50% 50%'
  const effectiveCollapse = !imageStyle.objectFit && !imageStyle.objectPosition
    ? true
    : collapse === 'inherited' ? 'inherited' : false

  useEffect(() => {
    setImageStyle({ objectFit, objectPosition })
  }, [targetDom, objectFit, objectPosition])

  const langType = (window as any).__lang_type__
  const fitOptions = useMemo(() => [
    { value: 'fill', label: lang.imageFitFill },
    { value: 'contain', label: lang.imageFitContain },
    { value: 'cover', label: lang.imageFitCover },
    { value: 'none', label: lang.imageFitNone },
    { value: 'scale-down', label: lang.imageFitScaleDown },
  ], [langType])
  const positionOptions = useMemo(() => [
    { value: '0% 0%', label: lang.imagePositionTopLeft },
    { value: '50% 0%', label: lang.imagePositionTop },
    { value: '100% 0%', label: lang.imagePositionTopRight },
    { value: '0% 50%', label: lang.imagePositionLeft },
    { value: '50% 50%', label: lang.imagePositionCenter },
    { value: '100% 50%', label: lang.imagePositionRight },
    { value: '0% 100%', label: lang.imagePositionBottomLeft },
    { value: '50% 100%', label: lang.imagePositionBottom },
    { value: '100% 100%', label: lang.imagePositionBottomRight },
  ], [langType])
  const fields = useMemo(() => [
    { key: 'objectFit' as const, label: lang.imageFitLabel, options: fitOptions },
    { key: 'objectPosition' as const, label: lang.imageFitAlignLabel,
      options: positionOptions.some(({ value }) => value === displayObjectPosition)
        ? positionOptions
        : [...positionOptions, { value: displayObjectPosition, label: displayObjectPosition }] },
  ], [fitOptions, positionOptions, displayObjectPosition])

  if (targetDom?.tagName !== 'IMG') return null

  // 整组清空交给公共链路决定删除声明或写入 unset。
  return (
    <Panel title={lang.imageFitPanelTitle} showTitle={showTitle} collapse={effectiveCollapse} showDelete={!!clear}
      onExpand={() => {
        // 点击加号即新增配置，两项初始值一起走现有样式写入链路。
        onChange([
          { key: 'objectFit', value: displayObjectFit },
          { key: 'objectPosition', value: displayObjectPosition },
        ])
        setImageStyle({ objectFit: displayObjectFit, objectPosition: displayObjectPosition })
      }}
      resetFunction={() => {
        clear?.()
        setImageStyle({ objectFit: '', objectPosition: '' })
      }}>
      <Panel.Content style={{ display: 'grid', gridTemplateColumns: 'max-content minmax(0, 1fr)', alignItems: 'center', rowGap: 10, columnGap: 8 }}>
        {fields.filter(field => field.key !== 'objectPosition' || displayObjectFit !== 'fill').map(field => (
          <React.Fragment key={field.key}>
            <span style={{ padding: '0 4px', whiteSpace: 'nowrap', fontSize: 11, color: 'var(--mybricks-text-color-main, #333)' }}>{field.label}</span>
            <div style={{ minWidth: 0 }}>
              <Select
                style={{ padding: '0 8px 0 0' }}
                value={field.key === 'objectFit' ? displayObjectFit : displayObjectPosition}
                options={field.options}
                onChange={value => {
                  onChange({ key: field.key, value })
                  setImageStyle(previous => ({ ...previous, [field.key]: value }))
                }}
              />
            </div>
          </React.Fragment>
        ))}
      </Panel.Content>
    </Panel>
  )
}
