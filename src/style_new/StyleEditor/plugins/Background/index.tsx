import React, { useState, CSSProperties } from 'react'

import { getRealKey } from '../../utils'
import { useStyleEditorContext } from '../..'
import { Panel, Image, ColorEditor } from '../../components'


interface BackgroundProps {
  value: CSSProperties
  onChange: (value: {key: string, value: any}) => void
  config: {
    [key: string]: any
  }
}

const DEFAULT_CONFIG = {
  disableBackgroundColor: false,
  disableBackgroundImage: false,
  keyMap: {},
  useImportant: false
}

export function Background ({value, onChange, config}: BackgroundProps) {
  const context = useStyleEditorContext()
  const [{
    keyMap,
    useImportant,
    disableBackgroundColor,
    disableBackgroundImage,
  }] = useState({ ...DEFAULT_CONFIG, ...config })

  return (
    <Panel title='背景'>
      {disableBackgroundColor ? null : (
        <Panel.Content>
          <ColorEditor
            // tip='背景色'
            // TODO
            // @ts-ignore
            defaultValue={value[getRealKey(keyMap, 'backgroundColor')] || value.backgroundColor}
            onChange={(value) => onChange({key: getRealKey(keyMap, 'backgroundColor'), value: `${value}${useImportant ? '!important' : ''}`})}
          />
        </Panel.Content>
      )}
      {disableBackgroundImage ? null : (
        <Panel.Content>
          <Image
            tip='背景图'
            defaultValue={{
              backgroundImage: value.backgroundImage,
              backgroundRepeat: value.backgroundRepeat,
              backgroundPosition: value.backgroundPosition,
              backgroundSize: value.backgroundSize
            }}
            onChange={(value) => onChange({key: getRealKey(keyMap, value.key), value: `${value.value}${useImportant ? '!important' : ''}`})}
            upload={context.upload}
          />
        </Panel.Content>
      )}
    </Panel>
  )
}
