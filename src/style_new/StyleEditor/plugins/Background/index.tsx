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
  keyMap: {}
}

export function Background ({value, onChange, config}: BackgroundProps) {
  const context = useStyleEditorContext()
  const [{disableBackgroundColor, disableBackgroundImage, keyMap}] = useState(Object.assign(DEFAULT_CONFIG, config))

  return (
    <Panel title='背景'>
      {disableBackgroundColor ? null : (
        <Panel.Content>
          <ColorEditor
            defaultValue={value.backgroundColor}
            onChange={(value) => onChange({key: getRealKey(keyMap, 'backgroundColor'), value})}
          />
        </Panel.Content>
      )}
      {disableBackgroundImage ? null : (
        <Panel.Content>
          <Image
            defaultValue={{
              backgroundImage: value.backgroundImage,
              backgroundRepeat: value.backgroundRepeat,
              backgroundPosition: value.backgroundPosition,
              backgroundSize: value.backgroundSize
            }}
            onChange={(value) => onChange({key: getRealKey(keyMap, value.key), value: value.value})}
            upload={context.upload}
          />
        </Panel.Content>
      )}
    </Panel>
  )
}