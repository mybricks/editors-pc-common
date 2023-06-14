import React, { CSSProperties, useState } from 'react'

import { Panel, Image, ColorEditor } from '../../components'

import { useStyleEditorContext } from '../..'

interface BackgroundProps {
  value: CSSProperties
  onChange: (value: {key: string, value: any}) => void
  config: {
    [key: string]: any
  }
}

const DEFAULT_CONFIG = {
  disableBackgroundColor: false,
  disableBackgroundImage: false
}

export function Background ({value, onChange, config}: BackgroundProps) {
  const context = useStyleEditorContext()
  const [cfg] = useState(Object.assign(DEFAULT_CONFIG, config))

  return (
    <Panel title='背景'>
      {cfg.disableBackgroundColor ? null : (
        <Panel.Content>
          <ColorEditor
            defaultValue={value.backgroundColor}
            onChange={(value) => onChange({key: 'backgroundColor', value})}
          />
        </Panel.Content>
      )}
      {cfg.disableBackgroundImage ? null : (
        <Panel.Content>
          <Image
            defaultValue={{
              backgroundImage: value.backgroundImage,
              backgroundRepeat: value.backgroundRepeat,
              backgroundPosition: value.backgroundPosition,
              backgroundSize: value.backgroundSize
            }}
            onChange={onChange}
            upload={context.upload}
          />
        </Panel.Content>
      )}
    </Panel>
  )
}
