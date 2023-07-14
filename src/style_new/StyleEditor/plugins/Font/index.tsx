import React, {
  useState,
  useCallback,
  CSSProperties
} from 'react'

import {
  Panel,
  Select,
  Toggle,
  ColorEditor,
  InputNumber,
  FontSizeOutlined,
  FontWeightOutlined,
  LineHeightOutlined,
  FontFamilyOutlined,
  LetterSpacingOutlined,
  TextAlignLeftOutlined,
  TextAlignRightOutlined,
  TextAlignCenterOutlined
} from '../../components'

interface FontProps {
  value: CSSProperties
  onChange: (value: {key: string, value: any}) => void
  config: {
    [key: string]: any
  }
}

/** 字体选项 */
const FONT_FAMILY_OPTIONS = [
  { label: '继承', value: 'inherit' }
]

/** 字体加粗(原先的需求对标的某个app，忘了) */
const FONT_WEIGHT_OPTIONS = [
  {label: '极细', value: '100'},
  {label: '特细', value: '200'},
  {label: '细', value: '300'},
  {label: '标准', value: '400'},
  {label: '中黑', value: '500'},
  {label: '中粗', value: '700'},
  {label: '特粗', value: '900'},
  {label: '继承', value: 'inherit'}
]

const FONT_SIZE_OPTIONS = [
  {label: 'px', value: 'px'},
  {label: '继承', value: 'inherit'},
]
const FONT_SIZE_DISABLED_LIST = ['inherit']

const LINEHEIGHT_UNIT_OPTIONS = [
  {label: '倍数', value: ''},
  {label: 'px', value: 'px'},
  {label: '%', value: '%'},
  {label: '继承', value: 'inherit'},
  {label: '默认', value: 'normal'},
]
const LINEHEIGHT_UNIT_DISABLED_LIST = ['normal', 'inherit']
const LETTERSPACING_UNIT_OPTIONS = [
  {label: 'px', value: 'px'},
  {label: '继承', value: 'inherit'},
  {label: '默认', value: 'normal'},
]
const LETTERSPACING_UNIT_DISABLED_LIST = ['normal', 'inherit']

const DEFAULT_CONFIG = {
  disableTextAlign: false,
  fontfaces: []
}

export function Font ({value, onChange, config}: FontProps) {
  const [cfg] = useState(Object.assign(DEFAULT_CONFIG, config))

  const fontFamilyOptions = useCallback(() => {
    const fontfaces = (cfg.fontfaces as typeof FONT_FAMILY_OPTIONS).filter((item) => item.label && item.value)
    return [...FONT_FAMILY_OPTIONS, ...fontfaces]
  }, [])

  const getTextAlignOptions = useCallback(() => {
    const useStart = ['start', 'end'].includes(value.textAlign as any)

    return [
      { label: <TextAlignLeftOutlined />, value: useStart ? 'start' : 'left', tip: '居左对齐' },
      { label: <TextAlignCenterOutlined />, value: 'center', tip: '居中对齐' },
      { label: <TextAlignRightOutlined />, value: useStart ? 'end' : 'right', tip: '居右对齐' }
    ]
  }, [])

  return (
    <Panel title='字体'>
      <Panel.Content>
        <Select
          tip='字体'
          prefix={<FontFamilyOutlined />}
          style={{flexBasis: '50%', padding: 0, overflow: 'hidden'}}
          defaultValue={value.fontFamily}
          options={fontFamilyOptions()}
          onChange={(value) => onChange({key: 'fontFamily', value})}
        />
        <ColorEditor
          style={{flexBasis: '50%'}}
          defaultValue={value.color}
          onChange={(value) => onChange({key: 'color', value})}
        />
      </Panel.Content>
      <Panel.Content>
        <Select
          tip='粗细'
          prefix={<FontWeightOutlined />}
          style={{flexBasis: '50%', padding: 0, overflow: 'hidden'}}
          defaultValue={value.fontWeight}
          options={FONT_WEIGHT_OPTIONS}
          onChange={(value) => onChange({key: 'fontWeight', value})}
        />
        <InputNumber
          tip='大小'
          style={{flexBasis: '50%'}}
          prefix={<FontSizeOutlined />}
          defaultValue={value.fontSize}
          unitOptions={FONT_SIZE_OPTIONS}
          unitDisabledList={FONT_SIZE_DISABLED_LIST}
          onChange={(value) => onChange({key: 'fontSize', value})}
        />
      </Panel.Content>
      <Panel.Content>
        <InputNumber
          tip='行高'
          prefix={<LineHeightOutlined />}
          defaultValue={value.lineHeight}
          defaultUnitValue='inherit'
          unitOptions={LINEHEIGHT_UNIT_OPTIONS}
          unitDisabledList={LINEHEIGHT_UNIT_DISABLED_LIST}
          onChange={(value) => onChange({key: 'lineHeight', value})}
        />
        <InputNumber
          tip='间距'
          prefix={<LetterSpacingOutlined />}
          defaultValue={value.letterSpacing}
          unitOptions={LETTERSPACING_UNIT_OPTIONS}
          unitDisabledList={LETTERSPACING_UNIT_DISABLED_LIST}
          onChange={(value) => onChange({key: 'letterSpacing', value})}
        />
      </Panel.Content>
      {cfg.disableTextAlign ? null : (
        <Panel.Content>
          <Toggle
            defaultValue={value.textAlign}
            options={getTextAlignOptions()}
            onChange={(value) => onChange({key: 'textAlign', value})}
          />
        </Panel.Content>
      )}
    </Panel>
  )
}
